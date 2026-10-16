import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FKProfile, FKProfileKPI, FKDailyTopPost } from "./useFanpageKarma";

type FKProfileExt = FKProfile & { is_competitor?: boolean };
import { getFKProfileDisplayName } from "@/lib/fkProfileUtils";

export type PerformanceReportMode = "brand" | "benchmark" | "comparative";

export interface PerformanceReportHighlight {
  label: string;
  value: string;
  context: string;
}

export interface PerformanceReportAnalytics {
  networks: string[];
  avgEngagement: number;
  avgGrowth: number;
  totalFollowers: number;
  /** Promedio universal de interacciones absolutas por publicación (todo el set) */
  avgInteractionsPerPost: number;
  bestPerformer: { name: string; network: string; engagement: number; avgInteractionsPerPost: number } | null;
  fastestGrower: { name: string; network: string; growth: number } | null;
  shareOfVoice: Array<{ name: string; network: string; isOwn: boolean; engagementShare: number; followersShare: number; interactionsShare: number }>;
  /** Ranking por interacciones promedio por post (no por tasa %) — name = nombre limpio sin sufijo de red */
  rankingByEngagement: Array<{ name: string; network: string; engagement: number; avgInteractionsPerPost: number; postsCount: number; isOwn: boolean; hasData: boolean }>;
  /** Engagement promedio + interacciones absolutas agregadas por marca (todas sus redes) */
  brandEngagement: Array<{ brand: string; isOwn: boolean; avgEngagement: number; totalInteractions: number; avgInteractionsPerPost: number; postsCount: number; profiles: number; followers: number; networks: string[] }>;
  /** Crecimiento promedio agregado por red social */
  networkGrowth: Array<{ network: string; avgGrowth: number; profiles: number }>;
  /** Engagement (interacciones promedio por post) por red social */
  networkEngagement: Array<{ network: string; avgInteractionsPerPost: number; totalInteractions: number; postsCount: number; profiles: number }>;
  /** Interacciones absolutas (likes+comments+shares de top posts) sumadas por red social */
  networkInteractions: Array<{ network: string; totalInteractions: number; profiles: number }>;
  /** Followers ordenados por perfil (top N) — name = nombre limpio */
  followersByProfile: Array<{ name: string; network: string; followers: number; isOwn: boolean }>;
  /** Brecha vs líder para la marca propia (en interacciones promedio por post) */
  ownBrandGap: { ownAvg: number; leaderName: string; leaderAvg: number; multiple: number } | null;
}

