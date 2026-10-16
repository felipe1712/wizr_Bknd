import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Download, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { useGabineteData, fmtNum, fmtPct, pctDelta } from "./useGabineteData";
import { usePortalFreshness, fmtDay } from "./usePortalFreshness";

type Semaforo = "verde" | "ambar" | "rojo";

const SEM_COLOR: Record<Semaforo, string> = {
  verde: "#10b981",
  ambar: "#f59e0b",
  rojo: "#ef4444",
};

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/**
 * Big Picture ejecutivo: una sola pantalla (y un solo PDF) con el semáforo de
 * todo el gabinete, quién sube, quién baja y las alertas de prensa de la semana.
 */
export default function PortalBigPicture({ clientId, titulo }: { clientId: string; titulo: string }) {
  const gab = useGabineteData(clientId, 14);
  const fresh = usePortalFreshness(clientId);
  const { loading, dependencias, depById, periods, periodLabels, mentions, aggregate } = gab;
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const periodLabel = periodLabels[periodLabels.length - 1] ?? "";
  const prevLabel = periodLabels[periodLabels.length - 2] ?? "";

  const curr = useMemo(
    () => aggregate(periods.filter((p) => p.period_label === periodLabel).map((p) => p.id), "combinado"),
    [aggregate, periods, periodLabel],
  );
  const prev = useMemo(
    () => aggregate(periods.filter((p) => p.period_label === prevLabel).map((p) => p.id), "combinado"),
    [aggregate, periods, prevLabel],
  );

  const engAvg = useMemo(() => {
    const vals = Array.from(curr.values()).map((v) => v.engagement).filter((v): v is number => v != null && v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [curr]);

  const pressByDep = useMemo(() => {
    const from = isoDaysAgo(6);
    const m = new Map<string, { total: number; neg: number }>();
    for (const r of mentions) {
      if (r.fecha < from || !r.dep) continue;
      const e = m.get(r.dep) ?? { total: 0, neg: 0 };
      e.total += 1;
      if (r.tono === "negativo" || r.tono === "crisis") e.neg += 1;
      m.set(r.dep, e);
    }
    return m;
  }, [mentions]);

  const filas = useMemo(() => {
    return dependencias.map((d) => {
      const v = curr.get(d.id);
      const p = prev.get(d.id);
      const dEng = pctDelta(v?.engagement, p?.engagement);
      const pr = pressByDep.get(d.id) ?? { total: 0, neg: 0 };
      const bajoPromedio = engAvg != null && v?.engagement != null && v.engagement < engAvg * 0.7;
      const caida = dEng != null && dEng <= -0.25;
      const prensaMala = pr.neg >= 2;
      const sinDatos = !v;
      let sem: Semaforo = "verde";
      if (sinDatos || (prensaMala && (bajoPromedio || caida))) sem = "rojo";
      else if (prensaMala || bajoPromedio || caida) sem = "ambar";
      return {
        id: d.id, nombre: d.nombre_corto || d.nombre, titular: d.titular,
        followers: v?.followers ?? null, engagement: v?.engagement ?? null,
        dEng, neg: pr.neg, total: pr.total, sem, sinDatos,
      };
    }).sort((a, b) => {
      const order: Semaforo[] = ["rojo", "ambar", "verde"];
      return order.indexOf(a.sem) - order.indexOf(b.sem) || (b.engagement ?? 0) - (a.engagement ?? 0);
    });
  }, [dependencias, curr, prev, pressByDep, engAvg]);

  const movers = useMemo(() => {
    const rows: { nombre: string; delta: number }[] = [];
    curr.forEach((v, id) => {
      const d = pctDelta(v.followers, prev.get(id)?.followers);
      if (d == null) return;
      rows.push({ nombre: depById.get(id)?.nombre_corto || depById.get(id)?.nombre || "—", delta: d });
    });
    return {
      suben: rows.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5),
      bajan: rows.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5),
    };
  }, [curr, prev, depById]);

  const alertas = useMemo(() => {
    return Array.from(pressByDep.entries())
      .filter(([, v]) => v.neg >= 1)
      .sort((a, b) => b[1].neg - a[1].neg)
      .slice(0, 3)
      .map(([id, v]) => ({
        nombre: depById.get(id)?.nombre ?? "—",
        dato: `${v.neg} de ${v.total} menciones de los últimos 7 días con tono negativo o de crisis.`,
      }));
  }, [pressByDep, depById]);

  const conteo = useMemo(() => ({
    rojo: filas.filter((f) => f.sem === "rojo").length,
    ambar: filas.filter((f) => f.sem === "ambar").length,
    verde: filas.filter((f) => f.sem === "verde").length,
  }), [filas]);

  const conclusion = useMemo(() => {
    if (!filas.length) return "Sin datos suficientes para evaluar al gabinete esta semana.";
    const peor = filas.find((f) => f.sem === "rojo" && !f.sinDatos);
    const mejor = filas.slice().sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))[0];
    return `${conteo.verde} de ${filas.length} dependencias en verde, ${conteo.ambar} en ámbar y ${conteo.rojo} en rojo.` +
      (peor ? ` La atención de la semana está en ${peor.nombre}.` : "") +
      (mejor?.engagement ? ` El mejor desempeño en redes es de ${mejor.nombre} con ${fmtPct(mejor.engagement, 2)} de engagement.` : "");
  }, [filas, conteo]);

  const descargar = async () => {
    if (!ref.current) return;
    setDownloading(true);
    const { default: html2pdf } = await import("html2pdf.js");
    toast.loading("Generando Big Picture…", { id: "bp" });
    try {
      await html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: `big-picture-${new Date().toISOString().slice(0, 10)}.pdf`,
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 1120 },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["css", "legacy"] },
      } as any).from(ref.current).save();
      toast.success("Big Picture descargado", { id: "bp" });
    } catch {
      toast.error("No se pudo generar el PDF", { id: "bp" });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <Skeleton className="h-[520px] rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold">Big Picture del gabinete</h2>
          <p className="text-xs text-muted-foreground">
            Semana al {fmtDay(fresh.pressThrough)} · redes: {periodLabel || "sin periodo"}
          </p>
        </div>
        <Button size="sm" onClick={descargar} disabled={downloading}>
          <Download className="w-4 h-4 mr-2" /> Descargar PDF
        </Button>
      </div>

      <div ref={ref} className="bg-white text-[#111] rounded-2xl p-6 space-y-4" style={{ width: "100%" }}>
        <div className="flex items-baseline justify-between border-b border-[#e5e5e5] pb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#888]">{titulo}</div>
            <div className="text-xl font-bold">Big Picture semanal</div>
          </div>
          <div className="text-[11px] text-[#666] text-right">
            Prensa hasta {fmtDay(fresh.pressThrough)}<br />Redes: {periodLabel || "—"}
          </div>
        </div>

        <p className="text-[13px] leading-relaxed">{conclusion}</p>

        <div className="flex gap-4 text-[11px]">
          {(["verde", "ambar", "rojo"] as Semaforo[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: SEM_COLOR[s] }} />
              {s === "verde" ? "Bien" : s === "ambar" ? "Atención" : "Crítico"} · {conteo[s]}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {filas.map((f) => (
            <div key={f.id} className="border border-[#eee] rounded-md px-2 py-1.5 flex items-start gap-2">
              <span className="inline-block w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: SEM_COLOR[f.sem] }} />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold leading-tight truncate">{f.nombre}</div>
                <div className="text-[9px] text-[#777] leading-tight">
                  {f.sinDatos ? "sin métricas" : `${fmtPct(f.engagement, 2)} · ${fmtNum(f.followers)} seg.`}
                  {f.neg > 0 && ` · ${f.neg} neg.`}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#888] mb-1.5">Quién sube</div>
            {movers.suben.length ? movers.suben.map((m) => (
              <div key={m.nombre} className="text-[11px] flex justify-between gap-2">
                <span className="truncate">{m.nombre}</span>
                <span className="text-emerald-600 shrink-0">+{fmtPct(m.delta)}</span>
              </div>
            )) : <p className="text-[11px] text-[#888] italic">Sin comparativo disponible.</p>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#888] mb-1.5">Quién baja</div>
            {movers.bajan.length ? movers.bajan.map((m) => (
              <div key={m.nombre} className="text-[11px] flex justify-between gap-2">
                <span className="truncate">{m.nombre}</span>
                <span className="text-rose-600 shrink-0">−{fmtPct(Math.abs(m.delta))}</span>
              </div>
            )) : <p className="text-[11px] text-[#888] italic">Sin comparativo disponible.</p>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#888] mb-1.5">Alertas de prensa</div>
            {alertas.length ? alertas.map((a) => (
              <div key={a.nombre} className="text-[11px] mb-1">
                <span className="font-semibold">{a.nombre}</span>
                <span className="text-[#666]"> — {a.dato}</span>
              </div>
            )) : <p className="text-[11px] text-[#888] italic">Sin menciones negativas en los últimos 7 días.</p>}
          </div>
        </div>

        <p className="text-[9px] text-[#999] border-t border-[#eee] pt-2">
          Semáforo determinista: rojo cuando hay prensa negativa concentrada junto con desempeño bajo o caída mayor a 25%;
          ámbar con una sola de esas señales; verde en el resto. KiMedia.
        </p>
      </div>

      <Card className="p-4 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Las señales son sugerencias calculadas sobre los datos cargados; requieren criterio humano antes de convertirse en instrucción.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
            <TrendingUp className="w-3.5 h-3.5" /> Crecimiento
          </div>
          <p className="text-xs text-muted-foreground">
            {movers.suben.length} dependencias crecieron en seguidores y {movers.bajan.length} retrocedieron
            entre {prevLabel || "—"} y {periodLabel || "—"}.
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
            <TrendingDown className="w-3.5 h-3.5" /> Cobertura
          </div>
          <p className="text-xs text-muted-foreground">
            {filas.filter((f) => f.sinDatos).length} de {filas.length} dependencias no tienen métricas registradas en el periodo.
          </p>
        </Card>
      </div>
    </div>
  );
}
