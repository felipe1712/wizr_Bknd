import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Lightbulb, Target, TrendingUp, TrendingDown, Clock, Bookmark, Share2, Type, Hash, CalendarCheck,
  Sparkles, Loader2, CheckCircle2, AlertTriangle, ExternalLink,
} from "lucide-react";
import { type Post, NET_LABEL as NET, SAVES_NETWORKS, themes as calcThemes } from "@/lib/portalInsightsCore";
import type { PdfSpec } from "./InsightsPdf";

const FMT: Record<string, string> = { carrusel: "Carrusel", image: "Imagen", video: "Video", reel: "Reel", album: "Álbum", photo: "Foto", status: "Texto", link: "Enlace", post: "Publicación" };
const fmtL = (f?: string) => FMT[(f ?? "").toLowerCase()] ?? (f ? f[0].toUpperCase() + f.slice(1) : "Otro");
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIAS_L = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const FRANJAS = [
  { k: "Madrugada", from: 0, to: 6 }, { k: "Mañana", from: 6, to: 12 }, { k: "Tarde", from: 12, to: 18 }, { k: "Noche", from: 18, to: 24 },
];
const nf = (v: number | null | undefined, d = 0) => v == null || !Number.isFinite(v) ? "—" : Number(v).toLocaleString("es-MX", { maximumFractionDigits: d });
const pct = (v: number | null) => v == null || !Number.isFinite(v) ? "—" : `${nf(v * 100, 1)}%`;
const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const er = (p: Post) => (p.reach ? p.interactions / p.reach : null);
const snippet = (t?: string, n = 90) => { const a = Array.from((t ?? "").replace(/\s+/g, " ").trim()); return a.length > n ? a.slice(0, n).join("") + "…" : a.join(""); };
const x = (v: number) => `${nf(v, 1)}×`;
/** Traduce un índice vs. su red a lenguaje claro. */
const veces = (v: number) => {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1.9 && v < 2.15) return "casi el doble de interacciones de lo normal";
  if (v >= 2.15) return `${nf(v, 1)} veces las interacciones de lo normal`;
  if (v >= 1.1) return `${Math.round((v - 1) * 100)}% más interacciones de lo normal`;
  if (v <= 0.9) return `${Math.round((1 - v) * 100)}% menos interacciones de lo normal`;
  return "lo normal en su red";
};
const corto = (v: number) => (v >= 1.1 ? `+${Math.round((v - 1) * 100)}%` : v <= 0.9 ? `−${Math.round((1 - v) * 100)}%` : "igual");

type ParrillaItem = { scheduled_date: string | null; network: string | null; status: string | null; title: string | null };

