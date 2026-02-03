import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Mention } from "@/hooks/useMentions";
import { format, min, max } from "date-fns";
import { es } from "date-fns/locale";
import {
  Database,
  Globe,
  Calendar,
  TrendingUp,
  ArrowRight,
  Info,
  Hash,
  Newspaper,
  Twitter,
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
} from "lucide-react";

interface MentionsSummaryCardProps {
  mentions: Mention[];
  projectName: string;
  onPlatformClick?: (platform: string, label: string) => void;
  onSentimentClick?: (sentiment: string, label: string) => void;
}

interface PlatformInfo {
  name: string;
  count: number;
  icon: React.ReactNode;
  color: string;
}

function categorizeSource(domain: string | null): string {
  if (!domain) return "other";
  const d = domain.toLowerCase();
  if (d.includes("twitter") || d.includes("x.com")) return "twitter";
  if (d.includes("facebook") || d.includes("fb.com")) return "facebook";
  if (d.includes("instagram")) return "instagram";
  if (d.includes("tiktok")) return "tiktok";
  if (d.includes("youtube") || d.includes("youtu.be")) return "youtube";
  if (d.includes("linkedin")) return "linkedin";
  if (d.includes("reddit")) return "reddit";
  return "news";
}

const PLATFORM_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  twitter: { label: "Twitter/X", icon: Twitter, color: "bg-sky-500" },
  facebook: { label: "Facebook", icon: Facebook, color: "bg-blue-600" },
  instagram: { label: "Instagram", icon: Instagram, color: "bg-pink-500" },
  youtube: { label: "YouTube", icon: Youtube, color: "bg-red-500" },
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "bg-blue-700" },
  tiktok: { label: "TikTok", icon: Hash, color: "bg-black" },
  reddit: { label: "Reddit", icon: Globe, color: "bg-orange-500" },
  news: { label: "Medios digitales", icon: Newspaper, color: "bg-gray-500" },
  other: { label: "Otros", icon: Globe, color: "bg-gray-400" },
};

