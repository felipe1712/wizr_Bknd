import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, Legend,
} from "recharts";
import { TrendingUp, Users, Globe, Activity, Eye, Radio } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { SourceBreakdown, InfluencerInfo, TimelinePoint, MediaOutletInfo } from "@/hooks/useSmartReport";
import { EditableText } from "./EditableText";
import { InlineBoldText, BulletText } from "./InlineBoldText";

interface ReportAnalyticsChartsProps {
  sourceBreakdown: SourceBreakdown[];
  influencers: InfluencerInfo[];
  mediaOutlets?: MediaOutletInfo[];
  timeline: TimelinePoint[];
  sentimentData: {
    positivo: number;
    negativo: number;
    neutral: number;
    sinAnalizar: number;
  };
  impactAssessment?: string;
  sentimentAnalysis?: string;
  dateLabel: string;
  estimatedImpressions?: number;
  estimatedReach?: number;
  totalUniqueAuthors?: number;
  editing?: boolean;
  onImpactAssessmentChange?: (v: string) => void;
  onSentimentAnalysisChange?: (v: string) => void;
}

function formatBigNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const SENTIMENT_COLORS = {
  positivo: "hsl(142, 76%, 36%)",
  negativo: "hsl(0, 84%, 60%)",
  neutral: "hsl(215, 16%, 57%)",
  sinAnalizar: "hsl(45, 93%, 47%)",
};

const PLATFORM_LABELS: Record<string, string> = {
  "twitter.com": "X/Twitter",
  "x.com": "X/Twitter",
  "facebook.com": "Facebook",
  "instagram.com": "Instagram",
  "tiktok.com": "TikTok",
  "youtube.com": "YouTube",
  "reddit.com": "Reddit",
  "linkedin.com": "LinkedIn",
};

function normalizeDomain(domain: string): string {
  return PLATFORM_LABELS[domain] || domain.replace(/^www\./, "");
}

