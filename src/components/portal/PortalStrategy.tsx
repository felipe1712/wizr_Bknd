import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Compass, Sparkles, RefreshCcw, Loader2, AlertTriangle, CheckCircle2, CalendarIcon, MessageSquare, Users, Target, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
const LightbulbIcon = Lightbulb;

type Payload = {
  coherence?: { level: "alta" | "media" | "baja"; reason: string };
  what_audience_says?: { topics: string[]; sentiment_summary: string };
  what_client_does?: { narratives: string[]; tone: string };
  what_peers_do?: { dominant_narratives: string[]; gaps_client_misses: string[] };
  gaps?: { type: string; description: string; evidence: string }[];
  recommendations?: { title: string; action: string; evidence_listening: string; evidence_benchmark: string; priority: "alta" | "media" }[];
};

type Report = { id: string; range_start: string; range_end: string; payload: Payload; generated_at: string; model: string | null };

function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function fmtHuman(d: Date) { return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }); }

const PRESETS: { key: string; label: string; weeks: number }[] = [
  { key: "7", label: "Semana (L–D)", weeks: 1 },
  { key: "14", label: "Quincena (L–D)", weeks: 2 },
  { key: "30", label: "Mes (~4 sem)", weeks: 4 },
];

// Última semana COMPLETA lunes→domingo relativa a hoy.
// Si hoy es domingo, incluye la semana actual; si no, toma la anterior.
function lastCompleteWeek(): { start: Date; end: Date } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=dom, 1=lun...
  // Domingo de la semana ya cerrada
  const daysSinceSunday = dow === 0 ? 0 : dow;
  const sunday = new Date(today); sunday.setDate(today.getDate() - daysSinceSunday);
  const monday = new Date(sunday); monday.setDate(sunday.getDate() - 6);
  return { start: monday, end: sunday };
}

