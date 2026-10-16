import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCcw, Loader2, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

type NarrativeAxis = { name: string; description: string; share_pct: number };
type Narratives = { narrative_axes: NarrativeAxis[]; dominant_tone: { label: string; evidence: string } | null; winning_formats: string[]; differential_vs_client: string | null };
type NarrativeRow = {
  id: string;
  profile_name: string;
  network: string;
  competitor_id: string | null;
  narratives: Narratives;
  posts_sampled: number;
  generated_at: string;
};

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }

export default function BenchmarkNarratives({
  clientId,
  clientName,
  range,
  networkFilter,
  scopeNote,
}: {
  clientId: string;
  clientName: string;
  range: { from: Date; to: Date; label: string } | null;
  networkFilter: string;
  /** Aclaración del universo real que cubre el análisis (no depende del filtro de Cuentas). */
  scopeNote?: string;
}) {
  const [rows, setRows] = useState<NarrativeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeKey = range ? `${fmtDate(range.from)}|${fmtDate(range.to)}|${networkFilter}` : "";

  const fetchCached = useCallback(async () => {
    if (!range) return;
    setLoading(true); setError(null);
    const { data, error } = await supabase
      .from("client_portal_benchmark_narratives")
      .select("*")
      .eq("client_id", clientId)
      .eq("range_start", fmtDate(range.from))
      .eq("range_end", fmtDate(range.to));
    if (error) setError(error.message);
    let list = ((data ?? []) as any[]).map((r) => ({ ...r, narratives: r.narratives ?? {} })) as NarrativeRow[];
    if (networkFilter !== "all") list = list.filter((r) => r.network === networkFilter);
    setRows(list);
    setLoading(false);
  }, [clientId, rangeKey]);

  useEffect(() => { fetchCached(); }, [fetchCached]);

  const generate = async (force = false) => {
    if (!range) return;
    setGenerating(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-benchmark-narratives", {
        body: {
          client_id: clientId,
          range_start: fmtDate(range.from),
          range_end: fmtDate(range.to),
          network_filter: networkFilter,
          force,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await fetchCached();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Compass className="w-4 h-4 text-primary" />
        <h4 className="font-semibold text-sm">Narrativas del periodo — análisis con IA</h4>
        <span className="text-[10px] text-muted-foreground ml-2">{range?.label}</span>
        {scopeNote && <span className="text-[10px] text-muted-foreground">· {scopeNote}</span>}
        <div className="ml-auto flex items-center gap-2">
          {rows.length === 0 ? (
            <Button size="sm" onClick={() => generate(false)} disabled={generating || !range}>
              {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              Generar análisis
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => generate(true)} disabled={generating}>
              {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />}
              Regenerar
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground italic">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Aún no hay análisis para este rango. Genera uno para descubrir los ejes narrativos, el tono y los ángulos diferenciales de cada marca.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const isClient = String(r.profile_name).toLowerCase().includes(clientName.toLowerCase());
            const axes = r.narratives?.narrative_axes ?? [];
            const tone = r.narratives?.dominant_tone;
            const formats = r.narratives?.winning_formats ?? [];
            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-xl border p-4 space-y-3",
                  isClient ? "border-primary/50 bg-primary/5" : "border-border/40 bg-background/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{r.profile_name}</p>
                      {isClient && <Badge className="text-[10px]">Cliente</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{r.network} · {r.posts_sampled} posts</p>
                  </div>
                </div>

                {axes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ejes narrativos</p>
                    {axes.map((a, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{a.name}</span>
                          <span className="tabular-nums text-muted-foreground">{Math.round(a.share_pct ?? 0)}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-background overflow-hidden mt-0.5">
                          <div className={cn("h-full", isClient ? "bg-primary" : "bg-muted-foreground/60")} style={{ width: `${Math.min(100, Math.max(0, a.share_pct ?? 0))}%` }} />
                        </div>
                        {a.description && <p className="text-[11px] text-muted-foreground mt-1">{a.description}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {tone && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tono</p>
                    <p className="text-xs"><span className="font-medium">{tone.label}</span>{tone.evidence ? ` — ${tone.evidence}` : ""}</p>
                  </div>
                )}

                {formats.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formats.map((f, i) => <Badge key={i} variant="secondary" className="text-[10px]">{f}</Badge>)}
                  </div>
                )}

                {r.narratives?.differential_vs_client && (
                  <div className="text-[11px] border-t border-border/40 pt-2">
                    <span className="font-semibold text-primary">Vs. {clientName}: </span>
                    <span className="text-muted-foreground">{r.narratives.differential_vs_client}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}