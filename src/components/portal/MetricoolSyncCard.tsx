import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("metricool-sync", { body });
  if (error) {
    const detail = (error as any)?.context?.text ? await (error as any).context.text() : error.message;
    let msg = detail;
    try { msg = JSON.parse(detail)?.error ?? detail; } catch { /* texto */ }
    throw new Error(msg);
  }
  return data;
}

/** Trae mes por mes las métricas de redes desde Metricool para este cliente. */
export default function MetricoolSyncCard({ clientId, onDone }: { clientId: string; onDone?: () => void }) {
  const [brands, setBrands] = useState<{ id: number; label: string }[]>([]);
  const [blogId, setBlogId] = useState("");
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01`);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    call({ action: "brands" })
      .then((d) => setBrands(((d?.brands ?? []) as any[]).map((b) => ({ id: b.id, label: b.label }))))
      .catch(() => setBrands([]));
    supabase.from("client_portal_social_metrics").select("raw").eq("client_id", clientId).eq("source", "metricool").limit(1)
      .then(({ data }) => { const id = (data?.[0] as any)?.raw?.blog_id; if (id) setBlogId(String(id)); });
  }, [clientId]);

  const run = async () => {
    if (!blogId) { toast.error("Elige la marca de Metricool"); return; }
    const [fy, fm] = from.split("-").map(Number);
    const now = new Date();
    const months: string[] = [];
    const c = new Date(Date.UTC(fy, fm - 1, 1));
    while (c <= now && months.length < 36) {
      months.push(`${c.getUTCFullYear()}-${String(c.getUTCMonth() + 1).padStart(2, "0")}`);
      c.setUTCMonth(c.getUTCMonth() + 1);
    }
    let saved = 0;
    try {
      for (let i = 0; i < months.length; i++) {
        setProgress(`${i + 1} de ${months.length}`);
        const d = await call({ action: "sync", clientId, blogId, month: months[i] });
        saved += d?.saved ?? 0;
      }
      toast.success(`Metricool: ${months.length} meses actualizados (${saved} registros por red)`);
      onDone?.();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo leer Metricool");
    } finally {
      setProgress(null);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="text-sm font-semibold">Traer datos de Metricool</div>
      <p className="text-xs text-muted-foreground">
        Jala mes por mes seguidores, publicaciones, interacciones y las mejores publicaciones de cada red. Volver a correrlo actualiza sin duplicar.
      </p>
      <div className="grid gap-3 sm:grid-cols-3 items-end">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Marca en Metricool</Label>
          <Select value={blogId} onValueChange={setBlogId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Elige la marca" /></SelectTrigger>
            <SelectContent>
              {brands.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Desde (mes)</Label>
          <Input type="month" className="h-9" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
      </div>
      <Button size="sm" onClick={run} disabled={!!progress}>
        {progress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
        {progress ? `Trayendo ${progress}…` : "Traer datos"}
      </Button>
    </Card>
  );
}
