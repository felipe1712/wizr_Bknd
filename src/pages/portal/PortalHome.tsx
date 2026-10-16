import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut, FileText, ShieldAlert, Download, Sparkles,
  BarChart3, Lightbulb, History, ChevronLeft, ChevronRight,
  AlertTriangle, TrendingUp, MessageCircle, Sun, Moon, CalendarRange, X, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mergeNameCounts } from "@/lib/entityNames";
import type { ClientPortalConfig } from "@/lib/clientPortal";
import PortalAnalysis from "./PortalAnalysis";
import PortalPdfTemplate from "./PortalPdfTemplate";
import RecommendationsBlock from "@/components/portal/RecommendationsBlock";
import PortalBenchmark from "@/components/portal/PortalBenchmark";
import PortalStrategy from "@/components/portal/PortalStrategy";
import PortalDescargas from "@/components/portal/PortalDescargas";
import PortalBriefing from "@/components/portal/PortalBriefing";
import PortalFreshnessBar from "@/components/portal/PortalFreshnessBar";
import PortalBigPicture from "@/components/portal/PortalBigPicture";
import { Compass, Users as UsersIcon, Building2, Home } from "lucide-react";
import type { DateRange } from "react-day-picker";

type Analysis = {
  id: string;
  week_start: string;
  week_end: string;
  entries_count: number;
  executive_summary: string | null;
  key_findings: any[];
  alerts: any[];
  recommendations_client: string | null;
  sentiment_breakdown: Record<string, number> | null;
  top_topics: { topic: string; count: number }[] | null;
  top_mentions: { name: string; type?: string; count: number }[] | null;
};

type Report = {
  id: string;
  report_date: string;
  title: string;
  type: string;
  summary_md: string | null;
};

type PeriodMilestone = {
  date: string;
  title: string;
  detail: string;
  kind: string;
  impact: string;
};

const COMPARE_OPTIONS = [
  { key: "week", label: "Corte semanal", weeks: 1 },
  { key: "biweek", label: "Corte quincenal", weeks: 2 },
  { key: "month", label: "Corte mensual", weeks: 4 },
];

const TYPE_LABEL: Record<string, string> = {
  daily: "Análisis diario",
  weekly: "Reporte semanal",
  benchmark: "Benchmark",
  other: "Otro",
};

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}
function fmtWeekShort(start: string, end: string) {
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  const sameMonth = a.getMonth() === b.getMonth();
  const sa = a.toLocaleDateString("es-MX", { day: "numeric", month: sameMonth ? undefined : "short" });
  const sb = b.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  return `${sa} – ${sb}`;
}

function buildMilestonesFromRows(rows: any[]): PeriodMilestone[] {
  const IMPACT_RANK: Record<string, number> = { crisis: 4, alto: 3, medio: 2, bajo: 1 };
  const mentionsByDate = new Map<string, number>();
  const events: PeriodMilestone[] = [];

  for (const r of rows) {
    const sc = r.sentiment_counts ?? {};
    const hasCounts = sc && (sc.positivo || sc.neutral || sc.negativo || sc.crisis);
    const total = hasCounts
      ? Number(sc.positivo ?? 0) + Number(sc.neutral ?? 0) + Number(sc.negativo ?? 0) + Number(sc.crisis ?? 0)
      : (Number(r.total_mentions ?? 0) || 1);
    mentionsByDate.set(r.entry_date, (mentionsByDate.get(r.entry_date) ?? 0) + total);

    for (const ev of (r.events ?? [])) {
      events.push({
        date: r.entry_date,
        title: ev?.title ?? "",
        kind: ev?.kind ?? "evento",
        impact: ev?.impact ?? "medio",
        detail: ev?.detail ?? "",
      });
    }
  }

  const volumes = Array.from(mentionsByDate.values()).filter(v => v > 0);
  if (!volumes.length) return [];
  const maxVol = Math.max(1, ...volumes);
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const peakThreshold = Math.max(avgVol * 1.15, maxVol * 0.4);

  let peakDate: string | null = null;
  let peakVolume = 0;
  for (const [d, v] of mentionsByDate.entries()) {
    if (v > peakVolume) { peakVolume = v; peakDate = d; }
  }

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

  const bestByDate = new Map<string, PeriodMilestone>();
  for (const ev of events) {
    const cur = bestByDate.get(ev.date);
    const nextRank = Math.max(IMPACT_RANK[ev.impact ?? ""] ?? 0, ev.kind === "crisis" ? IMPACT_RANK.crisis : 0);
    const curRank = cur ? Math.max(IMPACT_RANK[cur.impact ?? ""] ?? 0, cur.kind === "crisis" ? IMPACT_RANK.crisis : 0) : -1;
    if (nextRank > curRank) bestByDate.set(ev.date, ev);
  }

  const candidates = Array.from(bestByDate.values()).map(ev => {
    const vol = mentionsByDate.get(ev.date) ?? 0;
    const impactScore = Math.max(IMPACT_RANK[ev.impact ?? ""] ?? 0, ev.kind === "crisis" ? IMPACT_RANK.crisis : 0);
    return { ...ev, vol, impactScore, score: (vol / maxVol) * 10 + impactScore, isPeak: vol >= peakThreshold };
  });

  for (const [date, vol] of mentionsByDate.entries()) {
    if (candidates.some(c => c.date === date)) continue;
    const isPeak = date === peakDate || vol >= peakThreshold;
    const isCoveragePeak = coveragePeakDates.has(date);
    if (!isPeak && !isCoveragePeak) continue;
    const ratio = avgVol ? vol / avgVol : 1;
    const impactScore = date === peakDate || vol >= maxVol * 0.75 ? IMPACT_RANK.alto : IMPACT_RANK.medio;
    candidates.push({
      date,
      title: date === peakDate ? "Pico de conversación del período" : isCoveragePeak ? "Pico local de conversación" : "Día con conversación destacada",
      kind: "volumen",
      impact: impactScore >= IMPACT_RANK.alto ? "alto" : "medio",
      detail: `${vol.toLocaleString("es-MX")} menciones registradas${avgVol ? ` (${ratio.toFixed(1)}× el promedio diario)` : ""}.`,
      vol,
      impactScore,
      score: (vol / maxVol) * 10 + impactScore + (isCoveragePeak ? 1 : 0),
      isPeak: isPeak || isCoveragePeak,
    });
  }

  for (const c of candidates) {
    if (!coveragePeakDates.has(c.date)) continue;
    c.isPeak = true;
    c.score += 1;
  }

  const peakCandidate = peakDate ? candidates.find(c => c.date === peakDate) : undefined;
  const requiredDates = new Set([peakDate, ...coveragePeakDates].filter(Boolean) as string[]);
  const HARD_CAP = 6;
  const eligible = candidates.filter(c => c.isPeak || c.impactScore >= IMPACT_RANK.alto);
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
  if (picked.length === 0) picked = [...candidates].sort((a, b) => b.score - a.score).slice(0, Math.min(3, candidates.length));
  if (peakCandidate && !picked.some(p => p.date === peakCandidate.date)) {
    picked = [peakCandidate, ...picked].sort((a, b) => b.score - a.score).slice(0, HARD_CAP);
    if (!picked.some(p => p.date === peakCandidate.date)) picked[picked.length - 1] = peakCandidate;
  }

  return picked
    .sort((a, b) => {
      if (a.date === peakDate) return -1;
      if (b.date === peakDate) return 1;
      return b.score - a.score || a.date.localeCompare(b.date);
    })
    .map(({ date, title, detail, kind, impact }) => ({ date, title, detail, kind, impact }));
}

