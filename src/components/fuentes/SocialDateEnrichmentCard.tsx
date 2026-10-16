import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PendingCounts {
  facebook: number;
  instagram: number;
  tiktok: number;
  twitter: number;
  total: number;
}

interface SocialDateEnrichmentCardProps {
  projectId: string;
}

const DOMAIN_PATTERNS: Record<string, RegExp> = {
  facebook: /facebook\.com|fb\.com/i,
  instagram: /instagram\.com/i,
  tiktok: /tiktok\.com/i,
  twitter: /twitter\.com|x\.com/i,
};

export function SocialDateEnrichmentCard({ projectId }: SocialDateEnrichmentCardProps) {
  const [counts, setCounts] = useState<PendingCounts>({ facebook: 0, instagram: 0, tiktok: 0, twitter: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const loadCounts = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("mentions")
      .select("url, source_domain, raw_metadata")
      .eq("project_id", projectId)
      .is("published_at", null)
      .eq("is_archived", false)
      .limit(1000);

    if (error) {
      toast.error("No se pudo cargar conteo de pendientes");
      setLoading(false);
      return;
    }

    const c: PendingCounts = { facebook: 0, instagram: 0, tiktok: 0, twitter: 0, total: 0 };
    for (const m of data || []) {
      const meta = (m.raw_metadata as any) || {};
      if (meta.date_confidence === "unavailable") continue;
      const hay = `${m.url ?? ""} ${m.source_domain ?? ""}`;
      for (const [k, re] of Object.entries(DOMAIN_PATTERNS)) {
        if (re.test(hay)) {
          (c as any)[k]++;
          c.total++;
          break;
        }
      }
    }
    setCounts(c);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const runEnrichment = async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-social-dates", {
        body: { project_id: projectId, limit: 100 },
      });
      if (error) throw error;
      setLastResult(data);
      toast.success(`Enriquecimiento completo: ${data?.total_updated ?? 0} fechas reconstruidas`);
      await loadCounts();
    } catch (e: any) {
      toast.error(e?.message || "Falló el enriquecimiento");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Enriquecer fechas de redes sociales
            </CardTitle>
            <CardDescription>
              Reconstruye <code>published_at</code> de menciones de Facebook, Instagram, TikTok y X usando Apify. Mejora la precisión de la curva de actividad.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={loadCounts} disabled={loading || running} title="Recargar conteo">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["facebook", "instagram", "tiktok", "twitter"] as const).map((p) => (
            <div key={p} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground tracking-wide">{p === "twitter" ? "X (Twitter)" : p}</p>
              <p className="text-2xl font-semibold mt-1">{counts[p]}</p>
              <p className="text-[10px] text-muted-foreground mt-1">sin fecha</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-sm text-muted-foreground">
            {counts.total === 0
              ? "No hay menciones pendientes de enriquecer."
              : <>Total pendientes: <span className="font-semibold text-foreground">{counts.total}</span> · Procesamos hasta 100 por corrida.</>}
          </div>
          <Button onClick={runEnrichment} disabled={running || counts.total === 0}>
            {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando…</> : "Ejecutar enriquecimiento"}
          </Button>
        </div>

        {lastResult && (
          <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Última corrida
            </div>
            <p className="text-muted-foreground text-xs">
              Escaneadas: {lastResult.total_scanned} · Actualizadas: {lastResult.total_updated}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.entries(lastResult.by_platform || {}).map(([k, v]: any) => (
                <Badge key={k} variant="outline" className="text-[10px]">
                  {k}: {v.updated}/{v.scanned}
                  {v.unavailable > 0 && ` · ${v.unavailable} sin dato`}
                  {v.error && <AlertCircle className="h-3 w-3 ml-1 text-destructive" />}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
