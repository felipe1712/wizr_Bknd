import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  FileText,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Filter,
  Target,
  BookOpen,
  BarChart3,
  Download,
  Pencil,
  Check,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSmartReport, SmartReportContent, SmartReportConfig } from "@/hooks/useSmartReport";
import type { Mention } from "@/hooks/useMentions";
import { SmartReportPDFGenerator } from "./SmartReportPDFGenerator";
import { ReportAnalyticsCharts } from "./ReportAnalyticsCharts";
import { PublishReportDialog } from "./PublishReportDialog";
import { VisualSlidesViewer } from "./VisualSlidesViewer";
import { EditableText } from "./EditableText";
import { InlineBoldText, BulletText } from "./InlineBoldText";
import { Globe, Presentation } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

interface Entity {
  id: string;
  nombre: string;
}

interface SmartReportGeneratorProps {
  mentions: Mention[];
  projectId?: string;
  projectName: string;
  projectAudience: string;
  projectObjective: string;
  strategicContext?: string;
  entityNames?: string[];
  entities?: Entity[];
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
}

const SOURCE_TYPES = [
  { value: "__all__", label: "Todas las fuentes" },
  { value: "twitter", label: "Twitter/X" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "reddit", label: "Reddit" },
  { value: "news", label: "Medios Digitales" },
];