export interface PerformanceTopPostSnapshot {
  authorName: string;
  network: string;
  postDate: string;
  postContent: string | null;
  postUrl: string | null;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

export interface PerformanceProfileSnapshot {
  id: string;
  name: string;
  network: string;
  isCompetitor: boolean;
  followers: number | null;
  growthPercent: number | null;
  engagementRate: number | null;
  postsPerDay: number | null;
  performanceIndex: number | null;
}

export interface PerformanceReportContent {
  title: string;
  summary: string;
  highlights: PerformanceReportHighlight[];
  keyFindings: string[];
  recommendations: string[];
  topContentInsight: string;
  competitiveInsight: string;
  /** Lectura contextual debajo del ranking de engagement */
  rankingInsight?: string;
  /** Lectura contextual debajo del share of voice */
  sovInsight?: string;
  /** Lectura contextual debajo de la tabla de perfiles */
  profilesInsight?: string;
  conclusion: string;
  reportMode: PerformanceReportMode;
  clientName: string;
  brandName?: string;
  analytics: PerformanceReportAnalytics;
  profiles: PerformanceProfileSnapshot[];
  topPosts: PerformanceTopPostSnapshot[];
}

export interface PerformanceReportConfig {
  reportMode: PerformanceReportMode;
  clientName: string;
  brandName?: string;
  strategicFocus?: string;
  dateRange: { start: string; end: string; label: string };
}

function pct(value: number): number {
  return Math.round(value * 100) / 100;
}

// Quita sufijos tipo "_FB", "_IG", "- YT", "(Twitter)" de display_name
const NETWORK_SUFFIX_RE = /[\s_\-·|]+\(?(fb|facebook|ig|instagram|tw|twitter|x|yt|youtube|tt|tiktok|li|linkedin|th|threads)\)?\s*$/i;
function cleanProfileName(name: string): string {
  let out = String(name || "").trim();
  for (let i = 0; i < 3; i += 1) {
    const replaced = out.replace(NETWORK_SUFFIX_RE, "").trim();
    if (replaced === out) break;
    out = replaced;
  }
  return out || String(name || "").trim();
}

// Tokens descartables al canonicalizar marca: variantes geográficas y descriptores comunes
const BRAND_NOISE_TOKENS = new Set([
  "mx", "mex", "mexico", "latam", "latinoamerica",
  "oficial", "official", "es", "espanol", "spanish", "english",
  "analisis", "noticias", "news",
  "grupo", "financiero", "banco", "casa", "bolsa",
]);

/**
 * Canonicaliza una marca para agrupar variantes:
 *   "Santander Mex", "Santander Mexico", "Santander México" → "santander"
 *   "Grupo Financiero Actinver", "Actinver" → "actinver"
 *   "Monex", "Monex Análisis" → "monex"
 */
function canonicalBrandKey(rawName: string): string {
  const cleaned = cleanProfileName(rawName)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned.split(" ").filter((t) => t && !BRAND_NOISE_TOKENS.has(t));
  return (tokens.length > 0 ? tokens.join(" ") : cleaned).trim();
}

function brandKeyFromProfile(p: FKProfileExt): string {
  return canonicalBrandKey(getFKProfileDisplayName(p));
}

// Elige el display name más representativo para un grupo de variantes
function pickBrandDisplay(variants: string[]): string {
  const counts = new Map<string, number>();
  for (const v of variants) counts.set(v, (counts.get(v) ?? 0) + 1);
  // ordena por frecuencia desc, luego por longitud asc (más corto = más limpio)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
}

function computeAnalytics(
  profiles: FKProfileExt[],
  kpis: FKProfileKPI[],
  topPosts: FKDailyTopPost[] = [],
): PerformanceReportAnalytics {
  const networks = Array.from(new Set(profiles.map((p) => p.network)));

  const validEng = kpis
    .map((k) => Number(k.engagement_rate))
    .filter((v) => Number.isFinite(v) && v > 0);
  const validGrowth = kpis
    .map((k) => Number(k.follower_growth_percent))
    .filter((v) => Number.isFinite(v));
  const totalFollowers = kpis.reduce(
    (s, k) => s + (Number(k.followers) > 0 ? Number(k.followers) : 0),
    0,
  );

  const avgEngagement = validEng.length
    ? pct(validEng.reduce((s, v) => s + v, 0) / validEng.length)
    : 0;
  const avgGrowth = validGrowth.length
    ? pct(validGrowth.reduce((s, v) => s + v, 0) / validGrowth.length)
    : 0;

  // ── Interacciones absolutas + posts por perfil (a partir de topPosts del periodo) ──
  // Esta es la métrica universal que reemplaza al engagement_rate %
  const profileInter = new Map<string, { total: number; posts: number }>();
  for (const tp of topPosts) {
    const eng = Number(tp.engagement);
    if (!Number.isFinite(eng) || eng <= 0) continue;
    if (!profileInter.has(tp.fk_profile_id)) profileInter.set(tp.fk_profile_id, { total: 0, posts: 0 });
    const slot = profileInter.get(tp.fk_profile_id)!;
    slot.total += eng;
    slot.posts += 1;
  }
  const avgInteractionsPerPost = (() => {
    let total = 0;
    let posts = 0;
    profileInter.forEach((v) => {
      total += v.total;
      posts += v.posts;
    });
    return posts > 0 ? Math.round(total / posts) : 0;
  })();

  // Best performer = mayor interacciones promedio por post
  let bestPerformer: PerformanceReportAnalytics["bestPerformer"] = null;
  let fastestGrower: PerformanceReportAnalytics["fastestGrower"] = null;
  let bestAvgInter = -Infinity;
  let bestGrowth = -Infinity;

  for (const p of profiles) {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    const inter = profileInter.get(p.id);
    const avgInter = inter && inter.posts > 0 ? inter.total / inter.posts : 0;
    const gr = Number(k?.follower_growth_percent);
    const name = cleanProfileName(getFKProfileDisplayName(p));
    if (avgInter > bestAvgInter && avgInter > 0) {
      bestAvgInter = avgInter;
      bestPerformer = { name, network: p.network, engagement: pct(Number(k?.engagement_rate) || 0), avgInteractionsPerPost: Math.round(avgInter) };
    }
    if (Number.isFinite(gr) && gr > bestGrowth) {
      bestGrowth = gr;
      fastestGrower = { name, network: p.network, growth: pct(gr) };
    }
  }

  // Share of voice (interacciones absolutas)
  const totalInterAll = Array.from(profileInter.values()).reduce((s, v) => s + v.total, 0) || 1;
  const totalFollowersForShare = totalFollowers || 1;

  const shareOfVoice = profiles.map((p) => {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    const inter = profileInter.get(p.id);
    const fol = Number(k?.followers);
    const interTotal = inter?.total ?? 0;
    return {
      name: cleanProfileName(getFKProfileDisplayName(p)),
      network: p.network,
      isOwn: !p.is_competitor,
      engagementShare: pct((interTotal / totalInterAll) * 100),
      interactionsShare: pct((interTotal / totalInterAll) * 100),
      followersShare: pct(((Number.isFinite(fol) && fol > 0 ? fol : 0) / totalFollowersForShare) * 100),
    };
  });

  // Ranking por interacciones promedio por post
  const rankingByEngagement = profiles
    .map((p) => {
      const k = kpis.find((kp) => kp.fk_profile_id === p.id);
      const inter = profileInter.get(p.id);
      const avgInter = inter && inter.posts > 0 ? Math.round(inter.total / inter.posts) : 0;
      const hasData = avgInter > 0;
      return {
        name: cleanProfileName(getFKProfileDisplayName(p)),
        network: p.network,
        engagement: pct(Number(k?.engagement_rate) || 0),
        avgInteractionsPerPost: avgInter,
        postsCount: inter?.posts ?? 0,
        isOwn: !p.is_competitor,
        hasData,
      };
    })
    .sort((a, b) => {
      if (a.hasData && !b.hasData) return -1;
      if (!a.hasData && b.hasData) return 1;
      return b.avgInteractionsPerPost - a.avgInteractionsPerPost;
    });

  // ── Brand-level aggregation (canonicalizada para colapsar variantes Mex/México/etc) ──
  const brandMap = new Map<string, { isOwn: boolean; displayVariants: string[]; engs: number[]; engsAbs: number; postsCount: number; followers: number; profiles: number; networks: Set<string> }>();
  for (const p of profiles) {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    const brandKey = brandKeyFromProfile(p);
    const displayVariant = cleanProfileName(getFKProfileDisplayName(p));
    const eng = Number(k?.engagement_rate);
    const fol = Number(k?.followers);
    if (!brandMap.has(brandKey)) {
      brandMap.set(brandKey, { isOwn: !p.is_competitor, displayVariants: [], engs: [], engsAbs: 0, postsCount: 0, followers: 0, profiles: 0, networks: new Set() });
    }
    const slot = brandMap.get(brandKey)!;
    // Si cualquiera de las variantes es propia, la marca es propia
    if (!p.is_competitor) slot.isOwn = true;
    slot.displayVariants.push(displayVariant);
    slot.profiles += 1;
    slot.networks.add(p.network);
    if (Number.isFinite(eng) && eng > 0) slot.engs.push(eng);
    if (Number.isFinite(fol) && fol > 0) slot.followers += fol;
    const inter = profileInter.get(p.id);
    if (inter) {
      slot.engsAbs += inter.total;
      slot.postsCount += inter.posts;
    }
  }
  const brandEngagement = Array.from(brandMap.entries())
    .map(([, v]) => ({
      brand: pickBrandDisplay(v.displayVariants),
      isOwn: v.isOwn,
      avgEngagement: v.engs.length ? pct(v.engs.reduce((s, e) => s + e, 0) / v.engs.length) : 0,
      totalInteractions: Math.round(v.engsAbs),
      avgInteractionsPerPost: v.postsCount > 0 ? Math.round(v.engsAbs / v.postsCount) : 0,
      postsCount: v.postsCount,
      profiles: v.profiles,
      followers: v.followers,
      networks: Array.from(v.networks),
    }))
    .sort((a, b) => b.avgInteractionsPerPost - a.avgInteractionsPerPost || b.totalInteractions - a.totalInteractions);

  // ── Network-level aggregation ──
  const netGrowthMap = new Map<string, number[]>();
  const netInterAgg = new Map<string, { total: number; posts: number; profiles: Set<string> }>();
  for (const p of profiles) {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    const gr = Number(k?.follower_growth_percent);
    if (Number.isFinite(gr)) {
      if (!netGrowthMap.has(p.network)) netGrowthMap.set(p.network, []);
      netGrowthMap.get(p.network)!.push(gr);
    }
    const inter = profileInter.get(p.id);
    if (!netInterAgg.has(p.network)) netInterAgg.set(p.network, { total: 0, posts: 0, profiles: new Set() });
    const slot = netInterAgg.get(p.network)!;
    if (inter) {
      slot.total += inter.total;
      slot.posts += inter.posts;
    }
    slot.profiles.add(p.id);
  }
  const networkGrowth = Array.from(netGrowthMap.entries())
    .map(([network, arr]) => ({
      network,
      avgGrowth: pct(arr.reduce((s, v) => s + v, 0) / arr.length),
      profiles: arr.length,
    }))
    .sort((a, b) => b.avgGrowth - a.avgGrowth);
  const networkEngagement = Array.from(netInterAgg.entries())
    .map(([network, v]) => ({
      network,
      avgInteractionsPerPost: v.posts > 0 ? Math.round(v.total / v.posts) : 0,
      totalInteractions: Math.round(v.total),
      postsCount: v.posts,
      profiles: v.profiles.size,
    }))
    .filter((x) => x.avgInteractionsPerPost > 0)
    .sort((a, b) => b.avgInteractionsPerPost - a.avgInteractionsPerPost);

  // ── Interacciones absolutas por red social ──
  const networkInteractions = Array.from(netInterAgg.entries())
    .map(([network, v]) => ({
      network,
      totalInteractions: Math.round(v.total),
      profiles: v.profiles.size,
    }))
    .filter((x) => x.totalInteractions > 0)
    .sort((a, b) => b.totalInteractions - a.totalInteractions);

  // ── Followers por perfil ──
  const followersByProfile = profiles
    .map((p) => {
      const k = kpis.find((kp) => kp.fk_profile_id === p.id);
      const fol = Number(k?.followers);
      return {
        name: cleanProfileName(getFKProfileDisplayName(p)),
        network: p.network,
        followers: Number.isFinite(fol) && fol > 0 ? fol : 0,
        isOwn: !p.is_competitor,
      };
    })
    .filter((x) => x.followers > 0)
    .sort((a, b) => b.followers - a.followers);

  // ── Own brand gap (en interacciones promedio por post) ──
  let ownBrandGap: PerformanceReportAnalytics["ownBrandGap"] = null;
  const own = brandEngagement.find((b) => b.isOwn && b.avgInteractionsPerPost > 0);
  const leader = brandEngagement.find((b) => !b.isOwn && b.avgInteractionsPerPost > 0);
  if (own && leader) {
    ownBrandGap = {
      ownAvg: own.avgInteractionsPerPost,
      leaderName: leader.brand,
      leaderAvg: leader.avgInteractionsPerPost,
      multiple: own.avgInteractionsPerPost > 0 ? Math.round((leader.avgInteractionsPerPost / own.avgInteractionsPerPost) * 10) / 10 : 0,
    };
  }

  return {
    networks,
    avgEngagement,
    avgGrowth,
    totalFollowers,
    avgInteractionsPerPost,
    bestPerformer,
    fastestGrower,
    shareOfVoice,
    rankingByEngagement,
    brandEngagement,
    networkGrowth,
    networkEngagement,
    networkInteractions,
    followersByProfile,
    ownBrandGap,
  };
}

function buildSnapshots(
  profiles: FKProfileExt[],
  kpis: FKProfileKPI[],
  topPosts: FKDailyTopPost[],
): { profiles: PerformanceProfileSnapshot[]; topPosts: PerformanceTopPostSnapshot[] } {
  const profileSnapshots: PerformanceProfileSnapshot[] = profiles.map((p) => {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    return {
      id: p.id,
      name: getFKProfileDisplayName(p),
      network: p.network,
      isCompetitor: !!p.is_competitor,
      followers: k?.followers ?? null,
      growthPercent: k?.follower_growth_percent ?? null,
      engagementRate: k?.engagement_rate ?? null,
      postsPerDay: k?.posts_per_day ?? null,
      performanceIndex: k?.page_performance_index ?? null,
    };
  });

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const topPostSnapshots: PerformanceTopPostSnapshot[] = [...topPosts]
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, 10)
    .map((tp) => {
      const profile = profileById.get(tp.fk_profile_id);
      return {
        authorName: profile ? getFKProfileDisplayName(profile) : "—",
        network: tp.network,
        postDate: tp.post_date,
        postContent: tp.post_content,
        postUrl: tp.post_url,
        engagement: tp.engagement || 0,
        likes: tp.likes || 0,
        comments: tp.comments || 0,
        shares: tp.shares || 0,
        views: tp.views || 0,
      };
    });