export function MentionsSummaryCard({ mentions, projectName, onPlatformClick, onSentimentClick }: MentionsSummaryCardProps) {
  const navigate = useNavigate();

  const summary = useMemo(() => {
    if (!mentions || mentions.length === 0) {
      return null;
    }

    // Group by platform
    const platformCounts: Record<string, number> = {};
    mentions.forEach((m) => {
      const category = categorizeSource(m.source_domain);
      platformCounts[category] = (platformCounts[category] || 0) + 1;
    });

    // Get platforms sorted by count
    const platforms = Object.entries(platformCounts)
      .map(([key, count]) => {
        const config = PLATFORM_CONFIG[key] || PLATFORM_CONFIG.other;
        const Icon = config.icon;
        return {
          key, // Store the key for filtering
          name: config.label,
          count,
          icon: <Icon className="h-4 w-4" />,
          color: config.color,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Calculate date range
    const dates = mentions
      .map((m) => new Date(m.published_at || m.created_at))
      .filter((d) => !isNaN(d.getTime()));
    
    const minDate = dates.length > 0 ? min(dates) : null;
    const maxDate = dates.length > 0 ? max(dates) : null;

    // Sentiment counts
    const sentiment = {
      positivo: mentions.filter((m) => m.sentiment === "positivo").length,
      neutral: mentions.filter((m) => m.sentiment === "neutral").length,
      negativo: mentions.filter((m) => m.sentiment === "negativo").length,
      sinAnalizar: mentions.filter((m) => !m.sentiment).length,
    };

    // Unique sources
    const uniqueSources = new Set(mentions.map((m) => m.source_domain).filter(Boolean)).size;

    return {
      total: mentions.length,
      platforms,
      platformCount: Object.keys(platformCounts).length,
      minDate,
      maxDate,
      sentiment,
      uniqueSources,
    };
  }, [mentions]);

  if (!summary) {
    return (
      <Card className="border-dashed border-muted-foreground/30 bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="rounded-full bg-muted p-3 mb-3">
            <Database className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-muted-foreground mb-1">Sin menciones guardadas</h3>
          <p className="text-sm text-muted-foreground/80 mb-4 text-center max-w-sm">
            Aún no has recopilado menciones. Ve a Fuentes para buscar y guardar contenido.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/fuentes")}>
            <Database className="mr-2 h-4 w-4" />
            Ir a Fuentes
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-transparent to-transparent border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Tu Base de Datos</CardTitle>
            <CardDescription>Resumen de menciones recopiladas para {projectName}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Summary Sentence */}
        <div className="text-lg">
          Tienes{" "}
          <span className="font-bold text-primary">{summary.total.toLocaleString()} menciones</span>{" "}
          de{" "}
          <span className="font-semibold">{summary.platformCount} plataforma{summary.platformCount !== 1 ? "s" : ""}</span>
          {summary.minDate && summary.maxDate && (
            <>
              , del{" "}
              <span className="font-medium">
                {format(summary.minDate, "d 'de' MMMM", { locale: es })}
              </span>{" "}
              al{" "}
              <span className="font-medium">
                {format(summary.maxDate, "d 'de' MMMM yyyy", { locale: es })}
              </span>
            </>
          )}
          .
        </div>

        {/* Platform Breakdown */}
        <div className="flex flex-wrap gap-2">
          {summary.platforms.slice(0, 5).map((platform) => (
            <Badge
              key={platform.name}
              variant="secondary"
              className={`flex items-center gap-1.5 py-1 px-2.5 ${onPlatformClick ? "cursor-pointer hover:bg-secondary/80" : ""}`}
              onClick={() => onPlatformClick?.(platform.key, platform.name)}
            >
              {platform.icon}
              <span>{platform.name}</span>
              <span className="font-bold ml-1">{platform.count}</span>
            </Badge>
          ))}
          {summary.platforms.length > 5 && (
            <Badge variant="outline" className="py-1 px-2.5">
              +{summary.platforms.length - 5} más
            </Badge>
          )}
        </div>

        {/* Sentiment Quick View */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Sentimiento:</span>
          <div className="flex gap-2">
            {summary.sentiment.positivo > 0 && (
              <span 
                className={`flex items-center gap-1 text-green-600 ${onSentimentClick ? "cursor-pointer hover:underline" : ""}`}
                onClick={() => onSentimentClick?.("positivo", "Positivo")}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {summary.sentiment.positivo} positivas
              </span>
            )}
            {summary.sentiment.neutral > 0 && (
              <span 
                className={`text-gray-500 ${onSentimentClick ? "cursor-pointer hover:underline" : ""}`}
                onClick={() => onSentimentClick?.("neutral", "Neutral")}
              >
                {summary.sentiment.neutral} neutrales
              </span>
            )}
            {summary.sentiment.negativo > 0 && (
              <span 
                className={`text-red-600 ${onSentimentClick ? "cursor-pointer hover:underline" : ""}`}
                onClick={() => onSentimentClick?.("negativo", "Negativo")}
              >
                {summary.sentiment.negativo} negativas
              </span>
            )}
            {summary.sentiment.sinAnalizar > 0 && (
              <span 
                className={`text-amber-600 ${onSentimentClick ? "cursor-pointer hover:underline" : ""}`}
                onClick={() => onSentimentClick?.("sinAnalizar", "Sin analizar")}
              >
                {summary.sentiment.sinAnalizar} sin analizar
              </span>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              {summary.uniqueSources} fuentes únicas
            </span>
            {summary.minDate && summary.maxDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {Math.ceil((summary.maxDate.getTime() - summary.minDate.getTime()) / (1000 * 60 * 60 * 24))} días de datos
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/fuentes")} className="gap-1">
            Ver menciones
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
