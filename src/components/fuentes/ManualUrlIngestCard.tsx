import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Link2, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ManualUrlIngestCardProps {
  projectId: string;
}

export function ManualUrlIngestCard({ projectId }: ManualUrlIngestCardProps) {
  const [raw, setRaw] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const parseUrls = (text: string): string[] => {
    const matched = text.match(/https?:\/\/[^\s,)]+/gi) || [];
    return Array.from(new Set(matched.map((u) => u.replace(/[.,;)\]>]+$/, ""))));
  };

  const ingest = async () => {
    const urls = parseUrls(raw);
    if (urls.length === 0) {
      toast.error("No se detectaron URLs válidas");
      return;
    }
    setRunning(true);
    setResults(null);
    setSummary(null);
    setProgress("Iniciando scrapers…");
    try {
      const { data, error } = await supabase.functions.invoke("ingest-manual-urls", {
        body: { project_id: projectId, urls },
      });
      if (error) throw error;
      const initialResults = data?.results || [];
      setResults(initialResults);

      if (data?.mode !== "async") {
        setSummary(data?.summary || null);
        const s = data?.summary || {};
        toast.success(`Listo: ${s.inserted ?? 0} nuevas, ${s.updated ?? 0} actualizadas, ${s.failed ?? 0} fallidas`);
        return;
      }

      let jobs = data?.jobs || [];
      const queued = data?.summary?.queued ?? 0;
      setSummary({ inserted: 0, updated: 0, skipped: data?.summary?.skipped ?? 0, failed: data?.summary?.failed ?? 0, queued });
      setProgress(`${queued} URL${queued === 1 ? "" : "s"} en cola. Esperando resultados de Apify…`);
      toast.info(`Ingestión en segundo plano iniciada: ${queued} URL${queued === 1 ? "" : "s"}`);

      let finalData: any = null;
      for (let attempt = 1; attempt <= 45; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, attempt < 4 ? 5000 : 8000));
        const { data: statusData, error: statusError } = await supabase.functions.invoke("ingest-manual-urls-status", {
          body: { project_id: projectId, jobs },
        });
        if (statusError) throw statusError;
        jobs = statusData?.jobs || jobs;
        const s = statusData?.summary || {};
        const mergedResults = [...initialResults, ...(statusData?.results || [])];
        setResults(mergedResults);
        setSummary({ ...s, skipped: (s.skipped ?? 0) + (data?.summary?.skipped ?? 0), failed: (s.failed ?? 0) + (data?.summary?.failed ?? 0) });
        setProgress(statusData?.done ? "Procesamiento finalizado." : `Apify procesando: ${s.completed ?? 0}/${s.total ?? jobs.length} lotes listos…`);
        if (statusData?.done) {
          finalData = { ...statusData, results: mergedResults };
          break;
        }
      }

      if (!finalData) {
        toast.warning("La ingestión sigue procesándose en Apify. Intenta consultar de nuevo en unos minutos.");
        return;
      }

      const s = finalData.summary || {};
      toast.success(`Listo: ${s.inserted ?? 0} nuevas, ${s.updated ?? 0} actualizadas, ${(s.failed ?? 0) + (data?.summary?.failed ?? 0)} fallidas`);
    } catch (e: any) {
      toast.error(e?.message || "Falló la ingestión");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const statusIcon = (st: string) => {
    if (st === "inserted") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (st === "updated") return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
    if (st === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
    return <AlertCircle className="h-4 w-4 text-amber-600" />;
  };

  const urlCount = parseUrls(raw).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          Ingestión manual de URLs
        </CardTitle>
        <CardDescription>
          Pega URLs de Facebook, Instagram, TikTok o X que no captamos automáticamente. Las scrapeamos con Apify y las incorporamos al proyecto con fecha y contenido real.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Pega aquí las URLs (una por línea o separadas por espacios)..."
          rows={6}
          className="font-mono text-xs"
        />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {progress || (urlCount > 0 ? <>{urlCount} URL{urlCount === 1 ? "" : "s"} detectada{urlCount === 1 ? "" : "s"}</> : "Sin URLs detectadas")}
          </span>
          <Button onClick={ingest} disabled={running || urlCount === 0}>
            {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Consultando…</> : "Ingerir URLs"}
          </Button>
        </div>

        {summary && (
          <div className="flex gap-2 flex-wrap pt-1">
            {summary.queued !== undefined && <Badge variant="outline" className="text-xs">En cola: {summary.queued}</Badge>}
            <Badge variant="outline" className="text-xs">Nuevas: {summary.inserted}</Badge>
            <Badge variant="outline" className="text-xs">Actualizadas: {summary.updated}</Badge>
            <Badge variant="outline" className="text-xs">Omitidas: {summary.skipped}</Badge>
            <Badge variant={summary.failed > 0 ? "destructive" : "outline"} className="text-xs">Fallidas: {summary.failed}</Badge>
          </div>
        )}

        {results && results.length > 0 && (
          <div className="space-y-1 max-h-72 overflow-y-auto border rounded-lg p-2 bg-muted/20">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs py-1 border-b last:border-0">
                {statusIcon(r.status)}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-mono">{r.url}</div>
                  {r.reason && <div className="text-muted-foreground text-[10px] mt-0.5">{r.reason}</div>}
                </div>
                <Badge variant="outline" className="text-[10px] uppercase shrink-0">{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
