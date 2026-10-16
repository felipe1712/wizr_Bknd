import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { BarChart3, Download, TrendingUp, TrendingDown, PieChart as PieIcon, Table as TableIcon, Newspaper, Trophy, Target, AlertTriangle, Sparkles, Minus, ArrowUp, ArrowDown, CalendarIcon, Lightbulb } from "lucide-react";
import BenchmarkNarratives from "./BenchmarkNarratives";

type Competitor = { id: string; name: string; network: string; brand_color: string; active: boolean; is_client: boolean; image_url: string | null; external_url: string | null; dependencia_id?: string | null; account_type?: string | null };
type Dependencia = { id: string; nombre: string; tipo: string | null; titular: string | null; titular_cargo: string | null; sort_order: number | null };
type Period = { id: string; period_label: string; period_start: string; period_end: string };
type Metric = { id: string; period_id: string; competitor_id: string; network: string; performance_index: number | null; followers: number | null; follower_growth_rate: number | null; engagement_rate: number | null; posts_per_day: number | null; reach_per_day: number | null; interaction_per_impression: number | null };
type Daily = { period_id: string; competitor_id: string; network: string; day: string; delta: number };
type Post = { id: string; period_id: string; competitor_id: string | null; network: string; profile_name: string; posted_at: string | null; message: string | null; likes: number | null; comments: number | null; interactions: number | null; engagement_rate: number | null; link: string | null; image_link: string | null; source_account_type?: "institucional" | "titular" | null };

const METRICS: { key: keyof Metric; label: string; fmt: (n: number) => string }[] = [
  { key: "followers", label: "Seguidores", fmt: (n) => n.toLocaleString("es-MX") },
  { key: "engagement_rate", label: "Tasa de interacción", fmt: (n) => (n * 100).toFixed(2) + "%" },
  { key: "follower_growth_rate", label: "Crecimiento de seguidores / día", fmt: (n) => (n * 100).toFixed(3) + "%" },
  { key: "posts_per_day", label: "Publicaciones por día", fmt: (n) => n.toFixed(2) },
  { key: "performance_index", label: "Índice de rendimiento", fmt: (n) => n.toFixed(2) },
  { key: "interaction_per_impression", label: "Interacción / impresión", fmt: (n) => (n * 100).toFixed(3) + "%" },
];