export default function PortalHome({ portal }: { portal: ClientPortalConfig }) {
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState<string | null>(portal.logoUrl ?? null);
  const [portalModules, setPortalModules] = useState<Record<string, boolean>>({});
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [role, setRole] = useState<"admin" | "executive" | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [compareKey, setCompareKey] = useState("week");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [rangeAgg, setRangeAgg] = useState<{
    totalMentions: number;
    entriesInRange: number;
    sent: { positivo: number; neutral: number; negativo: number; crisis: number };
  }>({ totalMentions: 0, entriesInRange: 0, sent: { positivo: 0, neutral: 0, negativo: 0, crisis: 0 } });
  const [prevRangeAgg, setPrevRangeAgg] = useState<{ totalMentions: number } | null>(null);
  const [rangeMilestones, setRangeMilestones] = useState<PeriodMilestone[]>([]);
  const [periodAnalysis, setPeriodAnalysis] = useState<Analysis | null>(null);
  const [periodAnalysisKey, setPeriodAnalysisKey] = useState<string | null>(null);
  const [periodAnalysisErrorKey, setPeriodAnalysisErrorKey] = useState<string | null>(null);
  const [periodCacheCheckedKey, setPeriodCacheCheckedKey] = useState<string | null>(null);
  const [periodJobId, setPeriodJobId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [pdfChartData, setPdfChartData] = useState<{
    volumeByDay: { date: string; positivo: number; neutral: number; negativo: number; crisis: number }[];
    topChannels: { name: string; value: number }[];
    topEntities: { name: string; size: number }[];
    reputation: { score: number; label: string; color: string };
  } | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("portal-theme") as "dark" | "light") || "dark";
  });
  const [activeTab, setActiveTab] = useState<string>("panorama");
  const [focusDepId, setFocusDepId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("portal-focus-dep") || null;
  });
  const gabineteTabInit = useRef(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const isGabinete = !!(portalModules.benchmark_funcionarios || portalModules.benchmark_instituciones);
  const canSeeBigPicture = isGabinete && (role === "admin" || role === "executive");

  // Rol interno del usuario: define quién registra el corte semanal y quién ve el Big Picture.
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const { data } = await supabase
        .from("user_roles").select("role").eq("user_id", s.session.user.id);
      const roles = (data ?? []).map((r: any) => r.role as string);
      setRole(roles.includes("admin") ? "admin" : roles.includes("executive") ? "executive" : null);
    })();
  }, []);

  useEffect(() => {
    if (focusDepId) localStorage.setItem("portal-focus-dep", focusDepId);
    else localStorage.removeItem("portal-focus-dep");
  }, [focusDepId]);

  useEffect(() => {
    if (isGabinete && !gabineteTabInit.current) {
      gabineteTabInit.current = true;
      setActiveTab("inicio");
    }
  }, [isGabinete]);


  useEffect(() => {
    localStorage.setItem("portal-theme", theme);
    const root = document.documentElement;
    if (theme === "light") root.classList.add("theme-light");
    else root.classList.remove("theme-light");
    return () => { root.classList.remove("theme-light"); };
  }, [theme]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [c, a, r] = await Promise.all([
        supabase.from("clients").select("logo_url, portal_modules").eq("id", portal.clientId).maybeSingle(),
        supabase
          .from("client_portal_listening_analyses")
          .select("id, week_start, week_end, entries_count, executive_summary, key_findings, alerts, recommendations_client, sentiment_breakdown, top_topics, top_mentions")
          .eq("client_id", portal.clientId)
          .order("week_start", { ascending: false })
          .limit(52),
        supabase
          .from("client_portal_reports")
          .select("id, report_date, title, type, summary_md")
          .eq("client_id", portal.clientId)
          .order("report_date", { ascending: false })
          .limit(50),
      ]);
      if (c.data?.logo_url) setLogoUrl(c.data.logo_url);
      setPortalModules((((c.data as any)?.portal_modules) ?? {}) as Record<string, boolean>);
      // Solo aceptar análisis anclados a semanas completas lunes→domingo.
      // Los análisis heredados con anclajes arbitrarios (martes, miércoles, etc.)
      // se ocultan para no dar la falsa impresión de semanas superpuestas.
      const raw = ((a.data ?? []) as unknown) as Analysis[];
      const list = raw.filter((x) => {
        const s = new Date(x.week_start + "T00:00:00");
        const e = new Date(x.week_end + "T00:00:00");
        const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
        return s.getDay() === 1 && days === 7; // lunes + 7 días
      });
      setReports((r.data ?? []) as Report[]);

      // Semanas disponibles = análisis guardados + semanas sintetizadas a partir
      // de las bitácoras cargadas (para que datos nuevos aparezcan aunque aún no
      // se haya generado su reporte semanal).
      const byWeek = new Map<string, Analysis>();
      for (const item of list) byWeek.set(item.week_start, item);

      const { data: dates } = await supabase
        .from("client_portal_listening_entries")
        .select("entry_date")
        .eq("client_id", portal.clientId)
        .order("entry_date", { ascending: false })
        .limit(1000);
      for (const row of (dates ?? []) as { entry_date: string }[]) {
        const dt = new Date(row.entry_date + "T00:00:00");
        const monday = new Date(dt);
        monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        const ws = monday.toISOString().slice(0, 10);
        const we = sunday.toISOString().slice(0, 10);
        if (byWeek.has(ws)) continue;
        byWeek.set(ws, {
          id: `synthetic-${ws}`,
          week_start: ws,
          week_end: we,
          entries_count: 0,
          executive_summary: null,
          key_findings: [],
          alerts: [],
          recommendations_client: null,
          sentiment_breakdown: null,
          top_topics: null,
          top_mentions: null,
        } as Analysis);
      }
      const merged = Array.from(byWeek.values()).sort((x, y) => y.week_start.localeCompare(x.week_start));
      setAnalyses(merged);
      if (merged.length > 0) setSelectedWeek(merged[0].week_start);

      if (merged.length === 0 && (r.data ?? []).length === 0) {
        const { data: access } = await supabase
          .from("client_access").select("id").eq("client_id", portal.clientId).limit(1);
        if (!access || access.length === 0) setDenied(true);
      }
      setLoading(false);
    })();
  }, [portal.clientId]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };

  const currentIdx = useMemo(
    () => analyses.findIndex(a => a.week_start === selectedWeek),
    [analyses, selectedWeek]
  );
  const current = currentIdx >= 0 ? analyses[currentIdx] : null;
  const prevWeek = currentIdx >= 0 && currentIdx < analyses.length - 1 ? analyses[currentIdx + 1] : null;

  const { fromDate, toDate } = useMemo(() => {
    if (customRange?.from && customRange?.to) {
      return {
        fromDate: customRange.from.toISOString().slice(0, 10),
        toDate: customRange.to.toISOString().slice(0, 10),
      };
    }
    if (!current) return { fromDate: "1900-01-01", toDate: "2999-12-31" };
    const weeks = COMPARE_OPTIONS.find(o => o.key === compareKey)?.weeks ?? 1;
    if (weeks === 1) return { fromDate: current.week_start, toDate: current.week_end };
    const end = new Date(current.week_end + "T00:00:00");
    const start = new Date(end); start.setDate(start.getDate() - 7 * weeks + 1);
    return { fromDate: start.toISOString().slice(0, 10), toDate: current.week_end };
  }, [current, compareKey, customRange]);

  const isExtendedPeriod = useMemo(() => {
    if (!current) return false;
    // Semanas sin reporte guardado (sintetizadas desde bitácoras nuevas)
    // se tratan como período a generar bajo demanda.
    if (String(current.id).startsWith("synthetic-")) return true;
    return fromDate !== current.week_start || toDate !== current.week_end;
  }, [current, fromDate, toDate]);

  const activePeriodKey = useMemo(
    () => `${portal.clientId}|${fromDate}|${toDate}`,
    [portal.clientId, fromDate, toDate]
  );

  // Clear stale period analysis when range changes
  useEffect(() => {
    if (periodAnalysisKey && periodAnalysisKey !== activePeriodKey) {
      setPeriodAnalysis(null);
      setPeriodAnalysisKey(null);
      setPeriodJobId(null);
    }
    if (periodCacheCheckedKey && periodCacheCheckedKey !== activePeriodKey) {
      setPeriodCacheCheckedKey(null);
    }
    if (periodAnalysisErrorKey && periodAnalysisErrorKey !== activePeriodKey) {
      setPeriodAnalysisErrorKey(null);
    }
  }, [activePeriodKey, periodAnalysisKey, periodAnalysisErrorKey, periodCacheCheckedKey]);

  const regeneratePeriod = async (silent = false) => {
    if (!isExtendedPeriod) return;
    let queuedJob = false;
    setRegenerating(true);
    setPeriodAnalysis(null);
    setPeriodJobId(null);
    if (!silent) toast.loading("Regenerando análisis del período…", { id: "regen" });
    try {
      const { data, error } = await supabase.functions.invoke("generate-listening-weekly-summary", {
        body: { client_id: portal.clientId, from_date: fromDate, to_date: toDate, persist: false, async: true },
      });
      if (error) throw error;
      if (data?.job_id) {
        queuedJob = true;
        setPeriodJobId(data.job_id);
        setPeriodAnalysisErrorKey(null);
        if (!silent) toast.loading("Análisis en proceso…", { id: "regen" });
      } else if (data?.analysis) {
        setPeriodAnalysis(data.analysis as Analysis);
        setPeriodAnalysisKey(activePeriodKey);
        setPeriodAnalysisErrorKey(null);
        if (!silent) toast.success("Análisis regenerado para el período", { id: "regen" });
      } else {
        throw new Error(data?.error ?? "Sin respuesta");
      }
    } catch (e: any) {
      setPeriodAnalysisErrorKey(activePeriodKey);
      setPeriodJobId(null);
      toast.error(e.message ?? "No se pudo regenerar", { id: "regen" });
    } finally {
      if (!queuedJob) setRegenerating(false);
    }
  };

  useEffect(() => {
    if (!periodJobId || !isExtendedPeriod) return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      const { data, error } = await supabase
        .from("client_portal_listening_analysis_jobs" as any)
        .select("status, result, error_message")
        .eq("id", periodJobId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setRegenerating(false);
        setPeriodAnalysisErrorKey(activePeriodKey);
        toast.error("No se pudo leer el recálculo", { id: "regen" });
        return;
      }

      const job = data as any;
      if (job?.status === "completed" && job.result?.analysis) {
        setPeriodAnalysis(job.result.analysis as Analysis);
        setPeriodAnalysisKey(activePeriodKey);
        setPeriodAnalysisErrorKey(null);
        setPeriodJobId(null);
        setRegenerating(false);
        toast.success("Análisis regenerado para el período", { id: "regen" });
        return;
      }

      if (job?.status === "failed") {
        setRegenerating(false);
        setPeriodJobId(null);
        setPeriodAnalysisErrorKey(activePeriodKey);
        toast.error(job.error_message ?? "No se pudo regenerar", { id: "regen" });
        return;
      }

      if (attempts >= 40) {
        setRegenerating(false);
        setPeriodAnalysisErrorKey(activePeriodKey);
        toast.error("El análisis tardó demasiado. Inténtalo de nuevo.", { id: "regen" });
        return;
      }

      window.setTimeout(poll, 2500);
    };

    const timer = window.setTimeout(poll, 1200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [periodJobId, isExtendedPeriod, activePeriodKey]);

  useEffect(() => {
    if (!isExtendedPeriod) return;
    if (periodAnalysisKey === activePeriodKey || periodCacheCheckedKey === activePeriodKey) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("client_portal_listening_analysis_jobs" as any)
          .select("result")
          .eq("client_id", portal.clientId)
          .eq("period_start", fromDate)
          .eq("period_end", toDate)
          .eq("status", "completed")
          .not("result", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        const cached = (data as any)?.result?.analysis;
        if (cached) {
          setPeriodAnalysis(cached as Analysis);
          setPeriodAnalysisKey(activePeriodKey);
          setPeriodAnalysisErrorKey(null);
          setPeriodJobId(null);
          setRegenerating(false);
        }
      } finally {
        if (!cancelled) setPeriodCacheCheckedKey(activePeriodKey);
      }
    })();

    return () => { cancelled = true; };
  }, [isExtendedPeriod, activePeriodKey, periodAnalysisKey, periodCacheCheckedKey, portal.clientId, fromDate, toDate]);

  useEffect(() => {
    if (!isExtendedPeriod || regenerating || periodJobId) return;
    if (periodCacheCheckedKey !== activePeriodKey) return;
    if (periodAnalysisKey === activePeriodKey || periodAnalysisErrorKey === activePeriodKey) return;
    regeneratePeriod(true);
  }, [isExtendedPeriod, regenerating, periodJobId, activePeriodKey, periodAnalysisKey, periodAnalysisErrorKey, periodCacheCheckedKey]);

  // Effective analysis for display: never show stale weekly text while an extended period is selected
  const effective: Analysis | null = isExtendedPeriod
    ? (periodAnalysisKey === activePeriodKey ? periodAnalysis : null)
    : current;

  // Aggregate real numbers directly from analyzed entries in the selected range
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("client_portal_listening_entries")
        .select("entry_date, total_mentions, sentiment_counts, sentiment")
        .eq("client_id", portal.clientId)
        .gte("entry_date", fromDate).lte("entry_date", toDate)
        .not("analyzed_at", "is", null)
        .limit(500);
      const rows = (data ?? []) as any[];
      const sent = { positivo: 0, neutral: 0, negativo: 0, crisis: 0 };
      let totalMentions = 0;
      for (const r of rows) {
        const tm = Number(r.total_mentions ?? 0) || 0;
        totalMentions += tm;
        const sc = r.sentiment_counts ?? {};
        const hasCounts = sc && (sc.positivo || sc.neutral || sc.negativo || sc.crisis);
        if (hasCounts) {
          sent.positivo += Number(sc.positivo ?? 0) || 0;
          sent.neutral  += Number(sc.neutral ?? 0)  || 0;
          sent.negativo += Number(sc.negativo ?? 0) || 0;
          sent.crisis   += Number(sc.crisis ?? 0)   || 0;
        } else if (r.sentiment) {
          // fallback: use daily overall sentiment weighted by total_mentions (or 1)
          const w = tm || 1;
          (sent as any)[r.sentiment] = ((sent as any)[r.sentiment] ?? 0) + w;
        }
      }
      setRangeAgg({ totalMentions, entriesInRange: rows.length, sent });

      // aggregates for PDF SVG charts
      const { data: rich } = await supabase
        .from("client_portal_listening_entries")
        .select("entry_date, sentiment, sentiment_score, sentiment_counts, total_mentions, channels, entities, events")
        .eq("client_id", portal.clientId)
        .gte("entry_date", fromDate).lte("entry_date", toDate)
        .not("analyzed_at", "is", null)
        .limit(500);
      const richRows = (rich ?? []) as any[];
      setRangeMilestones(buildMilestonesFromRows(richRows));
      const volMap = new Map<string, { date: string; positivo: number; neutral: number; negativo: number; crisis: number }>();
      const chanMap = new Map<string, number>();
      const entMap = new Map<string, number>();
      let scSum = 0, scN = 0, crisisEvts = 0;
      for (const r of richRows) {
        const row = volMap.get(r.entry_date) ?? { date: r.entry_date, positivo: 0, neutral: 0, negativo: 0, crisis: 0 };
        const sc = r.sentiment_counts ?? {};
        const has = sc && (sc.positivo || sc.neutral || sc.negativo || sc.crisis);
        if (has) {
          row.positivo += Number(sc.positivo ?? 0) || 0;
          row.neutral  += Number(sc.neutral ?? 0)  || 0;
          row.negativo += Number(sc.negativo ?? 0) || 0;
          row.crisis   += Number(sc.crisis ?? 0)   || 0;
        } else if (r.sentiment) {
          (row as any)[r.sentiment] += Number(r.total_mentions ?? 1) || 1;
        }
        volMap.set(r.entry_date, row);
        for (const ch of (r.channels ?? [])) {
          const raw = typeof ch === "string" ? ch : ch?.name; if (!raw) continue;
          const s = String(raw).toLowerCase().trim();
          const name =
            s === "x" || s.includes("twitter") ? "x" :
            s.startsWith("facebook") || s === "fb" ? "facebook" :
            s.startsWith("instagram") || s === "ig" ? "instagram" :
            s.startsWith("youtube") || s === "yt" ? "youtube" :
            s.startsWith("tiktok") ? "tiktok" :
            s.startsWith("reddit") ? "reddit" :
            s.startsWith("linkedin") ? "linkedin" :
            "medios digitales";
          const n = typeof ch?.count === "number" ? ch.count : 1;
          chanMap.set(name, (chanMap.get(name) ?? 0) + n);
        }
        for (const en of (r.entities ?? [])) {
          const name = typeof en === "string" ? en : en?.name; if (!name) continue;
          const n = typeof en?.count === "number" ? en.count : 1;
          entMap.set(name, (entMap.get(name) ?? 0) + n);
        }
        if (typeof r.sentiment_score === "number") { scSum += r.sentiment_score; scN++; }
        crisisEvts += ((r.events ?? []) as any[]).filter(e => e?.impact === "alto" || e?.kind === "crisis").length;
      }
      const avg = scN ? scSum / scN : 0;
      const raw = 50 + 50 * avg - Math.min(30, crisisEvts * 6);
      const score = Math.max(0, Math.min(100, Math.round(raw)));
      const label = score >= 75 ? "Saludable" : score >= 55 ? "Estable" : score >= 40 ? "En riesgo" : "Crítico";
      const color = score >= 75 ? "#10b981" : score >= 55 ? "#0ea5e9" : score >= 40 ? "#f59e0b" : "#ef4444";
      setPdfChartData({
        volumeByDay: Array.from(volMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
        topChannels: Array.from(chanMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6),
        topEntities: Array.from(mergeNameCounts(entMap).entries())
          .map(([name, size]) => ({ name, size }))
          .sort((a, b) => b.size - a.size)
          .slice(0, 12),
        reputation: { score, label, color },
      });

      // previous equivalent range for delta
      const from = new Date(fromDate + "T00:00:00");
      const to = new Date(toDate + "T00:00:00");
      const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days + 1);
      const { data: prev } = await supabase
        .from("client_portal_listening_entries")
        .select("total_mentions")
        .eq("client_id", portal.clientId)
        .gte("entry_date", prevFrom.toISOString().slice(0, 10))
        .lte("entry_date", prevTo.toISOString().slice(0, 10))
        .not("analyzed_at", "is", null);
      const prevTotal = ((prev ?? []) as any[]).reduce((s, r) => s + (Number(r.total_mentions ?? 0) || 0), 0);
      setPrevRangeAgg({ totalMentions: prevTotal });
    })();
  }, [portal.clientId, fromDate, toDate]);

  const weekLabel = current ? fmtWeekShort(current.week_start, current.week_end) : "";
  const periodLabel = useMemo(() => {
    if (!fromDate || !toDate) return weekLabel;
    return fmtWeekShort(fromDate, toDate);
  }, [fromDate, toDate, weekLabel]);

  const sentTotals = useMemo(() => {
    const s = rangeAgg.sent;
    const total = s.positivo + s.neutral + s.negativo + s.crisis;
    return { total, ...s };
  }, [rangeAgg]);

  const displayExecutiveSummary = useMemo(() => {
    const summary = effective?.executive_summary ?? "";
    const contradictsCounts = /no se detectaron|volumen nulo|silencio digital|sin actividad relevante/i.test(summary);
    if (!effective || !contradictsCounts || rangeAgg.totalMentions <= 0) return summary;

    const posPct = sentTotals.total ? Math.round((sentTotals.positivo / sentTotals.total) * 100) : null;
    const negPct = sentTotals.total ? Math.round((sentTotals.negativo / sentTotals.total) * 100) : null;
    const crisisPct = sentTotals.total ? Math.round((sentTotals.crisis / sentTotals.total) * 100) : null;
    const sentimentLine = posPct !== null
      ? `El balance de sentimiento fue ${posPct}% positivo, ${negPct}% negativo y ${crisisPct}% crisis, calculado directamente desde la bitácora procesada.`
      : "El balance de sentimiento se muestra en las tarjetas y gráficas a partir de la bitácora procesada.";

    return `Durante ${periodLabel}, se analizaron ${rangeAgg.totalMentions} menciones detectadas en el monitoreo. ${sentimentLine} Las gráficas de esta vista son la fuente operativa para volumen, canales, entidades y evolución del período.`;
  }, [effective, rangeAgg.totalMentions, sentTotals, periodLabel]);

  const pdfAnalysis = useMemo(() => {
    if (!effective) return null;
    // Conteos deterministas: siempre desde la bitácora procesada, no desde el texto del modelo.
    const deterministicMentions = (pdfChartData?.topEntities ?? [])
      .slice(0, 8)
      .map(e => ({ name: e.name, count: e.size }));
    return {
      ...effective,
      executive_summary: displayExecutiveSummary,
      entries_count: rangeAgg.totalMentions || effective.entries_count,
      top_mentions: deterministicMentions.length ? deterministicMentions : (effective as any).top_mentions,
      sentiment_breakdown: sentTotals.total ? {
        positivo: sentTotals.positivo,
        neutral: sentTotals.neutral,
        negativo: sentTotals.negativo,
        crisis: sentTotals.crisis,
      } : effective.sentiment_breakdown,
    };
  }, [effective, displayExecutiveSummary, rangeAgg.totalMentions, sentTotals, pdfChartData]);

  const deltaMentions = useMemo(() => {
    if (!prevRangeAgg) return null;
    const d = rangeAgg.totalMentions - prevRangeAgg.totalMentions;
    const pct = prevRangeAgg.totalMentions ? Math.round((d / prevRangeAgg.totalMentions) * 100) : null;
    return { d, pct };
  }, [rangeAgg, prevRangeAgg]);

  const goPrev = () => { if (currentIdx < analyses.length - 1) setSelectedWeek(analyses[currentIdx + 1].week_start); };
  const goNext = () => { if (currentIdx > 0) setSelectedWeek(analyses[currentIdx - 1].week_start); };

  const downloadPdf = async () => {
    if (!pdfRef.current) return;
    const { default: html2pdf } = await import("html2pdf.js");
    toast.loading("Generando PDF...", { id: "pdf" });
    try {
      await html2pdf().set({
        margin: [10, 0, 12, 0],
        filename: `${portal.slug}-${current?.week_start ?? "reporte"}.pdf`,
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 794, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".pdf-avoid", "svg"] },
      } as any).from(pdfRef.current).save();
      toast.success("PDF descargado", { id: "pdf" });
    } catch {
      toast.error("No se pudo generar el PDF", { id: "pdf" });
    }
  };

  const initials = portal.displayName.slice(0, 2).toUpperCase();

  if (denied) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass rounded-xl p-10 text-center space-y-3 max-w-md">
          <ShieldAlert className="w-10 h-10 text-coral mx-auto" />
          <h2 className="text-lg font-semibold">Tu cuenta no tiene acceso a este portal</h2>
          <p className="text-sm text-muted-foreground">Solicita a KiMedia que habilite tu correo.</p>
          <Button size="sm" variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Salir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-mesh opacity-30 pointer-events-none" />

      {/* Header */}
      <header className="relative border-b border-border/50 bg-background/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-coral/20 to-coral/5 border border-coral/20 flex items-center justify-center shrink-0 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={portal.displayName} className="w-full h-full object-contain p-1.5" />
              ) : (
                <span className="font-display font-bold text-coral text-sm">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Inteligencia digital</div>
              <h1 className="text-lg font-display font-bold truncate leading-tight">{portal.displayName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!(portalModules.benchmark_funcionarios || portalModules.benchmark_instituciones) && (
              <Button variant="outline" size="sm" onClick={downloadPdf} disabled={!current}>
                <Download className="w-4 h-4 mr-2" /> PDF de la semana
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Cambiar tema" className="h-9 w-9">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-6 py-6 space-y-6">
        {isGabinete && (
          <PortalFreshnessBar clientId={portal.clientId} canEdit={role === "admin"} />
        )}

        {/* Week bar (listening scope: only for Panorama/Histórico) */}
        {analyses.length > 0 && activeTab !== "inicio" && activeTab !== "benchmark" && activeTab !== "benchmark_funcionarios" && activeTab !== "benchmark_instituciones" && activeTab !== "estrategia" && activeTab !== "prensa" && activeTab !== "descargas" && (
        <div className="glass rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goPrev} disabled={currentIdx >= analyses.length - 1} className="h-9 w-9">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-[220px]">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Semana analizada</div>
              <div className="text-base font-semibold font-display leading-tight">{current ? weekLabel : "—"}</div>
            </div>
            <Button variant="outline" size="icon" onClick={goNext} disabled={currentIdx <= 0} className="h-9 w-9">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Select value={selectedWeek ?? ""} onValueChange={(v) => setSelectedWeek(v)} disabled={analyses.length === 0}>
              <SelectTrigger className="w-[240px] h-9"><SelectValue placeholder="Elige semana" /></SelectTrigger>
              <SelectContent>
                {analyses.map(a => (
                  <SelectItem key={a.id} value={a.week_start}>
                    {fmtWeekShort(a.week_start, a.week_end)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={compareKey} onValueChange={(v) => { setCompareKey(v); setCustomRange(undefined); }} disabled={!!customRange?.from && !!customRange?.to}>
              <SelectTrigger className="w-[190px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPARE_OPTIONS.map(o => (
                  <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={customRange?.from && customRange?.to ? "default" : "outline"}
                  size="sm"
                  className="h-9"
                >
                  <CalendarRange className="w-4 h-4 mr-2" />
                  {customRange?.from && customRange?.to
                    ? `${customRange.from.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${customRange.to.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`
                    : "Rango personalizado"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={setCustomRange}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
                {customRange?.from && (
                  <div className="p-2 border-t border-border flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setCustomRange(undefined)}>
                      <X className="w-3 h-3 mr-1" /> Limpiar
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : analyses.length === 0 && !portalModules.press_daily ? (
          <div className="glass rounded-2xl p-14 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-coral mx-auto" />
            <h3 className="font-semibold">Aún no hay análisis publicado</h3>
            <p className="text-sm text-muted-foreground">El equipo KiMedia procesará las próximas entradas y aparecerán aquí.</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedWeek}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* KPI cards (listening scope) */}
              {analyses.length > 0 && activeTab !== "inicio" && activeTab !== "benchmark" && activeTab !== "benchmark_funcionarios" && activeTab !== "benchmark_instituciones" && activeTab !== "estrategia" && activeTab !== "prensa" && activeTab !== "descargas" && (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <KpiCard
                  label="Menciones analizadas"
                  value={rangeAgg.totalMentions || rangeAgg.entriesInRange || 0}
                  delta={deltaMentions ? `${deltaMentions.d > 0 ? "+" : ""}${deltaMentions.d}${deltaMentions.pct !== null ? ` (${deltaMentions.pct > 0 ? "+" : ""}${deltaMentions.pct}%)` : ""}` : null}
                  positive={deltaMentions ? deltaMentions.d >= 0 : undefined}
                />
                <KpiCard
                  label="Sentimiento positivo"
                  value={sentTotals.total ? `${Math.round((sentTotals.positivo / sentTotals.total) * 100)}%` : "—"}
                  accent="emerald"
                />
                <KpiCard
                  label="Sentimiento negativo"
                  value={sentTotals.total ? `${Math.round((sentTotals.negativo / sentTotals.total) * 100)}%` : "—"}
                  accent="amber"
                />
                <KpiCard
                  label="Alertas de crisis"
                  value={sentTotals.crisis}
                  accent="rose"
                />
              </div>
              )}

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-background/50 backdrop-blur border border-border/60 rounded-xl p-1 h-auto flex-wrap">
                  {isGabinete && (
                    <TabsTrigger value="inicio" className="rounded-lg data-[state=active]:bg-coral/10 data-[state=active]:text-coral"><Home className="w-4 h-4 mr-2" />Inicio</TabsTrigger>
                  )}
                  <TabsTrigger value="panorama" className="rounded-lg data-[state=active]:bg-coral/10 data-[state=active]:text-coral"><BarChart3 className="w-4 h-4 mr-2" />Panorama</TabsTrigger>
                  <TabsTrigger value="benchmark" className="rounded-lg data-[state=active]:bg-coral/10 data-[state=active]:text-coral"><TrendingUp className="w-4 h-4 mr-2" />Benchmark</TabsTrigger>
                  <TabsTrigger value="estrategia" className="rounded-lg data-[state=active]:bg-coral/10 data-[state=active]:text-coral"><Compass className="w-4 h-4 mr-2" />Estrategia</TabsTrigger>
                  <TabsTrigger value="historico" className="rounded-lg data-[state=active]:bg-coral/10 data-[state=active]:text-coral"><History className="w-4 h-4 mr-2" />Histórico</TabsTrigger>
                  {(portalModules.benchmark_funcionarios || portalModules.benchmark_instituciones) && (
                    <TabsTrigger value="descargas" className="rounded-lg data-[state=active]:bg-coral/10 data-[state=active]:text-coral"><Download className="w-4 h-4 mr-2" />Descargas</TabsTrigger>
                  )}
                  {canSeeBigPicture && (
                    <TabsTrigger value="bigpicture" className="rounded-lg data-[state=active]:bg-coral/10 data-[state=active]:text-coral"><Compass className="w-4 h-4 mr-2" />Big Picture</TabsTrigger>
                  )}
                </TabsList>

                {canSeeBigPicture && (
                  <TabsContent value="bigpicture" className="mt-5">
                    <PortalBigPicture clientId={portal.clientId} titulo={portal.displayName} />
                  </TabsContent>
                )}

                {isGabinete && (
                  <TabsContent value="inicio" className="mt-5 space-y-4">
                    <PortalBriefing
                      clientId={portal.clientId}
                      focusDepId={focusDepId}
                      onFocusChange={setFocusDepId}
                      onGoTo={setActiveTab}
                    />
                  </TabsContent>
                )}

                {/* Panorama: resumen ejecutivo + alertas + hallazgos + análisis en un solo tab */}
                <TabsContent value="panorama" className="mt-5 space-y-5">
                  {isExtendedPeriod && (
                    <div className="glass rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 border border-coral/30 bg-coral/5">
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] uppercase tracking-widest text-coral font-semibold">Período ampliado</div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {periodAnalysis
                            ? <>Mostrando análisis y recomendaciones regenerados para <b className="text-foreground">{periodLabel}</b>.</>
                            : regenerating
                              ? <>Recalculando resumen, hallazgos y recomendaciones para <b className="text-foreground">{periodLabel}</b>.</>
                              : <>No se pudo recalcular automáticamente. Puedes intentarlo de nuevo para cubrir <b className="text-foreground">{periodLabel}</b>.</>}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => regeneratePeriod(false)} disabled={regenerating} className="shrink-0">
                        <RefreshCw className={`w-4 h-4 mr-2 ${regenerating ? "animate-spin" : ""}`} />
                        {periodAnalysis ? "Regenerar de nuevo" : "Regenerar para el período"}
                      </Button>
                    </div>
                  )}

                  {displayExecutiveSummary && (
                    <div className="glass rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-coral" />
                        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Resumen ejecutivo</span>
                      </div>
                      <p className="text-[15px] leading-relaxed">{displayExecutiveSummary}</p>
                      <p className="text-[11px] text-muted-foreground mt-3 italic">
                        Nota: los conteos y gráficas de abajo son la fuente de verdad — reflejan cada mención individual detectada en la bitácora.
                      </p>
                    </div>
                  )}

                  {isExtendedPeriod && !periodAnalysis && (
                    <div className="glass rounded-2xl p-6 border border-coral/20 bg-coral/5">
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className={`w-4 h-4 text-coral ${regenerating ? "animate-spin" : ""}`} />
                        <span className="text-[11px] uppercase tracking-widest text-coral font-semibold">Análisis contextual en proceso</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Las métricas y gráficas ya reflejan <b className="text-foreground">{periodLabel}</b>. El resumen, hallazgos y recomendaciones se mostrarán aquí únicamente cuando estén recalculados para ese mismo período.
                      </p>
                    </div>
                  )}

                  {/* Gráficas primero para dar contexto visual */}
                  <div className="pt-2">
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Panorama del período</div>
                    <PortalAnalysis clientId={portal.clientId} fromDate={fromDate} toDate={toDate} mode={portalModules.press_daily ? "press" : "social"} />
                  </div>

                  {(() => {
                    const computedAlerts = rangeMilestones.slice(0, 6);
                    const items = computedAlerts.length
                      ? computedAlerts.map((m, i) => ({
                          label: `H${i + 1}`,
                          detail: m.detail || m.title || m.kind,
                          title: m.title || m.kind,
                        }))
                      : (effective?.alerts ?? []).map((a: any) => ({
                          label: a.level ?? "alerta",
                          detail: a.detail ?? a.summary ?? String(a),
                          title: "",
                        }));
                    if (!items.length) return null;
                    return (
                    <div className="space-y-2">
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Hitos del período</div>
                      <div className="grid gap-2">
                      {items.map((a: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/30">
                          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="destructive" className="text-[10px] uppercase">{a.label}</Badge>
                              {a.title && <span className="text-sm font-semibold">{a.title}</span>}
                            </div>
                            <p className="text-sm">{a.detail}</p>
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                    );
                  })()}

                  {effective?.key_findings && effective.key_findings.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Hallazgos clave</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {effective.key_findings.map((f: any, i: number) => (
                          <div key={i} className="glass rounded-xl p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <TrendingUp className="w-4 h-4 text-coral shrink-0" />
                                <span className="text-sm font-semibold truncate">{f.title ?? f.headline}</span>
                              </div>
                              {f.impact && <Badge variant="outline" className="text-[10px] shrink-0">{f.impact}</Badge>}
                            </div>
                            {f.detail && <p className="text-xs text-muted-foreground leading-relaxed">{f.detail}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recomendaciones al cierre del análisis */}
                  {effective?.recommendations_client && (
                    <RecommendationsBlock markdown={effective.recommendations_client} weekLabel={periodAnalysis ? periodLabel : weekLabel} />
                  )}
                </TabsContent>

                {/* Benchmark: vista unificada por dependencia (secretaría + titular) */}
                <TabsContent value="benchmark" className="mt-5 space-y-4">
                  {portalModules.benchmark_funcionarios || portalModules.benchmark_instituciones ? (
                    <PortalBenchmark clientId={portal.clientId} clientName={portal.displayName} groupBy="dependencia" />
                  ) : (
                    <PortalBenchmark clientId={portal.clientId} clientName={portal.displayName} />
                  )}
                </TabsContent>

                {/* Estrategia (Listening x Benchmark) */}
                <TabsContent value="estrategia" className="mt-5 space-y-4">
                  <PortalStrategy clientId={portal.clientId} clientName={portal.displayName} />
                </TabsContent>

                {/* Centro de descargas (portales por dependencia) */}
                {(portalModules.benchmark_funcionarios || portalModules.benchmark_instituciones) && (
                  <TabsContent value="descargas" className="mt-5 space-y-4">
                    <PortalDescargas clientId={portal.clientId} portalName={portal.displayName} />
                  </TabsContent>
                )}

                {/* Histórico */}
                <TabsContent value="historico" className="mt-5 space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Semanas anteriores</div>
                    <div className="grid gap-2">
                      {analyses.map((a, i) => (
                        <button
                          key={a.id}
                          onClick={() => setSelectedWeek(a.week_start)}
                          className={`text-left glass hover:glass-strong rounded-xl p-4 transition-all group border ${a.week_start === selectedWeek ? "border-coral/50 bg-coral/5" : "border-transparent"}`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold">{fmtWeekShort(a.week_start, a.week_end)}</span>
                                <Badge variant="secondary" className="text-[10px]"><MessageCircle className="w-3 h-3 mr-1" />{a.entries_count}</Badge>
                                {i === 0 && <Badge className="text-[10px] bg-coral/15 text-coral border-coral/30">Última</Badge>}
                              </div>
                              {a.executive_summary && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{a.executive_summary}</p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-coral shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {reports.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3 mt-6">Reportes publicados</div>
                      <div className="grid gap-2">
                        {reports.map(r => (
                          <Link key={r.id} to={`/reporte/${r.id}`} className="block glass hover:glass-strong rounded-xl p-4 transition-all group">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-muted-foreground group-hover:text-coral" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold truncate group-hover:text-coral transition-colors">{r.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {fmtDate(r.report_date)} · {TYPE_LABEL[r.type] ?? r.type}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Hidden PDF template */}
        <div className="fixed -left-[10000px] top-0" aria-hidden>
          <PortalPdfTemplate ref={pdfRef} portal={portal} logoUrl={logoUrl} analysis={pdfAnalysis} weekLabel={weekLabel} charts={pdfChartData} />
        </div>
      </main>

      <footer className="relative py-8 text-center text-xs text-muted-foreground/60">
        powered by KiMedia
      </footer>
    </div>
  );
}

function KpiCard({
  label, value, delta, positive, accent = "coral",
}: {
  label: string; value: React.ReactNode; delta?: string | null; positive?: boolean;
  accent?: "coral" | "emerald" | "amber" | "rose";
}) {
  const accentClass = {
    coral: "text-coral",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
  }[accent];
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-3xl font-display font-bold mt-1 ${accentClass}`}>{value}</div>
      {delta && (
        <div className={`text-[11px] mt-1 ${positive === undefined ? "text-muted-foreground" : positive ? "text-emerald-500" : "text-rose-500"}`}>
          {delta} vs semana previa
        </div>
      )}
    </div>
  );
}