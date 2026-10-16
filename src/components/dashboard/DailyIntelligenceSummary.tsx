import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  MessageSquare,
  Globe,
  BarChart3,
  Clock,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { subHours, subDays, format, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface DailyIntelligenceSummaryProps {
  projectId: string;
  projectName: string;
}

interface DailyStats {
  totalMentions: number;
  last24h: number;
  sentimentBreakdown: {
    positivo: number;
    negativo: number;
    neutral: number;
  };
  topSources: { domain: string; count: number }[];
  topKeywords: { keyword: string; count: number }[];
  alerts: string[];
}

interface AISummary {
  headline: string;
  highlights: string[];
  alerts: string[];
  recommendation: string;
}

export function DailyIntelligenceSummary({ projectId, projectName }: DailyIntelligenceSummaryProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);

  // Fetch mentions from last 24 hours and 7 days
  const { data: mentions, isLoading } = useQuery({
    queryKey: ["daily-summary-mentions", projectId],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7);
      
      const { data, error } = await supabase
        .from("mentions")
        .select("id, title, description, source_domain, sentiment, matched_keywords, created_at, published_at")
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .gte("created_at", sevenDaysAgo.toISOString());

      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  // Calculate stats
  const stats = useMemo((): DailyStats => {
    if (!mentions) {
      return {
        totalMentions: 0,
        last24h: 0,
        sentimentBreakdown: { positivo: 0, negativo: 0, neutral: 0 },
        topSources: [],
        topKeywords: [],
        alerts: [],
      };
    }

    const now = new Date();
    const yesterday = subHours(now, 24);

    const last24hMentions = mentions.filter(m => 
      isWithinInterval(new Date(m.created_at), { start: yesterday, end: now })
    );

    const sentimentBreakdown = {
      positivo: mentions.filter(m => m.sentiment === "positivo").length,
      negativo: mentions.filter(m => m.sentiment === "negativo").length,
      neutral: mentions.filter(m => m.sentiment === "neutral").length,
    };

    // Top sources
    const sourceCount: Record<string, number> = {};
    last24hMentions.forEach(m => {
      if (m.source_domain) {
        sourceCount[m.source_domain] = (sourceCount[m.source_domain] || 0) + 1;
      }
    });
    const topSources = Object.entries(sourceCount)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top keywords
    const keywordCount: Record<string, number> = {};
    last24hMentions.forEach(m => {
      (m.matched_keywords || []).forEach((kw: string) => {
        keywordCount[kw] = (keywordCount[kw] || 0) + 1;
      });
    });
    const topKeywords = Object.entries(keywordCount)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Generate alerts
    const alerts: string[] = [];
    const negativePercent = mentions.length > 0 
      ? (sentimentBreakdown.negativo / mentions.length) * 100 
      : 0;
    
    if (negativePercent > 20) {
      alerts.push(`Alto porcentaje de menciones negativas (${negativePercent.toFixed(1)}%)`);
    }
    if (last24hMentions.length === 0) {
      alerts.push("No se detectaron nuevas menciones en las últimas 24 horas");
    }

    return {
      totalMentions: mentions.length,
      last24h: last24hMentions.length,
      sentimentBreakdown,
      topSources,
      topKeywords,
      alerts,
    };
  }, [mentions]);

  // Generate AI summary
  const generateAISummary = async () => {
    if (!mentions || mentions.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay menciones para generar el resumen",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAI(true);
    try {
      const now = new Date();
      const yesterday = subHours(now, 24);
      const recentMentions = mentions.filter(m => 
        isWithinInterval(new Date(m.created_at), { start: yesterday, end: now })
      );

      const { data, error } = await supabase.functions.invoke("generate-smart-report", {
        body: {
          mentions: recentMentions.slice(0, 30).map(m => ({
            id: m.id,
            title: m.title,
            description: m.description,
            source_domain: m.source_domain,
            sentiment: m.sentiment,
            matched_keywords: m.matched_keywords,
            created_at: m.created_at,
          })),
          reportType: "brief",
          extension: "micro",
          projectName,
          projectAudience: "Equipo interno de monitoreo",
          projectObjective: "Resumen ejecutivo diario",
          dateRange: {
            start: yesterday.toISOString(),
            end: now.toISOString(),
            label: "Últimas 24 horas",
          },
        },
      });

      if (error) throw error;

      if (data?.title) {
        setAiSummary({
          headline: data.title,
          highlights: data.keyFindings?.slice(0, 3) || [],
          alerts: data.recommendations?.filter((r: string) => r.toLowerCase().includes("alerta") || r.toLowerCase().includes("urgente")) || [],
          recommendation: data.recommendations?.[0] || "",
        });
      }
    } catch (err) {
      console.error("Error generating AI summary:", err);
      toast({
        title: "Error",
        description: "No se pudo generar el resumen inteligente",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const negativePercent = stats.totalMentions > 0 
    ? (stats.sentimentBreakdown.negativo / stats.totalMentions) * 100 
    : 0;
  const positivePercent = stats.totalMentions > 0
    ? (stats.sentimentBreakdown.positivo / stats.totalMentions) * 100
    : 0;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Resumen de Inteligencia</CardTitle>
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Últimas 24 horas • {format(new Date(), "dd MMM, HH:mm", { locale: es })}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generateAISummary}
            disabled={isGeneratingAI}
          >
            {isGeneratingAI ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {aiSummary ? "Actualizar" : "Generar resumen IA"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs">Últimas 24h</span>
            </div>
            <p className="text-2xl font-bold">{stats.last24h}</p>
          </div>

          <div className="p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">7 días</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalMentions}</p>
          </div>

          <div className="p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs">Positivas</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{positivePercent.toFixed(0)}%</p>
          </div>

          <div className="p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs">Negativas</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{negativePercent.toFixed(0)}%</p>
          </div>
        </div>

        {/* Alerts */}
        {stats.alerts.length > 0 && (
          <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {stats.alerts.map((alert, i) => (
                <span key={i} className="block">{alert}</span>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* AI Summary */}
        {aiSummary && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm text-primary">Análisis IA</span>
            </div>
            <p className="font-medium mb-2">{aiSummary.headline}</p>
            {aiSummary.highlights.length > 0 && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {aiSummary.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {h}
                  </li>
                ))}
              </ul>
            )}
            {aiSummary.recommendation && (
              <p className="mt-2 text-sm italic text-muted-foreground">
                💡 {aiSummary.recommendation}
              </p>
            )}
          </div>
        )}

        {/* Top Sources & Keywords */}
        {(stats.topSources.length > 0 || stats.topKeywords.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4">
            {stats.topSources.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  Fuentes principales (24h)
                </div>
                <div className="flex flex-wrap gap-1">
                  {stats.topSources.map((s) => (
                    <Badge key={s.domain} variant="secondary" className="text-xs">
                      {s.domain.replace(/^www\./, "").split(".")[0]} ({s.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {stats.topKeywords.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Keywords activos (24h)
                </div>
                <div className="flex flex-wrap gap-1">
                  {stats.topKeywords.map((k) => (
                    <Badge key={k.keyword} variant="outline" className="text-xs">
                      {k.keyword} ({k.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard/panorama")}
            className="gap-1"
          >
            Ver Panorama
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard/fuentes")}
            className="gap-1"
          >
            Recopilar menciones
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard/reportes")}
            className="gap-1"
          >
            Generar reporte
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
