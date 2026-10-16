import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import PortalAprendizajes from "./PortalAprendizajes";
import InsightsPdf, { downloadPdf, type PdfSpec } from "./InsightsPdf";
import { useWebRows, channelsOf, webReading, dur } from "./PortalWebsite";
import {
  type Social, type Ad, type Post, type Win, NET_LABEL, SAVES_NETWORKS,
  buildPosts, buildFollowers, buildWindows, aggregate, adsIn, sumAds, isMonthly, isWeekly, monthLabel, dayLabel,
} from "@/lib/portalInsightsCore";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ComposedChart,
} from "recharts";
import {
  Users, TrendingUp, MessageCircle, Eye, Megaphone, Download, Sparkles, ArrowUpRight, ArrowDownRight,
  Heart, Share2, Bookmark, Play, ExternalLink, Clock, CalendarDays, LayoutGrid, Table2, Info, ArrowUpDown,
} from "lucide-react";

export type InsightsView = "panorama" | "contenido" | "publicidad" | "aprendizajes";

const NET: Record<string, { label: string; color: string }> = {
  instagram: { label: "Instagram", color: "hsl(330 85% 60%)" },
  facebook: { label: "Facebook", color: "hsl(220 85% 60%)" },
  tiktok: { label: "TikTok", color: "hsl(185 85% 50%)" },
  youtube: { label: "YouTube", color: "hsl(0 85% 55%)" },
  linkedin: { label: "LinkedIn", color: "hsl(205 80% 45%)" },
  x: { label: "X", color: "hsl(0 0% 60%)" },
};
const FORMAT_LABEL: Record<string, string> = {
  carrusel: "Carrusel", image: "Imagen", video: "Video", reel: "Reel", album: "Álbum", photo: "Foto",
  status: "Texto", link: "Enlace", post: "Publicación",
};
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const nf = (v: number | null | undefined, d = 0) =>
  v == null || !Number.isFinite(v) ? "—" : Number(v).toLocaleString("es-MX", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const money = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `$${Number(v).toLocaleString("es-MX", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
const pctf = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : `${nf(v * 100, d)}%`);
const fmtLabel = (f?: string) => FORMAT_LABEL[(f ?? "").toLowerCase()] ?? (f ? f[0].toUpperCase() + f.slice(1) : "Otro");
const snippet = (t?: string, n = 90) => { const a = Array.from((t ?? "").replace(/\s+/g, " ").trim()); return a.length > n ? a.slice(0, n).join("") + "…" : a.join(""); };
const ddmm = (d: string) => d.slice(5).split("-").reverse().join("/");
const change = (cur: number | null, prev: number | null) => (cur == null || prev == null || !prev ? null : (cur - prev) / Math.abs(prev));

function Delta({ cur, prev, invert, label = "vs. periodo anterior" }: { cur: number | null; prev: number | null; invert?: boolean; label?: string }) {
  const p = change(cur, prev);
  if (p == null) return null;
  if (Math.abs(p) < 0.005) return <span className="text-[11px] text-muted-foreground">sin cambio</span>;
  const good = invert ? p < 0 : p > 0;
  const Icon = p > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${good ? "text-emerald-500" : "text-red-500"}`}>
      <Icon className="w-3 h-3" />{nf(Math.abs(p) * 100, 1)}% {label}
    </span>
  );
}
const deltaNote = (cur: number | null, prev: number | null, invert = false): { note?: string; tone?: "up" | "down" | "flat" } => {
  const p = change(cur, prev);
  if (p == null) return {};
  if (Math.abs(p) < 0.005) return { note: "sin cambio", tone: "flat" };
  return { note: `${p > 0 ? "▲" : "▼"} ${nf(Math.abs(p) * 100, 1)}% vs. anterior`, tone: (invert ? p < 0 : p > 0) ? "up" : "down" };
};

function Kpi({ icon: Icon, label, value, cur, prev, hint, invert }: any) {
  return (
    <Card className="glass border-border/50 p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3.5 h-3.5 text-coral" /> {label}
      </div>
      <div className="text-2xl font-display font-bold">{value}</div>
      <Delta cur={cur ?? null} prev={prev ?? null} invert={invert} />
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

const tooltipStyle = {
  contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "hsl(var(--foreground))" },
};
const axis = { tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } };

type SortKey = "day" | "interactions" | "reach" | "rate" | "saves" | "shares" | "comments" | "views" | "idx";