  return { profiles: profileSnapshots, topPosts: topPostSnapshots };
}

export function usePerformanceReport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<PerformanceReportContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const waitForJob = async (jobId: string): Promise<Partial<PerformanceReportContent>> => {
    const maxAttempts = 90;
    const intervalMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      const { data: statusData, error: statusError } = await supabase.functions.invoke(
        "generate-performance-report-async",
        {
          body: { action: "status", jobId },
        },
      );

      if (statusError) throw statusError;
      if (statusData?.error) throw new Error(statusData.error);
      if (statusData?.status === "failed") {
        throw new Error(statusData.error || "Error al generar reporte");
      }
      if (statusData?.status === "completed" && statusData.result) {
        return statusData.result as Partial<PerformanceReportContent>;
      }
    }

    throw new Error("La generación del reporte tardó demasiado. Intenta de nuevo.");
  };

  const generateReport = async (
    profilesIn: FKProfile[],
    kpis: FKProfileKPI[],
    topPosts: FKDailyTopPost[],
    config: PerformanceReportConfig,
  ): Promise<PerformanceReportContent | null> => {
    const profiles = profilesIn as FKProfileExt[];
    if (profiles.length === 0) {
      toast({
        title: "Sin perfiles",
        description: "No hay perfiles para generar el reporte",
        variant: "destructive",
      });
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const analytics = computeAnalytics(profiles, kpis, topPosts);
      const snapshots = buildSnapshots(profiles, kpis, topPosts);

      const payloadTopPosts = [...topPosts]
        .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
        .slice(0, 10);

      // Backend solo conoce brand/benchmark; "comparative" se envía como benchmark pero el título y la UI lo presentan distinto
      const backendMode = config.reportMode === "comparative" ? "benchmark" : config.reportMode;
      const payload = {
        reportMode: backendMode,
        clientMode: config.reportMode, // hint para el prompt si lo soporta
        clientName: config.clientName,
        brandName: config.brandName,
        dateRange: config.dateRange,
        strategicFocus: config.strategicFocus,
        profiles: profiles.map((p) => ({
          id: p.id,
          network: p.network,
          display_name: p.display_name,
          profile_id: p.profile_id,
          is_competitor: !!p.is_competitor,
          is_own_profile: p.is_own_profile,
        })),
        kpis: kpis.map((k) => ({
          fk_profile_id: k.fk_profile_id,
          followers: k.followers,
          follower_growth_percent: k.follower_growth_percent,
          engagement_rate: k.engagement_rate,
          posts_per_day: k.posts_per_day,
          page_performance_index: k.page_performance_index,
        })),
        topPosts: payloadTopPosts.map((tp) => ({
          fk_profile_id: tp.fk_profile_id,
          network: tp.network,
          post_content: tp.post_content,
          post_url: tp.post_url,
          engagement: tp.engagement,
          likes: tp.likes,
          comments: tp.comments,
          shares: tp.shares,
          views: tp.views,
          post_date: tp.post_date,
        })),
        analytics,
      };

      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-performance-report-async",
        {
          body: {
            action: "create",
            payload,
          },
        },
      );

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const reportData = data?.jobId
        ? await waitForJob(data.jobId as string)
        : (data as Partial<PerformanceReportContent>);

      const defaultTitle = config.reportMode === "comparative"
        ? `Análisis Comparativo — ${config.clientName}`
        : config.reportMode === "brand"
          ? `Reporte de Marca — ${config.clientName}`
          : `Reporte Benchmark — ${config.clientName}`;
      const enriched: PerformanceReportContent = {
        title: config.reportMode === "comparative"
          ? `Análisis Comparativo — ${config.clientName}`
          : (reportData.title || defaultTitle),
        summary: reportData.summary || "",
        highlights: reportData.highlights || [],
        keyFindings: reportData.keyFindings || [],
        recommendations: reportData.recommendations || [],
        topContentInsight: reportData.topContentInsight || "",
        competitiveInsight: reportData.competitiveInsight || "",
        rankingInsight: reportData.rankingInsight || "",
        sovInsight: reportData.sovInsight || "",
        profilesInsight: reportData.profilesInsight || "",
        conclusion: reportData.conclusion || "",
        reportMode: config.reportMode,
        clientName: config.clientName,
        brandName: config.brandName,
        analytics,
        profiles: snapshots.profiles,
        topPosts: snapshots.topPosts,
      };

      setReport(enriched);
      toast({ title: "Reporte generado", description: `"${enriched.title}" está listo` });
      return enriched;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      toast({
        title: "Error al generar reporte",
        description: message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const clearReport = () => {
    setReport(null);
    setError(null);
  };

  return { generateReport, clearReport, isGenerating, report, error };
}
