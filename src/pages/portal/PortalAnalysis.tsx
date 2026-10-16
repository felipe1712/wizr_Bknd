import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, CartesianGrid,
  PolarAngleAxis, RadialBarChart, RadialBar, ReferenceDot,
} from "recharts";
import { Sparkles, Quote, AlertOctagon, Radio, Grid3x3, Gauge, TrendingUp, Flag, Newspaper, AtSign, ExternalLink, Search, Download, X } from "lucide-react";
import { Lightbulb } from "lucide-react";

type Entry = {
  entry_date: string;
  sentiment: string | null;
  sentiment_score: number | null;
  urgency: string | null;
  topics: string[] | null;
  mentions: any[] | null;
  summary: string | null;
  analyzed_at: string | null;
  channels: any[] | null;
  entities: any[] | null;
  events: any[] | null;
  key_quotes: any[] | null;
  competitors: any[] | null;
  total_mentions?: number | null;
  sentiment_counts?: any | null;
  media_mentions?: any[] | null;
  social_mentions?: any[] | null;
  scope_counts?: any | null;
  national_context?: any[] | null;
};

const SENT_COLORS: Record<string, string> = {
  positivo: "#10b981",
  neutral: "#94a3b8",
  negativo: "#ef4444",
  crisis: "#991b1b",
};

// Brand-inspired colors per platform (lower-cased key)
const PLATFORM_COLORS: Record<string, string> = {
  "medios digitales": "#3b82f6",
  "x": "#0f172a",
  "linkedin": "#0a66c2",
  "facebook": "#1877f2",
  "instagram": "#e1306c",
  "youtube": "#ff0000",
  "tiktok": "#111111",
  "reddit": "#ff4500",
};
const CHANNEL_FALLBACK = ["#ef6a4d", "#0ea5e9", "#a855f7", "#10b981", "#f59e0b", "#ec4899", "#14b8a6", "#8b5cf6"];
function platformColor(name: string, i = 0) {
  return PLATFORM_COLORS[name.toLowerCase().trim()] ?? CHANNEL_FALLBACK[i % CHANNEL_FALLBACK.length];
}

// Normaliza cualquier nombre heredado a la taxonomía canónica (8 categorías)
function canonicalChannel(raw: string): string {
  const s = (raw || "").toLowerCase().trim();
  if (!s) return "medios digitales";
  if (s === "x" || s.includes("twitter")) return "x";
  if (s.startsWith("facebook") || s === "fb") return "facebook";
  if (s.startsWith("instagram") || s === "ig") return "instagram";
  if (s.startsWith("youtube") || s === "yt") return "youtube";
  if (s.startsWith("tiktok")) return "tiktok";
  if (s.startsWith("reddit")) return "reddit";
  if (s.startsWith("linkedin")) return "linkedin";
  return "medios digitales"; // prensa, radio, tv, blog, podcast, telegram, otro, medios...
}

const DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HEAT_COLOR: Record<string, [number, number, number]> = {
  positivo: [16, 185, 129],
  neutral:  [148, 163, 184],
  negativo: [239, 68, 68],
  crisis:   [153, 27, 27],
};