export function ReportAnalyticsCharts({
  sourceBreakdown,
  influencers,
  mediaOutlets = [],
  timeline,
  sentimentData,
  impactAssessment,
  sentimentAnalysis,
  dateLabel,
  estimatedImpressions = 0,
  estimatedReach = 0,
  totalUniqueAuthors,
  editing = false,
  onImpactAssessmentChange,
  onSentimentAnalysisChange,
}: ReportAnalyticsChartsProps) {
  const sentimentChartData = useMemo(() => {
    const items = [
      { name: "Positivo", value: sentimentData.positivo, color: SENTIMENT_COLORS.positivo },
      { name: "Negativo", value: sentimentData.negativo, color: SENTIMENT_COLORS.negativo },
      { name: "Neutral", value: sentimentData.neutral, color: SENTIMENT_COLORS.neutral },
    ];
    if (sentimentData.sinAnalizar > 0) {
      items.push({ name: "Sin analizar", value: sentimentData.sinAnalizar, color: SENTIMENT_COLORS.sinAnalizar });
    }
    return items.filter(i => i.value > 0);
  }, [sentimentData]);

  const total = sentimentData.positivo + sentimentData.negativo + sentimentData.neutral + sentimentData.sinAnalizar;

  const topSources = useMemo(() => 
    sourceBreakdown.slice(0, 8).map(s => ({
      ...s,
      name: normalizeDomain(s.source),
    })),
  [sourceBreakdown]);

  const timelineFormatted = useMemo(() =>
    timeline.map(t => ({
      ...t,
      label: t.date.slice(5), // MM-DD
    })),
  [timeline]);

  return (
    <div className="space-y-6">
      {/* Estimated Impressions & Reach */}
      {(estimatedImpressions > 0 || estimatedReach > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatBigNumber(estimatedImpressions)}</p>
                <p className="text-xs text-muted-foreground">Impresiones est.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Radio className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatBigNumber(estimatedReach)}</p>
                <p className="text-xs text-muted-foreground">Alcance est.</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs text-muted-foreground">Menciones</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUniqueAuthors ?? influencers.length}</p>
                <p className="text-xs text-muted-foreground">Autores únicos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Impact Assessment */}
      {(impactAssessment || editing) && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-destructive" />
              Evaluación de Impacto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editing && onImpactAssessmentChange ? (
              <EditableText
                editing
                multiline
                minRows={4}
                value={impactAssessment || ""}
                onChange={onImpactAssessmentChange}
                className="text-sm leading-relaxed block"
                placeholder="Evaluación de impacto"
              />
            ) : (
              <BulletText text={impactAssessment || ""} className="text-sm leading-relaxed" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Sentiment Analysis narrative */}
      {(sentimentAnalysis || editing) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Análisis de Sentimiento</CardTitle>
          </CardHeader>
          <CardContent>
            {editing && onSentimentAnalysisChange ? (
              <EditableText
                editing
                multiline
                minRows={4}
                value={sentimentAnalysis || ""}
                onChange={onSentimentAnalysisChange}
                className="text-sm leading-relaxed text-muted-foreground block"
                placeholder="Análisis de sentimiento"
              />
            ) : (
              <BulletText text={sentimentAnalysis || ""} className="text-sm leading-relaxed text-muted-foreground" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts Row: Sentiment + Timeline */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Sentiment Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribución de Sentimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {sentimentChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} menciones (${((value/total)*100).toFixed(1)}%)`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-3 mt-2">
              {sentimentChartData.map(d => (
                <div key={d.name} className="flex items-center gap-1 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span>{d.name}: {d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Línea de Tiempo — {dateLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineFormatted}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" name="Total" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="negative" name="Negativas" stroke={SENTIMENT_COLORS.negativo} fill={SENTIMENT_COLORS.negativo} fillOpacity={0.1} />
                  <Area type="monotone" dataKey="positive" name="Positivas" stroke={SENTIMENT_COLORS.positivo} fill={SENTIMENT_COLORS.positivo} fillOpacity={0.1} />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row: Sources + Influencers */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Media / Sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Distribución por Medios/Plataformas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSources.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topSources} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="positive" stackId="a" name="Positivas" fill={SENTIMENT_COLORS.positivo} />
                    <Bar dataKey="neutral" stackId="a" name="Neutrales" fill={SENTIMENT_COLORS.neutral} />
                    <Bar dataKey="negative" stackId="a" name="Negativas" fill={SENTIMENT_COLORS.negativo} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos de fuentes</p>
            )}
          </CardContent>
        </Card>

        {/* Source sentiment breakdown table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Desglose por Fuente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSources.length > 0 ? (
              <div className="max-h-[220px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 font-medium">Fuente</th>
                      <th className="text-center py-1.5 font-medium">Total</th>
                      <th className="text-center py-1.5 font-medium text-green-600">+</th>
                      <th className="text-center py-1.5 font-medium text-gray-500">~</th>
                      <th className="text-center py-1.5 font-medium text-red-600">−</th>
                      <th className="text-center py-1.5 font-medium">% Neg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSources.map((s, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-1.5 font-medium">{s.name}</td>
                        <td className="text-center py-1.5">{s.count}</td>
                        <td className="text-center py-1.5 text-green-600">{s.positive}</td>
                        <td className="text-center py-1.5 text-gray-500">{s.neutral}</td>
                        <td className="text-center py-1.5 text-red-600">{s.negative}</td>
                        <td className="text-center py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            s.negative / (s.count || 1) > 0.5 
                              ? "bg-red-100 text-red-700" 
                              : s.negative / (s.count || 1) > 0.3 
                              ? "bg-amber-100 text-amber-700"
                              : "bg-green-100 text-green-700"
                          }`}>
                            {Math.round(s.negative / (s.count || 1) * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Influencers — Full Width Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Influenciadores de la Conversación ({influencers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {influencers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium text-muted-foreground text-xs w-8">#</th>
                    <th className="text-left py-2 font-medium text-muted-foreground text-xs">Perfil</th>
                    <th className="text-center py-2 font-medium text-muted-foreground text-xs">Plataforma</th>
                    <th className="text-center py-2 font-medium text-muted-foreground text-xs">Menciones</th>
                    <th className="text-center py-2 font-medium text-muted-foreground text-xs">Sentimiento</th>
                    <th className="text-left py-2 font-medium text-muted-foreground text-xs">Alcance</th>
                  </tr>
                </thead>
                <tbody>
                  {influencers.map((inf, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 text-xs font-bold text-primary">{i + 1}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            {inf.avatarUrl && <AvatarImage src={inf.avatarUrl} />}
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {inf.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <span className="font-medium text-sm block truncate">{inf.name}</span>
                            {inf.username && (
                              <span className="text-[11px] text-muted-foreground">@{inf.username}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-2">
                        <Badge variant="secondary" className="text-xs">{normalizeDomain(inf.platform)}</Badge>
                      </td>
                      <td className="text-center py-2">
                        <Badge variant="outline" className="text-xs font-semibold">{inf.mentions}</Badge>
                      </td>
                      <td className="text-center py-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            inf.sentiment === "negativo"
                              ? "text-red-600 border-red-200 bg-red-50"
                              : inf.sentiment === "positivo"
                              ? "text-green-600 border-green-200 bg-green-50"
                              : "text-amber-600 border-amber-200 bg-amber-50"
                          }`}
                        >
                          {inf.sentiment === "negativo" ? "Negativo" : inf.sentiment === "positivo" ? "Positivo" : "Mixto"}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{inf.reach}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin datos de autores en las menciones
            </p>
          )}
        </CardContent>
      </Card>

      {/* Medios Digitales — Full Width Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Medios Digitales en la Conversación ({mediaOutlets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mediaOutlets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium text-muted-foreground text-xs w-8">#</th>
                    <th className="text-left py-2 font-medium text-muted-foreground text-xs">Medio</th>
                    <th className="text-left py-2 font-medium text-muted-foreground text-xs">Dominio</th>
                    <th className="text-center py-2 font-medium text-muted-foreground text-xs">Artículos</th>
                    <th className="text-center py-2 font-medium text-muted-foreground text-xs">Sentimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {mediaOutlets.map((m, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 text-xs font-bold text-primary">{i + 1}</td>
                      <td className="py-2 font-medium">{m.name}</td>
                      <td className="py-2 text-xs text-muted-foreground">{m.domain}</td>
                      <td className="text-center py-2">
                        <Badge variant="outline" className="text-xs font-semibold">{m.articles}</Badge>
                      </td>
                      <td className="text-center py-2">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            m.sentiment === "negativo"
                              ? "text-red-600 border-red-200 bg-red-50"
                              : m.sentiment === "positivo"
                              ? "text-green-600 border-green-200 bg-green-50"
                              : m.sentiment === "neutral"
                              ? "text-gray-600 border-gray-200 bg-gray-50"
                              : "text-amber-600 border-amber-200 bg-amber-50"
                          }`}
                        >
                          {m.sentiment === "negativo" ? "Negativo" : m.sentiment === "positivo" ? "Positivo" : m.sentiment === "neutral" ? "Neutral" : "Mixto"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin datos de medios digitales en las menciones
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}