export default function PortalAprendizajes({
  clientId, posts, allPosts, periodLabel, from, to, onSpec,
}: { clientId: string; posts: Post[]; allPosts: Post[]; periodLabel: string; from: string; to: string; onSpec?: (s: Partial<PdfSpec>) => void }) {
  const [plan, setPlan] = useState<ParrillaItem[]>([]);
  const [ai, setAi] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    supabase.from("notion_parrilla_items").select("scheduled_date, network, status, title").eq("client_id", clientId)
      .then(({ data }) => setPlan((data ?? []) as ParrillaItem[]));
  }, [clientId]);
  useEffect(() => setAi(null), [periodLabel]);

  const a = useMemo(() => {
    // Todo se compara con "índice": interacciones de la pieza / promedio histórico de SU red.
    // Así TikTok (que rinde más en absoluto) no infla temas, horarios ni estilos.
    const cur = avg(posts.map((p) => p.idx));

    const matrix = new Map<string, Map<string, Post[]>>();
    posts.forEach((p) => {
      const f = fmtL(p.format); const m = matrix.get(p.network) ?? new Map(); const xs = m.get(f) ?? [];
      xs.push(p); m.set(f, xs); matrix.set(p.network, m);
    });
    const formatNet = [...matrix.entries()].map(([n, m]) => ({
      n, rows: [...m.entries()].map(([f, xs]) => { const v = xs.filter((p) => (p.views ?? 0) > 0); return { f, n: xs.length, avg: avg(xs.map((p) => p.interactions || 0)), reach: avg(xs.map((p) => p.reach || 0)), views: v.length ? avg(v.map((p) => p.views!)) : 0 }; }).sort((x, y) => y.avg - x.avg),
    }));

    const heat = DIAS.map(() => FRANJAS.map(() => [] as number[]));
    posts.forEach((p) => { const fi = FRANJAS.findIndex((f) => p.hour >= f.from && p.hour < f.to); heat[p.dow][fi].push(p.idx); });
    const heatMax = Math.max(1, ...heat.flat().map((xs) => avg(xs)));
    let bestSlot: { d: number; f: number; v: number; n: number } | null = null;
    heat.forEach((row, d) => row.forEach((xs, f) => { if (xs.length >= 2 && (!bestSlot || avg(xs) > bestSlot.v)) bestSlot = { d, f, v: avg(xs), n: xs.length }; }));

    const lenBuckets = [
      { k: "Corto (<150 car.)", test: (l: number) => l < 150 }, { k: "Medio (150–400)", test: (l: number) => l >= 150 && l <= 400 },
      { k: "Largo (>400)", test: (l: number) => l > 400 },
    ].map((b) => { const xs = posts.filter((p) => b.test(Array.from(p.text ?? "").length)); return { k: b.k, n: xs.length, avg: avg(xs.map((p) => p.idx)) }; });

    const withQ = posts.filter((p) => /\?/.test(p.text ?? "")); const noQ = posts.filter((p) => !/\?/.test(p.text ?? ""));
    const qEffect = withQ.length >= 2 && noQ.length >= 2 ? { withQ: avg(withQ.map((p) => p.idx)), noQ: avg(noQ.map((p) => p.idx)), nQ: withQ.length } : null;

    const th = calcThemes(allPosts);
    const themesUp = th.filter((t) => t.lift >= 1.15).slice(0, 8);
    const themesDown = [...th].reverse().filter((t) => t.lift < 0.8).slice(0, 5);

    // Contenido de valor: guardados solo existen en Instagram; compartidos en todas.
    const savesTop = posts.filter((p) => SAVES_NETWORKS.has(p.network) && (p.saves ?? 0) > 0 && p.reach > 0)
      .map((p) => ({ p, q: (p.saves ?? 0) / p.reach })).sort((x, y) => y.q - x.q).slice(0, 3);
    const sharesTop = posts.filter((p) => (p.shares ?? 0) > 0 && p.reach > 0)
      .map((p) => ({ p, q: (p.shares ?? 0) / p.reach })).sort((x, y) => y.q - x.q).slice(0, 3);

    const withEr = posts.filter((p) => p.reach >= 100);
    const byEr = [...withEr].sort((x, y) => (er(y) ?? 0) - (er(x) ?? 0));
    const top = byEr.slice(0, 4); const bottom = byEr.length > 4 ? byEr.slice(-4).reverse() : [];

    const days = Math.max(1, (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000 + 1);
    const freq = Object.entries(posts.reduce<Record<string, number>>((acc, p) => { acc[p.network] = (acc[p.network] ?? 0) + 1; return acc; }, {}))
      .map(([n, c]) => ({ n, perWeek: (c / days) * 7, c }));

    const inPeriod = plan.filter((i) => i.scheduled_date && i.scheduled_date >= from && i.scheduled_date <= to);
    const planned = inPeriod.length;
    const pubDates = new Set(posts.map((p) => p.day));
    const delivered = inPeriod.filter((i) => pubDates.has(i.scheduled_date!)).length;

    return { cur, formatNet, heat, heatMax, bestSlot: bestSlot as any, lenBuckets, qEffect, themesUp, themesDown, savesTop, sharesTop, top, bottom, freq, planned, delivered, days };
  }, [posts, allPosts, plan, from, to]);

  const recs = useMemo(() => {
    const out: { tipo: "hacer" | "dejar" | "probar"; titulo: string; porque: string }[] = [];
    a.formatNet.forEach(({ n, rows }) => {
      const good = rows.filter((r) => r.n >= 2);
      if (good.length >= 2 && good[0].avg > good[good.length - 1].avg * 1.5) {
        out.push({ tipo: "hacer", titulo: `En ${NET[n] ?? n}, prioriza ${good[0].f}`, porque: `Promedia ${nf(good[0].avg)} interacciones (${good[0].n} piezas) contra ${nf(good[good.length - 1].avg)} de ${good[good.length - 1].f}.` });
      }
    });
    if (a.bestSlot) out.push({ tipo: "hacer", titulo: `Programa las piezas clave el ${DIAS_L[a.bestSlot.d]} por la ${FRANJAS[a.bestSlot.f].k.toLowerCase()}`, porque: `Ahí las piezas rinden ${x(a.bestSlot.v)} el promedio de su red (${a.bestSlot.n} publicaciones, hora de CDMX).` });
    const lb = a.lenBuckets.filter((b) => b.n >= 3).sort((x, y) => y.avg - x.avg);
    if (lb.length >= 2 && lb[0].avg > lb[lb.length - 1].avg * 1.3) out.push({ tipo: "probar", titulo: `Textos de largo ${lb[0].k.split(" ")[0].toLowerCase()}`, porque: `Rinden ${x(lb[0].avg)} el promedio de su red vs. ${x(lb[lb.length - 1].avg)} los de largo ${lb[lb.length - 1].k.split(" ")[0].toLowerCase()}.` });
    if (a.qEffect && Math.abs(a.qEffect.withQ - a.qEffect.noQ) > 0.15) {
      const up = a.qEffect.withQ > a.qEffect.noQ;
      out.push({ tipo: up ? "hacer" : "probar", titulo: up ? "Cierra con una pregunta" : "Revisa cómo se formulan las preguntas", porque: `Con pregunta rinden ${x(a.qEffect.withQ)} el promedio de su red; sin pregunta, ${x(a.qEffect.noQ)} (${a.qEffect.nQ} piezas con pregunta).` });
    }
    // Temas: nunca "haz más de X" (vuelve la cuenta monotemática). Se recomienda replicar el ENFOQUE.
    const tu = a.themesUp.find((t: any) => t.sample);
    if (tu) out.push({ tipo: "probar", titulo: "Llevar el enfoque de las piezas que más conectaron a otros temas", porque: `Las ${tu.n} publicaciones del año como «${tu.sample}» lograron ${veces(tu.lift)}. No se trata de repetir ese tema (la cuenta se volvería monotemática), sino de identificar qué tenían —personaje, historia concreta, pregunta, formato— y usarlo en los demás temas del calendario.` });
    if (a.days >= 14) a.freq.filter((f) => f.perWeek < 2).forEach((f) => out.push({ tipo: "probar", titulo: `Subir frecuencia en ${NET[f.n] ?? f.n}`, porque: `Hoy se publica ${nf(f.perWeek, 1)} veces por semana (${f.c} en el periodo); con tan poco volumen el algoritmo tiene poco que distribuir.` }));
    if (a.planned && a.delivered / a.planned < 0.8) out.push({ tipo: "dejar", titulo: "Cerrar la brecha entre parrilla y publicación", porque: `De ${a.planned} piezas planeadas en Notion para el periodo, ${a.delivered} coinciden con un día publicado.` });
    return out;
  }, [a]);

  useEffect(() => {
    onSpec?.({
      kpis: [
        { label: "Publicaciones", value: nf(posts.length) },
        { label: "Rendimiento vs. su red", value: x(a.cur), note: "1× = promedio histórico" },
        { label: "Parrilla cumplida", value: a.planned ? `${a.delivered}/${a.planned}` : "—" },
        { label: "Mejor franja", value: a.bestSlot ? `${DIAS[a.bestSlot.d]} ${FRANJAS[a.bestSlot.f].k.toLowerCase()}` : "—" },
      ],
      recs: recs.map((r) => ({ tag: r.tipo === "hacer" ? "Hacer más" : r.tipo === "dejar" ? "Ajustar" : "Probar", title: r.titulo, body: r.porque })),
      bullets: ai ? [{ title: "Lectura estratégica", items: ai.split(/\n+/).map((l) => l.trim()).filter(Boolean) }] : undefined,
      tables: [
        { title: "Lo que funcionó", subtitle: "Mayor tasa de interacción sobre alcance", columns: [{ h: "Pieza", w: 52 }, { h: "Red", w: 14, align: "left" }, { h: "Fecha", w: 10 }, { h: "Interacc.", w: 12 }, { h: "Tasa", w: 12 }],
          rows: a.top.map((p) => [snippet(p.text, 110), NET[p.network], p.day.slice(5).split("-").reverse().join("/"), nf(p.interactions), pct(er(p))]) },
        ...(a.bottom.length ? [{ title: "Lo que no conectó", columns: [{ h: "Pieza", w: 52 }, { h: "Red", w: 14, align: "left" as const }, { h: "Fecha", w: 10 }, { h: "Interacc.", w: 12 }, { h: "Tasa", w: 12 }],
          rows: a.bottom.map((p) => [snippet(p.text, 110), NET[p.network], p.day.slice(5).split("-").reverse().join("/"), nf(p.interactions), pct(er(p))]) }] : []),
        { title: "Temas que mueven a la comunidad", subtitle: "Rendimiento de las piezas que mencionan el tema vs. el promedio de su red (todo el año)", columns: [{ h: "Tema", w: 40 }, { h: "Piezas", w: 20 }, { h: "Rendimiento", w: 20 }, { h: "Lectura", w: 20 }],
          rows: [...a.themesUp, ...a.themesDown].map((t) => [t.w, t.n, x(t.lift), t.lift >= 1 ? "Arriba" : "Abajo"]) },
      ],
    });
  }, [a, recs, ai, posts.length, onSpec]);

  const genAi = async () => {
    setAiLoading(true);
    const payload = {
      periodo: periodLabel,
      nota: "Los 'veces_promedio' comparan cada pieza con el promedio histórico de SU red (1 = promedio).",
      rendimiento_periodo_vs_red: +a.cur.toFixed(2),
      formato_por_red: a.formatNet.map((x) => ({ red: NET[x.n], formatos: x.rows.map((r: any) => ({ formato: r.f, piezas: r.n, promedio_interacciones: Math.round(r.avg), promedio_alcance: Math.round(r.reach), promedio_vistas: r.views ? Math.round(r.views) : null })) })),
      mejor_franja_cdmx: a.bestSlot ? { dia: DIAS_L[a.bestSlot.d], franja: FRANJAS[a.bestSlot.f].k, veces_promedio: +a.bestSlot.v.toFixed(2), piezas: a.bestSlot.n } : null,
      largo_texto: a.lenBuckets.map((b) => ({ tipo: b.k, piezas: b.n, veces_promedio: +b.avg.toFixed(2) })),
      efecto_preguntas: a.qEffect && { con_pregunta: +a.qEffect.withQ.toFixed(2), sin_pregunta: +a.qEffect.noQ.toFixed(2), piezas_con_pregunta: a.qEffect.nQ },
      piezas_que_conectaron_ejemplos: a.themesUp.filter((t: any) => t.sample).slice(0, 4).map((t: any) => ({ ejemplo: t.sample, piezas_parecidas: t.n, veces_promedio: +t.lift.toFixed(2) })),
      frecuencia_semanal: a.freq.map((f) => ({ red: NET[f.n], por_semana: +f.perWeek.toFixed(1) })),
      mejores: a.top.map((p) => ({ red: NET[p.network], formato: fmtL(p.format), texto: snippet(p.text, 220), interacciones: p.interactions, alcance: p.reach, vistas: p.views || null, compartidos: p.shares ?? null, guardados: p.saves ?? null })),
      peores: a.bottom.map((p) => ({ red: NET[p.network], formato: fmtL(p.format), texto: snippet(p.text, 220), interacciones: p.interactions, alcance: p.reach, vistas: p.views || null })),
      mas_vistas: [...posts].filter((p) => (p.views ?? 0) > 0).sort((p, q) => (q.views ?? 0) - (p.views ?? 0)).slice(0, 4).map((p) => ({ red: NET[p.network], formato: fmtL(p.format), texto: snippet(p.text, 160), vistas: p.views, interacciones: p.interactions })),
      parrilla: { planeadas: a.planned, coinciden_con_publicacion: a.delivered },
    };
    const { data, error } = await supabase.functions.invoke("portal-strategy-ai", { body: { data: payload } });
    setAiLoading(false);
    if (error || !(data as any)?.text) { toast.error("No se pudo generar la lectura"); return; }
    setAi((data as any).text);
  };

  if (!posts.length) return <Card className="glass border-border/50 p-12 text-center text-sm text-muted-foreground">No hay publicaciones en este periodo.</Card>;

  const recStyle = { hacer: { icon: CheckCircle2, cls: "text-emerald-500", label: "Hacer más" }, dejar: { icon: AlertTriangle, cls: "text-coral", label: "Ajustar" }, probar: { icon: Lightbulb, cls: "text-amber-500", label: "Probar" } };

  return (
    <div className="space-y-5">
      <Card className="glass border-border/50 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-semibold"><Target className="w-4 h-4 text-coral" /> Qué hacer el próximo periodo</div>
          <Button size="sm" variant="outline" onClick={genAi} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} Lectura estratégica con IA
          </Button>
        </div>
        {ai && <div className="rounded-xl border border-coral/30 bg-coral/5 p-4 text-sm whitespace-pre-line leading-relaxed">{ai}</div>}
        {recs.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {recs.map((r, i) => { const S = recStyle[r.tipo]; return (
              <div key={i} className="rounded-xl border border-border/50 p-4 space-y-1.5">
                <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wide ${S.cls}`}><S.icon className="w-3.5 h-3.5" /> {S.label}</div>
                <div className="text-sm font-semibold">{r.titulo}</div>
                <div className="text-xs text-muted-foreground">{r.porque}</div>
              </div>
            ); })}
          </div>
        ) : <p className="text-sm text-muted-foreground">Todavía no hay volumen suficiente para recomendaciones firmes en este periodo.</p>}
        <p className="text-[11px] text-muted-foreground">Para comparar redes distintas usamos el rendimiento de cada pieza contra el promedio de su propia red: "1.5×" = rinde 50% más de lo habitual en esa red.</p>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <PostList title="Lo que funcionó" subtitle="Mayor tasa de interacción sobre alcance (piezas con 100+ de alcance)" icon={TrendingUp} posts={a.top} tone="good" />
        {a.bottom.length > 0 && <PostList title="Lo que no conectó" subtitle="Menor tasa de interacción sobre alcance" icon={TrendingDown} posts={a.bottom} tone="bad" />}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="glass border-border/50 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><Clock className="w-4 h-4 text-coral" /> Cuándo publicar</div>
          <div className="grid grid-cols-[48px_repeat(4,1fr)] gap-1 text-[11px]">
            <div />{FRANJAS.map((f) => <div key={f.k} className="text-center text-muted-foreground">{f.k}</div>)}
            {DIAS.map((d, di) => (
              <Fragment key={d}>
                <div className="text-muted-foreground flex items-center">{d}</div>
                {FRANJAS.map((f, fi) => { const xs = a.heat[di][fi]; const v = avg(xs); return (
                  <div key={d + f.k} title={`${xs.length} piezas`} className="h-9 rounded-md flex items-center justify-center font-medium"
                    style={{ background: xs.length ? `hsl(15 95% 55% / ${0.1 + (v / a.heatMax) * 0.8})` : "hsl(var(--muted) / 0.4)" }}>
                    {xs.length ? `${nf(v, 1)}×` : ""}
                  </div>
                ); })}
              </Fragment>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Rendimiento vs. el promedio de su red, según día y hora de publicación (hora de CDMX).</p>
        </Card>

        <Card className="glass border-border/50 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 text-coral" /> Qué formato rinde en cada red</div>
          <div className="space-y-4">
            {a.formatNet.map(({ n, rows }) => { const max = Math.max(1, ...rows.map((r) => r.avg)); return (
              <div key={n} className="space-y-1.5">
                <div className="text-xs font-semibold">{NET[n] ?? n}</div>
                {rows.map((r) => (
                  <div key={r.f} className="grid grid-cols-[90px_1fr_110px] items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{r.f}</span>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden"><div className="h-full bg-coral rounded-full" style={{ width: `${(r.avg / max) * 100}%` }} /></div>
                    <span className="text-right">{nf(r.avg)} <span className="text-muted-foreground">· {r.n} pzs</span></span>
                  </div>
                ))}
              </div>
            ); })}
          </div>
          <p className="text-[11px] text-muted-foreground">Interacciones promedio por pieza.</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="glass border-border/50 p-5 space-y-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold"><Hash className="w-4 h-4 text-coral" /> Las piezas que más conectaron en el año</div>
            <p className="text-[11px] text-muted-foreground mt-1">Ejemplos reales de publicaciones que lograron más interacciones de lo normal en su red. Sirven para entender qué enfoque funciona, no para repetir el mismo tema.</p>
          </div>
          {a.themesUp.filter((t: any) => t.sample).length ? (
            <div className="space-y-2.5">
              {a.themesUp.filter((t: any) => t.sample).slice(0, 4).map((t: any) => (
                <div key={t.w} className="rounded-lg border border-border/50 p-2.5 text-xs space-y-1">
                  <p className="italic">«{t.sample}»</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{t.n} publicaciones parecidas · {veces(t.lift)}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">Todavía no hay suficientes publicaciones parecidas para sacar un patrón.</p>}
        </Card>
        <Card className="glass border-border/50 p-5 space-y-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold"><Type className="w-4 h-4 text-coral" /> Cómo están escritos los textos</div>
            <p className="text-[11px] text-muted-foreground mt-1">Cuántas interacciones logran los textos según su largo y si invitan a responder, comparado con lo normal en su red.</p>
          </div>
          {a.lenBuckets.filter((b) => b.n).map((b) => <Row key={b.k} k={`${b.k} · ${b.n} piezas`} v={corto(b.avg)} />)}
          {a.qEffect && <>
            <Row k={`Terminan con pregunta · ${a.qEffect.nQ} piezas`} v={corto(a.qEffect.withQ)} />
            <Row k="Sin pregunta" v={corto(a.qEffect.noQ)} />
          </>}
          <p className="text-[11px] text-muted-foreground">"+30%" = 30% más interacciones de lo normal; "igual" = sin diferencia relevante.</p>
        </Card>
        <Card className="glass border-border/50 p-5 space-y-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck className="w-4 h-4 text-coral" /> Cuánto publicamos</div>
            <p className="text-[11px] text-muted-foreground mt-1">Publicaciones por red en el periodo y qué tanto del calendario planeado salió.</p>
          </div>
          {a.freq.map((f) => <Row key={f.n} k={NET[f.n] ?? f.n} v={`${f.c} piezas (${nf(f.perWeek, 1)} a la semana)`} />)}
          {a.planned > 0 && <Row k="Del calendario planeado" v={`se publicaron ${a.delivered} de ${a.planned}`} />}
          <Row k="Respuesta frente a lo normal" v={corto(a.cur)} />
        </Card>
      </div>

      <Card className="glass border-border/50 p-5 space-y-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Bookmark className="w-4 h-4 text-coral" /> Contenido de valor</div>
          <p className="text-xs text-muted-foreground">Guardar o compartir indica que la pieza se quiso conservar o recomendar. Metricool solo entrega guardados de Instagram; Facebook y TikTok no los reportan.</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <ValueList title="Más guardados (Instagram)" icon={Bookmark} items={a.savesTop} metric={(p) => p.saves ?? 0} empty="Sin guardados registrados en Instagram este periodo." />
          <ValueList title="Más compartidos (todas las redes)" icon={Share2} items={a.sharesTop} metric={(p) => p.shares ?? 0} empty="Sin compartidos este periodo." />
        </div>
      </Card>
    </div>
  );
}

function ValueList({ title, icon: Icon, items, metric, empty }: { title: string; icon: any; items: { p: Post; q: number }[]; metric: (p: Post) => number; empty: string }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-coral" />{title}</div>
      {items.length ? items.map(({ p, q }, i) => (
        <a key={i} href={p.url} target="_blank" rel="noreferrer" className="rounded-xl border border-border/50 p-2.5 flex gap-3 hover:border-coral/40 transition-colors">
          {p.image ? <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" loading="lazy" referrerPolicy="no-referrer" /> : <div className="w-12 h-12 rounded-lg bg-muted shrink-0" />}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-[11px] text-muted-foreground">{NET[p.network]} · {fmtL(p.format)} · {p.day.slice(5).split("-").reverse().join("/")}</div>
            <div className="text-xs line-clamp-2">{snippet(p.text, 90)}</div>
            <div className="text-[11px]"><span className="font-semibold">{nf(metric(p))}</span> <span className="text-coral font-medium">· {pct(q)} de quienes la vieron</span></div>
          </div>
        </a>
      )) : <p className="text-xs text-muted-foreground">{empty}</p>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 text-xs border-b border-border/40 pb-1.5 last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>;
}

function PostList({ title, subtitle, icon: Icon, posts, tone }: { title: string; subtitle: string; icon: any; posts: Post[]; tone: "good" | "bad" }) {
  return (
    <Card className="glass border-border/50 p-5 space-y-3">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold"><Icon className={`w-4 h-4 ${tone === "good" ? "text-emerald-500" : "text-coral"}`} /> {title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
      <div className="space-y-2">
        {posts.length ? posts.map((p, i) => (
          <a key={i} href={p.url} target="_blank" rel="noreferrer" className="flex gap-3 rounded-xl border border-border/50 p-2.5 hover:border-coral/40 transition-colors">
            {p.image ? <img src={p.image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" referrerPolicy="no-referrer" /> : <div className="w-14 h-14 rounded-lg bg-muted shrink-0" />}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">{NET[p.network]} · {fmtL(p.format)} · {p.day.slice(5).split("-").reverse().join("/")} <ExternalLink className="w-3 h-3 ml-auto" /></div>
              <div className="text-xs line-clamp-2">{snippet(p.text, 110)}</div>
              <div className="text-[11px]"><span className={tone === "good" ? "text-emerald-500 font-medium" : "text-coral font-medium"}>{pct(er(p))}</span> <span className="text-muted-foreground">· {nf(p.interactions)} interacciones · {nf(p.reach)} alcance</span></div>
            </div>
          </a>
        )) : <p className="text-xs text-muted-foreground">Sin piezas con alcance suficiente.</p>}
      </div>
    </Card>
  );
}