export default function PortalAnalysis({ clientId, fromDate, toDate, mode = "social" }: { clientId: string; fromDate: string; toDate: string; mode?: "press" | "social"; }) {
  const isPress = mode === "press";
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendPeriods, setTrendPeriods] = useState<{ label: string; total: number; delta: number | null }[]>([]);
  // Buscador de menciones
  const [searchQ, setSearchQ] = useState("");
  const [searchPlatform, setSearchPlatform] = useState<string>("todas");
  const [searchSent, setSearchSent] = useState<string>("todos");
  const [searchLimit, setSearchLimit] = useState<number>(50);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const e = await supabase.from("client_portal_listening_entries")
        .select("entry_date, sentiment, sentiment_score, urgency, topics, mentions, summary, analyzed_at, channels, entities, events, key_quotes, competitors, total_mentions, sentiment_counts, media_mentions, social_mentions, scope_counts, national_context")
        .eq("client_id", clientId)
        .gte("entry_date", fromDate).lte("entry_date", toDate)
        .not("analyzed_at", "is", null)
        .order("entry_date", { ascending: true }).limit(500);
      setEntries((e.data ?? []) as Entry[]);
      setLoading(false);
    })();
  }, [clientId, fromDate, toDate]);

  // Tendencia comparativa: 4 periodos con misma longitud que el rango actual
  useEffect(() => {
    (async () => {
      const from = new Date(fromDate + "T00:00:00");
      const to = new Date(toDate + "T00:00:00");
      const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      if (!days || days < 1) return;
      const periods: { start: Date; end: Date }[] = [];
      for (let i = 3; i >= 0; i--) {
        const end = new Date(from); end.setDate(end.getDate() - 1 - i * days + days);
        const start = new Date(end); start.setDate(start.getDate() - days + 1);
        if (i === 0) { periods.push({ start: from, end: to }); }
        else periods.push({ start, end });
      }
      const results = await Promise.all(periods.map(async (p) => {
        const s = p.start.toISOString().slice(0, 10);
        const e = p.end.toISOString().slice(0, 10);
        const { data } = await supabase.from("client_portal_listening_entries")
          .select("total_mentions")
          .eq("client_id", clientId)
          .gte("entry_date", s).lte("entry_date", e)
          .not("analyzed_at", "is", null);
        const total = ((data ?? []) as any[]).reduce((acc, r) => acc + (Number(r.total_mentions ?? 0) || 0), 0);
        const label = p.start.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
        return { label, total };
      }));
      const withDelta = results.map((r, i) => ({
        ...r,
        delta: i === 0 ? null : (results[i - 1].total ? Math.round(((r.total - results[i - 1].total) / results[i - 1].total) * 100) : null),
      }));
      setTrendPeriods(withDelta);
    })();
  }, [clientId, fromDate, toDate]);

  // Ámbito: separa lo que sí toca al cliente de la agenda nacional / de otras entidades
  const scopeSummary = useMemo(() => {
    const counts = { local: 0, nacional_impacto: 0, nacional_contexto: 0, otra_entidad: 0 };
    const context: { date: string; title: string; detail?: string; why?: string; scope: string }[] = [];
    for (const e of entries) {
      const sc = (e.scope_counts ?? {}) as Record<string, any>;
      for (const k of Object.keys(counts) as (keyof typeof counts)[]) counts[k] += Number(sc[k] ?? 0) || 0;
      for (const n of (e.national_context ?? [])) {
        if (!n?.title) continue;
        context.push({ date: e.entry_date, title: n.title, detail: n.detail, why: n.why_excluded, scope: n.scope ?? "nacional_contexto" });
      }
    }
    const relevant = counts.local + counts.nacional_impacto;
    const excluded = counts.nacional_contexto + counts.otra_entidad;
    return { counts, context: context.slice(0, 12), relevant, excluded, hasData: relevant + excluded > 0 };
  }, [entries]);

  const volumeByDay = useMemo(() => {
    const map = new Map<string, { date: string; total: number; positivo: number; neutral: number; negativo: number; crisis: number }>();
    for (const e of entries) {
      const row = map.get(e.entry_date) ?? { date: e.entry_date, total: 0, positivo: 0, neutral: 0, negativo: 0, crisis: 0 };
      const sc = e.sentiment_counts ?? {};
      const hasCounts = sc && (sc.positivo || sc.neutral || sc.negativo || sc.crisis);
      if (hasCounts) {
        row.positivo += Number(sc.positivo ?? 0) || 0;
        row.neutral += Number(sc.neutral ?? 0) || 0;
        row.negativo += Number(sc.negativo ?? 0) || 0;
        row.crisis += Number(sc.crisis ?? 0) || 0;
        row.total += Number(sc.positivo ?? 0) + Number(sc.neutral ?? 0) + Number(sc.negativo ?? 0) + Number(sc.crisis ?? 0);
      } else {
        const weight = Number(e.total_mentions ?? 0) || 1;
        row.total += weight;
        const s = (e.sentiment ?? "neutral") as keyof typeof SENT_COLORS;
        (row as any)[s] = ((row as any)[s] ?? 0) + weight;
      }
      map.set(e.entry_date, row);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [entries]);

  const sentimentBreakdown = useMemo(() => {
    const c: Record<string, number> = { positivo: 0, neutral: 0, negativo: 0, crisis: 0 };
    for (const e of entries) {
      const sc = e.sentiment_counts ?? {};
      const hasCounts = sc && (sc.positivo || sc.neutral || sc.negativo || sc.crisis);
      if (hasCounts) {
        c.positivo += Number(sc.positivo ?? 0) || 0;
        c.neutral += Number(sc.neutral ?? 0) || 0;
        c.negativo += Number(sc.negativo ?? 0) || 0;
        c.crisis += Number(sc.crisis ?? 0) || 0;
      } else {
        const s = e.sentiment ?? "neutral";
        c[s] = (c[s] ?? 0) + (Number(e.total_mentions ?? 0) || 1);
      }
    }
    return Object.entries(c).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [entries]);

  const topTopics = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of entries) for (const t of (e.topics ?? [])) c.set(t, (c.get(t) ?? 0) + 1);
    return Array.from(c.entries()).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [entries]);

  const topMentions = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of entries) for (const m of (e.mentions ?? [])) {
      const name = typeof m === "string" ? m : m?.name; if (!name) continue;
      c.set(name, (c.get(name) ?? 0) + 1);
    }
    return Array.from(c.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [entries]);

  const channelsBreakdown = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of entries) for (const ch of (e.channels ?? [])) {
      const raw = typeof ch === "string" ? ch : ch?.name; if (!raw) continue;
      const name = canonicalChannel(raw);
      const n = typeof ch?.count === "number" ? ch.count : 1;
      c.set(name, (c.get(name) ?? 0) + n);
    }
    return Array.from(c.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [entries]);

  const eventsTimeline = useMemo(() => {
    const items: { date: string; title: string; kind: string; impact: string; detail: string }[] = [];
    for (const e of entries) for (const ev of (e.events ?? [])) {
      items.push({
        date: e.entry_date,
        title: ev?.title ?? "",
        kind: ev?.kind ?? "otro",
        impact: ev?.impact ?? "medio",
        detail: ev?.detail ?? "",
      });
    }
    // Keep the full period for milestone selection. Slicing here hid early-period
    // events in longer ranges (quincena / mensual), so only the UI lists should cap.
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [entries]);

  // ---------- Nuevos agregados ----------

  // 1) Heatmap día-de-semana × sentimiento
  const heatmap = useMemo(() => {
    const grid: Record<string, Record<string, number>> = {};
    for (const s of Object.keys(HEAT_COLOR)) grid[s] = Object.fromEntries(DOW_LABELS.map(d => [d, 0]));
    for (const e of entries) {
      const dow = DOW_LABELS[new Date(e.entry_date + "T00:00:00").getDay()];
      const sc = e.sentiment_counts ?? {};
      const hasCounts = sc && (sc.positivo || sc.neutral || sc.negativo || sc.crisis);
      if (hasCounts) {
        for (const k of Object.keys(HEAT_COLOR)) grid[k][dow] += Number(sc[k] ?? 0) || 0;
      } else if (e.sentiment) {
        grid[e.sentiment as string] = grid[e.sentiment as string] ?? {};
        grid[e.sentiment as string][dow] = (grid[e.sentiment as string][dow] ?? 0) + (Number(e.total_mentions ?? 0) || 1);
      }
    }
    const max = Math.max(1, ...Object.values(grid).flatMap(r => Object.values(r)));
    return { grid, max };
  }, [entries]);

  // Salud reputacional (0-100)
  const reputationScore = useMemo(() => {
    let sum = 0, n = 0;
    for (const e of entries) {
      if (typeof e.sentiment_score === "number") { sum += e.sentiment_score; n++; }
    }
    const avg = n ? sum / n : 0;
    const crisisEvents = entries.reduce((acc, e) => acc + (e.events ?? []).filter((ev: any) => ev?.impact === "alto" || ev?.kind === "crisis").length, 0);
    const raw = 50 + 50 * avg - Math.min(30, crisisEvents * 6);
    const score = Math.max(0, Math.min(100, Math.round(raw)));
    const label = score >= 75 ? "Saludable" : score >= 55 ? "Estable" : score >= 40 ? "En riesgo" : "Crítico";
    const color = score >= 75 ? "#10b981" : score >= 55 ? "#0ea5e9" : score >= 40 ? "#f59e0b" : "#ef4444";
    return { score, label, color, avg: +avg.toFixed(2), crisisEvents };
  }, [entries]);

  // Serie diaria: % positivo / neutral / negativo por día (para "Tonalidad y narrativas")
  const sentimentDaily = useMemo(() => {
    return volumeByDay.map(d => {
      const t = d.positivo + d.neutral + d.negativo + d.crisis || 1;
      return {
        date: d.date.slice(5),
        Positivo: Math.round((d.positivo / t) * 100),
        Neutral: Math.round((d.neutral / t) * 100),
        Negativo: Math.round(((d.negativo + d.crisis) / t) * 100),
      };
    });
  }, [volumeByDay]);

  // KPIs slide 1
  const totals = useMemo(() => {
    const total = volumeByDay.reduce((a, d) => a + d.positivo + d.neutral + d.negativo + d.crisis, 0);
    const peak = volumeByDay.reduce((p, d) => {
      const s = d.positivo + d.neutral + d.negativo + d.crisis;
      return s > p.value ? { date: d.date, value: s } : p;
    }, { date: "", value: 0 });
    const pos = volumeByDay.reduce((a, d) => a + d.positivo, 0);
    const neg = volumeByDay.reduce((a, d) => a + d.negativo + d.crisis, 0);
    const neu = volumeByDay.reduce((a, d) => a + d.neutral, 0);
    const posPct = total ? Math.round((pos / total) * 100) : 0;
    const negPct = total ? Math.round((neg / total) * 100) : 0;
    const neuPct = total ? Math.round((neu / total) * 100) : 0;
    return { total, peak, posPct, negPct, neuPct };
  }, [volumeByDay]);

  // Plataformas: totales + % + color de marca
  const platforms = useMemo(() => {
    const total = channelsBreakdown.reduce((a, c) => a + c.value, 0) || 1;
    return channelsBreakdown.map((c, i) => ({
      name: c.name,
      value: c.value,
      pct: +((c.value / total) * 100).toFixed(1),
      color: platformColor(c.name, i),
    }));
  }, [channelsBreakdown]);

  // Narrativas dominantes (top topics con % de días en los que aparecen)
  const narratives = useMemo(() => {
    const totalDays = new Set(entries.map(e => e.entry_date)).size || 1;
    const perTopic = new Map<string, Set<string>>();
    for (const e of entries) for (const t of (e.topics ?? [])) {
      if (!perTopic.has(t)) perTopic.set(t, new Set());
      perTopic.get(t)!.add(e.entry_date);
    }
    return Array.from(perTopic.entries())
      .map(([topic, days], i) => ({
        topic,
        pct: Math.round((days.size / totalDays) * 100),
        days: days.size,
        color: CHANNEL_FALLBACK[i % CHANNEL_FALLBACK.length],
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [entries]);

  // ---------- "Quién dijo qué": agregados por medio y por perfil social ----------

  const mediaCoverage = useMemo(() => {
    type Item = {
      outlet: string;
      type: string;
      count: number;
      pos: number;
      neg: number;
      neu: number;
      topics: Set<string>;
      links: { url: string; headline: string | null; date: string; sentiment: string; topic: string; quote: string | null }[];
    };
    const byOutlet = new Map<string, Item>();
    for (const e of entries) {
      for (const m of (e.media_mentions ?? [])) {
        const outlet = String(m?.outlet ?? "").trim();
        if (!outlet) continue;
        const key = outlet.toLowerCase();
        const row = byOutlet.get(key) ?? {
          outlet, type: String(m?.type ?? "portal"),
          count: 0, pos: 0, neg: 0, neu: 0,
          topics: new Set<string>(), links: [],
        };
        row.count++;
        const s = String(m?.sentiment ?? "neutral");
        if (s === "positivo") row.pos++;
        else if (s === "negativo" || s === "crisis") row.neg++;
        else row.neu++;
        const topic = String(m?.topic ?? "").trim();
        if (topic) row.topics.add(topic);
        row.links.push({
          url: String(m?.url ?? "") || "",
          headline: m?.headline ?? null,
          date: e.entry_date,
          sentiment: s,
          topic,
          quote: m?.quote ?? null,
        });
        byOutlet.set(key, row);
      }
    }
    return Array.from(byOutlet.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map(r => ({ ...r, topics: Array.from(r.topics).slice(0, 4) }));
  }, [entries]);

  const socialVoices = useMemo(() => {
    type Item = {
      profile: string;
      handle: string | null;
      platform: string;
      count: number;
      pos: number;
      neg: number;
      neu: number;
      topics: Set<string>;
      posts: { url: string; date: string; sentiment: string; topic: string; quote: string | null }[];
    };
    const byKey = new Map<string, Item>();
    for (const e of entries) {
      for (const p of (e.social_mentions ?? [])) {
        const profile = String(p?.profile ?? "").trim();
        const handle = p?.handle ? String(p.handle).trim() : null;
        const platform = canonicalChannel(String(p?.platform ?? ""));
        if (!profile && !handle) continue;
        if (platform === "medios digitales") continue; // solo redes sociales
        const key = `${platform}::${(handle || profile).toLowerCase()}`;
        const row = byKey.get(key) ?? {
          profile: profile || handle || "",
          handle, platform,
          count: 0, pos: 0, neg: 0, neu: 0,
          topics: new Set<string>(), posts: [],
        };
        row.count++;
        const s = String(p?.sentiment ?? "neutral");
        if (s === "positivo") row.pos++;
        else if (s === "negativo" || s === "crisis") row.neg++;
        else row.neu++;
        const topic = String(p?.topic ?? "").trim();
        if (topic) row.topics.add(topic);
        row.posts.push({
          url: String(p?.url ?? "") || "",
          date: e.entry_date,
          sentiment: s,
          topic,
          quote: p?.quote ?? null,
        });
        byKey.set(key, row);
      }
    }
    // agrupa además por plataforma
    const list = Array.from(byKey.values()).sort((a, b) => b.count - a.count);
    const byPlatform = new Map<string, typeof list>();
    for (const v of list) {
      const arr = byPlatform.get(v.platform) ?? [];
      arr.push(v);
      byPlatform.set(v.platform, arr);
    }
    return {
      flat: list.slice(0, 30).map(v => ({ ...v, topics: Array.from(v.topics).slice(0, 3) })),
      byPlatform: Array.from(byPlatform.entries())
        .map(([platform, voices]) => ({
          platform,
          total: voices.reduce((a, v) => a + v.count, 0),
          voices: voices.slice(0, 8).map(v => ({ ...v, topics: Array.from(v.topics).slice(0, 3) })),
        }))
        .sort((a, b) => b.total - a.total),
    };
  }, [entries]);

  // ---------- Índice de menciones para buscador ----------
  type MentionRow = {
    kind: "media" | "social";
    date: string;
    who: string;         // outlet o profile
    handle: string | null;
    platform: string;    // canonical (medios digitales / x / facebook / ...)
    type: string;        // media type (portal/radio/tv/prensa/...) o platform
    topic: string;
    headline: string | null;
    quote: string | null;
    url: string;
    sentiment: string;
    haystack: string;
  };
  const mentionIndex = useMemo<MentionRow[]>(() => {
    const rows: MentionRow[] = [];
    for (const e of entries) {
      for (const m of (e.media_mentions ?? [])) {
        const outlet = String(m?.outlet ?? "").trim();
        if (!outlet) continue;
        const row: MentionRow = {
          kind: "media",
          date: e.entry_date,
          who: outlet,
          handle: null,
          platform: "medios digitales",
          type: String(m?.type ?? "portal"),
          topic: String(m?.topic ?? ""),
          headline: m?.headline ?? null,
          quote: m?.quote ?? null,
          url: String(m?.url ?? ""),
          sentiment: String(m?.sentiment ?? "neutral"),
          haystack: "",
        };
        row.haystack = [row.who, row.topic, row.headline, row.quote, row.type, row.url]
          .filter(Boolean).join(" ").toLowerCase();
        rows.push(row);
      }
      for (const p of (e.social_mentions ?? [])) {
        const profile = String(p?.profile ?? "").trim();
        const handle = p?.handle ? String(p.handle).trim() : null;
        if (!profile && !handle) continue;
        const platform = canonicalChannel(String(p?.platform ?? ""));
        const row: MentionRow = {
          kind: "social",
          date: e.entry_date,
          who: profile || handle || "",
          handle,
          platform,
          type: platform,
          topic: String(p?.topic ?? ""),
          headline: null,
          quote: p?.quote ?? null,
          url: String(p?.url ?? ""),
          sentiment: String(p?.sentiment ?? "neutral"),
          haystack: "",
        };
        row.haystack = [row.who, row.handle, row.topic, row.quote, row.platform, row.url]
          .filter(Boolean).join(" ").toLowerCase();
        rows.push(row);
      }
    }
    return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [entries]);

  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];
    return mentionIndex.filter(r => {
      if (searchPlatform !== "todas" && r.platform !== searchPlatform) return false;
      if (searchSent !== "todos") {
        if (searchSent === "negativo") { if (r.sentiment !== "negativo" && r.sentiment !== "crisis") return false; }
        else if (r.sentiment !== searchSent) return false;
      }
      if (terms.length && !terms.every(t => r.haystack.includes(t))) return false;
      return true;
    });
  }, [mentionIndex, searchQ, searchPlatform, searchSent]);

  const searchStats = useMemo(() => {
    const total = searchResults.length;
    const media = searchResults.filter(r => r.kind === "media").length;
    const social = total - media;
    return { total, media, social };
  }, [searchResults]);

  const exportSearchCsv = () => {
    const header = ["fecha","tipo","quien","handle","plataforma","tema","titular","cita","url","sentimiento"];
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [header.join(",")].concat(
      searchResults.map(r => [r.date, r.kind, r.who, r.handle ?? "", r.platform, r.topic, r.headline ?? "", r.quote ?? "", r.url, r.sentiment].map(esc).join(","))
    );
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `menciones_${fromDate}_${toDate}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // Hitos: selección estricta por pico de menciones + impacto del evento.
  // El número de hitos NO escala con la duración del período; se limita a los
  // días verdaderamente destacados. Si el análisis IA no trajo eventos para un
  // día pico, se crea un hito por volumen para no dejar vacío el corte mensual.
  const IMPACT_RANK: Record<string, number> = { crisis: 4, alto: 3, medio: 2, bajo: 1 };
  const milestones = useMemo(() => {
    // Menciones totales por día (base para detectar picos)
    const mentionsByDate = new Map<string, number>();
    for (const d of volumeByDay) {
      mentionsByDate.set(d.date, d.positivo + d.neutral + d.negativo + d.crisis);
    }
    const volumes = Array.from(mentionsByDate.values()).filter(v => v > 0);
    if (!volumes.length) return [] as { date: string; dateKey: string; title: string; detail: string; kind: string; impact: string; color: string }[];
    const maxVol = Math.max(1, ...volumes);
    const avgVol = volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
    // Umbral de "pico": por encima del promedio y con volumen relevante (>=40% del máximo)
    const peakThreshold = Math.max(avgVol * 1.15, maxVol * 0.4);

    // Mejor evento por fecha (ranking por impacto)
    const bestByDate = new Map<string, typeof eventsTimeline[number]>();
    for (const ev of eventsTimeline) {
      const cur = bestByDate.get(ev.date);
      const rNew = Math.max(IMPACT_RANK[ev.impact ?? ""] ?? 0, ev.kind === "crisis" ? IMPACT_RANK.crisis : 0);
      const rCur = cur ? Math.max(IMPACT_RANK[cur.impact ?? ""] ?? 0, cur.kind === "crisis" ? IMPACT_RANK.crisis : 0) : -1;
      if (rNew > rCur) bestByDate.set(ev.date, ev);
    }

    // Puntaje: volumen del día (dominante) + impacto del evento
    const candidates = Array.from(bestByDate.values()).map(ev => {
      const vol = mentionsByDate.get(ev.date) ?? 0;
      const impactScore = Math.max(IMPACT_RANK[ev.impact ?? ""] ?? 0, ev.kind === "crisis" ? IMPACT_RANK.crisis : 0);
      const score = (vol / maxVol) * 10 + impactScore; // volumen pesa más que impacto
      const isPeak = vol >= peakThreshold;
      const color = ev.kind === "crisis" || ev.impact === "alto" ? "#ef4444" : ev.impact === "medio" ? "#f59e0b" : "#0ea5e9";
      return { ...ev, vol, impactScore, score, isPeak, color };
    });

    // El día con el mayor volumen SIEMPRE es hito si tiene evento asociado.
    // Es incongruente que otros días marquen hito y el pico no.
    let peakDate: string | null = null;
    let peakVolume = 0;
    for (const [d, v] of mentionsByDate.entries()) {
      if (v > peakVolume) { peakVolume = v; peakDate = d; }
    }

    // En rangos largos, no basta con comparar todo contra el pico global: si el
    // 6-jul concentra 119 menciones, puede ocultar picos locales reales de la
    // primera semana. Reservamos el máximo de cada semana calendario.
    const coveragePeakDates = new Set<string>();
    const orderedVolumes = Array.from(mentionsByDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const weekSegments = new Map<string, [string, number][]>();
    for (const item of orderedVolumes) {
      const dt = new Date(item[0] + "T00:00:00");
      const monday = new Date(dt);
      monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const arr = weekSegments.get(key) ?? [];
      arr.push(item);
      weekSegments.set(key, arr);
    }
    for (const segment of weekSegments.values()) {
      const active = segment.filter(([, v]) => v > 0);
      if (!active.length) continue;
      const [localDate, localVol] = active.reduce((best, cur) => cur[1] > best[1] ? cur : best);
      if (localVol >= Math.max(1, avgVol * 0.55, maxVol * 0.25)) coveragePeakDates.add(localDate);
    }

    // Agregar días pico aunque no tengan evento explícito en la respuesta IA.
    // Esto hace que el corte mensual conserve hitos basados en datos duros.
    for (const [date, vol] of mentionsByDate.entries()) {
      if (candidates.some(c => c.date === date)) continue;
      const isPeak = date === peakDate || vol >= peakThreshold;
      const isCoveragePeak = coveragePeakDates.has(date);
      if (!isPeak && !isCoveragePeak) continue;
      const ratio = avgVol ? vol / avgVol : 1;
      const impact = date === peakDate || vol >= maxVol * 0.75 ? IMPACT_RANK.alto : IMPACT_RANK.medio;
      candidates.push({
        date,
        title: date === peakDate ? "Pico de conversación del período" : isCoveragePeak ? "Pico local de conversación" : "Día con conversación destacada",
        kind: "volumen",
        impact: impact >= IMPACT_RANK.alto ? "alto" : "medio",
        detail: `${vol.toLocaleString("es-MX")} menciones registradas${avgVol ? ` (${ratio.toFixed(1)}× el promedio diario)` : ""}.`,
        vol,
        impactScore: impact,
        score: (vol / maxVol) * 10 + impact + (isCoveragePeak ? 1 : 0),
        isPeak: isPeak || isCoveragePeak,
        color: impact >= IMPACT_RANK.alto ? "#ef4444" : "#f59e0b",
      });
    }

    for (const c of candidates) {
      if (!coveragePeakDates.has(c.date)) continue;
      c.isPeak = true;
      c.score += 1;
      if (c.title && !c.title.toLowerCase().includes("pico")) c.title = `${c.title}`;
    }

    const peakCandidate = peakDate ? candidates.find(c => c.date === peakDate) : undefined;
    const requiredDates = new Set([peakDate, ...coveragePeakDates].filter(Boolean) as string[]);

    // Filtrar a picos reales; si el evento es crisis/alto siempre entra
    const eligible = candidates.filter(c => c.isPeak || c.impactScore >= IMPACT_RANK.alto);
    const HARD_CAP = 6;
    const required = Array.from(requiredDates)
      .map(date => candidates.find(c => c.date === date))
      .filter(Boolean)
      .sort((a, b) => (b!.date === peakDate ? 1 : 0) - (a!.date === peakDate ? 1 : 0) || (b!.vol - a!.vol))
      .slice(0, HARD_CAP) as typeof candidates;
    let picked = [...required];
    for (const c of [...eligible].sort((a, b) => b.score - a.score)) {
      if (picked.length >= HARD_CAP) break;
      if (!picked.some(p => p.date === c.date)) picked.push(c);
    }
    // Fallback: si no hay picos, tomar los 3 días con mayor volumen que tengan evento
    if (picked.length === 0) {
      picked = [...candidates].sort((a, b) => b.score - a.score).slice(0, Math.min(3, candidates.length));
    }
    // Garantía: el pico absoluto del período SIEMPRE está incluido.
    if (peakCandidate && !picked.some(p => p.date === peakCandidate.date)) {
      // Insertar el pico y desalojar al de menor score para respetar el cap
      picked = [peakCandidate, ...picked].sort((a, b) => b.score - a.score).slice(0, HARD_CAP);
      if (!picked.some(p => p.date === peakCandidate.date)) {
        picked[picked.length - 1] = peakCandidate;
      }
    }

    return picked
      .sort((a, b) => {
        if (a.date === peakDate) return -1;
        if (b.date === peakDate) return 1;
        return b.score - a.score || a.date.localeCompare(b.date);
      })
      .map(m => ({ date: m.date, dateKey: m.date.slice(5), title: m.title, detail: m.detail, kind: m.kind, impact: m.impact, color: m.color }));
  }, [eventsTimeline, volumeByDay]);

  // y-value por fecha para cada gráfica temporal
  const yByDateLine = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of volumeByDay) m.set(d.date.slice(5), d.positivo + d.neutral + d.negativo + d.crisis);
    return m;
  }, [volumeByDay]);
  const yByDateBar = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of volumeByDay) m.set(d.date, d.positivo + d.neutral + d.negativo + d.crisis);
    return m;
  }, [volumeByDay]);

  const quotes = useMemo(() => {
    const items: { date: string; text: string; author: string; source: string; sentiment: string }[] = [];
    for (const e of entries) for (const q of (e.key_quotes ?? [])) {
      if (!q?.text) continue;
      items.push({
        date: e.entry_date,
        text: q.text,
        author: q.author ?? "",
        source: q.source ?? "",
        sentiment: q.sentiment ?? "neutral",
      });
    }
    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  }, [entries]);

  const scoreTrend = useMemo(() => {
    const map = new Map<string, { date: string; sum: number; n: number }>();
    for (const e of entries) {
      if (typeof e.sentiment_score !== "number") continue;
      const r = map.get(e.entry_date) ?? { date: e.entry_date, sum: 0, n: 0 };
      r.sum += e.sentiment_score; r.n++; map.set(e.entry_date, r);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ date: r.date, score: +(r.sum / r.n).toFixed(2) }));
  }, [entries]);

  // ---------- Insights narrativos (explicaciones) ----------

  // Drivers de tonalidad: topics y entidades más asociados a cada polaridad
  const sentimentDrivers = useMemo(() => {
    const topicPolarity = new Map<string, { pos: number; neg: number; neu: number }>();
    const entityPolarity = new Map<string, { pos: number; neg: number; neu: number; count: number }>();
    const negDates: string[] = [];
    const posDates: string[] = [];
    let posEntries = 0, negEntries = 0, neuEntries = 0, crisisEntries = 0;
    for (const e of entries) {
      const s = (e.sentiment ?? "neutral") as string;
      const bucket = s === "positivo" ? "pos" : (s === "negativo" || s === "crisis") ? "neg" : "neu";
      if (s === "positivo") { posEntries++; posDates.push(e.entry_date); }
      else if (s === "negativo") { negEntries++; negDates.push(e.entry_date); }
      else if (s === "crisis") { crisisEntries++; negDates.push(e.entry_date); }
      else neuEntries++;
      for (const t of (e.topics ?? [])) {
        const row = topicPolarity.get(t) ?? { pos: 0, neg: 0, neu: 0 };
        (row as any)[bucket]++;
        topicPolarity.set(t, row);
      }
      for (const ent of (e.entities ?? [])) {
        const name = typeof ent === "string" ? ent : ent?.name; if (!name) continue;
        const localSent = (typeof ent === "object" && ent?.sentiment) ? ent.sentiment : s;
        const b = localSent === "positivo" ? "pos" : (localSent === "negativo" || localSent === "crisis") ? "neg" : "neu";
        const row = entityPolarity.get(name) ?? { pos: 0, neg: 0, neu: 0, count: 0 };
        (row as any)[b]++; row.count++;
        entityPolarity.set(name, row);
      }
    }
    const negTopics = Array.from(topicPolarity.entries())
      .filter(([_, v]) => v.neg > 0)
      .sort((a, b) => b[1].neg - a[1].neg).slice(0, 4)
      .map(([topic, v]) => ({ topic, count: v.neg }));
    const posTopics = Array.from(topicPolarity.entries())
      .filter(([_, v]) => v.pos > 0)
      .sort((a, b) => b[1].pos - a[1].pos).slice(0, 4)
      .map(([topic, v]) => ({ topic, count: v.pos }));
    const negEntities = Array.from(entityPolarity.entries())
      .filter(([_, v]) => v.neg > 0)
      .sort((a, b) => b[1].neg - a[1].neg).slice(0, 3)
      .map(([name, v]) => ({ name, count: v.neg }));
    const posEntities = Array.from(entityPolarity.entries())
      .filter(([_, v]) => v.pos > 0)
      .sort((a, b) => b[1].pos - a[1].pos).slice(0, 3)
      .map(([name, v]) => ({ name, count: v.pos }));
    // Representative quotes
    const negQuote = quotes.find(q => q.sentiment === "negativo" || q.sentiment === "crisis");
    const posQuote = quotes.find(q => q.sentiment === "positivo");
    const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    const uniq = (arr: string[]) => Array.from(new Set(arr)).sort();
    const negDatesU = uniq(negDates); const posDatesU = uniq(posDates);
    const negReading = (() => {
      const hasSignal = negEntries + crisisEntries > 0 || negTopics.length > 0 || negEntities.length > 0;
      if (!hasSignal) return "";
      const who = negEntities.length ? negEntities.map(e => e.name).join(", ") : "";
      const what = negTopics.length ? negTopics.map(t => t.topic).slice(0, 3).join(", ") : "";
      const when = negDatesU.length ? negDatesU.slice(0, 3).map(fmt).join(", ") + (negDatesU.length > 3 ? "…" : "") : "";
      const parts: string[] = [];
      const totalNegMentions = negEntities.reduce((a, e) => a + e.count, 0) + negTopics.reduce((a, t) => a + t.count, 0);
      if (negEntries + crisisEntries > 0) {
        parts.push(`Se detectaron ${negEntries + crisisEntries} día(s) con carga negativa dominante${crisisEntries ? ` (incluyendo ${crisisEntries} de crisis)` : ""}.`);
      } else {
        parts.push(`El tono predominante no fue negativo, pero hay ${totalNegMentions || "algunas"} señal(es) puntual(es) de crítica que conviene monitorear.`);
      }
      if (what) parts.push(`El ruido gira en torno a: ${what}.`);
      if (who) parts.push(`Voces más asociadas: ${who}.`);
      if (when) parts.push(`Fechas con señal negativa: ${when}.`);
      if (!what && !when && who) parts.push(`Sin un tema recurrente todavía — es una crítica aislada, no una narrativa instalada.`);
      return parts.join(" ");
    })();
    const posReading = (() => {
      const hasSignal = posEntries > 0 || posTopics.length > 0 || posEntities.length > 0;
      if (!hasSignal) return "";
      const who = posEntities.length ? posEntities.map(e => e.name).join(", ") : "";
      const what = posTopics.length ? posTopics.map(t => t.topic).slice(0, 3).join(", ") : "";
      const when = posDatesU.length ? posDatesU.slice(0, 3).map(fmt).join(", ") + (posDatesU.length > 3 ? "…" : "") : "";
      const parts: string[] = [];
      if (posEntries > 0) parts.push(`Se registraron ${posEntries} día(s) con tono positivo dominante.`);
      else parts.push(`Hay menciones positivas puntuales aunque no dominan la conversación del período.`);
      if (what) parts.push(`Temas que jalan a favor: ${what}.`);
      if (who) parts.push(`Impulsados por: ${who}.`);
      if (when) parts.push(`Fechas con señal positiva: ${when}.`);
      return parts.join(" ");
    })();
    return {
      negTopics, posTopics, negEntities, posEntities, negQuote, posQuote,
      posEntries, negEntries, neuEntries, crisisEntries,
      negDates: negDatesU, posDates: posDatesU,
      negReading, posReading,
    };
  }, [entries, quotes]);

  // Heatmap insights: día pico negativo y día pico positivo
  const heatmapInsights = useMemo(() => {
    const scan = (key: "positivo" | "negativo" | "crisis") => {
      const row = heatmap.grid[key] ?? {};
      let best = { day: "", value: 0 };
      for (const d of DOW_LABELS) {
        const v = row[d] ?? 0;
        if (v > best.value) best = { day: d, value: v };
      }
      return best;
    };
    return {
      pos: scan("positivo"),
      neg: scan("negativo"),
      crisis: scan("crisis"),
    };
  }, [heatmap]);

  // Salud reputacional: desglose explicativo
  const reputationBreakdown = useMemo(() => {
    const baseline = 50;
    const sentimentComponent = Math.round(50 * reputationScore.avg);
    const crisisPenalty = Math.min(30, reputationScore.crisisEvents * 6);
    const parts = [
      { label: "Base neutral", value: baseline, tone: "neutral" as const },
      { label: "Aporte del sentimiento promedio", value: sentimentComponent, tone: sentimentComponent >= 0 ? "positivo" : "negativo" as any },
      { label: "Penalización por crisis / alto impacto", value: -crisisPenalty, tone: crisisPenalty > 0 ? "negativo" : "neutral" as any },
    ];
    const explanation = (() => {
      const bits: string[] = [];
      if (sentimentComponent > 15) bits.push("el tono predominante fue claramente positivo");
      else if (sentimentComponent > 0) bits.push("el tono predominante fue ligeramente positivo");
      else if (sentimentComponent < -15) bits.push("el tono predominante fue marcadamente negativo");
      else if (sentimentComponent < 0) bits.push("el tono predominante fue ligeramente negativo");
      else bits.push("el tono predominante fue neutral");
      if (crisisPenalty > 0) bits.push(`se detectaron ${reputationScore.crisisEvents} evento(s) de alto impacto que restan al score`);
      else bits.push("no se detectaron eventos de crisis o alto impacto");
      return bits.join(" y ") + ".";
    })();
    return { parts, explanation };
  }, [reputationScore]);

  // Insights por plataforma: qué está pasando en cada una
  const platformInsights = useMemo(() => {
    // Agrupa entradas por plataforma (una entrada puede aparecer en varias plataformas)
    const perPlatform = new Map<string, {
      total: number;
      pos: number; neg: number; neu: number; crisis: number;
      topics: Map<string, number>;
      entities: Map<string, number>;
    }>();
    for (const e of entries) {
      const chs = (e.channels ?? []).map((c: any) => ({
        name: canonicalChannel(typeof c === "string" ? c : c?.name),
        count: typeof c?.count === "number" ? c.count : 1,
      })).filter(c => c.name);
      for (const ch of chs) {
        const key = ch.name;
        const row = perPlatform.get(key) ?? { total: 0, pos: 0, neg: 0, neu: 0, crisis: 0, topics: new Map(), entities: new Map() };
        row.total += ch.count;
        const s = (e.sentiment ?? "neutral") as string;
        if (s === "positivo") row.pos += ch.count;
        else if (s === "negativo") row.neg += ch.count;
        else if (s === "crisis") row.crisis += ch.count;
        else row.neu += ch.count;
        for (const t of (e.topics ?? []).slice(0, 3)) row.topics.set(t, (row.topics.get(t) ?? 0) + 1);
        for (const ent of (e.entities ?? []).slice(0, 3)) {
          const nm = typeof ent === "string" ? ent : ent?.name;
          if (nm) row.entities.set(nm, (row.entities.get(nm) ?? 0) + 1);
        }
        perPlatform.set(key, row);
      }
    }
    return platforms.map(p => {
      const row = perPlatform.get(p.name);
      if (!row) return { ...p, insight: "", dominant: "neutral", topTopics: [] as string[], topEntities: [] as string[] };
      const totalSent = row.pos + row.neg + row.neu + row.crisis || 1;
      const negPct = Math.round(((row.neg + row.crisis) / totalSent) * 100);
      const posPct = Math.round((row.pos / totalSent) * 100);
      const dominant = row.crisis > 0 && (row.crisis + row.neg) >= row.pos ? "crisis"
        : row.neg > row.pos ? "negativo"
        : row.pos > row.neg ? "positivo" : "neutral";
      const topTopics = Array.from(row.topics.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
      const topEntities = Array.from(row.entities.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
      const insight = (() => {
        const parts: string[] = [];
        if (dominant === "positivo") parts.push(`Conversación mayoritariamente positiva (${posPct}%)`);
        else if (dominant === "negativo") parts.push(`Predomina la crítica (${negPct}% negativo)`);
        else if (dominant === "crisis") parts.push(`Foco de crisis activo (${negPct}% negativo)`);
        else parts.push(`Volumen neutral, sin polarización clara`);
        if (topTopics.length) parts.push(`Ejes: ${topTopics.join(", ")}`);
        if (topEntities.length) parts.push(`Actores citados: ${topEntities.join(", ")}`);
        return parts.join(". ") + ".";
      })();
      return { ...p, insight, dominant, negPct, posPct, topTopics, topEntities };
    });
  }, [entries, platforms]);

  // Detalles por narrativa: sentimiento dominante + snippet + fechas
  const narrativeDetails = useMemo(() => {
    return narratives.map(n => {
      const related = entries.filter(e => (e.topics ?? []).includes(n.topic));
      const sentCount: Record<string, number> = { positivo: 0, neutral: 0, negativo: 0, crisis: 0 };
      for (const e of related) sentCount[e.sentiment ?? "neutral"] = (sentCount[e.sentiment ?? "neutral"] ?? 0) + 1;
      const dominant = (Object.entries(sentCount).sort((a, b) => b[1] - a[1])[0] ?? ["neutral"])[0];
      const snippet = related.map(e => e.summary).filter(Boolean)[0] ?? "";
      const entities = new Set<string>();
      for (const e of related) for (const ent of (e.entities ?? []).slice(0, 3)) {
        const nm = typeof ent === "string" ? ent : ent?.name;
        if (nm) entities.add(nm);
        if (entities.size >= 4) break;
      }
      const firstDate = related.map(e => e.entry_date).sort()[0] ?? "";
      const lastDate = related.map(e => e.entry_date).sort().slice(-1)[0] ?? "";
      return { ...n, dominant, snippet, entities: Array.from(entities), firstDate, lastDate };
    });
  }, [entries, narratives]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Cargando análisis...</div>;

  if (entries.length === 0) {
    return (
      <div className="glass rounded-xl p-10 text-center space-y-2">
        <Sparkles className="w-8 h-8 text-coral mx-auto" />
        <h3 className="font-semibold">Sin datos enriquecidos en este rango</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Aún no hay entradas de listening procesadas por IA en la ventana seleccionada. Prueba ampliar la comparación o esperar al próximo corte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ámbito del análisis: qué toca al cliente y qué es contexto nacional */}
      {isPress && scopeSummary.hasData && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Flag className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">Ámbito del análisis</h4>
            <span className="text-[11px] text-muted-foreground">
              El sentimiento y los conteos del periodo solo consideran lo que toca al cliente.
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { k: "local", label: "Agenda local", n: scopeSummary.counts.local, cls: "text-emerald-600" },
              { k: "nacional_impacto", label: "Nacional con impacto", n: scopeSummary.counts.nacional_impacto, cls: "text-amber-600" },
              { k: "nacional_contexto", label: "Nacional · solo contexto", n: scopeSummary.counts.nacional_contexto, cls: "text-muted-foreground" },
              { k: "otra_entidad", label: "Otras entidades", n: scopeSummary.counts.otra_entidad, cls: "text-muted-foreground" },
            ].map((s) => (
              <div key={s.k} className="rounded-lg border border-border/50 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-semibold tabular-nums ${s.cls}`}>{s.n.toLocaleString("es-MX")}</p>
              </div>
            ))}
          </div>
          {scopeSummary.excluded > 0 && (
            <p className="text-[11px] text-muted-foreground mt-3">
              {scopeSummary.excluded.toLocaleString("es-MX")} menciones del periodo son agenda nacional o de otros estados y
              <span className="font-medium text-foreground"> no mueven el sentimiento ni las alertas</span> del cliente.
            </p>
          )}
          {scopeSummary.context.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Contexto nacional del periodo</p>
              {scopeSummary.context.map((c, i) => (
                <div key={i} className="text-sm flex items-start gap-3 p-2 rounded bg-muted/40">
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {c.scope === "otra_entidad" ? "Otra entidad" : "Nacional"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.title}</div>
                    {c.detail && <div className="text-xs text-muted-foreground">{c.detail}</div>}
                    {c.why && <div className="text-[11px] text-muted-foreground italic mt-0.5">No afecta al cliente: {c.why}</div>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{c.date}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Alertas: hitos críticos del período */}
      {milestones.some(m => isPress ? (m.impact === "alto" && m.kind === "crisis") : (m.impact === "alto" || m.kind === "crisis")) && (
        <Card className="p-5 border-rose-500/30 bg-rose-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon className="w-4 h-4 text-rose-500" />
            <h4 className="text-sm font-semibold">Hitos críticos del período</h4>
          </div>
          {isPress && (
            <p className="text-[11px] text-muted-foreground mb-2">
              Solo se marcan como crisis los hechos con implicación directa para el Gobierno del Estado; los temas municipales aparecen en narrativas y no elevan el nivel de alerta.
            </p>
          )}
          <div className="space-y-2">
            {milestones.filter(m => isPress ? (m.impact === "alto" && m.kind === "crisis") : (m.impact === "alto" || m.kind === "crisis")).slice(0, 5).map((m, i) => (
              <div key={i} className="text-sm flex items-start gap-3 p-2 rounded bg-background/50">
                <Badge variant="destructive" className="text-[10px] shrink-0">H{i + 1}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{m.title || m.kind}</div>
                  {m.detail && <div className="text-xs text-muted-foreground">{m.detail}</div>}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{m.date}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ============ SLIDE 1 · Conversación general ============ */}
      {!isPress && (
      <Card className="p-5 md:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">01 · Listening</div>
              <h3 className="text-2xl font-display font-bold mt-1">Conversación general</h3>
            </div>
            {trendPeriods.length > 0 && (
              <div className="flex items-end gap-6 flex-wrap">
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Tendencia:</span>
                {trendPeriods.map((p, i) => (
                  <div key={i}>
                    <div className="text-[10px] text-muted-foreground">{p.label}</div>
                    <div className={`text-xl font-display font-bold ${p.delta === null ? "text-foreground" : p.delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {p.total.toLocaleString("es-MX")}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volumeByDay.map(d => ({ date: d.date.slice(5), total: d.positivo + d.neutral + d.negativo + d.crisis }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" fontSize={10} />
                  <YAxis fontSize={10} domain={[0, (max: number) => Math.ceil(max * 1.18)]} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#ef6a4d" strokeWidth={2.5} dot={{ r: 3, fill: "#ef6a4d" }} activeDot={{ r: 5 }} />
                  {milestones.map((m, i) => {
                    const y = yByDateLine.get(m.dateKey);
                    if (y === undefined) return null;
                    return (
                      <ReferenceDot key={i} x={m.dateKey} y={y} r={7} fill={m.color} stroke="#fff" strokeWidth={2}
                        label={{ value: `H${i + 1}`, position: "top", fontSize: 10, fontWeight: 700, fill: m.color }} />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {milestones.length > 0 && <MilestonesLegend items={milestones} />}
          </div>
          <div className="lg:w-64 grid grid-cols-1 gap-3">
            <SlideKpi label="Menciones del período" value={totals.total.toLocaleString("es-MX")} accent="#ef6a4d" />
            {trendPeriods.length > 1 && trendPeriods[trendPeriods.length - 1].delta !== null && (
              <SlideKpi
                label="vs período previo"
                value={`${trendPeriods[trendPeriods.length - 1].delta! >= 0 ? "▲" : "▼"} ${Math.abs(trendPeriods[trendPeriods.length - 1].delta!)}%`}
                accent={trendPeriods[trendPeriods.length - 1].delta! >= 0 ? "#10b981" : "#ef4444"}
              />
            )}
            <SlideKpi label="Sentimiento positivo" value={`${totals.posPct}%`} accent="#10b981" />
            {totals.peak.value > 0 && (
              <SlideKpi label="Pico del período" value={new Date(totals.peak.date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })} accent="#0ea5e9" hint={`${totals.peak.value} menciones`} />
            )}
          </div>
        </div>
      </Card>
      )}

      {/* ============ SLIDE 2 · Plataformas y menciones ============ */}
      {!isPress && platforms.length > 0 && (
        <Card className="p-5 md:p-6">
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">01 · Listening</div>
            <h3 className="text-2xl font-display font-bold mt-1 flex items-center gap-2"><Radio className="w-5 h-5" />Plataformas y menciones</h3>
          </div>
          <div className="grid gap-6 lg:grid-cols-2 items-center">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={platforms} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}
                    label={({ pct }) => `${pct}%`} labelLine={false}>
                    {platforms.map((p, i) => <Cell key={i} fill={p.color} stroke="none" />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {platforms.map((p) => (
                <div key={p.name} className="flex items-center gap-3 pl-3 py-2 rounded-lg border-l-4" style={{ borderLeftColor: p.color, background: `${p.color}0f` }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">{p.pct}% del volumen</div>
                  </div>
                  <div className="text-xl font-display font-bold" style={{ color: p.color }}>{p.value}</div>
                </div>
              ))}
            </div>
          </div>
          {platformInsights.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Qué está pasando en cada plataforma</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {platformInsights.map((p) => (
                  <div key={p.name} className="rounded-lg border border-border/40 bg-background/40 p-3 border-l-4" style={{ borderLeftColor: p.color }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-semibold" style={{ color: p.color }}>{p.name}</div>
                      <Badge variant="outline" className="text-[9px]" style={{ borderColor: SENT_COLORS[p.dominant] ?? "#94a3b8", color: SENT_COLORS[p.dominant] ?? "#94a3b8" }}>
                        {p.dominant}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ============ SLIDE 3 · Tonalidad y narrativas ============ */}
      <Card className="p-5 md:p-6">
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">01 · Listening</div>
          <h3 className="text-2xl font-display font-bold mt-1">Tonalidad y narrativas</h3>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sentimentDaily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={10} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Positivo" stroke={SENT_COLORS.positivo} strokeWidth={2.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Neutral" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Negativo" stroke={SENT_COLORS.negativo} strokeWidth={2.5} dot={{ r: 2 }} />
                {milestones.map((m, i) => (
                  <ReferenceDot key={i} x={m.dateKey} y={95} r={6} fill={m.color} stroke="#fff" strokeWidth={2}
                    label={{ value: `H${i + 1}`, position: "top", fontSize: 10, fontWeight: 700, fill: m.color }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <SlideKpi label="Positivo" value={`${totals.posPct}%`} accent={SENT_COLORS.positivo} />
            <SlideKpi label="Neutral" value={`${totals.neuPct}%`} accent="#f59e0b" />
            <SlideKpi label="Negativo" value={`${totals.negPct}%`} accent={SENT_COLORS.negativo} />
          </div>
        </div>
        {milestones.length > 0 && <MilestonesLegend items={milestones} />}

        {/* Análisis de sentimiento: drivers */}
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border/40 p-4" style={{ background: `${SENT_COLORS.positivo}0d`, borderLeftWidth: 4, borderLeftColor: SENT_COLORS.positivo }}>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-3.5 h-3.5" style={{ color: SENT_COLORS.positivo }} />
              <span className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: SENT_COLORS.positivo }}>Qué está impulsando lo positivo</span>
            </div>
            {sentimentDrivers.posTopics.length === 0 && sentimentDrivers.posEntities.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin señales positivas relevantes en el período.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {sentimentDrivers.posTopics.length > 0 && (
                  <div><span className="text-muted-foreground">Temas: </span><span className="font-medium">{sentimentDrivers.posTopics.map(t => `${t.topic} (${t.count})`).join(", ")}</span></div>
                )}
                {sentimentDrivers.posEntities.length > 0 && (
                  <div><span className="text-muted-foreground">Voces / actores: </span><span className="font-medium">{sentimentDrivers.posEntities.map(e => `${e.name} (${e.count})`).join(", ")}</span></div>
                )}
                {sentimentDrivers.posReading && (
                  <p className="pt-1 text-[11px] text-muted-foreground leading-relaxed">{sentimentDrivers.posReading}</p>
                )}
                {sentimentDrivers.posQuote && (
                  <blockquote className="mt-2 pl-2 border-l-2 italic text-[11px] text-muted-foreground" style={{ borderColor: SENT_COLORS.positivo }}>
                    "{sentimentDrivers.posQuote.text}" <span className="not-italic">— {sentimentDrivers.posQuote.author || sentimentDrivers.posQuote.source || sentimentDrivers.posQuote.date}</span>
                  </blockquote>
                )}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border/40 p-4" style={{ background: `${SENT_COLORS.negativo}0d`, borderLeftWidth: 4, borderLeftColor: SENT_COLORS.negativo }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertOctagon className="w-3.5 h-3.5" style={{ color: SENT_COLORS.negativo }} />
              <span className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: SENT_COLORS.negativo }}>Qué está pesando en lo negativo</span>
            </div>
            {sentimentDrivers.negTopics.length === 0 && sentimentDrivers.negEntities.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin focos negativos relevantes en el período.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {sentimentDrivers.negTopics.length > 0 && (
                  <div><span className="text-muted-foreground">Temas: </span><span className="font-medium">{sentimentDrivers.negTopics.map(t => `${t.topic} (${t.count})`).join(", ")}</span></div>
                )}
                {sentimentDrivers.negEntities.length > 0 && (
                  <div><span className="text-muted-foreground">Voces / actores: </span><span className="font-medium">{sentimentDrivers.negEntities.map(e => `${e.name} (${e.count})`).join(", ")}</span></div>
                )}
                {sentimentDrivers.negReading && (
                  <p className="pt-1 text-[11px] text-muted-foreground leading-relaxed">{sentimentDrivers.negReading}</p>
                )}
                {sentimentDrivers.negQuote && (
                  <blockquote className="mt-2 pl-2 border-l-2 italic text-[11px] text-muted-foreground" style={{ borderColor: SENT_COLORS.negativo }}>
                    "{sentimentDrivers.negQuote.text}" <span className="not-italic">— {sentimentDrivers.negQuote.author || sentimentDrivers.negQuote.source || sentimentDrivers.negQuote.date}</span>
                  </blockquote>
                )}
              </div>
            )}
          </div>
        </div>

        {narrativeDetails.length > 0 && (
          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Narrativas dominantes</div>
            <div className="grid gap-3 md:grid-cols-2">
              {narrativeDetails.map((n) => (
                <div key={n.topic} className="p-4 rounded-lg bg-background/40 border border-border/40 border-l-4" style={{ borderLeftColor: n.color }}>
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: n.color }}>
                      {n.pct}%
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2 flex-wrap">
                        <div className="text-sm font-semibold break-words">{n.topic}</div>
                        <Badge variant="outline" className="text-[9px]" style={{ borderColor: SENT_COLORS[n.dominant] ?? "#94a3b8", color: SENT_COLORS[n.dominant] ?? "#94a3b8" }}>{n.dominant}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {n.days} día{n.days === 1 ? "" : "s"} activos
                        {n.firstDate && n.lastDate && n.firstDate !== n.lastDate && (
                          <> · del {new Date(n.firstDate + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })} al {new Date(n.lastDate + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</>
                        )}
                      </div>
                    </div>
                  </div>
                  {n.snippet && (
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line break-words">{n.snippet}</p>
                  )}
                  {n.entities.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {n.entities.map((e) => (
                        <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 border border-border/40 text-muted-foreground">{e}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ============ Quién dijo qué: medios y voces sociales ============ */}
      {(mediaCoverage.length > 0 || socialVoices.flat.length > 0) && (
        <Card className="p-5 md:p-6">
          <div>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Trazabilidad</span>
            <h3 className="text-2xl font-display font-bold mt-1 flex items-center gap-2">
              <AtSign className="w-5 h-5" />Quién dijo qué
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isPress
                ? "Reconstrucción por medio (primeras planas, columnas y síntesis) a partir de las bitácoras del período."
                : "Reconstrucción por medio y por perfil social a partir de las bitácoras del período."}
            </p>
          </div>

          <div className={`mt-5 grid gap-4 ${isPress ? "" : "lg:grid-cols-2"}`}>
            {/* Medios que hablaron */}
            <div className="rounded-xl border border-border/40 bg-background/30 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-background/40">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[11px] uppercase tracking-widest font-semibold">Medios que hablaron</span>
                </div>
                <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded bg-background/60 border border-border/40">
                  {mediaCoverage.length}
                </span>
              </div>
              {mediaCoverage.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground italic">Sin coberturas mediáticas identificadas en el período.</div>
              ) : (
                <ul className="divide-y divide-border/40 max-h-[520px] overflow-auto">
                  {mediaCoverage.map((m, i) => {
                    const dominant = m.neg > m.pos ? "negativo" : m.pos > m.neg ? "positivo" : "neutral";
                    const c = SENT_COLORS[dominant];
                    return (
                      <li key={i} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm truncate">{m.outlet}</span>
                              <span className="text-[9px] uppercase tracking-widest text-muted-foreground border border-border/40 rounded px-1.5 py-0.5">{m.type}</span>
                            </div>
                            {m.topics.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {m.topics.map((t) => (
                                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 border border-border/40 text-muted-foreground">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-lg font-display font-bold tabular-nums leading-none" style={{ color: c }}>{m.count}</div>
                            <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">nota{m.count === 1 ? "" : "s"}</div>
                          </div>
                        </div>
                        {(m.pos + m.neg + m.neu) > 0 && (
                          <div className="mt-2 flex h-1 rounded-full overflow-hidden bg-background/60">
                            {m.pos > 0 && <div style={{ background: SENT_COLORS.positivo, width: `${(m.pos / m.count) * 100}%` }} />}
                            {m.neu > 0 && <div style={{ background: SENT_COLORS.neutral, width: `${(m.neu / m.count) * 100}%` }} />}
                            {m.neg > 0 && <div style={{ background: SENT_COLORS.negativo, width: `${(m.neg / m.count) * 100}%` }} />}
                          </div>
                        )}
                        {m.links.filter(l => l.url).length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {m.links.filter(l => l.url).slice(0, 3).map((l, li) => (
                              <li key={li} className="text-[11px] leading-snug flex items-start gap-1.5">
                                <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                                <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                                  {l.headline || l.url}
                                </a>
                              </li>
                            ))}
                            {m.links.filter(l => l.url).length > 3 && (
                              <li className="text-[10px] text-muted-foreground pl-4.5">+{m.links.filter(l => l.url).length - 3} más</li>
                            )}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Voces en redes */}
            {!isPress && (
            <div className="rounded-xl border border-border/40 bg-background/30 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-background/40">
                <div className="flex items-center gap-2">
                  <AtSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[11px] uppercase tracking-widest font-semibold">Voces en redes</span>
                </div>
                <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded bg-background/60 border border-border/40">
                  {socialVoices.flat.length}
                </span>
              </div>
              {socialVoices.flat.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground italic">Sin perfiles sociales identificados individualmente en el período.</div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[520px] overflow-auto">
                  {socialVoices.byPlatform.map((group) => (
                    <div key={group.platform} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: platformColor(group.platform) }} />
                          <span className="text-[11px] uppercase tracking-widest font-semibold capitalize">{group.platform}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{group.total} mención{group.total === 1 ? "" : "es"}</span>
                      </div>
                      <ul className="space-y-1.5">
                        {group.voices.map((v, vi) => {
                          const dominant = v.neg > v.pos ? "negativo" : v.pos > v.neg ? "positivo" : "neutral";
                          const c = SENT_COLORS[dominant];
                          const firstUrl = v.posts.find(p => p.url)?.url ?? "";
                          const NameEl: any = firstUrl ? "a" : "span";
                          const nameProps = firstUrl
                            ? { href: firstUrl, target: "_blank", rel: "noopener noreferrer", className: "font-medium text-sm hover:underline truncate" }
                            : { className: "font-medium text-sm truncate" };
                          return (
                            <li key={vi} className="flex items-start justify-between gap-2 rounded-lg bg-background/40 border border-border/30 px-2.5 py-1.5">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <NameEl {...nameProps}>{v.profile}</NameEl>
                                  {v.handle && <span className="text-[10px] text-muted-foreground truncate">{v.handle.startsWith("@") ? v.handle : `@${v.handle}`}</span>}
                                </div>
                                {v.topics.length > 0 && (
                                  <div className="mt-0.5 flex flex-wrap gap-1">
                                    {v.topics.map((t) => (
                                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-background/70 border border-border/40 text-muted-foreground">{t}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-sm font-bold tabular-nums leading-none" style={{ color: c }}>{v.count}</div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>

          {mediaCoverage.length === 0 && socialVoices.flat.length === 0 && (
            <p className="mt-4 text-[11px] text-muted-foreground italic">
              Este período fue analizado antes de habilitar el desglose por medio/perfil. Se activará automáticamente con los próximos análisis.
            </p>
          )}
        </Card>
      )}

      {/* ============ Buscador de menciones ============ */}
      <Card className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Buscador</span>
              <h3 className="text-2xl font-display font-bold mt-1 flex items-center gap-2">
                <Search className="w-5 h-5" />Buscar menciones
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Filtra por texto, plataforma o sentimiento sobre todas las menciones detectadas en el período.
              </p>
            </div>
            <div className="text-right text-[11px] text-muted-foreground tabular-nums">
              <div><span className="font-bold text-foreground">{searchStats.total}</span> resultados</div>
              <div>{searchStats.media} medios · {searchStats.social} redes</div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setSearchLimit(50); }}
                placeholder="Buscar por outlet, perfil, tema, cita o URL…"
                className="pl-9 pr-8"
              />
              {searchQ && (
                <button
                  type="button"
                  onClick={() => setSearchQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-background/60"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <select
              value={searchPlatform}
              onChange={(e) => setSearchPlatform(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="todas">Todas las plataformas</option>
              <option value="medios digitales">Medios digitales</option>
              <option value="x">X</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="tiktok">TikTok</option>
              <option value="linkedin">LinkedIn</option>
              <option value="reddit">Reddit</option>
            </select>
            <select
              value={searchSent}
              onChange={(e) => setSearchSent(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="todos">Todo sentimiento</option>
              <option value="positivo">Positivo</option>
              <option value="neutral">Neutral</option>
              <option value="negativo">Negativo / crisis</option>
            </select>
            <Button variant="outline" size="sm" onClick={exportSearchCsv} disabled={searchResults.length === 0} className="h-10">
              <Download className="w-4 h-4 mr-1" />CSV
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-border/40 bg-background/30 overflow-hidden">
            {searchResults.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground italic">
                No hay menciones que coincidan con los filtros.
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border/40 max-h-[560px] overflow-auto">
                  {searchResults.slice(0, searchLimit).map((r, i) => {
                    const c = SENT_COLORS[r.sentiment === "crisis" ? "crisis" : r.sentiment] ?? SENT_COLORS.neutral;
                    return (
                      <li key={i} className="p-3 hover:bg-background/40">
                        <div className="flex items-start gap-3">
                          <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: c }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="tabular-nums text-muted-foreground">{r.date}</span>
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                              <span className="uppercase tracking-widest text-[10px] font-semibold" style={{ color: platformColor(r.platform) }}>
                                {r.platform}
                              </span>
                              <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border/40 rounded px-1.5 py-0.5">
                                {r.kind === "media" ? "medio" : "red"}
                              </span>
                              {r.topic && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 border border-border/40 text-muted-foreground">{r.topic}</span>
                              )}
                            </div>
                            <div className="mt-1 font-semibold text-sm truncate">
                              {r.who}
                              {r.handle && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{r.handle.startsWith("@") ? r.handle : `@${r.handle}`}</span>}
                            </div>
                            {r.headline && (
                              <div className="text-sm text-foreground/90 mt-0.5 line-clamp-2">{r.headline}</div>
                            )}
                            {r.quote && (
                              <div className="text-xs italic text-muted-foreground mt-1 line-clamp-2">"{r.quote}"</div>
                            )}
                            {r.url && (
                              <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline truncate max-w-full">
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{r.url}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {searchResults.length > searchLimit && (
                  <div className="p-3 border-t border-border/40 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setSearchLimit(l => l + 50)}>
                      Ver más ({searchResults.length - searchLimit} restantes)
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

      {/* Bloque táctico: volumen apilado + sentimiento agregado */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">Volumen y sentimiento por día</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={volumeByDay}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" fontSize={10} />
              <YAxis fontSize={10} domain={[0, (max: number) => Math.ceil(max * 1.18)]} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="positivo" stackId="a" fill={SENT_COLORS.positivo} />
              <Bar dataKey="neutral" stackId="a" fill={SENT_COLORS.neutral} />
              <Bar dataKey="negativo" stackId="a" fill={SENT_COLORS.negativo} />
              <Bar dataKey="crisis" stackId="a" fill={SENT_COLORS.crisis} />
              {milestones.map((m, i) => {
                const y = yByDateBar.get(m.date);
                if (y === undefined) return null;
                return (
                  <ReferenceDot key={i} x={m.date} y={y} r={6} fill={m.color} stroke="#fff" strokeWidth={2}
                    label={{ value: `H${i + 1}`, position: "top", fontSize: 9, fontWeight: 700, fill: m.color }} />
                );
              })}
            </BarChart>
          </ResponsiveContainer>
          {milestones.length > 0 && <MilestonesLegend items={milestones} />}
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">Sentimiento agregado</h4>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sentimentBreakdown} dataKey="value" nameKey="name" outerRadius={80} label>
                {sentimentBreakdown.map((entry, i) => (
                  <Cell key={i} fill={SENT_COLORS[entry.name] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          {(() => {
            const total = sentimentBreakdown.reduce((a, s) => a + s.value, 0);
            if (!total) return null;
            const get = (n: string) => sentimentBreakdown.find(s => s.name === n)?.value ?? 0;
            const pos = get("positivo"), neg = get("negativo"), neu = get("neutral"), cri = get("crisis");
            const pct = (v: number) => Math.round((v / total) * 100);
            const dominante = [
              { k: "positivo", v: pos }, { k: "neutral", v: neu }, { k: "negativo", v: neg }, { k: "crisis", v: cri }
            ].sort((a, b) => b.v - a.v)[0];
            const balance = pos - (neg + cri);
            const lectura = (() => {
              const bits: string[] = [];
              bits.push(`De ${total} menciones, el ${pct(dominante.v)}% son ${dominante.k}.`);
              if (balance > 0) bits.push(`La conversación se inclina a favor (${pos} positivas vs ${neg + cri} negativas).`);
              else if (balance < 0) bits.push(`La conversación pesa en contra (${neg + cri} negativas vs ${pos} positivas).`);
              else bits.push(`Positivo y negativo se equilibran.`);
              if (cri > 0) bits.push(`Hay ${cri} mención(es) de crisis que requieren atención inmediata.`);
              if (neu / total > 0.5) bits.push(`Más de la mitad del ruido es neutral: espacio para empujar mensajes propios.`);
              return bits.join(" ");
            })();
            return (
              <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Lectura</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{lectura}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded" style={{ background: `${SENT_COLORS.positivo}1a`, color: SENT_COLORS.positivo }}>Positivo {pct(pos)}%</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: `${SENT_COLORS.neutral}1a`, color: SENT_COLORS.neutral }}>Neutral {pct(neu)}%</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: `${SENT_COLORS.negativo}1a`, color: SENT_COLORS.negativo }}>Negativo {pct(neg)}%</span>
                  {cri > 0 && <span className="px-1.5 py-0.5 rounded" style={{ background: `${SENT_COLORS.crisis}1a`, color: SENT_COLORS.crisis }}>Crisis {pct(cri)}%</span>}
                </div>
              </div>
            );
          })()}
        </Card>
      </div>

      {/* Bloque avanzado: heatmap + salud reputacional */}
      <div className={`grid gap-4 ${isPress ? "" : "md:grid-cols-3"}`}>
        <Card className={`p-4 ${isPress ? "" : "md:col-span-2"}`}>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Grid3x3 className="w-4 h-4" />Heatmap día-semana × sentimiento</h4>
          <div className="space-y-2">
            {(["positivo", "neutral", "negativo", "crisis"] as const).map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-16 text-[11px] capitalize text-muted-foreground">{s}</div>
                <div className="grid grid-cols-7 gap-1 flex-1">
                  {DOW_LABELS.map(d => {
                    const v = heatmap.grid[s]?.[d] ?? 0;
                    const ratio = v / heatmap.max;
                    const [r, g, b] = HEAT_COLOR[s];
                    const bg = `rgba(${r}, ${g}, ${b}, ${0.08 + ratio * 0.85})`;
                    return (
                      <div key={d} title={`${d}: ${v}`} className="h-10 rounded flex items-center justify-center text-[10px] font-medium"
                        style={{ background: bg, color: ratio > 0.5 ? "#fff" : undefined }}>
                        {v > 0 ? v : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-7 gap-1 pl-[72px] pt-1">
              {DOW_LABELS.map(d => <div key={d} className="text-[9px] text-center text-muted-foreground uppercase tracking-wider">{d}</div>)}
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-border/40 bg-background/40 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Lectura del heatmap</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
              {heatmapInsights.pos.day && (
                <li>• Los <span className="font-semibold text-foreground">{heatmapInsights.pos.day}</span> concentran el mayor volumen positivo ({heatmapInsights.pos.value} menciones): buena ventana para lanzar mensajes propios.</li>
              )}
              {heatmapInsights.neg.day && heatmapInsights.neg.value > 0 && (
                <li>• Los <span className="font-semibold text-foreground">{heatmapInsights.neg.day}</span> son el día más crítico en negativo ({heatmapInsights.neg.value}): reforzar monitoreo y capacidad de respuesta rápida.</li>
              )}
              {heatmapInsights.crisis.value > 0 && (
                <li>• Se registran picos de <span className="font-semibold" style={{ color: SENT_COLORS.crisis }}>crisis</span> los <span className="font-semibold text-foreground">{heatmapInsights.crisis.day}</span>: revisar detonantes recurrentes.</li>
              )}
              {(!heatmapInsights.pos.value && !heatmapInsights.neg.value && !heatmapInsights.crisis.value) && (
                <li>Sin patrones semanales relevantes todavía.</li>
              )}
            </ul>
          </div>
        </Card>

        {!isPress && (
        <Card className="p-4 flex flex-col">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Gauge className="w-4 h-4" />Salud reputacional</h4>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <ResponsiveContainer width="100%" height={180}>
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ name: "score", value: reputationScore.score, fill: reputationScore.color }]} startAngle={210} endAngle={-30}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background={{ fill: "rgba(148,163,184,0.15)" } as any} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-4xl font-display font-bold" style={{ color: reputationScore.color }}>{reputationScore.score}</div>
              <div className="text-xs font-semibold" style={{ color: reputationScore.color }}>{reputationScore.label}</div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">{reputationBreakdown.explanation}</p>
            <div className="space-y-1">
              {reputationBreakdown.parts.map((p) => {
                const isNeg = p.value < 0;
                const isPos = p.value > 0;
                const color = isNeg ? SENT_COLORS.negativo : isPos ? SENT_COLORS.positivo : "#94a3b8";
                return (
                  <div key={p.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{p.label}</span>
                    <span className="font-semibold tabular-nums" style={{ color }}>{p.value > 0 ? "+" : ""}{p.value}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                <span className="font-semibold">Score total</span>
                <span className="font-bold tabular-nums" style={{ color: reputationScore.color }}>{reputationScore.score}</span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">Sentimiento promedio: {reputationScore.avg} · Crisis detectadas: {reputationScore.crisisEvents}</div>
          </div>
        </Card>
        )}
      </div>

      {/* Frases destacadas */}
      {quotes.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2"><Quote className="w-4 h-4" />Frases destacadas</h4>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{quotes.length} citas</span>
          </div>
          {(() => {
            const groups: { key: "positivo" | "neutral" | "negativo"; label: string }[] = [
              { key: "positivo", label: "Positivas" },
              { key: "neutral", label: "Neutras" },
              { key: "negativo", label: "Negativas" },
            ];
            const buckets = groups.map(g => ({
              ...g,
              color: SENT_COLORS[g.key],
              items: quotes.filter(q => (q.sentiment === "crisis" ? "negativo" : q.sentiment) === g.key),
            })).filter(b => b.items.length > 0);
            if (!buckets.length) return null;
            return (
              <div className={`grid gap-3 ${buckets.length === 1 ? "" : buckets.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                {buckets.map(b => (
                  <div key={b.key} className="rounded-xl border border-border/40 bg-background/30 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border/40" style={{ background: `${b.color}12` }}>
                      <span className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: b.color }}>{b.label}</span>
                      <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded" style={{ background: `${b.color}22`, color: b.color }}>{b.items.length}</span>
                    </div>
                    <ul className="divide-y divide-border/40">
                      {b.items.map((q, i) => (
                        <li key={i} className="p-3 relative">
                          <Quote className="absolute top-2 right-2 w-3 h-3 opacity-20" style={{ color: b.color }} />
                          <p className="text-[13px] italic leading-snug pr-4">"{q.text}"</p>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap mt-1.5">
                            {q.author && <span className="font-medium text-foreground/80">{q.author}</span>}
                            {q.source && <span>· {q.source}</span>}
                            <span className="ml-auto tabular-nums">{q.date}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Timeline de hitos */}
      {milestones.length > 0 && (
        <Card className="p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h4 className="text-sm font-semibold flex items-center gap-2"><Flag className="w-4 h-4" />Timeline de hitos</h4>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{milestones.length} hitos</span>
          </div>
          {(() => {
            const impactColor = (imp: string) => imp === "alto" ? SENT_COLORS.negativo : imp === "medio" ? "#f59e0b" : "#94a3b8";
            const fmt = (d: string) => {
              try {
                const dt = new Date(d + "T00:00:00");
                return {
                  day: dt.toLocaleDateString("es-MX", { day: "2-digit" }),
                  mon: dt.toLocaleDateString("es-MX", { month: "short" }).replace(".", ""),
                };
              } catch { return { day: d, mon: "" }; }
            };
            return (
              <ol className="relative border-l-2 border-border/50 ml-3 space-y-4">
                {milestones.map((m, i) => {
                  const c = impactColor(m.impact);
                  const d = fmt(m.date);
                  return (
                    <li key={i} className="relative pl-5">
                      <span
                        className="absolute -left-[13px] top-1 flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white ring-4 ring-background"
                        style={{ background: c }}
                        title={`Impacto ${m.impact}`}
                      >
                        H{i + 1}
                      </span>
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 text-center leading-none rounded-md border border-border/40 bg-background/40 px-2 py-1.5 min-w-[46px]">
                          <div className="text-sm font-bold tabular-nums">{d.day}</div>
                          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{d.mon}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase tracking-widest border-0 text-white"
                              style={{ background: c }}
                            >
                              {m.kind}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">Impacto {m.impact}</span>
                          </div>
                          <div className="font-medium text-sm leading-snug mt-1">{m.title || m.kind}</div>
                          {m.detail && <div className="text-xs text-muted-foreground leading-snug mt-0.5">{m.detail}</div>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            );
          })()}
        </Card>
      )}
    </div>
  );
}

function SlideKpi({ label, value, accent, hint }: { label: string; value: React.ReactNode; accent: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-4 border-l-4" style={{ borderLeftColor: accent }}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-2xl font-display font-bold mt-1" style={{ color: accent }}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function MilestonesLegend({ items }: { items: { date: string; title: string; detail: string; kind: string; color: string }[] }) {
  return (
    <div className="mt-3 rounded-lg border border-border/40 bg-background/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Flag className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Hitos del período</span>
      </div>
      <div className="grid gap-1.5 md:grid-cols-2">
        {items.map((m, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white" style={{ background: m.color }}>H{i + 1}</span>
            <div className="min-w-0">
              <div className="font-medium leading-tight truncate">{m.title || m.kind}</div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(m.date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · {m.kind}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