function getSourceType(domain: string | null | undefined): string {
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

export function SmartReportGenerator({
  mentions,
  projectId,
  projectName,
  projectAudience,
  projectObjective,
  strategicContext,
  entityNames,
  entities = [],
  dateRange,
}: SmartReportGeneratorProps) {
  const { toast } = useToast();
  const { generateReport, isGenerating, report, clearReport } = useSmartReport();
  
  const [strategicFocus, setStrategicFocus] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("__all__");
  const [entityFilter, setEntityFilter] = useState<string>("__all__");
  const [publishOpen, setPublishOpen] = useState(false);
  const [visualOpen, setVisualOpen] = useState(false);

  // Manual editing layer: editedReport overrides report for downstream (PDF, publish, visual)
  const [isEditing, setIsEditing] = useState(false);
  const [editedReport, setEditedReport] = useState<SmartReportContent | null>(null);

  // Sync editedReport whenever a fresh report is generated
  useEffect(() => {
    setEditedReport(report);
    setIsEditing(false);
  }, [report]);

  const activeReport = editedReport ?? report;

  const updateReport = (patch: Partial<SmartReportContent>) => {
    setEditedReport((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const resetEdits = () => {
    setEditedReport(report);
    toast({ title: "Cambios descartados", description: "Se restauró la versión original generada por la IA." });
  };

  const filteredMentions = useMemo(() => {
    return mentions.filter((m) => {
      if (sourceFilter !== "__all__") {
        const mentionSource = getSourceType(m.source_domain);
        if (mentionSource !== sourceFilter) return false;
      }
      if (entityFilter !== "__all__") {
        if (m.entity_id !== entityFilter) return false;
      }
      return true;
    });
  }, [mentions, sourceFilter, entityFilter]);

  const filteredEntityNames = useMemo(() => {
    if (entityFilter === "__all__") return entityNames;
    const entity = entities.find(e => e.id === entityFilter);
    return entity ? [entity.nombre] : entityNames;
  }, [entityFilter, entities, entityNames]);

  const sentimentData = useMemo(() => {
    const breakdown = { positivo: 0, negativo: 0, neutral: 0, sinAnalizar: 0 };
    filteredMentions.forEach(m => {
      if (m.sentiment === "positivo") breakdown.positivo++;
      else if (m.sentiment === "negativo") breakdown.negativo++;
      else if (m.sentiment === "neutral") breakdown.neutral++;
      else breakdown.sinAnalizar++;
    });
    return breakdown;
  }, [filteredMentions]);

  const handleGenerate = async () => {
    const config: SmartReportConfig = {
      reportFormat: "full",
      projectName,
      projectAudience,
      projectObjective,
      strategicContext: strategicContext || undefined,
      strategicFocus: strategicFocus.trim() || undefined,
      entityNames: filteredEntityNames,
      dateRange: {
        start: dateRange.start,
        end: dateRange.end,
        label: dateRange.label,
      },
    };

    await generateReport(filteredMentions, config);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Reporte Inteligente
        </CardTitle>
        <CardDescription>
          Genera un análisis integral con brief ejecutivo, narrativas, influenciadores y recomendaciones
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration */}
        {!report && (
          <div className="space-y-4">
            {/* Strategic Focus */}
            <div className="space-y-2 p-4 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <Label className="font-medium">Enfoque Estratégico del Reporte</Label>
              </div>
              {strategicContext && (
                <p className="text-xs text-muted-foreground">
                  <strong>Contexto del proyecto:</strong> {strategicContext}
                </p>
              )}
              <Textarea
                value={strategicFocus}
                onChange={(e) => setStrategicFocus(e.target.value)}
                placeholder="Ej: Analizar cómo la detención de Rafael Zaga impacta la reputación de Actinver dado el litigio activo entre ambos. Evaluar si los medios vinculan directamente a Actinver con el caso."
                className="text-sm min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">
                Define el ángulo específico del análisis. La IA interpretará el sentimiento y las narrativas en función de este contexto.
              </p>
            </div>

            {/* Filters Section */}
            <div className="space-y-3 p-4 rounded-lg border border-dashed bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4 text-muted-foreground" />
                Filtrar Menciones
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Fuente / Plataforma</Label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_TYPES.map((source) => (
                        <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Entidad</Label>
                  <Select value={entityFilter} onValueChange={setEntityFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas las entidades</SelectItem>
                      {entities.map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>{entity.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Data Summary */}
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={filteredMentions.length < mentions.length ? "default" : "outline"}>
                {filteredMentions.length} menciones
                {filteredMentions.length < mentions.length && ` (de ${mentions.length})`}
              </Badge>
              <Badge variant="outline">{dateRange.label}</Badge>
              {sourceFilter !== "__all__" && (
                <Badge variant="secondary">
                  {SOURCE_TYPES.find(s => s.value === sourceFilter)?.label}
                </Badge>
              )}
              {entityFilter !== "__all__" && (
                <Badge variant="secondary">
                  {entities.find(e => e.id === entityFilter)?.nombre}
                </Badge>
              )}
            </div>

            {/* Single Generate Button */}
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={isGenerating || filteredMentions.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando reporte inteligente...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar Reporte ({filteredMentions.length} menciones)
                </>
              )}
            </Button>
          </div>
        )}

        {/* Generated Report */}
        {report && activeReport && (
          <div className="space-y-6">
            {/* Report Header + Edit toolbar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <EditableText
                    editing={isEditing}
                    value={activeReport.title}
                    onChange={(v) => updateReport({ title: v })}
                    className="text-lg font-semibold block"
                    placeholder="Título del reporte"
                  />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={resetEdits}>
                        <Undo2 className="mr-2 h-4 w-4" />
                        Descartar
                      </Button>
                      <Button variant="default" size="sm" onClick={() => { setIsEditing(false); toast({ title: "Cambios guardados", description: "El PDF y el link público usarán tus ediciones." }); }}>
                        <Check className="mr-2 h-4 w-4" />
                        Listo
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar reporte
                      </Button>
                      <Button variant="outline" size="sm" onClick={clearReport}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Nuevo
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {isEditing && (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                  <Pencil className="h-3.5 w-3.5 text-primary" />
                  Modo edición. Click en cualquier texto para modificarlo. Las gráficas y métricas no son editables. Los cambios se aplican al PDF y al link público.
                </div>
              )}
              {isEditing ? (
                <EditableText
                  editing={isEditing}
                  value={activeReport.summary}
                  onChange={(v) => updateReport({ summary: v })}
                  multiline
                  minRows={3}
                  className="text-muted-foreground block"
                  placeholder="Resumen ejecutivo"
                />
              ) : (
                <BulletText text={activeReport.summary} className="text-sm text-muted-foreground leading-relaxed" />
              )}
            </div>

            {/* Visual Analytics */}
            <ReportAnalyticsCharts
              sourceBreakdown={report.sourceBreakdown}
              influencers={report.influencers}
              mediaOutlets={report.mediaOutlets}
              timeline={report.timeline}
              sentimentData={sentimentData}
              impactAssessment={activeReport.impactAssessment}
              sentimentAnalysis={activeReport.sentimentAnalysis}
              dateLabel={dateRange.label}
              estimatedImpressions={report.metrics.estimatedImpressions}
              estimatedReach={report.metrics.estimatedReach}
              totalUniqueAuthors={report.totalUniqueAuthors}
              editing={isEditing}
              onImpactAssessmentChange={(v) => updateReport({ impactAssessment: v })}
              onSentimentAnalysisChange={(v) => updateReport({ sentimentAnalysis: v })}
            />

            {/* Narratives Analysis */}
            {report.narratives && report.narratives.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Análisis Narrativo
                </h4>

                {/* Volume chart by sentiment */}
                {(() => {
                  const totalNarrMentions = report.narratives.reduce((s, n) => s + (Number.isFinite(n.mentions) && n.mentions > 0 ? n.mentions : 0), 0) || 1;
                  const SENT = { positivo: "hsl(142, 76%, 36%)", negativo: "hsl(0, 84%, 60%)", mixto: "hsl(38, 92%, 50%)", neutral: "hsl(215, 16%, 57%)" } as const;
                  const chartData = report.narratives.map((n, i) => {
                    const v = Number.isFinite(n.mentions) && n.mentions > 0 ? n.mentions : 0;
                    return {
                      name: `N${i + 1}`,
                      fullName: n.narrative,
                      value: v,
                      pct: Math.round((v / totalNarrMentions) * 100),
                      sentiment: n.sentiment,
                      color: SENT[n.sentiment as keyof typeof SENT] || SENT.neutral,
                    };
                  });
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Volumen por narrativa</CardTitle>
                        <CardDescription className="text-xs">
                          Barras coloreadas por sentimiento dominante (verde positivo, rojo negativo, ámbar mixto, gris neutral)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[260px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                              <Tooltip
                                cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                                content={({ active, payload }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  const p = payload[0].payload as typeof chartData[number];
                                  return (
                                    <div className="rounded-md border bg-background p-2 shadow-md text-xs max-w-[260px]">
                                      <div className="font-semibold mb-1">{p.name} · {p.fullName}</div>
                                      <div className="text-muted-foreground">{p.value} menciones · {p.pct}%</div>
                                      <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: p.color }}>{p.sentiment}</div>
                                    </div>
                                  );
                                }}
                              />
                              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {chartData.map((d, i) => (
                                  <Cell key={i} fill={d.color} />
                                ))}
                                <LabelList
                                  dataKey="value"
                                  position="top"
                                  formatter={(v: number) => {
                                    const item = chartData.find(c => c.value === v);
                                    return item ? `${v} · ${item.pct}%` : `${v}`;
                                  }}
                                  style={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--foreground))" }}
                                />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                          {chartData.map((d) => (
                            <div key={d.name} className="flex items-center gap-2 min-w-0">
                              <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="font-semibold flex-shrink-0">{d.name}</span>
                              <span className="text-muted-foreground truncate">{d.fullName}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                <div className="space-y-2">
                  {report.narratives.map((n, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] font-bold">N{i + 1}</Badge>
                            <span className="font-semibold text-sm">{n.narrative}</span>
                            <Badge variant="secondary" className="text-xs">{n.mentions} menciones</Badge>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                n.sentiment === "negativo" ? "text-red-600 border-red-200" :
                                n.sentiment === "positivo" ? "text-green-600 border-green-200" :
                                "text-muted-foreground"
                              }`}
                            >
                              {n.sentiment}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {n.trend === "creciente" ? "📈" : n.trend === "decreciente" ? "📉" : "➡️"} {n.trend}
                            </span>
                          </div>
                          <BulletText text={n.description} className="text-xs text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Entity Comparison (conditional) */}
            {report.entityComparison && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-500" />
                  Comparación entre Entidades
                </h4>
                <p className="text-sm text-muted-foreground">{report.entityComparison}</p>
              </div>
            )}

            {/* Keywords Cloud */}
            {report.keywords && report.keywords.length > 0 && (() => {
              const KW_SENT: Record<string, { bg: string; text: string; border: string }> = {
                positivo: { bg: "hsl(142 76% 36% / 0.10)", text: "hsl(142 71% 28%)", border: "hsl(142 71% 36% / 0.35)" },
                negativo: { bg: "hsl(0 84% 60% / 0.10)", text: "hsl(0 70% 40%)", border: "hsl(0 84% 60% / 0.35)" },
                mixto: { bg: "hsl(38 92% 50% / 0.12)", text: "hsl(28 80% 38%)", border: "hsl(38 92% 50% / 0.40)" },
                neutral: { bg: "hsl(215 16% 57% / 0.12)", text: "hsl(215 20% 35%)", border: "hsl(215 16% 57% / 0.35)" },
              };
              const maxC = Math.max(...report.keywords.map(k => k.count), 1);
              const minC = Math.min(...report.keywords.map(k => k.count), 1);
              const range = Math.max(1, maxC - minC);
              return (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Términos destacados
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Conceptos más recurrentes en la conversación, dimensionados por frecuencia y coloreados por sentimiento.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2 items-center justify-center py-2">
                      {report.keywords.map((k, i) => {
                        const norm = (k.count - minC) / range; // 0..1
                        const fontSize = 12 + Math.round(norm * 14); // 12..26 px
                        const opacity = 0.65 + norm * 0.35;
                        const s = KW_SENT[k.sentiment] || KW_SENT.mixto;
                        return (
                          <span
                            key={i}
                            className="inline-flex items-baseline gap-1 rounded-full border px-3 py-1 font-semibold transition-transform hover:scale-105 cursor-default"
                            style={{ fontSize: `${fontSize}px`, lineHeight: 1.2, backgroundColor: s.bg, color: s.text, borderColor: s.border, opacity }}
                            title={`${k.term} · ${k.count} apariciones · ${k.sentiment}`}
                          >
                            {k.term}
                            <span className="text-[10px] font-medium opacity-70">{k.count}</span>
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground justify-center">
                      {(["positivo","negativo","mixto","neutral"] as const).map(s => (
                        <span key={s} className="inline-flex items-center gap-1.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: KW_SENT[s].text }} />
                          <span className="capitalize">{s}</span>
                        </span>
                      ))}
                    </div>
                    {report.keywordsInsight && (
                      <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-3 italic">
                        {report.keywordsInsight}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Key Findings & Recommendations */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Hallazgos Clave
                  {isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7 px-2"
                      onClick={() => updateReport({ keyFindings: [...activeReport.keyFindings, "Nuevo hallazgo"] })}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                    </Button>
                  )}
                </h4>
                <ul className="space-y-1.5 text-sm">
                  {activeReport.keyFindings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-2 group">
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <div className="flex-1">
                        <EditableText
                          editing={isEditing}
                          value={finding}
                          multiline
                          minRows={3}
                          onChange={(v) => {
                            const next = [...activeReport.keyFindings];
                            next[i] = v;
                            updateReport({ keyFindings: next });
                          }}
                        />
                      </div>
                      {isEditing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-50 hover:opacity-100"
                          onClick={() => updateReport({ keyFindings: activeReport.keyFindings.filter((_, idx) => idx !== i) })}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Recomendaciones
                  {isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7 px-2"
                      onClick={() => updateReport({ recommendations: [...activeReport.recommendations, "Nueva recomendación"] })}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                    </Button>
                  )}
                </h4>
                <ul className="space-y-1.5 text-sm">
                  {activeReport.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 group">
                      <span className="text-muted-foreground mt-0.5">{i + 1}.</span>
                      <div className="flex-1">
                        <EditableText
                          editing={isEditing}
                          value={rec}
                          multiline
                          minRows={3}
                          onChange={(v) => {
                            const next = [...activeReport.recommendations];
                            next[i] = v;
                            updateReport({ recommendations: next });
                          }}
                        />
                      </div>
                      {isEditing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-50 hover:opacity-100"
                          onClick={() => updateReport({ recommendations: activeReport.recommendations.filter((_, idx) => idx !== i) })}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Conclusions (editable) */}
            {(activeReport.conclusions && activeReport.conclusions.length > 0) || isEditing ? (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Conclusiones
                  {isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7 px-2"
                      onClick={() => updateReport({ conclusions: [...(activeReport.conclusions || []), "Nueva conclusión"] })}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                    </Button>
                  )}
                </h4>
                <ul className="space-y-1.5 text-sm">
                  {(activeReport.conclusions || []).map((c, i) => (
                    <li key={i} className="flex items-start gap-2 group">
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <div className="flex-1">
                        <EditableText
                          editing={isEditing}
                          value={c}
                          multiline
                          minRows={2}
                          onChange={(v) => {
                            const next = [...(activeReport.conclusions || [])];
                            next[i] = v;
                            updateReport({ conclusions: next });
                          }}
                        />
                      </div>
                      {isEditing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-50 hover:opacity-100"
                          onClick={() => updateReport({ conclusions: (activeReport.conclusions || []).filter((_, idx) => idx !== i) })}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Separator />

            {/* Download Section — Resumen vs Completo */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar Reporte
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-lg border bg-muted/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Resumen</span>
                  </div>
                  <p className="text-xs text-muted-foreground">1-2 páginas. Brief ejecutivo, KPIs, top hallazgos y recomendaciones clave.</p>
                  <SmartReportPDFGenerator
                    report={activeReport}
                    projectName={projectName}
                    dateRange={dateRange}
                    pdfFormat="summary"
                  />
                </div>
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Reporte Completo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">4-6 páginas. Análisis integral con narrativas, influenciadores y visualizaciones.</p>
                  <SmartReportPDFGenerator
                    report={activeReport}
                    projectName={projectName}
                    dateRange={dateRange}
                    pdfFormat="full"
                  />
                </div>
                <div className="p-4 rounded-lg border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Presentation className="h-4 w-4 text-indigo-500" />
                    <span className="font-medium text-sm">Reporte Visual</span>
                    <span className="text-[10px] uppercase tracking-wide bg-indigo-500 text-white px-1.5 py-0.5 rounded font-bold">Nuevo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Presentación 16:9 con KPIs gigantes y gráficas. Visor interactivo + PDF landscape.</p>
                  <Button
                    onClick={() => setVisualOpen(true)}
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 border-indigo-500/40 hover:bg-indigo-500/10"
                  >
                    <Presentation className="h-4 w-4" />
                    Abrir visor
                  </Button>
                </div>
              </div>

              <VisualSlidesViewer
                open={visualOpen}
                onOpenChange={setVisualOpen}
                report={activeReport}
                projectName={projectName}
                dateRange={dateRange}
              />


              {/* Publicar como link público */}
              {projectId && (
                <div className="p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Globe className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Compartir como link público</p>
                      <p className="text-xs text-muted-foreground">
                        Genera un link sin login para enviar este reporte a tu cliente por correo o enlace directo.
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => setPublishOpen(true)} size="sm" className="gap-2">
                    <Globe className="h-4 w-4" /> Publicar
                  </Button>
                </div>
              )}
            </div>

            {projectId && (
              <PublishReportDialog
                open={publishOpen}
                onOpenChange={setPublishOpen}
                projectId={projectId}
                projectName={projectName}
                report={activeReport}
                dateRange={dateRange}
              />
            )}

            {/* Metrics Summary */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Métricas: {report.metrics.totalMentions} menciones</span>
              <span>•</span>
              <span className="text-green-600">+{report.metrics.positiveCount}</span>
              <span className="text-gray-500">{report.metrics.neutralCount}</span>
              <span className="text-red-600">-{report.metrics.negativeCount}</span>
              {report.metrics.estimatedImpressions > 0 && (
                <>
                  <span>•</span>
                  <span>~{(report.metrics.estimatedImpressions / 1000).toFixed(1)}K impresiones</span>
                  <span>~{(report.metrics.estimatedReach / 1000).toFixed(1)}K alcance</span>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