export default function PortalStrategy({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [preset, setPreset] = useState<string>("30");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (preset === "custom") {
      if (!from || !to) return null;
      const [a, b] = from < to ? [from, to] : [to, from];
      return { from: a, to: b };
    }
    const p = PRESETS.find((x) => x.key === preset)!;
    const lastWeek = lastCompleteWeek();
    const end = lastWeek.end; // domingo
    const start = new Date(end); start.setDate(end.getDate() - (7 * p.weeks - 1)); // lunes N semanas atrás
    return { from: start, to: end };
  }, [preset, from, to]);

  const fetchCached = useCallback(async () => {
    if (!range) return;
    setLoading(true); setError(null);
    const { data, error } = await supabase
      .from("client_portal_strategy_reports")
      .select("*")
      .eq("client_id", clientId)
      .eq("range_start", fmt(range.from))
      .eq("range_end", fmt(range.to))
      .maybeSingle();
    if (error) setError(error.message);
    setReport((data as any) ?? null);
    setLoading(false);
  }, [clientId, range?.from?.getTime(), range?.to?.getTime()]);

  useEffect(() => { fetchCached(); }, [fetchCached]);

  const generate = async (force = false) => {
    if (!range) return;
    setGenerating(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-strategy-recommendations", {
        body: { client_id: clientId, range_start: fmt(range.from), range_end: fmt(range.to), force },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setReport((data as any).report as Report);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setGenerating(false);
    }
  };

  const p = report?.payload ?? {};
  const coherenceColor =
    p.coherence?.level === "alta" ? "text-emerald-500 border-emerald-500/40 bg-emerald-500/10" :
    p.coherence?.level === "media" ? "text-amber-500 border-amber-500/40 bg-amber-500/10" :
    p.coherence?.level === "baja" ? "text-rose-500 border-rose-500/40 bg-rose-500/10" : "";

  const recs = p.recommendations ?? [];

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <Card className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Compass className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Estrategia — cruce Escucha × Benchmark</h3>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {PRESETS.map((pp) => (
                <Button key={pp.key} size="sm" variant={preset === pp.key ? "default" : "outline"} onClick={() => setPreset(pp.key)}>
                  {pp.label}
                </Button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant={preset === "custom" ? "default" : "outline"}><CalendarIcon className="w-3.5 h-3.5 mr-1.5" />Rango</Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Selecciona 2 fechas</p>
                    <Calendar
                      mode="range"
                      selected={{ from, to }}
                      onSelect={(r: any) => { setFrom(r?.from); setTo(r?.to); setPreset("custom"); }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {report ? (
              <Button size="sm" variant="outline" onClick={() => generate(true)} disabled={generating}>
                {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />}
                Regenerar
              </Button>
            ) : (
              <Button size="sm" onClick={() => generate(false)} disabled={generating || !range}>
                {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                Generar
              </Button>
            )}
          </div>
        </div>
        {range && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Rango: {fmtHuman(range.from)} — {fmtHuman(range.to)}
          </p>
        )}
        {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
      </Card>

      {loading && <p className="text-sm text-muted-foreground italic">Cargando…</p>}

      {!loading && !report && (
        <Card className="p-8 text-center">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            No hay reporte para este rango. Genera uno para cruzar lo que dicen las audiencias con lo que hacen {clientName} y sus pares, y obtener un diagnóstico de coherencia + recomendaciones accionables.
          </p>
        </Card>
      )}

      {report && (
        <>
          {p.coherence && (
            <Card className={cn("p-5 border-2", coherenceColor)}>
              <div className="flex items-center gap-3">
                {p.coherence.level === "alta" ? <CheckCircle2 className="w-6 h-6" /> :
                 p.coherence.level === "baja" ? <AlertTriangle className="w-6 h-6" /> :
                 <Target className="w-6 h-6" />}
                <div>
                  <p className="text-[10px] uppercase tracking-widest opacity-70">Coherencia estratégica</p>
                  <p className="text-lg font-display font-bold capitalize">{p.coherence.level}</p>
                </div>
              </div>
              <p className="text-sm mt-3">{p.coherence.reason}</p>
            </Card>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-sm">Qué DICEN de {clientName}</h4>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Temas top</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {(p.what_audience_says?.topics ?? []).map((t, i) => <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>)}
              </div>
              <p className="text-xs text-muted-foreground">{p.what_audience_says?.sentiment_summary}</p>
            </Card>

            <Card className="p-4 border-primary/40">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-sm">Qué HACE {clientName}</h4>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Narrativas propias</p>
              {(p.what_client_does?.narratives ?? []).length > 0 ? (
                <ul className="text-xs space-y-1 mb-3 list-disc pl-4">
                  {(p.what_client_does?.narratives ?? []).map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic mb-3">
                  Aún no hay análisis narrativo de {clientName}. Genera el análisis desde <span className="font-medium">Benchmark → Contenido → Narrativas del periodo</span> para poblar esta columna.
                </p>
              )}
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Tono</p>
              <p className="text-xs text-muted-foreground">{p.what_client_does?.tone || "no disponible"}</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-sm">Qué HACEN los pares</h4>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Narrativas dominantes</p>
              {(p.what_peers_do?.dominant_narratives ?? []).length > 0 ? (
                <ul className="text-xs space-y-1 mb-3 list-disc pl-4">
                  {(p.what_peers_do?.dominant_narratives ?? []).map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic mb-3">
                  Sin narrativas de competidores analizadas. Genera el análisis en Benchmark → Contenido.
                </p>
              )}
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Territorios que el cliente no cubre</p>
              {(p.what_peers_do?.gaps_client_misses ?? []).length > 0 ? (
                <ul className="text-xs space-y-1 list-disc pl-4">
                  {(p.what_peers_do?.gaps_client_misses ?? []).map((n, i) => <li key={i} className="text-rose-500">{n}</li>)}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sin brechas identificadas.</p>
              )}
            </Card>
          </div>

          {(p.gaps ?? []).length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h4 className="font-semibold text-sm">Brechas detectadas</h4>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {(p.gaps ?? []).map((g, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border/40 bg-background/40">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] uppercase">{g.type}</Badge>
                    </div>
                    <p className="text-xs font-medium">{g.description}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{g.evidence}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {recs.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <LightbulbIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Recomendaciones estratégicas</p>
                    <h4 className="font-semibold text-sm">
                      {fmtHuman(new Date(report.range_start))} — {fmtHuman(new Date(report.range_end))}
                    </h4>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  <Sparkles className="w-3 h-3 mr-1" /> {recs.length} acción{recs.length === 1 ? "" : "es"}
                </Badge>
              </div>
              <div className="space-y-3">
                {recs.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl border p-4 space-y-3",
                      r.priority === "alta" ? "border-rose-500/40 bg-rose-500/5" : "border-border/40 bg-background/40",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold tabular-nums",
                        r.priority === "alta" ? "bg-rose-500 text-white" : "bg-primary/10 text-primary",
                      )}>
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-sm">{r.title}</p>
                          <Badge
                            variant={r.priority === "alta" ? "destructive" : "secondary"}
                            className="text-[10px] uppercase"
                          >
                            Prioridad {r.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.action}</p>
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 pl-11">
                      {r.evidence_listening && (
                        <div className="rounded-lg border border-border/40 bg-background/60 p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <MessageSquare className="w-3 h-3 text-primary" />
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Evidencia · Escucha</p>
                          </div>
                          <p className="text-[11px] leading-relaxed">{r.evidence_listening}</p>
                        </div>
                      )}
                      {r.evidence_benchmark && (
                        <div className="rounded-lg border border-border/40 bg-background/60 p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Users className="w-3 h-3 text-primary" />
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Evidencia · Benchmark</p>
                          </div>
                          <p className="text-[11px] leading-relaxed">{r.evidence_benchmark}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <p className="text-[10px] text-muted-foreground text-right">
            Generado {new Date(report.generated_at).toLocaleString("es-MX")}{report.model ? ` · ${report.model}` : ""}
          </p>
        </>
      )}
    </div>
  );
}