export default function PortalInsights({ clientId, clientName, view }: { clientId: string; clientName: string; view: InsightsView }) {
  const [social, setSocial] = useState<Social[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>("");
  const [netFilter, setNetFilter] = useState("all");
  const [fmtFilter, setFmtFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("interactions");
  const [layout, setLayout] = useState<"cards" | "table">("cards");
  const [downloading, setDownloading] = useState(false);
  const [learnSpec, setLearnSpec] = useState<Partial<PdfSpec>>({});
  const pdfRef = useRef<HTMLDivElement>(null);
  const webRows = useWebRows(clientId);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [s, a] = await Promise.all([
        supabase.from("client_portal_social_metrics").select("*").eq("client_id", clientId).order("period_start").limit(1000),
        supabase.from("client_portal_ads_metrics").select("*").eq("client_id", clientId).order("period_start").limit(2000),
      ]);
      if (!alive) return;
      setSocial((s.data ?? []) as Social[]);
      setAds((a.data ?? []) as Ad[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [clientId]);

  const allPosts = useMemo(() => buildPosts(social), [social]);
  const followers = useMemo(() => buildFollowers(social), [social]);
  const networks = useMemo(() => [...new Set(social.map((r) => r.network))], [social]);
  const windows = useMemo(() => buildWindows(social, ads, allPosts), [social, ads, allPosts]);

  useEffect(() => {
    if (windows.length && !windows.some((w) => w.key === range)) setRange(windows[0].key);
  }, [windows, range]);

  const win: Win | undefined = windows.find((w) => w.key === range);
  const from = win?.from ?? "", to = win?.to ?? "";
  const cur = useMemo(() => (win ? aggregate(allPosts, followers, networks, win.from, win.to) : null), [win, allPosts, followers, networks]);
  const prev = useMemo(() => (win?.prev ? aggregate(allPosts, followers, networks, win.prev.from, win.prev.to) : null), [win, allPosts, followers, networks]);
  const aCurRows = useMemo(() => (win ? adsIn(ads, win, win.kind) : []), [ads, win]);
  const aPrevRows = useMemo(() => (win?.prev ? adsIn(ads, win.prev, win.kind) : []), [ads, win]);
  const aCur = sumAds(aCurRows), aPrev = sumAds(aPrevRows);
  const posts = cur?.posts ?? [];

  // Seguidores comparables: solo redes con dato en ambos cortes
  const followersCmp = useMemo(() => {
    if (!cur || !prev) return { cur: null, prev: null };
    const nets = cur.byNet.filter((x) => x.followers != null && prev.byNet.find((y) => y.n === x.n)?.followers != null).map((x) => x.n);
    if (!nets.length) return { cur: null, prev: null };
    const s = (agg: typeof cur) => agg.byNet.filter((x) => nets.includes(x.n)).reduce((a, x) => a + (x.followers ?? 0), 0);
    return { cur: s(cur), prev: s(prev) };
  }, [cur, prev]);

  const cpr = aCur.results ? aCur.spend / aCur.results : null;
  const cprPrev = aPrev.results ? aPrev.spend / aPrev.results : null;

  // Serie temporal: por semana si el corte es semanal, por mes en lo demás
  const trend = useMemo(() => {
    if (!win) return [];
    const weekly = win.kind === "week";
    const buckets: { label: string; from: string; to: string; kind: Win["kind"] }[] = [];
    if (weekly) {
      windows.filter((w) => w.kind === "week" && w.from <= win.from).slice(0, 12).reverse().forEach((w) => buckets.push({ label: dayLabel(w.from), from: w.from, to: w.to, kind: "week" }));
    } else {
      windows.filter((w) => w.kind === "month").slice().reverse().forEach((w) => buckets.push({ label: monthLabel(w.months[0]), from: w.from, to: w.to, kind: "month" }));
    }
    return buckets.map((b) => {
      const g = aggregate(allPosts, followers, networks, b.from, b.to);
      const ad = sumAds(adsIn(ads, b, b.kind));
      const row: any = { mes: b.label, spend: ad.spend || null, results: ad.results || null, cpr: ad.results ? ad.spend / ad.results : null, ctr: ad.impressions ? (ad.clicks / ad.impressions) * 100 : null };
      g.byNet.forEach((x) => { row[`f_${x.n}`] = x.followers; row[`i_${x.n}`] = x.inter; });
      return row;
    });
  }, [win, windows, allPosts, followers, networks, ads]);

  // Formato por red: "Video en TikTok" no se mezcla con "Imagen en Instagram". Se puede leer
  // por interacciones, alcance o vistas; el índice compara contra lo habitual en SU red en esa métrica.
  const [fmtMetric, setFmtMetric] = useState<"interactions" | "reach" | "views">("interactions");
  const formats = useMemo(() => {
    const val = (p: Post) => Number((p as any)[fmtMetric]) || 0;
    const netAvg: Record<string, number> = {};
    for (const n of new Set(posts.map((p) => p.network))) {
      const xs = posts.filter((p) => p.network === n && val(p) > 0).map(val);
      netAvg[n] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    }
    const m = new Map<string, { n: number; inter: number; reach: number; views: number; nv: number; mv: number; nm: number; net: string; fmt: string }>();
    posts.forEach((p) => {
      const fmt = fmtLabel(p.format);
      const k = `${fmt}|${p.network}`;
      const x = m.get(k) ?? { n: 0, inter: 0, reach: 0, views: 0, nv: 0, mv: 0, nm: 0, net: p.network, fmt };
      x.n++; x.inter += p.interactions; x.reach += p.reach;
      if ((p.views ?? 0) > 0) { x.views += p.views!; x.nv++; }
      if (val(p) > 0) { x.mv += val(p); x.nm++; }
      m.set(k, x);
    });
    return [...m.values()].filter((v) => v.nm > 0).map((v) => {
      const prom = v.mv / v.nm;
      return {
        formato: `${v.fmt} · ${NET_LABEL[v.net] ?? v.net}`, publicaciones: v.n,
        promedio: Math.round(v.inter / v.n), alcance: Math.round(v.reach / v.n), vistas: v.nv ? Math.round(v.views / v.nv) : null,
        valor: Math.round(prom), indice: netAvg[v.net] ? +(prom / netAvg[v.net]).toFixed(2) : 0,
      };
    }).sort((a, b) => b.valor - a.valor);
  }, [posts, fmtMetric]);
  const fmtMetricLabel = { interactions: "interacciones", reach: "alcance", views: "vistas" }[fmtMetric];

  const weekdays = useMemo(() => {
    const m = Array.from({ length: 7 }, (_, i) => ({ dia: DIAS[i], n: 0, idx: 0 }));
    posts.forEach((p) => { m[p.dow].n++; m[p.dow].idx += p.idx; });
    return m.map((x) => ({ dia: x.dia.slice(0, 3), indice: x.n ? +(x.idx / x.n).toFixed(2) : 0, n: x.n, full: x.dia }));
  }, [posts]);

  const campaigns = useMemo(() => {
    const m = new Map<string, Ad & { periods: number }>();
    aCurRows.forEach((r) => {
      const k = `${r.platform}|${r.campaign_key}`;
      const x = m.get(k);
      if (!x) m.set(k, { ...r, periods: 1, raw: { ...r.raw, actions: { ...(r.raw?.actions ?? {}) } } });
      else {
        x.spend = (x.spend ?? 0) + (r.spend ?? 0); x.impressions = (x.impressions ?? 0) + (r.impressions ?? 0); x.reach = (x.reach ?? 0) + (r.reach ?? 0);
        x.clicks = (x.clicks ?? 0) + (r.clicks ?? 0); x.results = (x.results ?? 0) + (r.results ?? 0); x.periods++;
        for (const [a, v] of Object.entries(r.raw?.actions ?? {})) x.raw.actions[a] = (x.raw.actions[a] ?? 0) + (v as number);
      }
    });
    return [...m.values()].map((c) => ({
      ...c, cost_per_result: c.results ? (c.spend ?? 0) / c.results : null,
      ctr: c.impressions ? ((c.clicks ?? 0) / c.impressions) * 100 : null, cpm: c.impressions ? ((c.spend ?? 0) / c.impressions) * 1000 : null,
      cpc: c.clicks ? (c.spend ?? 0) / c.clicks : null, freq: c.reach ? (c.impressions ?? 0) / c.reach : null,
      replies: c.raw?.actions?.["onsite_conversion.messaging_first_reply"] ?? 0,
    })).sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  }, [aCurRows]);

  // ---------- Métricas de publicidad ----------
  const adm = useMemo(() => {
    const k = (t: typeof aCur, key: string) => t.actions[key] ?? 0;
    const mk = (t: typeof aCur) => ({
      ctr: t.impressions ? t.clicks / t.impressions : null,
      cpc: t.clicks ? t.spend / t.clicks : null,
      cpm: t.impressions ? (t.spend / t.impressions) * 1000 : null,
      freq: t.reach ? t.impressions / t.reach : null,
      convRate: t.clicks ? t.results / t.clicks : null,
      replies: k(t, "onsite_conversion.messaging_first_reply"),
      depth2: k(t, "onsite_conversion.messaging_user_depth_2_message_send"),
      replyRate: t.results ? k(t, "onsite_conversion.messaging_first_reply") / t.results : null,
      costPerReply: k(t, "onsite_conversion.messaging_first_reply") ? t.spend / k(t, "onsite_conversion.messaging_first_reply") : null,
      linkClicks: k(t, "link_click"), engagement: k(t, "post_engagement"), saves: k(t, "onsite_conversion.post_save"),
      videoViews: k(t, "video_play_actions.video_views"), reactions: k(t, "post_reaction"),
    });
    return { cur: mk(aCur), prev: mk(aPrev) };
  }, [aCur, aPrev]);

  const isMsg = useMemo(() => campaigns.some((c) => /conversa|mensaj/i.test(c.result_type ?? "") || /MESSAG/i.test(c.objective ?? "")), [campaigns]);
  const resNoun = isMsg ? "conversaciones" : (campaigns[0]?.result_type ?? "resultados");
  const resTitle = resNoun[0].toUpperCase() + resNoun.slice(1);
  const adsReading = useMemo(() => {
    const out: string[] = [];
    if (!aCur.spend) return out;
    const rt = resNoun;
    out.push(`Se invirtieron ${money(aCur.spend)} y se obtuvieron ${nf(aCur.results)} ${rt}: cada una costó ${money(cpr)}${cprPrev ? `, ${cpr! < cprPrev ? "más barato" : "más caro"} que el periodo anterior (${money(cprPrev)})` : ""}.`);
    const vv = aCur.actions["video_view"] ?? 0, net = aCur.actions["post_interaction_net"] ?? 0;
    if (!isMsg && vv && aCur.results) out.push(`Ojo: ${nf((vv / aCur.results) * 100, 0)}% de esas ${rt} son reproducciones de video de al menos 3 segundos (${nf(vv)}); las reacciones, comentarios y compartidos fueron ${nf(net)}, a ${money(net ? aCur.spend / net : null)} cada una.`);
    if (isMsg && adm.cur.replyRate != null && adm.cur.replies) out.push(`De cada 10 conversaciones iniciadas, ${nf(adm.cur.replyRate * 10, 1)} recibieron primera respuesta (${nf(adm.cur.replies)} en total). Costo real por conversación respondida: ${money(adm.cur.costPerReply)}.`);
    if (adm.cur.ctr != null) out.push(`El ${pctf(adm.cur.ctr, 2)} de quienes vieron el anuncio dio clic (CTR). ${adm.cur.ctr >= 0.03 ? "Es un nivel alto: el creativo está llamando la atención." : adm.cur.ctr >= 0.01 ? "Es un nivel sano para campañas de mensajes." : "Es bajo: conviene probar otro creativo o mensaje."}`);
    if (adm.cur.freq != null) out.push(`Cada persona vio el anuncio ${nf(adm.cur.freq, 2)} veces en promedio. ${adm.cur.freq > 3 ? "Hay riesgo de cansancio: renovar creativos o ampliar público." : "Frecuencia sana: todavía hay espacio para repetir el mensaje."}`);
    if (adm.cur.convRate != null && adm.cur.convRate <= 1) out.push(`${pctf(adm.cur.convRate)} de los clics terminó en ${rt}.`);
    if (cur?.reach) out.push(`El alcance pagado (${nf(aCur.reach)} personas) equivale a ${nf(aCur.reach / cur.reach, 1)}× el alcance orgánico del mismo periodo (${nf(cur.reach)}).`);
    const best = [...campaigns].filter((c) => c.results).sort((a, b) => (a.cost_per_result ?? 1e9) - (b.cost_per_result ?? 1e9));
    if (best.length > 1) out.push(`La campaña más eficiente fue "${best[0].campaign_name}" con ${money(best[0].cost_per_result)} por resultado; la menos eficiente, "${best[best.length - 1].campaign_name}" con ${money(best[best.length - 1].cost_per_result)}.`);
    return out;
  }, [aCur, adm, campaigns, cpr, cprPrev, cur, isMsg, resNoun]);

  const adsRecs = useMemo(() => {
    const out: string[] = [];
    if (!aCur.spend) return out;
    if (isMsg && adm.cur.replyRate != null && adm.cur.replyRate < 0.8) out.push(`Responder más rápido en mensajería directa: ${nf((1 - adm.cur.replyRate) * 100)}% de las conversaciones pagadas no recibió primera respuesta registrada.`);
    if (adm.cur.freq != null && adm.cur.freq > 2.5) out.push("Rotar el creativo: la frecuencia ya supera 2.5 vistas por persona.");
    if (cprPrev && cpr && cpr > cprPrev * 1.15) out.push(`Revisar segmentación o creativo: el costo por resultado subió ${nf(((cpr - cprPrev) / cprPrev) * 100)}% vs. el periodo anterior.`);
    if (cprPrev && cpr && cpr < cprPrev * 0.9) out.push("Considerar subir presupuesto: el costo por resultado bajó y la campaña está respondiendo.");
    if (adm.cur.ctr != null && adm.cur.ctr < 0.01) out.push("Probar un creativo nuevo (video corto o testimonio): el CTR está por debajo de 1%.");
    const top = [...posts].sort((a, b) => b.idx - a.idx)[0];
    if (top) out.push(`Probar como anuncio la pieza orgánica que mejor funcionó: "${snippet(top.text, 70)}" (${NET_LABEL[top.network]}).`);
    return out;
  }, [aCur, adm, cpr, cprPrev, posts]);

  // Lectura automática del periodo
  const insights = useMemo(() => {
    const out: string[] = [];
    if (!cur) return out;
    const topNet = [...cur.byNet].sort((a, b) => b.inter - a.inter)[0];
    if (topNet && cur.interactions) out.push(`${NET[topNet.n]?.label ?? topNet.n} concentra el ${nf((topNet.inter / cur.interactions) * 100)}% de las interacciones (${nf(topNet.inter)} de ${nf(cur.interactions)}).`);
    if (prev && prev.interactions) {
      const p = change(cur.interactions, prev.interactions)!;
      out.push(`Las interacciones ${p >= 0 ? "subieron" : "bajaron"} ${nf(Math.abs(p) * 100)}% vs. ${win?.prev?.label}, con ${nf(cur.nPosts)} publicaciones (antes ${nf(prev.nPosts)}).`);
    }
    const rate = cur.reach ? cur.interactions / cur.reach : null;
    if (rate != null) out.push(`De cada 100 personas alcanzadas, ${nf(rate * 100, 1)} interactuaron.`);
    if (formats.length > 1 && formats[0].publicaciones >= 2) out.push(`El formato que mejor rinde es ${formats[0].formato}: ${nf(formats[0].indice, 1)}× el promedio de su red (${formats[0].publicaciones} piezas).`);
    const bestDay = [...weekdays].filter((d) => d.n >= 2).sort((a, b) => b.indice - a.indice)[0];
    if (bestDay) out.push(`Las publicaciones del ${bestDay.full} rindieron ${nf(bestDay.indice, 1)}× lo habitual (${bestDay.n} piezas).`);
    const best = [...posts].sort((a, b) => b.idx - a.idx)[0];
    if (best) out.push(`La pieza más fuerte fue en ${NET[best.network]?.label} (${ddmm(best.day)}): "${snippet(best.text, 70)}", ${nf(best.idx, 1)}× su promedio.`);
    if (aCur.spend && aCur.results) out.push(`Publicidad: ${nf(aCur.results)} resultados con ${money(aCur.spend)}, a ${money(cpr)} cada uno.`);
    const missing = cur.byNet.filter((x) => x.posts && x.followers == null).map((x) => NET[x.n]?.label);
    if (missing.length) out.push(`Metricool no registró el total de seguidores de ${missing.join(" y ")} en este corte; la comunidad total solo suma las redes con dato.`);
    return out;
  }, [cur, prev, formats, weekdays, posts, aCur, cpr, win]);

  const filteredPosts = useMemo(() => {
    const val = (p: Post, k: SortKey): number | string => k === "day" ? p.day : k === "rate" ? (p.reach ? p.interactions / p.reach : -1) : (Number((p as any)[k]) || 0);
    return posts
      .filter((p) => netFilter === "all" || p.network === netFilter)
      .filter((p) => fmtFilter === "all" || fmtLabel(p.format) === fmtFilter)
      .sort((a, b) => { const x = val(a, sortBy), y = val(b, sortBy); return typeof x === "string" ? String(y).localeCompare(x) : (y as number) - (x as number); });
  }, [posts, netFilter, fmtFilter, sortBy]);

  // ---------- PDF ----------
  const onLearnSpec = useCallback((s: Partial<PdfSpec>) => setLearnSpec(s), []);
  const spec: PdfSpec = useMemo(() => {
    const base = { client: clientName, period: win?.label.replace(" (mes)", "") ?? "", compare: win?.prev?.label };
    if (!cur) return { ...base, title: "Reporte" };
    if (view === "aprendizajes") return { ...base, title: "Qué funciona · Aprendizajes", ...learnSpec };
    const netTable = {
      title: "Desempeño por red", columns: [{ h: "Red", w: 16 }, { h: "Seguidores", w: 13 }, { h: "Nuevos", w: 11 }, { h: "Piezas", w: 9 }, { h: "Interacc.", w: 13 }, { h: "Alcance", w: 13 }, { h: "Por pieza", w: 12 }, { h: "Tasa", w: 13 }],
      rows: cur.byNet.filter((x) => x.posts || x.followers != null).map((x) => [NET[x.n]?.label ?? x.n, nf(x.followers), x.growth == null ? "—" : `+${nf(x.growth)}`, x.posts, nf(x.inter), nf(x.reach), nf(x.perPost), pctf(x.rate)]),
    };
    const postTable = (title: string, list: Post[]) => ({
      title, columns: [{ h: "Fecha", w: 8, align: "left" as const }, { h: "Red", w: 11, align: "left" as const }, { h: "Pieza", w: 41, align: "left" as const }, { h: "Interacc.", w: 10 }, { h: "Alcance", w: 10 }, { h: "Tasa", w: 9 }, { h: "Vs. red", w: 11 }],
      rows: list.map((p) => [ddmm(p.day), `${NET[p.network]?.label} · ${fmtLabel(p.format)}`, snippet(p.text, 95) || "Sin texto", nf(p.interactions), nf(p.reach), pctf(p.reach ? p.interactions / p.reach : null), `${nf(p.idx, 1)}×`]),
    });
    if (view === "panorama") {
      const HEX: Record<string, string> = { instagram: "#e1306c", facebook: "#1877f2", tiktok: "#14b8c4", youtube: "#ff0000", linkedin: "#0a66c2", x: "#334155" };
      const nl = (n: string) => NET[n]?.label ?? n;
      const periodKind = win?.kind === "week" ? "la semana" : win?.kind === "month" ? "el mes" : "el periodo";
      const activeNets = cur.byNet.filter((x) => x.posts || x.followers != null);
      const top = [...posts].sort((a, b) => b.idx - a.idx);
      const trendLabels = trend.map((r: any) => r.mes);
      const hasAds = aCur.spend > 0;
      const intro = `Este reporte resume cómo se movieron tus redes durante ${periodKind} (${base.period}). `
        + `Publicamos ${nf(cur.nPosts)} piezas que generaron ${nf(cur.interactions)} interacciones y llegaron a ${nf(cur.reach)} personas de forma orgánica`
        + (hasAds ? `; además, la publicidad en Meta generó ${nf(aCur.results)} ${resNoun} con una inversión de ${money(aCur.spend)}.` : ".")
        + (win?.prev ? ` Comparamos cada cifra contra ${win.prev.label}.` : "");
      const sections: NonNullable<PdfSpec["sections"]> = [
        {
          kicker: "01 · Comunidad", title: "Cómo creció tu comunidad",
          intro: "Seguidores por red al cierre del periodo y evolución de las interacciones.",
          chartRows: [[
            { kind: "donut", title: "Comunidad por red", subtitle: `${nf(cur.followers)} seguidores en total`, items: activeNets.filter((x) => x.followers).map((x) => ({ label: `${nl(x.n)} · ${nf(x.followers)}`, value: x.followers ?? 0, color: HEX[x.n] ?? "#94a3b8" })) },
            { kind: "hbar", title: "Nuevos seguidores", subtitle: "Altas netas en el periodo", items: activeNets.filter((x) => x.growth != null).map((x) => ({ label: nl(x.n), value: Math.max(0, x.growth ?? 0), display: `+${nf(x.growth)}`, color: HEX[x.n] })) },
          ], [
            { kind: "stack", title: win?.kind === "week" ? "Interacciones por semana" : "Interacciones por mes", subtitle: "Reacciones, comentarios, compartidos y guardados", labels: trendLabels, series: networks.map((n) => ({ name: nl(n), color: HEX[n] ?? "#94a3b8", values: trend.map((r: any) => r[`i_${n}`] ?? 0) })) },
          ]],
          tables: [netTable],
        },
        {
          kicker: "02 · Contenido", title: "Qué contenido conectó",
          intro: "Medimos cada pieza contra el promedio de su propia red: 1× es lo habitual; 2× es el doble.",
          chartRows: [[
            { kind: "hbar", title: "Rendimiento por formato", subtitle: "Veces su promedio habitual", items: formats.slice(0, 6).map((f) => ({ label: `${f.formato} (${f.publicaciones})`, value: f.indice, display: `${nf(f.indice, 1)}×` })) },
            { kind: "hbar", title: "Interacciones por red", subtitle: "Total del periodo", items: activeNets.filter((x) => x.inter).map((x) => ({ label: nl(x.n), value: x.inter, display: nf(x.inter), color: HEX[x.n] })) },
          ]],
          tables: [postTable("Las piezas que mejor funcionaron", top.slice(0, 6)), ...(top.length > 8 ? [postTable("Las que menos conectaron", top.slice(-4).reverse())] : [])],
        },
      ];
      if (hasAds) {
        const fn = funnel(aCur, isMsg ? adm.cur.replies : 0, isMsg ? "Conversaciones iniciadas" : resTitle);
        sections.push({
          kicker: "03 · Publicidad", title: "Qué logró la inversión en anuncios",
          kpis: [
            { label: "Inversión", value: money(aCur.spend), ...deltaNote(aCur.spend, aPrev.spend || null) },
            { label: resTitle, value: nf(aCur.results), ...deltaNote(aCur.results, aPrev.results || null) },
            { label: "Costo por resultado", value: money(cpr), ...deltaNote(cpr, cprPrev, true) },
            isMsg ? { label: "Con respuesta", value: adm.cur.replies ? nf(adm.cur.replies) : "—", note: adm.cur.replyRate != null ? `${pctf(adm.cur.replyRate, 0)} de las iniciadas` : undefined }
              : { label: "Personas alcanzadas", value: nf(aCur.reach), note: adm.cur.freq != null ? `${nf(adm.cur.freq, 2)} vistas por persona` : undefined },
          ],
          chartRows: [[
            { kind: "hbar", title: isMsg ? "Del anuncio a la conversación" : "Del anuncio al resultado", subtitle: "Cuántas personas avanzaron en cada paso", items: fn.map((x) => ({ label: x.label, value: x.v, display: nf(x.v) })) },
            { kind: "combo", title: win?.kind === "week" ? `Inversión y ${resNoun} por semana` : `Inversión y ${resNoun} por mes`, labels: trendLabels, bars: { name: "Inversión", color: "#f5b942", values: trend.map((r: any) => r.spend ?? 0) }, line: { name: resTitle, color: "#d63a8a", values: trend.map((r: any) => r.results) } },
          ]],
          bullets: adsReading.length ? [{ title: "Lectura de la inversión", items: adsReading }] : undefined,
        });
      }
      const webCur = win?.kind === "month" ? webRows?.find((r) => r.period_start === win.from) : undefined;
      if (webCur) {
        const wi = webRows!.indexOf(webCur), webPrev = wi > 0 ? webRows![wi - 1] : undefined;
        const ch = channelsOf(webCur);
        const wd = (c: number | null, p: number | null | undefined) => deltaNote(c, p ?? null);
        const last = webRows!.slice(Math.max(0, wi - 11), wi + 1);
        sections.push({
          kicker: `${String(sections.length + 1).padStart(2, "0")} · Sitio web`, title: "Cómo se comportó tu sitio web",
          intro: "Datos de Google Analytics del mes.",
          kpis: [
            { label: "Personas", value: nf(webCur.users), ...wd(webCur.users, webPrev?.users) },
            { label: "Visitas", value: nf(webCur.sessions), ...wd(webCur.sessions, webPrev?.sessions) },
            { label: "Páginas vistas", value: nf(webCur.pageviews), ...wd(webCur.pageviews, webPrev?.pageviews) },
            { label: "Tiempo por visita", value: dur(webCur.avg_session_seconds), ...wd(webCur.avg_session_seconds, webPrev?.avg_session_seconds) },
          ],
          chartRows: [[
            { kind: "hbar", title: "De dónde llegan las visitas", subtitle: "Visitas por canal", items: ch.slice(0, 6).map((c) => ({ label: c.label, value: c.sessions, display: `${nf(c.share * 100, 0)}%` })) },
            { kind: "combo", title: "Visitas y personas por mes", labels: last.map((r) => monthLabel(r.period_start.slice(0, 7))), bars: { name: "Visitas", color: "#ef6a4d", values: last.map((r) => r.sessions ?? 0) }, line: { name: "Personas", color: "#d63a8a", values: last.map((r) => r.users) } },
          ]],
          bullets: [{ title: "Lectura del sitio", items: webReading(webCur, webPrev) }],
        });
      }
      const recs = [...(learnSpec.recs ?? []), ...adsRecs.map((t) => ({ tag: "Publicidad", title: t, body: "" }))].slice(0, 6);
      sections.push({ kicker: `${String(sections.length + 1).padStart(2, "0")} · Siguientes pasos`, title: "Lo que haremos a continuación", recs: recs.length ? recs : undefined,
        bullets: insights.length ? [{ title: "Claves del periodo", items: insights }] : undefined });
      return {
        ...base, title: win?.kind === "week" ? "Reporte semanal de redes" : win?.kind === "month" ? "Reporte mensual de redes" : "Reporte de redes",
        intro,
        kpis: [
          { label: "Comunidad", value: nf(cur.followers), ...deltaNote(followersCmp.cur, followersCmp.prev) },
          { label: "Interacciones", value: nf(cur.interactions), ...deltaNote(cur.interactions, prev?.interactions ?? null) },
          { label: "Alcance orgánico", value: nf(cur.reach), ...deltaNote(cur.reach, prev?.reach ?? null) },
          { label: "Publicaciones", value: nf(cur.nPosts), ...deltaNote(cur.nPosts, prev?.nPosts ?? null) },
        ],
        sections,
        notes: ["Datos de tus cuentas vía Metricool. Tasa = interacciones / alcance. En TikTok el alcance corresponde a reproducciones.", "Los seguidores se comparan solo en redes con dato en ambos periodos."],
      };
    }
    if (view === "contenido") return {
      ...base, title: "Contenido publicado",
      kpis: [
        { label: "Publicaciones", value: nf(cur.nPosts), ...deltaNote(cur.nPosts, prev?.nPosts ?? null) },
        { label: "Interacciones por pieza", value: nf(cur.nPosts ? cur.interactions / cur.nPosts : null), ...deltaNote(cur.nPosts ? cur.interactions / cur.nPosts : null, prev?.nPosts ? prev.interactions / prev.nPosts : null) },
        { label: "Mejor formato", value: formats[0]?.formato ?? "—", note: formats[0] ? `${nf(formats[0].indice, 1)}× su red` : undefined },
        { label: "Reproducciones", value: nf(cur.views) },
      ],
      tables: [
        { title: "Rendimiento por formato", columns: [{ h: "Formato", w: 28 }, { h: "Piezas", w: 14 }, { h: "Interacc. prom.", w: 20 }, { h: "Alcance prom.", w: 20 }, { h: "Vs. red", w: 18 }],
          rows: formats.map((f) => [f.formato, f.publicaciones, nf(f.promedio), nf(f.alcance), `${nf(f.indice, 1)}×`]) },
        postTable(`Todas las publicaciones (${filteredPosts.length})`, filteredPosts),
      ],
    };
    return {
      ...base, title: "Publicidad en Meta",
      kpis: [
        { label: "Inversión", value: money(aCur.spend), ...deltaNote(aCur.spend, aPrev.spend || null) },
        { label: "Resultados", value: nf(aCur.results), ...deltaNote(aCur.results, aPrev.results || null) },
        { label: "Costo por resultado", value: money(cpr), ...deltaNote(cpr, cprPrev, true) },
        { label: isMsg ? "Respondidas" : "Alcance", value: isMsg ? (adm.cur.replies ? nf(adm.cur.replies) : "—") : nf(aCur.reach), note: adm.cur.replyRate != null ? `${pctf(adm.cur.replyRate, 0)} de las conversaciones` : undefined },
      ],
      bullets: [
        ...(adsReading.length ? [{ title: "Qué pasó con la inversión", items: adsReading }] : []),
        ...(adsRecs.length ? [{ title: "Qué recomendamos", items: adsRecs }] : []),
      ],
      tables: [
        { title: isMsg ? "Del anuncio a la conversación" : "Del anuncio al resultado", columns: [{ h: "Etapa", w: 40 }, { h: "Cantidad", w: 20 }, { h: "Paso", w: 20 }, { h: "Costo c/u", w: 20 }],
          rows: funnel(aCur, isMsg ? adm.cur.replies : 0, isMsg ? "Conversaciones iniciadas" : resTitle).map((s) => [s.label, nf(s.v), s.step == null ? "—" : pctf(s.step), money(s.v ? aCur.spend / s.v : null)]) },
        { title: "Campañas", columns: [{ h: "Campaña", w: 26 }, { h: "Inversión", w: 12 }, { h: "Alcance", w: 11 }, { h: "Frec.", w: 8 }, { h: "CTR", w: 8 }, { h: "CPC", w: 10 }, { h: "Result.", w: 12 }, { h: "Costo c/u", w: 13 }],
          rows: campaigns.map((c) => [c.campaign_name, money(c.spend), nf(c.reach), nf(c.freq, 2), c.ctr == null ? "—" : `${nf(c.ctr, 2)}%`, money(c.cpc), nf(c.results), money(c.cost_per_result)]) },
      ],
      notes: ["CTR = clics / impresiones · CPC = costo por clic · Frecuencia = veces que cada persona vio el anuncio."],
    };
  }, [view, win, cur, prev, followersCmp, trend, networks, webRows, isMsg, resNoun, resTitle, aCur, aPrev, cpr, cprPrev, insights, posts, formats, filteredPosts, adm, adsReading, adsRecs, campaigns, learnSpec, clientName]);

  const download = async () => {
    if (!pdfRef.current) return;
    setDownloading(true);
    try {
      await downloadPdf(pdfRef.current, `${clientName.replace(/\s+/g, "-").toLowerCase()}-reporte-${from}${win?.kind === "week" ? "-semana" : ""}.pdf`);
    } catch { toast.error("No se pudo generar el PDF"); } finally { setDownloading(false); }
  };

  if (loading) return <div className="grid gap-3 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  if (!windows.length || !cur) {
    return (
      <Card className="glass border-border/50 p-14 text-center space-y-2">
        <Users className="w-8 h-8 text-coral mx-auto" />
        <h3 className="font-semibold">Aún no hay datos cargados</h3>
        <p className="text-sm text-muted-foreground">En cuanto conectemos tus redes, aquí verás tu desempeño.</p>
      </Card>
    );
  }

  const group = (k: Win["kind"]) => windows.filter((w) => w.kind === k);
  const kind: Win["kind"] = win?.kind ?? "month";
  const KINDS: { k: Win["kind"]; label: string }[] = [
    { k: "week", label: "Semanal" }, { k: "month", label: "Mensual" }, { k: "multi", label: "Acumulado" },
  ];
  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
        {KINDS.filter((o) => group(o.k).length).map((o) => (
          <button
            key={o.k}
            onClick={() => setRange(group(o.k)[0].key)}
            className={`px-3 h-8 rounded-md text-sm transition-colors ${kind === o.k ? "bg-background text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >{o.label}</button>
        ))}
      </div>
      <Select value={range} onValueChange={setRange}>
        <SelectTrigger className="h-9 w-64"><CalendarDays className="w-4 h-4 mr-2 text-coral" /><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-80">
          {group(kind).map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {win?.prev && <span className="text-xs text-muted-foreground">Comparado con {win.prev.label}</span>}
      {view === "panorama" && (
        <Button size="sm" className="ml-auto h-9" onClick={download} disabled={downloading}>
          <Download className="w-4 h-4 mr-2" /> {downloading ? "Generando…" : win?.kind === "week" ? "Descargar reporte semanal" : "Descargar reporte"}
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {header}
      {/* Plantilla PDF oculta */}
      <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
        <InsightsPdf ref={pdfRef} spec={spec} />
      </div>

      <div className="space-y-6">
        {view === "aprendizajes" && (
          <PortalAprendizajes clientId={clientId} posts={posts} allPosts={allPosts} periodLabel={win?.label ?? ""} from={from} to={to} onSpec={onLearnSpec} />
        )}

        {view === "panorama" && (
          <>
            <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
              <Kpi icon={Users} label="Comunidad total" value={nf(cur.followers)} cur={followersCmp.cur} prev={followersCmp.prev}
                hint={cur.followers == null ? "Sin dato de seguidores en este corte" : `${cur.growth != null ? `${cur.growth >= 0 ? "+" : ""}${nf(cur.growth)} nuevos · ` : ""}${cur.followersNets.map((n) => NET[n]?.label).join(", ")}`} />
              <Kpi icon={Heart} label="Interacciones" value={nf(cur.interactions)} cur={cur.interactions} prev={prev?.interactions ?? null} hint={`${nf(cur.nPosts)} publicaciones`} />
              <Kpi icon={Eye} label="Alcance orgánico" value={nf(cur.reach)} cur={cur.reach} prev={prev?.reach ?? null} hint={cur.views ? `${nf(cur.views)} reproducciones` : undefined} />
              {aCur.spend ? (
                <Kpi icon={Megaphone} label="Costo por resultado" value={money(cpr)} cur={cpr} prev={cprPrev} invert hint={`${nf(aCur.results)} resultados · ${money(aCur.spend)}`} />
              ) : (
                <Kpi icon={TrendingUp} label="Interacciones por pieza" value={nf(cur.nPosts ? cur.interactions / cur.nPosts : null)} cur={cur.nPosts ? cur.interactions / cur.nPosts : null} prev={prev?.nPosts ? prev.interactions / prev.nPosts : null} />
              )}
            </div>

            {insights.length > 0 && (
              <Card className="glass border-coral/30 p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 text-coral" /> Lectura del periodo</div>
                <ul className="space-y-2 text-sm">
                  {insights.map((t, i) => <li key={i} className="flex gap-2"><span className="text-coral">•</span><span>{t}</span></li>)}
                </ul>
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="glass border-border/50 p-5 space-y-3">
                <div className="text-sm font-semibold">Seguidores por red {win?.kind === "week" ? "(por semana)" : "(por mes)"}</div>
                <div className="h-64">
                  <ResponsiveContainer>
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" {...axis} />
                      <YAxis {...axis} width={48} />
                      <Tooltip {...tooltipStyle} formatter={(v: any) => nf(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {networks.map((n) => <Line key={n} type="monotone" dataKey={`f_${n}`} name={NET[n]?.label ?? n} stroke={NET[n]?.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-muted-foreground">Los huecos son cortes en que Metricool no registró el total de seguidores de esa red.</p>
              </Card>
              <Card className="glass border-border/50 p-5 space-y-3">
                <div className="text-sm font-semibold">Interacciones {win?.kind === "week" ? "por semana" : "por mes"}</div>
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" {...axis} />
                      <YAxis {...axis} width={48} />
                      <Tooltip {...tooltipStyle} formatter={(v: any) => nf(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {networks.map((n) => <Bar key={n} dataKey={`i_${n}`} name={NET[n]?.label ?? n} stackId="a" fill={NET[n]?.color} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {cur.byNet.filter((x) => x.posts || x.followers != null).map((x) => {
                const p = prev?.byNet.find((y) => y.n === x.n);
                return (
                  <Card key={x.n} className="glass border-border/50 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold" style={{ color: NET[x.n]?.color }}>{NET[x.n]?.label ?? x.n}</div>
                      <Delta cur={x.inter} prev={p?.inter || null} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <Stat k="Seguidores" v={nf(x.followers)} />
                      <Stat k="Nuevos" v={x.growth == null ? "—" : `${x.growth >= 0 ? "+" : ""}${nf(x.growth)}`} />
                      <Stat k="Publicaciones" v={nf(x.posts)} />
                      <Stat k="Interacciones" v={nf(x.inter)} />
                      <Stat k={x.n === "tiktok" ? "Reproducciones" : "Alcance"} v={nf(x.reach)} />
                      <Stat k="Tasa de interacción" v={pctf(x.rate)} />
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                      <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{nf(x.likes)}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" />{nf(x.comments)}</span>
                      <span className="inline-flex items-center gap-1"><Share2 className="w-3 h-3" />{nf(x.shares)}</span>
                      {x.saves != null && <span className="inline-flex items-center gap-1"><Bookmark className="w-3 h-3" />{nf(x.saves)}</span>}
                      {!!x.views && x.n !== "tiktok" && <span className="inline-flex items-center gap-1"><Play className="w-3 h-3" />{nf(x.views)}</span>}
                    </div>
                  </Card>
                );
              })}
            </div>

            <TopPosts posts={[...posts].sort((a, b) => b.idx - a.idx).slice(0, 6)} title="Lo que mejor funcionó" subtitle="Ordenado por rendimiento contra el promedio de su red" />
            <DataNotes />
          </>
        )}

        {view === "contenido" && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="glass border-border/50 p-5 space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm font-semibold">Qué formato rinde más en cada red</div>
                    <div className="inline-flex rounded-lg border border-border/60 p-0.5 text-[11px]">
                      {([["interactions", "Interacciones"], ["reach", "Alcance"], ["views", "Vistas"]] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setFmtMetric(k)} className={`px-2.5 py-1 rounded-md transition-colors ${fmtMetric === k ? "bg-coral text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {fmtMetric === "interactions" && "Promedio de reacciones, comentarios, compartidos y guardados por pieza: mide cuánto se involucra la gente."}
                    {fmtMetric === "reach" && "Promedio de personas distintas que vieron cada pieza: mide hasta dónde llega."}
                    {fmtMetric === "views" && "Promedio de reproducciones o visualizaciones por pieza (incluye repeticiones). Facebook no las reporta en publicaciones de imagen."}
                  </p>
                </div>
                {formats.length ? (
                  <div style={{ height: Math.max(180, formats.length * 34) }}>
                    <ResponsiveContainer>
                      <BarChart data={formats} layout="vertical" margin={{ left: 10, right: 60 }}>
                        <XAxis type="number" {...axis} />
                        <YAxis type="category" dataKey="formato" {...axis} width={130} />
                        <Tooltip {...tooltipStyle} formatter={(v: any, _n: any, it: any) => [`${nf(v)} ${fmtMetricLabel} promedio · ${nf(it?.payload?.indice, 1)}× lo habitual en su red · ${it?.payload?.publicaciones} piezas`, ""]} />
                        <Bar dataKey="valor" fill="hsl(15 95% 55%)" radius={[0, 6, 6, 0]} label={{ position: "right", fontSize: 11, formatter: (v: any) => nf(v) }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-sm text-muted-foreground">No hay datos de {fmtMetricLabel} en este periodo.</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="text-muted-foreground"><tr className="text-left"><th className="py-1 font-normal">Formato</th><th className="font-normal text-right">Piezas</th><th className="font-normal text-right">Interacc.</th><th className="font-normal text-right">Alcance</th><th className="font-normal text-right">Vistas</th><th className="font-normal text-right">Vs. su red</th></tr></thead>
                    <tbody>{formats.map((f) => (
                      <tr key={f.formato} className="border-t border-border/40"><td className="py-1">{f.formato}</td><td className="text-right tabular-nums">{f.publicaciones}</td><td className="text-right tabular-nums">{nf(f.promedio)}</td><td className="text-right tabular-nums">{nf(f.alcance)}</td><td className="text-right tabular-nums">{f.vistas ? nf(f.vistas) : "n/d"}</td><td className="text-right tabular-nums">{nf(f.indice, 1)}×</td></tr>
                    ))}</tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground">Promedios por pieza. "Vs. su red" compara ese formato con lo que normalmente logra esa misma red en {fmtMetricLabel} (1× = lo habitual). Un formato puede rendir poco en interacciones y mucho en vistas: el primero conversa, el segundo da alcance. Conviene combinarlos.</p>
              </Card>
              <Card className="glass border-border/50 p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><Clock className="w-4 h-4 text-coral" /> Mejor día para publicar</div>
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={weekdays}>
                      <XAxis dataKey="dia" {...axis} />
                      <YAxis {...axis} width={40} />
                      <Tooltip {...tooltipStyle} formatter={(v: any, _k: any, it: any) => [`${nf(v, 2)}× (${it?.payload?.n} piezas)`, "Vs. promedio de su red"]} />
                      <Bar dataKey="indice" fill="hsl(185 85% 50%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[11px] text-muted-foreground">Rendimiento vs. el promedio de su red según el día (hora de CDMX). 1× = lo habitual.</div>
              </Card>
            </div>

            <Card className="glass border-border/50 p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold mr-auto">Publicaciones ({filteredPosts.length})</div>
                <div className="flex rounded-lg border border-border/60 p-0.5">
                  <Button size="sm" variant={layout === "cards" ? "secondary" : "ghost"} className="h-7 px-2" onClick={() => setLayout("cards")}><LayoutGrid className="w-3.5 h-3.5 mr-1" />Tarjetas</Button>
                  <Button size="sm" variant={layout === "table" ? "secondary" : "ghost"} className="h-7 px-2" onClick={() => setLayout("table")}><Table2 className="w-3.5 h-3.5 mr-1" />Tabla</Button>
                </div>
                <Select value={netFilter} onValueChange={setNetFilter}>
                  <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las redes</SelectItem>
                    {networks.map((n) => <SelectItem key={n} value={n}>{NET[n]?.label ?? n}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fmtFilter} onValueChange={setFmtFilter}>
                  <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los formatos</SelectItem>
                    {formats.map((f) => <SelectItem key={f.formato} value={f.formato}>{f.formato}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                  <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interactions">Más interacciones</SelectItem>
                    <SelectItem value="idx">Mejor vs. su red</SelectItem>
                    <SelectItem value="rate">Mayor tasa</SelectItem>
                    <SelectItem value="reach">Más alcance</SelectItem>
                    <SelectItem value="shares">Más compartidos</SelectItem>
                    <SelectItem value="saves">Más guardados</SelectItem>
                    <SelectItem value="day">Más recientes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {layout === "cards" ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredPosts.slice(0, 60).map((p, i) => <PostCard key={i} p={p} />)}
                </div>
              ) : (
                <PostTable posts={filteredPosts} sortBy={sortBy} setSortBy={setSortBy} />
              )}
            </Card>
          </>
        )}

        {view === "publicidad" && (
          campaigns.length ? (
            <>
              <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                <Kpi icon={Megaphone} label="Inversión" value={money(aCur.spend)} cur={aCur.spend} prev={aPrev.spend || null} hint={`${campaigns.length} campaña${campaigns.length > 1 ? "s" : ""}`} />
                <Kpi icon={MessageCircle} label={campaigns[0]?.result_type ? campaigns[0].result_type[0].toUpperCase() + campaigns[0].result_type.slice(1) : "Resultados"} value={nf(aCur.results)} cur={aCur.results} prev={aPrev.results || null} />
                <Kpi icon={TrendingUp} label="Costo por resultado" value={money(cpr)} cur={cpr} prev={cprPrev} invert />
                <Kpi icon={Users} label="Conversaciones respondidas" value={adm.cur.replies ? nf(adm.cur.replies) : "—"} cur={adm.cur.replies || null} prev={adm.prev.replies || null}
                  hint={adm.cur.replyRate != null ? `${pctf(adm.cur.replyRate, 0)} de las iniciadas · ${money(adm.cur.costPerReply)} c/u` : undefined} />
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                <Card className="glass border-coral/30 p-5 space-y-3 lg:col-span-3">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 text-coral" /> Qué pasó con la inversión</div>
                  <ul className="space-y-2 text-sm">{adsReading.map((t, i) => <li key={i} className="flex gap-2"><span className="text-coral">•</span><span>{t}</span></li>)}</ul>
                  {adsRecs.length > 0 && <>
                    <div className="text-xs font-semibold pt-2">Qué recomendamos</div>
                    <ul className="space-y-1.5 text-sm">{adsRecs.map((t, i) => <li key={i} className="flex gap-2"><span className="text-emerald-500">→</span><span>{t}</span></li>)}</ul>
                  </>}
                </Card>
                <Card className="glass border-border/50 p-5 space-y-3 lg:col-span-2">
                  <div className="text-sm font-semibold">{isMsg ? "Del anuncio a la conversación" : "Del anuncio al resultado"}</div>
                  <Funnel steps={funnel(aCur, isMsg ? adm.cur.replies : 0, isMsg ? "Conversaciones iniciadas" : resTitle)} spend={aCur.spend} />
                </Card>
              </div>

              <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                <Explain label="CTR" value={pctf(adm.cur.ctr, 2)} cur={adm.cur.ctr} prev={adm.prev.ctr} text="De cada 100 personas que vieron el anuncio, cuántas dieron clic. Mide qué tan atractivo es el creativo." />
                <Explain label="Costo por clic" value={money(adm.cur.cpc)} cur={adm.cur.cpc} prev={adm.prev.cpc} invert text="Lo que pagamos por cada clic. Más bajo = el anuncio convence con menos dinero." />
                <Explain label="Costo por mil (CPM)" value={money(adm.cur.cpm)} cur={adm.cur.cpm} prev={adm.prev.cpm} invert text="Lo que cuesta mostrar el anuncio mil veces. Sube cuando hay más competencia por el público." />
                <Explain label="Frecuencia" value={nf(adm.cur.freq, 2)} cur={adm.cur.freq} prev={adm.prev.freq} text="Veces que cada persona vio el anuncio. Arriba de 3, el público se cansa." />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="glass border-border/50 p-5 space-y-3">
                  <div className="text-sm font-semibold">Inversión y resultados {win?.kind === "week" ? "por semana" : "por mes"}</div>
                  <div className="h-60">
                    <ResponsiveContainer>
                      <ComposedChart data={trend.filter((t) => t.spend)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mes" {...axis} />
                        <YAxis yAxisId="l" {...axis} width={48} />
                        <YAxis yAxisId="r" orientation="right" {...axis} width={40} />
                        <Tooltip {...tooltipStyle} formatter={(v: any, k: any) => [k === "Inversión" ? money(v) : nf(v), k]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar yAxisId="l" dataKey="spend" name="Inversión" fill="hsl(45 100% 55%)" radius={[6, 6, 0, 0]} />
                        <Line yAxisId="r" dataKey="results" name="Resultados" stroke="hsl(330 85% 60%)" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="glass border-border/50 p-5 space-y-3">
                  <div className="text-sm font-semibold">Costo por resultado {win?.kind === "week" ? "por semana" : "por mes"}</div>
                  <div className="h-60">
                    <ResponsiveContainer>
                      <LineChart data={trend.filter((t) => t.cpr)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mes" {...axis} />
                        <YAxis {...axis} width={48} />
                        <Tooltip {...tooltipStyle} formatter={(v: any) => [money(v), "Costo por resultado"]} />
                        <Line dataKey="cpr" stroke="hsl(15 95% 55%)" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Más bajo es mejor: cada resultado cuesta menos.</p>
                </Card>
              </div>

              <Card className="glass border-border/50 p-5 space-y-3">
                <div className="text-sm font-semibold">Campañas</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/50">
                        {["Campaña", "Inversión", "% del total", "Alcance", "Frecuencia", "CTR", "CPC", "Resultados", "Costo c/u", "Respondidas"].map((h, i) => <th key={h} className={`py-2 font-medium ${i ? "text-right" : "text-left"}`}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c) => (
                        <tr key={c.campaign_key} className="border-b border-border/30 last:border-0">
                          <td className="py-2">
                            <div className="font-medium">{c.campaign_name}</div>
                            <div className="text-[11px] text-muted-foreground">Meta · {c.raw?.status === "ACTIVE" ? "Activa" : "Finalizada"}</div>
                          </td>
                          <td className="text-right py-2">{money(c.spend)}</td>
                          <td className="text-right py-2">{pctf(aCur.spend ? (c.spend ?? 0) / aCur.spend : null, 0)}</td>
                          <td className="text-right py-2">{nf(c.reach)}</td>
                          <td className="text-right py-2">{nf(c.freq, 2)}</td>
                          <td className="text-right py-2">{c.ctr == null ? "—" : `${nf(c.ctr, 2)}%`}</td>
                          <td className="text-right py-2">{money(c.cpc)}</td>
                          <td className="text-right py-2">{nf(c.results)}</td>
                          <td className="text-right py-2">{money(c.cost_per_result)}</td>
                          <td className="text-right py-2">{c.replies ? nf(c.replies) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {win?.kind === "week" && <p className="text-[11px] text-muted-foreground">Cifras de la semana; una campaña puede aparecer en varias semanas.</p>}
              </Card>

              {(adm.cur.engagement > 0 || adm.cur.videoViews > 0) && (
                <Card className="glass border-border/50 p-5 space-y-3">
                  <div className="text-sm font-semibold">Efecto secundario de los anuncios</div>
                  <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                    {[["Clics al enlace", adm.cur.linkClicks], ["Interacciones con la publicación", adm.cur.engagement], ["Reacciones", adm.cur.reactions], ["Reproducciones de video", adm.cur.videoViews], ["Guardados", adm.cur.saves]].filter(([, v]) => (v as number) > 0).map(([l, v]) => (
                      <div key={l as string} className="rounded-xl border border-border/50 p-3">
                        <div className="text-[11px] text-muted-foreground">{l}</div>
                        <div className="text-lg font-semibold">{nf(v as number)}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card className="glass border-border/50 p-14 text-center space-y-2">
              <Megaphone className="w-8 h-8 text-coral mx-auto" />
              <h3 className="font-semibold">Sin campañas en este periodo</h3>
              <p className="text-sm text-muted-foreground">Elige otro mes, otra semana o el año completo para ver la publicidad.</p>
            </Card>
          )
        )}
      </div>
    </div>
  );
}

function funnel(t: { impressions: number; reach: number; clicks: number; results: number }, replies: number, resLabel = "Conversaciones iniciadas") {
  const raw = [
    { label: "Impresiones", v: t.impressions }, { label: "Personas alcanzadas", v: t.reach }, { label: "Clics", v: t.clicks },
    { label: resLabel, v: t.results }, { label: "Con primera respuesta", v: replies },
  ].filter((s) => s.v > 0);
  return raw.map((s, i) => ({ ...s, step: i ? s.v / raw[i - 1].v : null as number | null }));
}

function Funnel({ steps, spend }: { steps: ReturnType<typeof funnel>; spend: number }) {
  const max = Math.max(1, ...steps.map((s) => s.v));
  return (
    <div className="space-y-2.5">
      {steps.map((s) => (
        <div key={s.label} className="space-y-1">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">{s.label}</span><span className="font-semibold">{nf(s.v)}</span></div>
          <div className="h-2.5 rounded-full bg-muted/50 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-coral to-pink-500" style={{ width: `${Math.max(2, Math.sqrt(s.v / max) * 100)}%` }} /></div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{s.step != null ? `${pctf(s.step)} del paso anterior` : ""}</span><span>{money(spend / s.v)} c/u</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Explain({ label, value, text, cur, prev, invert }: { label: string; value: string; text: string; cur: number | null; prev: number | null; invert?: boolean }) {
  return (
    <Card className="glass border-border/50 p-4 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground"><Info className="w-3.5 h-3.5 text-coral" />{label}</div>
      <div className="text-xl font-display font-bold">{value}</div>
      <Delta cur={cur} prev={prev} invert={invert} />
      <p className="text-[11px] text-muted-foreground leading-snug">{text}</p>
    </Card>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div><div className="text-[11px] text-muted-foreground">{k}</div><div className="font-semibold">{v}</div></div>;
}

function DataNotes() {
  return (
    <Card className="glass border-border/50 p-4 text-[11px] text-muted-foreground space-y-1">
      <div className="font-semibold text-foreground text-xs flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-coral" />Cómo leer estos datos</div>
      <p>Interacciones = reacciones + comentarios + compartidos (+ guardados en Instagram). Tasa = interacciones / alcance.</p>
      <p>TikTok no entrega alcance: usamos reproducciones. Facebook y TikTok no entregan guardados. Horas en hora de CDMX.</p>
      <p>"Vs. su red" compara cada pieza con el promedio histórico de su propia red, para no mezclar TikTok con Facebook.</p>
    </Card>
  );
}

function PostTable({ posts, sortBy, setSortBy }: { posts: Post[]; sortBy: SortKey; setSortBy: (k: SortKey) => void }) {
  const cols: { k: SortKey | null; h: string; right?: boolean }[] = [
    { k: "day", h: "Fecha" }, { k: null, h: "Red · formato" }, { k: null, h: "Publicación" },
    { k: "interactions", h: "Interacc.", right: true }, { k: "reach", h: "Alcance", right: true }, { k: "rate", h: "Tasa", right: true },
    { k: "comments", h: "Coment.", right: true }, { k: "shares", h: "Compart.", right: true }, { k: "saves", h: "Guard.", right: true },
    { k: "views", h: "Reprod.", right: true }, { k: "idx", h: "Vs. red", right: true },
  ];
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-xs min-w-[900px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/50">
            {cols.map((c) => (
              <th key={c.h} className={`py-2 px-2 font-medium ${c.right ? "text-right" : "text-left"}`}>
                {c.k ? <button className={`inline-flex items-center gap-0.5 hover:text-foreground ${sortBy === c.k ? "text-coral" : ""}`} onClick={() => setSortBy(c.k!)}>{c.h}<ArrowUpDown className="w-3 h-3" /></button> : c.h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {posts.map((p, i) => (
            <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
              <td className="py-2 px-2 whitespace-nowrap">{ddmm(p.day)} <span className="text-muted-foreground">{String(p.hour).padStart(2, "0")}h</span></td>
              <td className="py-2 px-2 whitespace-nowrap"><span style={{ color: NET[p.network]?.color }}>{NET[p.network]?.label}</span> <span className="text-muted-foreground">· {fmtLabel(p.format)}</span></td>
              <td className="py-2 px-2 max-w-[320px]">
                <a href={p.url} target="_blank" rel="noreferrer" className="line-clamp-2 hover:text-coral">{p.text || "Sin texto"}</a>
              </td>
              <td className="py-2 px-2 text-right font-semibold">{nf(p.interactions)}</td>
              <td className="py-2 px-2 text-right">{nf(p.reach)}</td>
              <td className="py-2 px-2 text-right">{pctf(p.reach ? p.interactions / p.reach : null)}</td>
              <td className="py-2 px-2 text-right">{nf(p.comments)}</td>
              <td className="py-2 px-2 text-right">{nf(p.shares)}</td>
              <td className="py-2 px-2 text-right">{SAVES_NETWORKS.has(p.network) ? nf(p.saves) : <span className="text-muted-foreground">n/d</span>}</td>
              <td className="py-2 px-2 text-right">{p.views ? nf(p.views) : "—"}</td>
              <td className={`py-2 px-2 text-right font-medium ${p.idx >= 1.2 ? "text-emerald-500" : p.idx < 0.8 ? "text-coral" : ""}`}>{nf(p.idx, 1)}×</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-muted-foreground px-2 pt-2">n/d = la red no entrega ese dato. Da clic en los encabezados para ordenar.</p>
    </div>
  );
}

function PostCard({ p }: { p: Post }) {
  return (
    <a href={p.url ?? undefined} target="_blank" rel="noreferrer" className="group rounded-xl border border-border/50 overflow-hidden hover:border-coral/50 transition-colors flex flex-col">
      {p.image && (
        <div className="aspect-[4/3] bg-muted overflow-hidden">
          <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" onError={(e) => ((e.target as HTMLImageElement).parentElement!.style.display = "none")} />
        </div>
      )}
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="text-[10px]" style={{ color: NET[p.network]?.color }}>{NET[p.network]?.label ?? p.network}</Badge>
          <span>{fmtLabel(p.format)}</span>
          <span className="ml-auto">{ddmm(p.day)}</span>
        </div>
        <p className="text-xs line-clamp-3 flex-1">{p.text || "Publicación sin texto"}</p>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{nf(p.interactions)} interacciones</span>
          <span>{nf(p.reach)} {p.network === "tiktok" ? "reprod." : "alcance"}</span>
          <span className={p.idx >= 1.2 ? "text-emerald-500" : p.idx < 0.8 ? "text-coral" : ""}>{nf(p.idx, 1)}× su red</span>
          {!!p.saves && <span className="inline-flex items-center gap-1"><Bookmark className="w-3 h-3" />{nf(p.saves)}</span>}
          {!!p.shares && <span className="inline-flex items-center gap-1"><Share2 className="w-3 h-3" />{nf(p.shares)}</span>}
          <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" />
        </div>
      </div>
    </a>
  );
}

function TopPosts({ posts, title, subtitle }: { posts: Post[]; title: string; subtitle?: string }) {
  if (!posts.length) return null;
  return (
    <Card className="glass border-border/50 p-5 space-y-3">
      <div><div className="text-sm font-semibold">{title}</div>{subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}</div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{posts.map((p, i) => <PostCard key={i} p={p} />)}</div>
    </Card>
  );
}