export default function PortalBenchmark({ clientId, clientName, scope, groupBy }: { clientId: string; clientName: string; scope?: "general" | "funcionarios" | "instituciones"; groupBy?: "dependencia" }) {
  const byDependencia = groupBy === "dependencia";
  const [rawCompetitors, setRawCompetitors] = useState<Competitor[]>([]);
  const [dependencias, setDependencias] = useState<Dependencia[]>([]);
  const [accountFilter, setAccountFilter] = useState<"ambos" | "institucional" | "titular">("ambos");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodAlias, setPeriodAlias] = useState<Map<string, string>>(new Map());
  const [rawMetrics, setRawMetrics] = useState<Metric[]>([]);
  const [rawDaily, setRawDaily] = useState<Daily[]>([]);
  const [rawPosts, setRawPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<string>("followers");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [rangeMode, setRangeMode] = useState<"period" | "custom">("period");
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>(undefined);
  const [rangeTo, setRangeTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let periodsQ = supabase.from("client_portal_benchmark_periods").select("*").eq("client_id", clientId);
      if (scope && !byDependencia) periodsQ = periodsQ.eq("scope", scope);
      let competitorsQ = supabase.from("client_portal_benchmark_competitors").select("*").eq("client_id", clientId).eq("active", true);
      if (scope && !byDependencia) competitorsQ = competitorsQ.eq("scope", scope);
      const [c, p, dep] = await Promise.all([
        competitorsQ.order("is_client", { ascending: false }).order("name"),
        periodsQ.order("period_start", { ascending: true }),
        byDependencia
          ? supabase.from("client_portal_dependencias").select("*").eq("client_id", clientId).order("sort_order")
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const rawPeriods = (p.data ?? []) as Period[];
      // En modo dependencia los periodos vienen duplicados por scope (funcionarios /
      // instituciones). Se fusionan por etiqueta para no partir el dataset.
      let ps = rawPeriods;
      const alias = new Map<string, string>();
      if (byDependencia) {
        const byLabel = new Map<string, Period[]>();
        rawPeriods.forEach((pp) => {
          if (!byLabel.has(pp.period_label)) byLabel.set(pp.period_label, []);
          byLabel.get(pp.period_label)!.push(pp);
        });
        ps = Array.from(byLabel.entries())
          .map(([label, group]) => {
            // Sin "::" en el id: ese separador se usa para las claves compuestas.
            const id = `lbl@${label}`;
            group.forEach((g) => alias.set(g.id, id));
            return {
              id,
              period_label: label,
              period_start: group.map((g) => g.period_start).sort()[0],
              period_end: group.map((g) => g.period_end).sort().slice(-1)[0],
            } as Period;
          })
          .sort((a, b) => a.period_start.localeCompare(b.period_start));
      }
      setPeriodAlias(alias);
      setRawCompetitors((c.data ?? []) as Competitor[]);
      setDependencias((dep.data ?? []) as Dependencia[]);
      setPeriods(ps);
      if (ps.length) {
        setSelectedPeriod(ps[ps.length - 1].id);
        const periodIds = rawPeriods.map((x) => x.id);
        const [m, d, po] = await Promise.all([
          supabase.from("client_portal_benchmark_metrics").select("*").in("period_id", periodIds).limit(20000),
          supabase.from("client_portal_benchmark_follower_daily").select("*").in("period_id", periodIds).limit(50000),
          supabase.from("client_portal_benchmark_posts").select("*").in("period_id", periodIds).order("interactions", { ascending: false }).limit(byDependencia ? 50000 : 2000),
        ]);
        setRawMetrics((m.data ?? []) as Metric[]);
        setRawDaily((d.data ?? []) as Daily[]);
        setRawPosts((po.data ?? []) as Post[]);
      }
      setLoading(false);
    })();
  }, [clientId, scope, byDependencia]);

  // ---------- AGRUPACIÓN POR DEPENDENCIA (lógica secretaría–titular) ----------
  const depPalette = ["#2563eb", "#0891b2", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#ca8a04", "#4f46e5"];

  /** Perfiles visibles según el filtro de tipo de cuenta (institucional / titular / ambos). */
  const allowedIds = useMemo(() => {
    if (!byDependencia) return null;
    const ok = rawCompetitors.filter(
      (c) => c.dependencia_id && (accountFilter === "ambos" || (c.account_type ?? "institucional") === accountFilter),
    );
    return new Set(ok.map((c) => c.id));
  }, [byDependencia, rawCompetitors, accountFilter]);

  const depOfCompetitor = useMemo(() => {
    const m = new Map<string, string>();
    rawCompetitors.forEach((c) => { if (c.dependencia_id) m.set(c.id, c.dependencia_id); });
    return m;
  }, [rawCompetitors]);

  const rawCompetitorMap = useMemo(
    () => new Map(rawCompetitors.map((c) => [c.id, c])),
    [rawCompetitors],
  );

  /** Entidades a comparar: cada dependencia se comporta como un "competidor". */
  const competitors = useMemo<Competitor[]>(() => {
    if (!byDependencia) return rawCompetitors;
    const used = new Set<string>();
    allowedIds?.forEach((id) => { const d = depOfCompetitor.get(id); if (d) used.add(d); });
    return dependencias
      .filter((d) => used.has(d.id))
      .map((d, i) => ({
        id: d.id,
        name: accountFilter === "ambos" ? d.nombre : `${d.nombre} · ${accountFilter === "titular" ? "titular" : "institucional"}`,
        network: "",
        brand_color: depPalette[i % depPalette.length],
        active: true,
        is_client: false,
        image_url: null,
        external_url: null,
      }));
  }, [byDependencia, rawCompetitors, dependencias, allowedIds, depOfCompetitor, accountFilter]);

  const RATE_KEYS = new Set(["engagement_rate", "follower_growth_rate", "interaction_per_impression", "performance_index"]);

  /** Métricas sumadas (escala) o promediadas (tasas) por dependencia + red + periodo. */
  const metrics = useMemo<Metric[]>(() => {
    if (!byDependencia) return rawMetrics;
    const bucket = new Map<string, Metric[]>();
    for (const m of rawMetrics) {
      if (!allowedIds?.has(m.competitor_id)) continue;
      const dep = depOfCompetitor.get(m.competitor_id);
      if (!dep) continue;
      const k = `${periodAlias.get(m.period_id) ?? m.period_id}::${dep}::${m.network}`;
      if (!bucket.has(k)) bucket.set(k, []);
      bucket.get(k)!.push(m);
    }
    const out: Metric[] = [];
    bucket.forEach((rows, k) => {
      const [period_id, dep, network] = k.split("::");
      const merged: any = { id: `dep-${k}`, period_id, competitor_id: dep, network };
      for (const M of METRICS) {
        const vals = rows.map((r) => Number(r[M.key])).filter((v) => Number.isFinite(v));
        merged[M.key] = vals.length
          ? (RATE_KEYS.has(M.key as string) ? vals.reduce((a, b) => a + b, 0) / vals.length : vals.reduce((a, b) => a + b, 0))
          : null;
      }
      merged.reach_per_day = rows.reduce((a, r) => a + (Number(r.reach_per_day) || 0), 0) || null;
      out.push(merged as Metric);
    });
    return out;
  }, [byDependencia, rawMetrics, allowedIds, depOfCompetitor, periodAlias]);

  const daily = useMemo<Daily[]>(() => {
    if (!byDependencia) return rawDaily;
    const bucket = new Map<string, Daily>();
    for (const d of rawDaily) {
      if (!allowedIds?.has(d.competitor_id)) continue;
      const dep = depOfCompetitor.get(d.competitor_id);
      if (!dep) continue;
      const pid = periodAlias.get(d.period_id) ?? d.period_id;
      const k = `${pid}::${dep}::${d.network}::${d.day}`;
      const prev = bucket.get(k);
      if (prev) prev.delta += Number(d.delta) || 0;
      else bucket.set(k, { ...d, period_id: pid, competitor_id: dep, delta: Number(d.delta) || 0 });
    }
    return Array.from(bucket.values());
  }, [byDependencia, rawDaily, allowedIds, depOfCompetitor, periodAlias]);

  const posts = useMemo<Post[]>(() => {
    if (!byDependencia) return rawPosts;
    return rawPosts
      // En modo gabinete sólo entran publicaciones que pertenecen a un perfil
      // mapeado y permitido por el filtro de Cuentas. Las publicaciones sin
      // perfil asignado se descartan: contarlas como "institucional" ensuciaba
      // los promedios y las tablas.
      .filter((p) => !!p.competitor_id && !!allowedIds?.has(p.competitor_id))
      .map((p) => ({
        ...p,
        period_id: periodAlias.get(p.period_id) ?? p.period_id,
        source_account_type: p.competitor_id
          ? ((rawCompetitorMap.get(p.competitor_id)?.account_type ?? "institucional") as "institucional" | "titular")
          : null,
        competitor_id: p.competitor_id ? (depOfCompetitor.get(p.competitor_id) ?? p.competitor_id) : p.competitor_id,
      }))
      // El selector "Cuentas" (institucional / titular / ambos) aplica a TODOS los
      // despliegues de contenido, igual que a las gráficas de métricas.
      .filter((p) => accountFilter === "ambos" || (p.source_account_type ?? "institucional") === accountFilter);
  }, [byDependencia, rawPosts, allowedIds, depOfCompetitor, periodAlias, rawCompetitorMap, accountFilter]);

  const compMap = useMemo(() => new Map(competitors.map((c) => [c.id, c])), [competitors]);
  const currentPeriod = periods.find((p) => p.id === selectedPeriod) ?? null;
  const currentMetric = METRICS.find((m) => m.key === selectedMetric) ?? METRICS[0];

  // ---------- DATE RANGE MODE ----------
  // effective date range for filtering posts/daily.
  // In "period" mode we derive it from selectedPeriod. In "custom" we use rangeFrom/rangeTo.
  const effectiveRange = useMemo<{ from: Date; to: Date; label: string } | null>(() => {
    if (rangeMode === "custom" && rangeFrom && rangeTo) {
      const from = rangeFrom < rangeTo ? rangeFrom : rangeTo;
      const to = rangeFrom < rangeTo ? rangeTo : rangeFrom;
      const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
      return { from, to, label: `${fmt(from)} — ${fmt(to)}` };
    }
    if (currentPeriod) {
      return {
        from: new Date(currentPeriod.period_start),
        to: new Date(currentPeriod.period_end),
        label: currentPeriod.period_label,
      };
    }
    return null;
  }, [rangeMode, rangeFrom, rangeTo, currentPeriod]);

  // Periods that overlap effective range (used when custom range spans multiple months)
  const activePeriodIds = useMemo<string[]>(() => {
    if (rangeMode === "period") return selectedPeriod ? [selectedPeriod] : [];
    if (!effectiveRange) return [];
    return periods
      .filter((p) => {
        const s = new Date(p.period_start);
        const e = new Date(p.period_end);
        return s <= effectiveRange.to && e >= effectiveRange.from;
      })
      .map((p) => p.id);
  }, [rangeMode, selectedPeriod, periods, effectiveRange]);

  const inRange = (isoOrDate: string | Date | null): boolean => {
    if (!effectiveRange || !isoOrDate) return false;
    const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
    if (isNaN(d.getTime())) return false;
    return d >= effectiveRange.from && d <= new Date(effectiveRange.to.getTime() + 86_400_000 - 1);
  };

  // Preset helper
  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    setRangeMode("custom");
    setRangeFrom(from);
    setRangeTo(to);
  };

  const networks = useMemo(() => {
    const set = new Set<string>();
    metrics.forEach((m) => set.add(m.network));
    return ["all", ...Array.from(set).sort()];
  }, [metrics]);

  const periodMetrics = useMemo(() => {
    // In custom range with multiple overlapping periods, we average scale metrics
    // and rate metrics per (competitor, network) across those periods.
    const base = metrics.filter((m) => activePeriodIds.includes(m.period_id) && (networkFilter === "all" || m.network === networkFilter));
    if (activePeriodIds.length <= 1) return base;
    const isRateKey = (k: string) => k === "engagement_rate" || k === "follower_growth_rate" || k === "interaction_per_impression" || k === "performance_index";
    const bucket = new Map<string, { rows: Metric[] }>();
    for (const r of base) {
      const k = `${r.competitor_id}::${r.network}`;
      if (!bucket.has(k)) bucket.set(k, { rows: [] });
      bucket.get(k)!.rows.push(r);
    }
    const out: Metric[] = [];
    bucket.forEach(({ rows }, k) => {
      const first = rows[0];
      const merged: any = { ...first, id: `agg-${k}` };
      for (const M of METRICS) {
        const vals = rows.map((r) => Number(r[M.key])).filter((v) => Number.isFinite(v));
        if (!vals.length) { merged[M.key] = null; continue; }
        const s = vals.reduce((a, b) => a + b, 0);
        merged[M.key] = isRateKey(M.key as string) ? s / vals.length : s / vals.length; // avg for both in range mode
      }
      out.push(merged as Metric);
    });
    return out;
  }, [metrics, activePeriodIds, networkFilter]);

  // Ranking
  const rankingData = useMemo(() => {
    return periodMetrics
      .map((m) => {
        const c = compMap.get(m.competitor_id);
        const v = Number(m[selectedMetric as keyof Metric] ?? 0);
        return { brand: c ? `${c.name}${networkFilter === "all" ? ` · ${m.network}` : ""}` : m.competitor_id, value: v, color: c?.brand_color ?? "#94a3b8", isClient: !!c?.is_client };
      })
      .filter((r) => Number.isFinite(r.value) && r.value !== 0)
      .sort((a, b) => b.value - a.value);
  }, [periodMetrics, selectedMetric, compMap, networkFilter]);

  const shareTotal = rankingData.reduce((a, b) => a + b.value, 0);

  /** Gráficas legibles: sólo el top N; el resto se agrupa u omite. */
  const topRanking = useMemo(() => rankingData.slice(0, 15), [rankingData]);
  const shareData = useMemo(() => {
    const top = rankingData.slice(0, 8);
    const rest = rankingData.slice(8);
    const restTotal = rest.reduce((a, b) => a + b.value, 0);
    return restTotal > 0
      ? [...top, { brand: `Otras (${rest.length})`, value: restTotal, color: "#94a3b8", isClient: false }]
      : top;
  }, [rankingData]);

  // Evolution (usa periodos: métrica agregada por periodo/competidor)
  const evolutionData = useMemo(() => {
    if (!periods.length) return [];
    const byPeriod = new Map<string, Record<string, any>>();
    periods.forEach((p) => byPeriod.set(p.id, { period: p.period_label }));
    for (const m of metrics) {
      if (networkFilter !== "all" && m.network !== networkFilter) continue;
      const row = byPeriod.get(m.period_id);
      if (!row) continue;
      const c = compMap.get(m.competitor_id);
      if (!c) continue;
      const key = `${c.name}${networkFilter === "all" ? ` · ${m.network}` : ""}`;
      const v = Number(m[selectedMetric as keyof Metric] ?? 0);
      // If multiple networks under "all", sum for the same competitor
      row[key] = (row[key] ?? 0) + (Number.isFinite(v) ? v : 0);
    }
    return Array.from(byPeriod.values());
  }, [metrics, periods, selectedMetric, compMap, networkFilter]);

  const brandsList = useMemo(() => {
    const seen = new Map<string, { key: string; color: string; isClient: boolean }>();
    for (const m of metrics) {
      if (networkFilter !== "all" && m.network !== networkFilter) continue;
      const c = compMap.get(m.competitor_id);
      if (!c) continue;
      const key = `${c.name}${networkFilter === "all" ? ` · ${m.network}` : ""}`;
      if (!seen.has(key)) seen.set(key, { key, color: c.brand_color, isClient: c.is_client });
    }
    return Array.from(seen.values()).sort((a, b) => (a.isClient === b.isClient ? 0 : a.isClient ? -1 : 1));
  }, [metrics, compMap, networkFilter]);

  // Daily followers evolution (line chart) — para el periodo seleccionado
  const dailyEvolution = useMemo(() => {
    if (!effectiveRange) return [];
    const days = new Set<string>();
    const byDay = new Map<string, Record<string, any>>();
    for (const d of daily) {
      if (!activePeriodIds.includes(d.period_id)) continue;
      if (!inRange(d.day)) continue;
      if (networkFilter !== "all" && d.network !== networkFilter) continue;
      days.add(d.day);
      if (!byDay.has(d.day)) byDay.set(d.day, { day: d.day });
      const c = compMap.get(d.competitor_id);
      if (!c) continue;
      const key = `${c.name}${networkFilter === "all" ? ` · ${d.network}` : ""}`;
      byDay.get(d.day)![key] = (byDay.get(d.day)![key] ?? 0) + d.delta;
    }
    return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [daily, activePeriodIds, effectiveRange, networkFilter, compMap]);

  // Top posts
  const topPosts = useMemo(() => {
    return posts
      .filter((p) => activePeriodIds.includes(p.period_id) && (networkFilter === "all" || p.network === networkFilter))
      .filter((p) => rangeMode === "period" ? true : inRange(p.posted_at))
      .sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0))
      .slice(0, 20);
  }, [posts, activePeriodIds, networkFilter, rangeMode, effectiveRange]);

  // Identify client competitor(s)
  const clientCompetitorIds = useMemo(
    () => new Set(competitors.filter((c) => c.is_client).map((c) => c.id)),
    [competitors],
  );

  // Robust client-post detector (falls back to profile_name match when competitor_id is missing)
  const isClientPost = (p: Post): boolean => {
    if (p.competitor_id && clientCompetitorIds.has(p.competitor_id)) return true;
    if (!p.profile_name) return false;
    const a = p.profile_name.toLowerCase();
    const b = clientName.toLowerCase();
    return a.includes(b) || b.includes(a);
  };

  // Previous period (chronological). In custom range mode, "previous" = first period before range.from.
  const prevPeriod = useMemo(() => {
    if (rangeMode === "custom" && effectiveRange) {
      const before = periods.filter((p) => new Date(p.period_end) < effectiveRange.from);
      return before.length ? before[before.length - 1] : null;
    }
    const idx = periods.findIndex((p) => p.id === selectedPeriod);
    return idx > 0 ? periods[idx - 1] : null;
  }, [periods, selectedPeriod, rangeMode, effectiveRange]);

  /** Ids del periodo anterior tal y como aparecen en `metrics` (los periodos se fusionan por alias). */
  const prevPeriodIds = useMemo<string[]>(() => {
    if (!prevPeriod) return [];
    const alias = periodAlias.get(prevPeriod.id) ?? prevPeriod.id;
    return Array.from(new Set([prevPeriod.id, alias]));
  }, [prevPeriod, periodAlias]);

  // Insights layer — deterministic templates, no LLM
  const insights = useMemo(() => {
    const netFilter = (m: { network: string }) => networkFilter === "all" || m.network === networkFilter;
    const currentAll = metrics.filter((m) => activePeriodIds.includes(m.period_id) && netFilter(m));
    const prevAll = prevPeriodIds.length ? metrics.filter((m) => prevPeriodIds.includes(m.period_id) && netFilter(m)) : [];

    // Aggregate helper: value by competitor for a metric key (sum across networks when "all")
    const aggByCompetitor = (rows: Metric[], key: keyof Metric) => {
      const map = new Map<string, number>();
      for (const r of rows) {
        const v = Number(r[key] ?? 0);
        if (!Number.isFinite(v)) continue;
        map.set(r.competitor_id, (map.get(r.competitor_id) ?? 0) + v);
      }
      return map;
    };

    // For rate-type metrics, averaging is more meaningful than summing; but since we filter by network or select "all",
    // and each competitor typically has one row per network, sum ≈ total presence. We keep sum for scale metrics
    // (followers, posts_per_day, reach_per_day) and average across networks for rates.
    const isRate = (k: string) => k === "engagement_rate" || k === "follower_growth_rate" || k === "interaction_per_impression" || k === "performance_index";
    const aggBy = (rows: Metric[], key: keyof Metric) => {
      if (!isRate(key as string)) return aggByCompetitor(rows, key);
      const sums = new Map<string, { s: number; n: number }>();
      for (const r of rows) {
        const v = Number(r[key] ?? NaN);
        if (!Number.isFinite(v)) continue;
        const e = sums.get(r.competitor_id) ?? { s: 0, n: 0 };
        e.s += v; e.n += 1;
        sums.set(r.competitor_id, e);
      }
      const out = new Map<string, number>();
      sums.forEach((v, k) => out.set(k, v.n ? v.s / v.n : 0));
      return out;
    };

    // Position of client for a metric (rank #N of M)
    const rankFor = (rows: Metric[], key: keyof Metric) => {
      const m = aggBy(rows, key);
      const arr = Array.from(m.entries()).filter(([, v]) => Number.isFinite(v) && v !== 0).sort((a, b) => b[1] - a[1]);
      const total = arr.length;
      let clientRank: number | null = null;
      let clientVal: number | null = null;
      for (let i = 0; i < arr.length; i++) {
        if (clientCompetitorIds.has(arr[i][0])) { clientRank = i + 1; clientVal = arr[i][1]; break; }
      }
      return { rank: clientRank, total, value: clientVal };
    };

    // Client value + previous value for a metric
    const clientValue = (rows: Metric[], key: keyof Metric) => {
      const m = aggBy(rows, key);
      let v = 0; let found = false;
      for (const id of clientCompetitorIds) {
        if (m.has(id)) { v += m.get(id)!; found = true; }
      }
      return found ? v : null;
    };

    // Sector average (excluding client)
    const sectorAvg = (rows: Metric[], key: keyof Metric) => {
      const m = aggBy(rows, key);
      const vals: number[] = [];
      m.forEach((v, id) => { if (!clientCompetitorIds.has(id) && Number.isFinite(v) && v !== 0) vals.push(v); });
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const pct = (a: number | null, b: number | null) => {
      if (a == null || b == null || b === 0) return null;
      return (a - b) / Math.abs(b);
    };

    const engagementRank = rankFor(currentAll, "engagement_rate");
    const followersClient = clientValue(currentAll, "followers");
    const followersPrev = clientValue(prevAll, "followers");
    const followersDelta = pct(followersClient, followersPrev);

    const engClient = clientValue(currentAll, "engagement_rate");
    const engPrev = clientValue(prevAll, "engagement_rate");
    const engDelta = pct(engClient, engPrev);

    const engSector = sectorAvg(currentAll, "engagement_rate");
    const engVsSector = pct(engClient, engSector);

    const followersSector = sectorAvg(currentAll, "followers");
    const followersVsSector = pct(followersClient, followersSector);

    // Best post of the period (client) by interactions
    const clientPostsForBest = posts.filter((p) =>
      activePeriodIds.includes(p.period_id)
      && (networkFilter === "all" || p.network === networkFilter)
      && (rangeMode === "period" || inRange(p.posted_at))
      && isClientPost(p),
    );
    let bestPost = clientPostsForBest.slice().sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0))[0] ?? null;
    let bestPostFromSector = false;
    if (!bestPost) {
      // Fallback: show the sector's best so the KPI never reads empty when filters exclude the client
      const sectorPostsForBest = posts.filter((p) =>
        activePeriodIds.includes(p.period_id)
        && (networkFilter === "all" || p.network === networkFilter)
        && (rangeMode === "period" || inRange(p.posted_at))
        && !isClientPost(p),
      );
      bestPost = sectorPostsForBest.slice().sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0))[0] ?? null;
      bestPostFromSector = !!bestPost;
    }

    // Streak on followers growth (consecutive positive months)
    let streak = 0;
    if (periods.length > 1) {
      for (let i = periods.length - 1; i > 0; i--) {
        const curr = clientValue(metrics.filter((m) => m.period_id === periods[i].id && netFilter(m)), "followers");
        const prev = clientValue(metrics.filter((m) => m.period_id === periods[i - 1].id && netFilter(m)), "followers");
        const d = pct(curr, prev);
        if (d != null && d > 0) streak++;
        else break;
      }
    }

    // Metric where client gained/lost most vs previous period
    let bestMetric: { key: string; label: string; delta: number } | null = null;
    let worstMetric: { key: string; label: string; delta: number } | null = null;
    for (const m of METRICS) {
      const c = clientValue(currentAll, m.key);
      const p = clientValue(prevAll, m.key);
      const d = pct(c, p);
      if (d == null) continue;
      if (!bestMetric || d > bestMetric.delta) bestMetric = { key: m.key as string, label: m.label, delta: d };
      if (!worstMetric || d < worstMetric.delta) worstMetric = { key: m.key as string, label: m.label, delta: d };
    }

    // Headline
    let headline = `${clientName} tiene datos cargados para ${currentPeriod?.period_label ?? "este periodo"}.`;
    if (engDelta != null && engSector != null && engVsSector != null) {
      const sectorDelta = (() => {
        const sc = sectorAvg(currentAll, "engagement_rate");
        const sp = sectorAvg(prevAll, "engagement_rate");
        return pct(sc, sp);
      })();
      if (sectorDelta != null) {
        headline = `${clientName} ${engDelta >= 0 ? "subió" : "cayó"} ${Math.abs(engDelta * 100).toFixed(1)}% en engagement mientras el sector ${sectorDelta >= 0 ? "subió" : "cayó"} ${Math.abs(sectorDelta * 100).toFixed(1)}%.`;
      } else {
        headline = `${clientName} ${engDelta >= 0 ? "subió" : "cayó"} ${Math.abs(engDelta * 100).toFixed(1)}% en engagement vs el mes anterior.`;
      }
    } else if (followersDelta != null) {
      headline = `${clientName} ${followersDelta >= 0 ? "creció" : "perdió"} ${Math.abs(followersDelta * 100).toFixed(1)}% en seguidores vs el mes anterior.`;
    }

    // Alerts
    const alerts: string[] = [];
    for (const m of METRICS) {
      const c = clientValue(currentAll, m.key);
      const p = clientValue(prevAll, m.key);
      const d = pct(c, p);
      if (d != null && d < -0.15) alerts.push(`${m.label} cayó ${(d * 100).toFixed(1)}% vs mes anterior.`);
    }
    if (engagementRank.rank && engagementRank.rank > 3) {
      alerts.push(`Están fuera del top 3 en engagement (#${engagementRank.rank} de ${engagementRank.total}).`);
    }

    return {
      engagementRank,
      followersClient, followersDelta, followersVsSector,
      engClient, engDelta, engVsSector, engSector,
      bestPost, bestPostFromSector,
      streak,
      bestMetric, worstMetric,
      headline,
      alerts,
    };
  }, [metrics, posts, activePeriodIds, prevPeriod, networkFilter, clientCompetitorIds, clientName, periods, currentPeriod, rangeMode, effectiveRange]);

  // Client's own evolution across all periods (for Actinver tab)
  // ---------- INSIGHTS DE GABINETE (modo dependencia: no hay "cliente") ----------
  const gabinete = useMemo(() => {
    if (!byDependencia) return null;
    const netFilter = (m: { network: string }) => networkFilter === "all" || m.network === networkFilter;
    const isRate = (k: string) => k === "engagement_rate" || k === "follower_growth_rate" || k === "interaction_per_impression" || k === "performance_index";
    const aggBy = (rows: Metric[], key: keyof Metric) => {
      const acc = new Map<string, { s: number; n: number }>();
      for (const r of rows) {
        const v = Number(r[key] ?? NaN);
        if (!Number.isFinite(v)) continue;
        const e = acc.get(r.competitor_id) ?? { s: 0, n: 0 };
        e.s += v; e.n += 1;
        acc.set(r.competitor_id, e);
      }
      const out = new Map<string, number>();
      acc.forEach((v, k) => out.set(k, isRate(key as string) ? (v.n ? v.s / v.n : 0) : v.s));
      return out;
    };
    const curr = metrics.filter((m) => activePeriodIds.includes(m.period_id) && netFilter(m));
    const prev = prevPeriodIds.length ? metrics.filter((m) => prevPeriodIds.includes(m.period_id) && netFilter(m)) : [];

    const engNow = aggBy(curr, "engagement_rate");
    const engRanking = Array.from(engNow.entries())
      .filter(([, v]) => Number.isFinite(v) && v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id, v]) => ({ id, name: compMap.get(id)?.name ?? "—", value: v }));
    const engAvg = engRanking.length ? engRanking.reduce((a, b) => a + b.value, 0) / engRanking.length : null;

    // Crecimiento de seguidores: se compara SOLO sobre pares (dependencia, red) con dato
    // en ambos periodos. Comparar sumas totales produce falsos -100% / +900% cuando la
    // cobertura de redes cambia entre meses o cambia el filtro de Cuentas.
    const followersByDepNet = (rows: Metric[]) => {
      const acc = new Map<string, number>();
      for (const r of rows) {
        const v = Number(r.followers ?? NaN);
        if (!Number.isFinite(v)) continue;
        const k = `${r.competitor_id}::${r.network}`;
        acc.set(k, (acc.get(k) ?? 0) + v);
      }
      return acc;
    };
    const fNowNet = followersByDepNet(curr);
    const fPrevNet = followersByDepNet(prev);
    const paired = new Map<string, { now: number; prev: number }>();
    fNowNet.forEach((v, k) => {
      const p = fPrevNet.get(k);
      if (p == null || p === 0) return;
      const dep = k.split("::")[0];
      const e = paired.get(dep) ?? { now: 0, prev: 0 };
      e.now += v; e.prev += p;
      paired.set(dep, e);
    });
    const moves = Array.from(paired.entries()).map(([id, v]) => ({
      id,
      name: compMap.get(id)?.name ?? "—",
      delta: (v.now - v.prev) / Math.abs(v.prev),
      value: v.now,
    }));
    const risers = moves.slice().sort((a, b) => b.delta - a.delta).slice(0, 5);
    const fallers = moves.slice().sort((a, b) => a.delta - b.delta).slice(0, 5);

    const postsHere = posts.filter((p) =>
      activePeriodIds.includes(p.period_id)
      && (networkFilter === "all" || p.network === networkFilter)
      && (rangeMode === "period" || inRange(p.posted_at)),
    );
    const bestPost = postsHere.slice().sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0))[0] ?? null;

    const noData = engRanking.length === 0;
    const unit = accountFilter === "titular" ? "titulares" : accountFilter === "institucional" ? "cuentas institucionales" : "dependencias";
    const headline = noData
      ? `Sin métricas cargadas para ${effectiveRange?.label ?? "este periodo"} con los filtros activos.`
      : `${engRanking[0].name} lidera en engagement (${(engRanking[0].value * 100).toFixed(2)}%) entre ${engRanking.length} ${unit} con datos${risers.length ? `; ${risers[0].name} es quien más crece en seguidores (${(risers[0].delta * 100).toFixed(1)}%)` : ""}.`;

    return { engRanking, engAvg, risers, fallers, bestPost, headline, entities: engRanking.length, unit };
  }, [byDependencia, metrics, posts, activePeriodIds, prevPeriodIds, networkFilter, compMap, currentPeriod, rangeMode, effectiveRange, accountFilter]);

  const clientEvolution = useMemo(() => {
    const netFilter = (m: { network: string }) => networkFilter === "all" || m.network === networkFilter;
    return periods.map((p) => {
      const rows = metrics.filter((m) => m.period_id === p.id && netFilter(m) && clientCompetitorIds.has(m.competitor_id));
      const row: Record<string, any> = { period: p.period_label };
      for (const M of METRICS) {
        let sum = 0, count = 0;
        for (const r of rows) {
          const v = Number(r[M.key] ?? NaN);
          if (Number.isFinite(v)) { sum += v; count++; }
        }
        const isRateKey = M.key === "engagement_rate" || M.key === "follower_growth_rate" || M.key === "interaction_per_impression" || M.key === "performance_index";
        row[M.key as string] = count ? (isRateKey ? sum / count : sum) : null;
      }
      return row;
    });
  }, [periods, metrics, networkFilter, clientCompetitorIds]);

  function exportCsv() {
    const header = ["periodo", "perfil", "red", "seguidores", "crecimiento_rate", "engagement_rate", "posts_dia", "alcance_dia", "indice_rendimiento", "interaccion_por_impresion"];
    const periodMap = new Map(periods.map((p) => [p.id, p]));
    // El CSV exporta exactamente el universo visible (periodo/rango + red + cuentas).
    const rows = periodMetrics.map((m) => {
      const p = periodMap.get(m.period_id);
      const c = compMap.get(m.competitor_id);
      return [p?.period_label ?? "", c?.name ?? "", m.network, m.followers ?? "", m.follower_growth_rate ?? "", m.engagement_rate ?? "", m.posts_per_day ?? "", m.reach_per_day ?? "", m.performance_index ?? "", m.interaction_per_impression ?? ""];
    });
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [header.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `benchmark_${clientName}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Card className="p-8 text-center text-sm text-muted-foreground">Cargando benchmark…</Card>;
  if (periods.length === 0) {
    return (
      <Card className="p-8 text-center">
        <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-display font-bold text-lg">Sin datos de benchmark todavía</h3>
        <p className="text-sm text-muted-foreground mt-2">El equipo de KiMedia aún no ha cargado el primer export de FanpageKarma para este cliente.</p>
      </Card>
    );
  }

  const fmtPct = (v: number | null, digits = 1) => v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;
  const deltaColor = (v: number | null) => v == null ? "text-muted-foreground" : v > 0 ? "text-emerald-500" : v < 0 ? "text-rose-500" : "text-muted-foreground";
  const DeltaIcon = ({ v }: { v: number | null }) => v == null ? <Minus className="w-3.5 h-3.5" /> : v > 0 ? <ArrowUp className="w-3.5 h-3.5" /> : v < 0 ? <ArrowDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />;

  const postsInScope = posts.filter((p) =>
    activePeriodIds.includes(p.period_id)
    && (networkFilter === "all" || p.network === networkFilter)
    && (rangeMode === "period" || inRange(p.posted_at)),
  );
  const clientPostsPeriod = postsInScope.filter(isClientPost)
    .sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0));
  const sectorPostsPeriod = postsInScope.filter((p) => !isClientPost(p))
    .sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0));
  // En modo dependencia no hay "cliente": todo el gabinete es el universo comparado.
  const ownPosts = byDependencia ? postsInScope.slice().sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0)) : clientPostsPeriod;
  const institutionalPosts = byDependencia
    ? ownPosts.filter((p) => p.source_account_type === "institucional")
    : [];
  const titularPosts = byDependencia
    ? ownPosts.filter((p) => p.source_account_type === "titular")
    : [];
  /** Sufijo explícito del universo visible, para que ninguna tarjeta mienta sobre su fuente. */
  const scopeSuffix = !byDependencia || accountFilter === "ambos"
    ? ""
    : accountFilter === "titular" ? " (titulares)" : " (institucionales)";
  // Comparativo: en gabinete sólo tiene sentido contrastar institucional vs titular
  // cuando el filtro es "ambos"; con un filtro específico el universo es uno solo.
  const peerPosts = byDependencia
    ? (accountFilter === "ambos" ? (titularPosts.length ? titularPosts : ownPosts) : ownPosts)
    : sectorPostsPeriod;
  /** Pool para líder y palabras clave: siempre el universo visible en modo gabinete. */
  const insightPool = byDependencia ? ownPosts : peerPosts;
  /** Tabla "Top de titulares": estrictamente cuentas de funcionarios (sin fallback). */
  const topPeerPosts = byDependencia ? titularPosts : sectorPostsPeriod;
  /** Mejor publicación institucional de cada dependencia (modo gabinete). */
  const bestPerDependencia = (() => {
    if (!byDependencia) return [];
    const best = new Map<string, Post>();
    for (const p of institutionalPosts) {
      const k = p.competitor_id ?? p.profile_name;
      const prev = best.get(k);
      if (!prev || (p.interactions ?? 0) > (prev.interactions ?? 0)) best.set(k, p);
    }
    return Array.from(best.values()).sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0)).slice(0, 10);
  })();

  // ---------- Deeper content insights ----------
  const contentInsights = (() => {
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const median = (arr: number[]) => {
      if (!arr.length) return 0;
      const s = arr.slice().sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };
    const cInter = ownPosts.map((p) => p.interactions ?? 0);
    const sInter = peerPosts.map((p) => p.interactions ?? 0);
    // Best day of week for client
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const dayAgg = new Array(7).fill(0).map(() => ({ total: 0, n: 0 }));
    for (const p of ownPosts) {
      if (!p.posted_at) continue;
      const dow = new Date(p.posted_at).getDay();
      dayAgg[dow].total += p.interactions ?? 0;
      dayAgg[dow].n += 1;
    }
    const bestDay = dayAgg
      .map((d, i) => ({ day: dayNames[i], avg: d.n ? d.total / d.n : 0, n: d.n }))
      .filter((d) => d.n > 0)
      .sort((a, b) => b.avg - a.avg)[0] ?? null;

    // Top keywords from top sector posts (very light heuristic)
    const stop = new Set(["de","la","el","en","los","las","que","por","con","para","del","a","y","o","u","es","un","una","al","se","su","sus","lo","le","les","no","si","sí","este","esta","estos","estas","con","tu","tus","mi","mis","como","más","ya","ese","esa","esos","esas","the","and","for","of","to","in","on","is","it","this","that","are","with","from","at","by","or","be","an","as","we","you","your"]);
    const freq = new Map<string, number>();
    for (const p of insightPool.slice(0, 30)) {
      if (!p.message) continue;
      const words = p.message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-záéíóúñü0-9#@]+/i)
        .map((w) => w.trim())
        .filter((w) => w.length >= 4 && !stop.has(w) && !/^\d+$/.test(w));
      const seen = new Set<string>();
      for (const w of words) { if (!seen.has(w)) { freq.set(w, (freq.get(w) ?? 0) + 1); seen.add(w); } }
    }
    const topKeywords = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Sector leader (competitor with most total interactions in the range)
    const leaderMap = new Map<string, number>();
    for (const p of insightPool) {
      if (!p.competitor_id) continue;
      leaderMap.set(p.competitor_id, (leaderMap.get(p.competitor_id) ?? 0) + (p.interactions ?? 0));
    }
    const leaderEntry = Array.from(leaderMap.entries()).sort((a, b) => b[1] - a[1])[0];
    const leader = leaderEntry ? { name: compMap.get(leaderEntry[0])?.name ?? "?", total: leaderEntry[1] } : null;

    return {
      clientAvg: avg(cInter),
      clientMedian: median(cInter),
      sectorAvg: avg(sInter),
      sectorMedian: median(sInter),
      bestDay,
      topKeywords,
      leader,
      clientPostCount: cInter.length,
      sectorPostCount: sInter.length,
    };
  })();

  // Client evolution card fallback helper
  const latestValueFor = (key: string): { value: number; label: string; isLatest: boolean } | null => {
    for (let i = clientEvolution.length - 1; i >= 0; i--) {
      const v = clientEvolution[i][key] as number | null | undefined;
      if (v != null && Number.isFinite(v)) {
        return { value: v, label: clientEvolution[i].period as string, isLatest: i === clientEvolution.length - 1 };
      }
    }
    return null;
  };

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Modo</span>
          <Select value={rangeMode} onValueChange={(v) => setRangeMode(v as any)}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="period">Mes cargado</SelectItem>
              <SelectItem value="custom">Rango personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {rangeMode === "period" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Periodo</span>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{periods.slice().reverse().map((p) => <SelectItem key={p.id} value={p.id}>{p.period_label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => applyPreset(7)}>7d</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => applyPreset(15)}>15d</Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => applyPreset(30)}>30d</Button>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 justify-start text-left font-normal", !rangeFrom && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-1" />
                  {rangeFrom ? rangeFrom.toLocaleDateString("es-MX") : "Desde"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={rangeFrom} onSelect={setRangeFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 justify-start text-left font-normal", !rangeTo && "text-muted-foreground")}>
                  <CalendarIcon className="w-4 h-4 mr-1" />
                  {rangeTo ? rangeTo.toLocaleDateString("es-MX") : "Hasta"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={rangeTo} onSelect={setRangeTo} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Red</span>
          <Select value={networkFilter} onValueChange={setNetworkFilter}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{networks.map((n) => <SelectItem key={n} value={n}>{n === "all" ? "Todas" : n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {byDependencia && (
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Cuentas</span>
            <Select value={accountFilter} onValueChange={(v) => setAccountFilter(v as typeof accountFilter)}>
              <SelectTrigger className="w-[190px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Dependencia + titular</SelectItem>
                <SelectItem value="institucional">Solo cuenta institucional</SelectItem>
                <SelectItem value="titular">Solo titular</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1" />Exportar CSV
          </Button>
        </div>
      </div>
      {rangeMode === "custom" && effectiveRange && (
        <p className="text-[11px] text-muted-foreground -mt-2">
          Rango activo: <span className="font-medium text-foreground">{effectiveRange.label}</span>
          {activePeriodIds.length > 0 && ` · ${activePeriodIds.length} mes(es) de snapshot cubiertos`}
        </p>
      )}

      {/* Contexto del universo visible: todo el tablero se calcula sobre estos filtros. */}
      <div className="flex flex-wrap items-center gap-2 -mt-1">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Viendo</span>
        <Badge variant="secondary" className="text-[10px]">{effectiveRange?.label ?? "sin periodo"}</Badge>
        <Badge variant="secondary" className="text-[10px]">{networkFilter === "all" ? "Todas las redes" : networkFilter}</Badge>
        {byDependencia && (
          <Badge variant="secondary" className="text-[10px]">
            {accountFilter === "ambos" ? "Dependencia + titular" : accountFilter === "titular" ? "Solo titulares" : "Solo cuentas institucionales"}
          </Badge>
        )}
        {byDependencia && (
          <span className="text-[10px] text-muted-foreground">
            {competitors.length} {gabinete?.unit ?? "dependencias"} en el universo · {postsInScope.length} publicaciones
          </span>
        )}
      </div>

      {/* EXECUTIVE SUMMARY */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Insight del periodo</p>
            <p className="text-base font-medium leading-snug mt-1">{gabinete ? gabinete.headline : insights.headline}</p>
          </div>
        </div>
        {gabinete ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-background/60 border border-border/40">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Trophy className="w-3 h-3" />Líder en engagement{scopeSuffix}
              </div>
              <p className="mt-1 font-display font-bold text-base leading-tight">{gabinete.engRanking[0]?.name ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground">{gabinete.engRanking[0] ? (gabinete.engRanking[0].value * 100).toFixed(2) + "%" : "sin datos"}</p>
            </div>
            <div className="p-3 rounded-lg bg-background/60 border border-border/40">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Target className="w-3 h-3" />Promedio{scopeSuffix}
              </div>
              <p className="mt-1 font-display font-bold text-2xl tabular-nums">{gabinete.engAvg != null ? (gabinete.engAvg * 100).toFixed(2) + "%" : "—"}</p>
              <p className="text-[10px] text-muted-foreground">{gabinete.entities} {gabinete.unit} con datos</p>
            </div>
            <div className="p-3 rounded-lg bg-background/60 border border-border/40">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <TrendingUp className="w-3 h-3" />Mayor crecimiento{scopeSuffix}
              </div>
              <p className="mt-1 font-display font-bold text-base leading-tight">{gabinete.risers[0]?.name ?? "—"}</p>
              <p className={cn("text-[10px]", deltaColor(gabinete.risers[0]?.delta ?? null))}>{fmtPct(gabinete.risers[0]?.delta ?? null)} seguidores</p>
            </div>
            <div className="p-3 rounded-lg bg-background/60 border border-border/40">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Newspaper className="w-3 h-3" />Mejor post{scopeSuffix}
              </div>
              <div className="mt-1 font-display font-bold text-2xl tabular-nums">
                {gabinete.bestPost?.interactions?.toLocaleString("es-MX") ?? "—"}
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {gabinete.bestPost ? `${gabinete.bestPost.profile_name} · ${gabinete.bestPost.network}` : "sin publicaciones"}
              </p>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-background/60 border border-border/40">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Trophy className="w-3 h-3" />Posición engagement
            </div>
            <div className="mt-1 font-display font-bold text-2xl">
              {insights.engagementRank.rank ? `#${insights.engagementRank.rank}` : "—"}
              {insights.engagementRank.total > 0 && <span className="text-sm text-muted-foreground font-normal"> de {insights.engagementRank.total}</span>}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-background/60 border border-border/40">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <TrendingUp className="w-3 h-3" />Seguidores vs mes ant.
            </div>
            <div className={`mt-1 font-display font-bold text-2xl flex items-center gap-1 ${deltaColor(insights.followersDelta)}`}>
              <DeltaIcon v={insights.followersDelta} />{fmtPct(insights.followersDelta)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-background/60 border border-border/40">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Target className="w-3 h-3" />Engagement vs sector
            </div>
            <div className={`mt-1 font-display font-bold text-2xl flex items-center gap-1 ${deltaColor(insights.engVsSector)}`}>
              <DeltaIcon v={insights.engVsSector} />{fmtPct(insights.engVsSector)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-background/60 border border-border/40">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Newspaper className="w-3 h-3" />Mejor post
            </div>
            <div className="mt-1 font-display font-bold text-2xl tabular-nums">
              {insights.bestPost ? (insights.bestPost.interactions?.toLocaleString("es-MX") ?? "—") : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              interacciones{insights.bestPost?.network ? ` · ${insights.bestPost.network}` : ""}
              {insights.bestPostFromSector && insights.bestPost ? ` · sector (${insights.bestPost.profile_name})` : ""}
            </p>
          </div>
        </div>
        )}
        {!gabinete && insights.alerts.length > 0 && (
          <div className="mt-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-amber-500 mb-1">
              <AlertTriangle className="w-3 h-3" />Alertas
            </div>
            <ul className="text-xs space-y-1">
              {insights.alerts.map((a, i) => <li key={i}>• {a}</li>)}
            </ul>
          </div>
        )}
      </Card>

      {/* SUB-TABS */}
      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className={cn("grid w-full max-w-2xl", byDependencia ? "grid-cols-4" : "grid-cols-5")}>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          {!byDependencia && <TabsTrigger value="cliente">{clientName}</TabsTrigger>}
          <TabsTrigger value="competidores">{byDependencia ? "Comparativo" : "Competidores"}</TabsTrigger>
          <TabsTrigger value="contenido">Contenido</TabsTrigger>
          <TabsTrigger value="datos">Datos</TabsTrigger>
        </TabsList>

        {/* TAB: RESUMEN */}
        <TabsContent value="resumen" className="space-y-4 mt-4">
          {gabinete ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <h4 className="font-semibold text-sm">Quién sube{scopeSuffix}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Mayor crecimiento de seguidores vs periodo anterior, sólo sobre {gabinete.unit} y redes con dato en ambos periodos.</p>
                  {gabinete.risers.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Necesitas 2+ periodos.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {gabinete.risers.map((r) => (
                        <li key={r.id} className="flex items-center justify-between text-sm gap-2">
                          <span className="truncate">{r.name}</span>
                          <span className={cn("tabular-nums font-medium", deltaColor(r.delta))}>{fmtPct(r.delta)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-4 h-4 text-rose-500" />
                    <h4 className="font-semibold text-sm">Quién baja{scopeSuffix}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Mayor caída de seguidores vs periodo anterior, sólo sobre {gabinete.unit} y redes con dato en ambos periodos.</p>
                  {gabinete.fallers.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Necesitas 2+ periodos.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {gabinete.fallers.map((r) => (
                        <li key={r.id} className="flex items-center justify-between text-sm gap-2">
                          <span className="truncate">{r.name}</span>
                          <span className={cn("tabular-nums font-medium", deltaColor(r.delta))}>{fmtPct(r.delta)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-sm">Top 10 {gabinete.unit} — engagement</h4>
                  <span className="text-[10px] text-muted-foreground ml-auto">Promedio de {gabinete.unit} con datos: {gabinete.engAvg != null ? (gabinete.engAvg * 100).toFixed(2) + "%" : "—"} · última columna = vs promedio</span>
                </div>
                {gabinete.engRanking.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Sin datos con los filtros activos.</p>
                ) : (
                  <ul className="space-y-2">
                    {gabinete.engRanking.slice(0, 10).map((r, i) => (
                      <li key={r.id} className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                        <span className="flex-1 truncate">{r.name}</span>
                        <span className="tabular-nums font-medium">{(r.value * 100).toFixed(2)}%</span>
                        {gabinete.engAvg != null && (
                          <span className={cn("text-[10px] tabular-nums w-16 text-right", r.value >= gabinete.engAvg ? "text-emerald-500" : "text-rose-500")}>
                            {fmtPct((r.value - gabinete.engAvg) / gabinete.engAvg)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          ) : (
          <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h4 className="font-semibold text-sm">Dónde estamos ganando</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Métrica con mayor crecimiento vs mes anterior.</p>
              {insights.bestMetric ? (
                <div>
                  <p className="text-lg font-display font-bold">{insights.bestMetric.label}</p>
                  <p className={`text-3xl font-display font-bold ${deltaColor(insights.bestMetric.delta)}`}>{fmtPct(insights.bestMetric.delta)}</p>
                </div>
              ) : <p className="text-sm text-muted-foreground italic">Necesitas 2+ periodos.</p>}
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                <h4 className="font-semibold text-sm">Dónde estamos perdiendo</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Métrica con mayor caída vs mes anterior.</p>
              {insights.worstMetric ? (
                <div>
                  <p className="text-lg font-display font-bold">{insights.worstMetric.label}</p>
                  <p className={`text-3xl font-display font-bold ${deltaColor(insights.worstMetric.delta)}`}>{fmtPct(insights.worstMetric.delta)}</p>
                </div>
              ) : <p className="text-sm text-muted-foreground italic">Necesitas 2+ periodos.</p>}
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">Racha positiva de seguidores</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Meses consecutivos con crecimiento neto.</p>
            <p className="text-4xl font-display font-bold">{insights.streak} <span className="text-base font-normal text-muted-foreground">meses</span></p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Snapshot competitivo — Engagement rate</h4>
            </div>
            {(() => {
              const key: keyof Metric = "engagement_rate";
              const data = periodMetrics
                .map((m) => {
                  const c = compMap.get(m.competitor_id);
                  const v = Number(m[key] ?? 0);
                  return { brand: c ? `${c.name}${networkFilter === "all" ? ` · ${m.network}` : ""}` : m.competitor_id, value: v, color: c?.brand_color ?? "#94a3b8", isClient: !!c?.is_client };
                })
                .filter((r) => Number.isFinite(r.value) && r.value !== 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, 20);
              if (!data.length) return <p className="text-sm text-muted-foreground italic">Sin datos.</p>;
              return (
                <ResponsiveContainer width="100%" height={Math.max(220, data.length * 26)}>
                  <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" fontSize={10} tickFormatter={(v) => (v * 100).toFixed(1) + "%"} />
                    <YAxis type="category" dataKey="brand" fontSize={11} width={170} />
                    <Tooltip formatter={(v: number) => (v * 100).toFixed(2) + "%"} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {data.map((r, i) => <Cell key={i} fill={r.color} fillOpacity={r.isClient ? 1 : 0.5} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </Card>
          </>
          )}
        </TabsContent>

        {/* TAB: CLIENT */}
        {!byDependencia && (
        <TabsContent value="cliente" className="space-y-4 mt-4">
          <div className="grid gap-3 md:grid-cols-3">
            {METRICS.slice(0, 6).map((M) => {
              const currRaw = clientEvolution.length ? clientEvolution[clientEvolution.length - 1][M.key as string] as number | null : null;
              const prev = clientEvolution.length > 1 ? clientEvolution[clientEvolution.length - 2][M.key as string] as number | null : null;
              const fallback = currRaw == null ? latestValueFor(M.key as string) : null;
              const curr = currRaw ?? fallback?.value ?? null;
              const delta = currRaw != null && prev != null && prev !== 0 ? (currRaw - prev) / Math.abs(prev) : null;
              return (
                <Card key={M.key as string} className="p-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{M.label}</p>
                  <div className="flex items-baseline justify-between mt-1">
                    <p className="text-xl font-display font-bold tabular-nums">{curr != null ? M.fmt(curr) : "—"}</p>
                    <span className={`text-xs font-medium flex items-center gap-0.5 ${deltaColor(delta)}`}>
                      <DeltaIcon v={delta} />{fmtPct(delta)}
                    </span>
                  </div>
                  {fallback && !fallback.isLatest && (
                    <p className="text-[10px] text-muted-foreground mt-1 italic">Último dato disponible: {fallback.label}</p>
                  )}
                  {curr == null && (
                    <p className="text-[10px] text-muted-foreground mt-1 italic">Sin datos reportados en ningún periodo.</p>
                  )}
                </Card>
              );
            })}
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Evolución de {clientName} — {currentMetric.label}</h4>
              <div className="ml-auto">
                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                  <SelectTrigger className="w-[220px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{METRICS.map((m) => <SelectItem key={m.key as string} value={m.key as string}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {clientEvolution.length < 2 ? (
              <p className="text-sm text-muted-foreground italic">Necesitas 2+ periodos cargados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={clientEvolution}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="period" fontSize={10} />
                  <YAxis fontSize={10} tickFormatter={(v) => v > 999 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                  <Tooltip formatter={(v: number) => currentMetric.fmt(v)} />
                  <Line type="monotone" dataKey={selectedMetric} stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Crecimiento diario de seguidores — {effectiveRange?.label ?? currentPeriod?.period_label}</h4>
            </div>
            {dailyEvolution.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No hay datos diarios para este periodo.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="day" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {brandsList.filter((b) => b.isClient).map((b) => (
                    <Line key={b.key} type="monotone" dataKey={b.key} stroke={b.color} strokeWidth={3} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>
        )}

        {/* TAB: COMPETIDORES */}
        <TabsContent value="competidores" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Métrica</span>
            <Select value={selectedMetric} onValueChange={setSelectedMetric}>
              <SelectTrigger className="w-[240px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{METRICS.map((m) => <SelectItem key={m.key as string} value={m.key as string}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Ranking — {currentMetric.label}{scopeSuffix}</h4>
                <span className="text-[10px] text-muted-foreground ml-auto">Top {topRanking.length} de {rankingData.length}</span>
              </div>
              {rankingData.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, topRanking.length * 28)}>
                  <BarChart data={topRanking} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" fontSize={10} tickFormatter={(v) => v > 999 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                    <YAxis type="category" dataKey="brand" fontSize={10} width={200} />
                    <Tooltip formatter={(v: number) => currentMetric.fmt(v)} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {topRanking.map((r, i) => <Cell key={i} fill={r.color} fillOpacity={r.isClient ? 1 : 0.75} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <PieIcon className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">{byDependencia ? `Share del gabinete${scopeSuffix}` : "Share del sector"}</h4>
              </div>
              {rankingData.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={shareData} dataKey="value" nameKey="brand" cx="50%" cy="45%" innerRadius={55} outerRadius={95} paddingAngle={2}>
                      {shareData.map((r, i) => <Cell key={i} fill={r.color} fillOpacity={r.isClient ? 1 : 0.75} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, _n, p: any) => [`${currentMetric.fmt(v)} (${((v / shareTotal) * 100).toFixed(1)}%)`, String(p.payload.brand)]} />
                    <Legend wrapperStyle={{ fontSize: 10, maxHeight: 90, overflowY: "auto" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Evolución por periodo — {currentMetric.label}{scopeSuffix}</h4>
            </div>
            {evolutionData.length < 2 ? (
              <p className="text-sm text-muted-foreground italic">Necesitas 2+ periodos cargados.</p>
            ) : (
              (() => {
                const topKeys = new Set(topRanking.slice(0, 8).map((r) => r.brand));
                const lines = brandsList.filter((b) => b.isClient || topKeys.has(b.key));
                return (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="period" fontSize={10} />
                  <YAxis fontSize={10} tickFormatter={(v) => v > 999 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                  <Tooltip formatter={(v: number) => currentMetric.fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 10, maxHeight: 60, overflowY: "auto" }} />
                  {lines.map((b) => (
                    <Line key={b.key} type="monotone" dataKey={b.key} stroke={b.color}
                      strokeWidth={b.isClient ? 3 : 1.5} strokeOpacity={b.isClient ? 1 : 0.65}
                      dot={{ r: b.isClient ? 4 : 2 }} activeDot={{ r: b.isClient ? 6 : 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
                );
              })()
            )}
          </Card>
        </TabsContent>

        {/* TAB: CONTENIDO */}
        <TabsContent value="contenido" className="space-y-4 mt-4">
          <BenchmarkNarratives
            clientId={clientId}
            clientName={clientName}
            range={effectiveRange}
            networkFilter={networkFilter}
            scopeNote={byDependencia ? "cubre todas las cuentas cargadas (institucionales y titulares); no se ajusta al filtro de Cuentas" : undefined}
          />
          {/* Deeper insights row */}
          <div className="grid gap-3 md:grid-cols-4">
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Interacciones prom. / post</p>
              <p className="text-2xl font-display font-bold tabular-nums mt-1">{Math.round(contentInsights.clientAvg).toLocaleString("es-MX")}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {byDependencia ? `${contentInsights.clientPostCount} publicaciones analizadas${scopeSuffix}` : <>Sector: <span className="font-medium text-foreground">{Math.round(contentInsights.sectorAvg).toLocaleString("es-MX")}</span></>}
                {!byDependencia && contentInsights.sectorAvg > 0 && (
                  <span className={cn("ml-1", contentInsights.clientAvg >= contentInsights.sectorAvg ? "text-emerald-500" : "text-rose-500")}>
                    ({fmtPct((contentInsights.clientAvg - contentInsights.sectorAvg) / contentInsights.sectorAvg)})
                  </span>
                )}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Mediana / post{scopeSuffix}</p>
              <p className="text-2xl font-display font-bold tabular-nums mt-1">{Math.round(contentInsights.clientMedian).toLocaleString("es-MX")}</p>
              {!byDependencia && <p className="text-[10px] text-muted-foreground mt-1">Sector: <span className="font-medium text-foreground">{Math.round(contentInsights.sectorMedian).toLocaleString("es-MX")}</span></p>}
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Mejor día {byDependencia ? `del gabinete${scopeSuffix}` : clientName}</p>
              <p className="text-2xl font-display font-bold mt-1">{contentInsights.bestDay ? contentInsights.bestDay.day : "—"}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{contentInsights.bestDay ? `${Math.round(contentInsights.bestDay.avg).toLocaleString("es-MX")} interacc. prom.` : "Sin posts en el rango"}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{byDependencia ? `Dependencia líder${scopeSuffix}` : "Líder del sector"}</p>
              <p className="text-lg font-display font-bold mt-1 truncate">{contentInsights.leader?.name ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{contentInsights.leader ? `${contentInsights.leader.total.toLocaleString("es-MX")} interacc. totales` : "Sin datos"}</p>
            </Card>
          </div>

          {contentInsights.topKeywords.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">{byDependencia ? `Palabras clave del gabinete${scopeSuffix}` : "Palabras clave que usa el sector"}</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {byDependencia
                  ? `Términos más frecuentes en las publicaciones top del universo visible${scopeSuffix ? ` — cuentas ${accountFilter === "titular" ? "de titulares" : "institucionales"}` : " — cuentas institucionales y de titulares"}.`
                  : "Términos más frecuentes en los posts top de los competidores. Úsalo para inspirar temas propios."}
              </p>
              <div className="flex flex-wrap gap-2">
                {contentInsights.topKeywords.map(([w, n]) => (
                  <Badge key={w} variant="secondary" className="text-xs">
                    {w} <span className="ml-1 text-muted-foreground">×{n}</span>
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          <div className={cn("grid gap-4", (!byDependencia || accountFilter === "ambos") && "lg:grid-cols-2")}>
            {byDependencia ? (accountFilter !== "titular" && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-sm">Mejor publicación por dependencia</h4>
                <Badge variant="secondary" className="ml-auto">{bestPerDependencia.length} dependencias · institucional</Badge>
              </div>
              {bestPerDependencia.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sin publicaciones en este {rangeMode === "custom" ? "rango" : "periodo"}{networkFilter !== "all" ? ` para ${networkFilter}` : ""}.</p>
              ) : (
                <ul className="space-y-3 max-h-[500px] overflow-auto pr-1">
                  {bestPerDependencia.map((p) => {
                    const c = p.competitor_id ? compMap.get(p.competitor_id) : null;
                    return (
                      <li key={p.id} className="p-3 rounded-lg border border-border/40 bg-background/40">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 gap-2">
                          <span className="inline-flex items-center gap-1 truncate">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c?.brand_color ?? "#94a3b8" }} />
                            {c?.name ?? p.profile_name} · {p.network}
                            {p.profile_name && c?.name && p.profile_name !== c.name && (
                              <span className="opacity-70">· @{p.profile_name}</span>
                            )}
                          </span>
                          <span className="tabular-nums font-medium text-foreground shrink-0">{p.interactions?.toLocaleString("es-MX") ?? 0}</span>
                        </div>
                        <p className="text-xs line-clamp-3">{p.message ?? "—"}</p>
                        {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline mt-1 inline-block">Ver publicación ↗</a>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            )) : (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-sm">Top propios — {clientName}</h4>
                <Badge variant="secondary" className="ml-auto">{clientPostsPeriod.length}</Badge>
              </div>
              {clientPostsPeriod.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Sin publicaciones de {clientName} en este {rangeMode === "custom" ? "rango" : "periodo"}
                  {networkFilter !== "all" ? ` para ${networkFilter}` : ""}.
                </p>
              ) : (
                <ul className="space-y-3 max-h-[500px] overflow-auto pr-1">
                  {clientPostsPeriod.slice(0, 10).map((p) => (
                    <li key={p.id} className="p-3 rounded-lg border border-border/40 bg-background/40">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{p.network} · {p.posted_at ? new Date(p.posted_at).toLocaleDateString("es-MX") : "—"}</span>
                        <span className="tabular-nums font-medium text-foreground">{p.interactions?.toLocaleString("es-MX") ?? 0} interacc.</span>
                      </div>
                      <p className="text-xs line-clamp-3">{p.message ?? "—"}</p>
                      {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline mt-1 inline-block">Ver publicación ↗</a>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            )}

            {(!byDependencia || accountFilter !== "institucional") && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Newspaper className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">{byDependencia ? "Top de titulares del gabinete" : "Top del sector"}</h4>
                <Badge variant="secondary" className="ml-auto">Top {Math.min(10, topPeerPosts.length)} de {topPeerPosts.length}{byDependencia ? " · titular" : ""}</Badge>
              </div>
              {topPeerPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sin publicaciones cargadas.</p>
              ) : (
                <ul className="space-y-3 max-h-[500px] overflow-auto pr-1">
                  {topPeerPosts.slice(0, 10).map((p) => {
                    const c = p.competitor_id ? compMap.get(p.competitor_id) : null;
                    return (
                      <li key={p.id} className="p-3 rounded-lg border border-border/40 bg-background/40">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c?.brand_color ?? "#94a3b8" }} />
                            {p.profile_name} · {p.network}
                            {byDependencia && c?.name && <span className="opacity-70">· {c.name}</span>}
                          </span>
                          <span className="tabular-nums font-medium text-foreground">{p.interactions?.toLocaleString("es-MX") ?? 0}</span>
                        </div>
                        <p className="text-xs line-clamp-3">{p.message ?? "—"}</p>
                        {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline mt-1 inline-block">Ver ↗</a>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            )}
          </div>
        </TabsContent>

        {/* TAB: DATOS */}
        <TabsContent value="datos" className="space-y-4 mt-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TableIcon className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Tabla detallada — {effectiveRange?.label ?? currentPeriod?.period_label}{scopeSuffix}</h4>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {networkFilter === "all" ? "todas las redes" : networkFilter} · {periodMetrics.length} filas visibles
              </span>
            </div>
            <div className="overflow-auto max-h-[500px] border border-border/40 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-background/60 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Perfil</th>
                    <th className="text-left p-2">Red</th>
                    <th className="text-right p-2">Seguidores</th>
                    <th className="text-right p-2">Crec.%/día</th>
                    <th className="text-right p-2">Engagement</th>
                    <th className="text-right p-2">Posts/día</th>
                    <th className="text-right p-2">Alcance/día</th>
                    <th className="text-right p-2">Índice</th>
                  </tr>
                </thead>
                <tbody>
                  {periodMetrics
                    .slice()
                    .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))
                    .map((m) => {
                      const c = compMap.get(m.competitor_id);
                      return (
                        <tr key={m.id} className={`border-t border-border/30 ${c?.is_client ? "bg-primary/5 font-medium" : ""}`}>
                          <td className="p-2">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ background: c?.brand_color ?? "#94a3b8" }} />
                              {c?.name ?? "?"}
                            </span>
                          </td>
                          <td className="p-2">{m.network}</td>
                          <td className="p-2 text-right tabular-nums">{m.followers?.toLocaleString("es-MX") ?? "—"}</td>
                          <td className="p-2 text-right tabular-nums">{m.follower_growth_rate != null ? (m.follower_growth_rate * 100).toFixed(3) + "%" : "—"}</td>
                          <td className="p-2 text-right tabular-nums">{m.engagement_rate != null ? (m.engagement_rate * 100).toFixed(2) + "%" : "—"}</td>
                          <td className="p-2 text-right tabular-nums">{m.posts_per_day != null ? m.posts_per_day.toFixed(2) : "—"}</td>
                          <td className="p-2 text-right tabular-nums">{m.reach_per_day != null ? m.reach_per_day.toFixed(0) : "—"}</td>
                          <td className="p-2 text-right tabular-nums">{m.performance_index != null ? m.performance_index.toFixed(2) : "—"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Newspaper className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Top 20 publicaciones (todo el sector)</h4>
            </div>
            {topPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sin publicaciones cargadas.</p>
            ) : (
              <div className="overflow-auto max-h-[500px] border border-border/40 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-background/60 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Perfil</th>
                      <th className="text-left p-2">Red</th>
                      <th className="text-left p-2">Fecha</th>
                      <th className="text-left p-2">Mensaje</th>
                      <th className="text-right p-2">Interacc.</th>
                      <th className="text-right p-2">Eng.%</th>
                      <th className="p-2">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPosts.map((p) => {
                      const c = p.competitor_id ? compMap.get(p.competitor_id) : null;
                      return (
                        <tr key={p.id} className={`border-t border-border/30 ${c?.is_client ? "bg-primary/5 font-medium" : ""}`}>
                          <td className="p-2">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ background: c?.brand_color ?? "#94a3b8" }} />
                              {p.profile_name}
                            </span>
                          </td>
                          <td className="p-2">{p.network}</td>
                          <td className="p-2 text-muted-foreground">{p.posted_at ? new Date(p.posted_at).toLocaleDateString("es-MX") : "—"}</td>
                          <td className="p-2 max-w-xs truncate" title={p.message ?? ""}>{p.message ?? "—"}</td>
                          <td className="p-2 text-right tabular-nums">{p.interactions?.toLocaleString("es-MX") ?? "—"}</td>
                          <td className="p-2 text-right tabular-nums">{p.engagement_rate != null ? (p.engagement_rate * 100).toFixed(2) + "%" : "—"}</td>
                          <td className="p-2">{p.link ? <a href={p.link} target="_blank" rel="noreferrer" className="text-primary hover:underline">↗</a> : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
