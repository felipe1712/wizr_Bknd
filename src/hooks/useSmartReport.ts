import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Mention } from "./useMentions";

export type ReportFormat = "summary" | "full";

export interface SmartReportMetrics {
  totalMentions: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  topSources: string[];
  estimatedImpressions: number;
  estimatedReach: number;
}

export interface SmartReportTemplates {
  executive: string;
  technical: string;
  public: string;
}

export interface SourceBreakdown {
  source: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface InfluencerInfo {
  name: string;
  username: string;
  avatarUrl: string | null;
  platform: string;
  mentions: number;
  sentiment: string;
  reach: string;
}

export interface MediaOutletInfo {
  name: string;
  domain: string;
  articles: number;
  sentiment: "positivo" | "negativo" | "neutral" | "mixto";
  positive: number;
  negative: number;
  neutral: number;
  lastPublishedAt?: string | null;
}

export interface TimelinePoint {
  date: string;
  count: number;
  negative: number;
  positive: number;
}

export interface NarrativeInfo {
  narrative: string;
  description: string;
  mentions: number;
  sentiment: "positivo" | "negativo" | "mixto";
  trend: "creciente" | "decreciente" | "estable";
}

export interface KeywordCloudItem {
  term: string;
  count: number;
  sentiment: "positivo" | "negativo" | "neutral" | "mixto";
}

export interface SmartReportContent {
  title: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  conclusions?: string[];
  metrics: SmartReportMetrics;
  templates: SmartReportTemplates;
  impactAssessment?: string;
  sourceBreakdown: SourceBreakdown[];
  influencers: InfluencerInfo[];
  mediaOutlets?: MediaOutletInfo[];
  timeline: TimelinePoint[];
  narratives: NarrativeInfo[];
  keywords?: KeywordCloudItem[];
  keywordsInsight?: string;
  sentimentAnalysis?: string;
  totalUniqueAuthors: number;
  entityComparison?: string;
  narrativesInsight?: string;
  timelineInsight?: string;
  influencersInsight?: string;
  mediaInsight?: string;
  platformsInsight?: string;
}

export interface SmartReportConfig {
  reportFormat: ReportFormat;
  projectName: string;
  projectAudience: string;
  projectObjective: string;
  strategicContext?: string;
  strategicFocus?: string;
  entityNames?: string[];
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
}

// Keep old types as aliases for backward compatibility
export type ReportType = "brief" | "crisis" | "thematic" | "comparative";
export type ReportExtension = "micro" | "short" | "medium";

export function useSmartReport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<SmartReportContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const computeAnalytics = (mentions: Mention[]) => {
    const normalizeDomain = (d: string): string => {
      const map: Record<string, string> = {
        "twitter": "twitter.com", "x.com": "twitter.com",
        "facebook": "facebook.com", "www.facebook.com": "facebook.com",
        "youtube": "youtube.com", "www.youtube.com": "youtube.com",
        "instagram": "instagram.com", "www.instagram.com": "instagram.com",
        "tiktok": "tiktok.com", "www.tiktok.com": "tiktok.com",
        "reddit": "reddit.com", "www.reddit.com": "reddit.com",
        "linkedin": "linkedin.com", "www.linkedin.com": "linkedin.com",
      };
      return map[d] || d.replace(/^www\./, "");
    };

    const sourceMap: Record<string, { count: number; positive: number; negative: number; neutral: number }> = {};
    mentions.forEach(m => {
      const src = normalizeDomain(m.source_domain || "desconocido");
      if (!sourceMap[src]) sourceMap[src] = { count: 0, positive: 0, negative: 0, neutral: 0 };
      sourceMap[src].count++;
      if (m.sentiment === "positivo") sourceMap[src].positive++;
      else if (m.sentiment === "negativo") sourceMap[src].negative++;
      else if (m.sentiment === "neutral") sourceMap[src].neutral++;
    });
    const sourceBreakdown: SourceBreakdown[] = Object.entries(sourceMap)
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.count - a.count);

    const inferAuthorFromText = (title?: string | null, description?: string | null, url?: string): string | null => {
      const text = `${title || ""} ${description || ""}`;
      const mentionMatch = text.match(/@([A-Za-z0-9_]{2,})/);
      if (mentionMatch) return mentionMatch[1];
      const FB_BLACKLIST = ["permalink.php","profile.php","story.php","photo.php","photos","photo","video.php","videos","watch","groups","pages","share","sharer","sharer.php","plugins","dialog","events","marketplace","gaming","help","login","reg","reel","reels","media","notes","ads","business","l.php","tr","privacy","policies","terms","hashtag","search","public"];
      const TW_BLACKLIST = ["search","hashtag","i","intent","share","home","explore","notifications","messages","compose"];
      const IG_BLACKLIST = ["p","reel","reels","explore","stories","tv","accounts","direct","web"];
      const isValidHandle = (h: string) => h.length >= 3 && !/^\d+$/.test(h) && !/\.(php|html?|aspx?)$/i.test(h);
      if (url) {
        const twitterMatch = url.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/i);
        if (twitterMatch && isValidHandle(twitterMatch[1]) && !TW_BLACKLIST.includes(twitterMatch[1].toLowerCase())) return twitterMatch[1];
        const fbMatch = url.match(/facebook\.com\/([A-Za-z0-9_.-]+)/i);
        if (fbMatch && isValidHandle(fbMatch[1]) && !FB_BLACKLIST.includes(fbMatch[1].toLowerCase())) return fbMatch[1];
        const igMatch = url.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
        if (igMatch && isValidHandle(igMatch[1]) && !IG_BLACKLIST.includes(igMatch[1].toLowerCase())) return igMatch[1];
      }
      return null;
    };

    // ===== HÍBRIDO: separar Influenciadores (redes) vs Medios digitales =====
    const SOCIAL_DOMAINS = ["twitter.com", "x.com", "facebook.com", "instagram.com", "tiktok.com", "youtube.com", "reddit.com", "linkedin.com"];
    const KNOWN_MEDIA_BRANDS: Record<string, string> = {
      "elfinanciero": "El Financiero", "eleconomista": "El Economista", "expansion": "Expansión",
      "reforma": "Reforma", "eluniversal": "El Universal", "milenio": "Milenio",
      "excelsior": "Excélsior", "jornada": "La Jornada", "forbes": "Forbes",
      "bloomberg": "Bloomberg", "reuters": "Reuters", "informador": "El Informador",
      "proceso": "Proceso", "animalpolitico": "Animal Político", "aristeguinoticias": "Aristegui Noticias",
      "sinembargo": "Sin Embargo", "sdpnoticias": "SDP Noticias", "hrratings": "HR Ratings",
      "cbonds": "Cbonds", "polemon": "Polemón", "infobae": "Infobae", "elpais": "El País",
    };
    const formatDomainAsName = (domain: string): string => {
      const clean = domain.replace(/^(www\.|m\.|amp\.)/, "").replace(/\.(com|org|net|mx|es|co|io|info|gov|edu)(\.\w+)?$/, "");
      const key = clean.replace(/[-_.]/g, "").toLowerCase();
      if (KNOWN_MEDIA_BRANDS[key]) return KNOWN_MEDIA_BRANDS[key];
      return clean.split(/[-_.]/).filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
    };
    const isSocialDomain = (d: string) => SOCIAL_DOMAINS.includes(d);
    const isKnownMediaDomain = (d: string) => {
      const clean = d.replace(/^(www\.|m\.|amp\.)/, "").replace(/\.(com|org|net|mx|es|co|io|info|gov|edu)(\.\w+)?$/, "");
      const key = clean.replace(/[-_.]/g, "").toLowerCase();
      return Boolean(KNOWN_MEDIA_BRANDS[key]);
    };

    // Influencers: solo menciones de redes sociales (con autor identificable)
    const authorMap: Record<string, { name: string; username: string; avatarUrl: string | null; platform: string; mentions: number; sentiments: string[]; engagement: number }> = {};
    // Media outlets: agrupados por dominio
    const outletMap: Record<string, { name: string; domain: string; articles: number; sentiments: string[]; lastPublishedAt: string | null }> = {};

    mentions.forEach(m => {
      const meta = m.raw_metadata as Record<string, unknown> | null;
      const normalizedPlatform = normalizeDomain(m.source_domain || "unknown");
      const isSocial = isSocialDomain(normalizedPlatform);
      const isKnownMedia = isKnownMediaDomain(normalizedPlatform);

      // Heurística híbrida
      let authorName = (meta?.author || meta?.author_name || meta?.authorName || meta?.author_username || meta?.authorUsername) as string | undefined;
      let username = (meta?.authorUsername || meta?.author_username || "") as string;
      const avatarUrl = (meta?.authorAvatarUrl || meta?.author_avatar_url || meta?.profileImageUrl || null) as string | null;

      if (!authorName) {
        const inferred = inferAuthorFromText(m.title, m.description, m.url);
        if (inferred) { authorName = inferred; username = inferred; }
      }

      // Sanitize: descarta autores claramente inválidos (slugs de URL, numéricos, archivos)
      const isJunkAuthor = (n?: string) => {
        if (!n) return true;
        const x = String(n).trim();
        if (x.length < 3) return true;
        if (/^\d+$/.test(x)) return true;
        if (/\.(php|html?|aspx?)$/i.test(x)) return true;
        if (/^(share|photo|photos|video|videos|watch|reel|reels|story|stories|permalink|profile|p|posts|pages|groups|plugins|sharer|dialog|events|marketplace)$/i.test(x)) return true;
        return false;
      };
      if (isJunkAuthor(authorName)) { authorName = undefined; }

      // Decisión: ¿Influencer o Medio?
      // - Red social conocida + autor → Influencer
      // - Dominio de medio conocido → Medio
      // - Resto: si tiene autor con @ → Influencer; si tiene título → Medio
      const goToInfluencer = isSocial && Boolean(authorName);
      const goToMedia = !goToInfluencer && (isKnownMedia || (!isSocial && Boolean(m.title)));

      if (goToInfluencer && authorName) {
        const key = `${authorName.toLowerCase()}@${normalizedPlatform}`;
        if (!authorMap[key]) {
          authorMap[key] = { name: authorName, username: username || authorName, avatarUrl, platform: normalizedPlatform, mentions: 0, sentiments: [], engagement: 0 };
        }
        authorMap[key].mentions++;
        if (m.sentiment) authorMap[key].sentiments.push(m.sentiment);
        const eng = ((meta?.likes as number) || 0) + ((meta?.comments as number) || 0) + ((meta?.shares as number) || 0);
        authorMap[key].engagement += eng;
      } else if (goToMedia) {
        const domain = normalizedPlatform;
        if (!outletMap[domain]) {
          outletMap[domain] = { name: formatDomainAsName(domain), domain, articles: 0, sentiments: [], lastPublishedAt: null };
        }
        outletMap[domain].articles++;
        if (m.sentiment) outletMap[domain].sentiments.push(m.sentiment);
        const pubDate = m.published_at || m.created_at;
        if (pubDate && (!outletMap[domain].lastPublishedAt || pubDate > outletMap[domain].lastPublishedAt!)) {
          outletMap[domain].lastPublishedAt = pubDate;
        }
      }
    });

    const computeDominantSentiment = (sentiments: string[]): "positivo" | "negativo" | "neutral" | "mixto" => {
      if (!sentiments.length) return "neutral";
      const neg = sentiments.filter(s => s === "negativo").length / sentiments.length;
      const pos = sentiments.filter(s => s === "positivo").length / sentiments.length;
      if (neg > 0.5) return "negativo";
      if (pos > 0.5) return "positivo";
      const neu = sentiments.filter(s => s === "neutral").length / sentiments.length;
      if (neu > 0.5) return "neutral";
      return "mixto";
    };

    const influencers: InfluencerInfo[] = Object.values(authorMap)
      .sort((a, b) => b.engagement - a.engagement || b.mentions - a.mentions)
      .slice(0, 20)
      .map(a => ({
        name: a.name, username: a.username, avatarUrl: a.avatarUrl, platform: a.platform,
        mentions: a.mentions,
        sentiment: computeDominantSentiment(a.sentiments),
        reach: a.engagement > 0 ? `${a.engagement.toLocaleString()} interacciones` : "N/D",
      }));

    const mediaOutlets: MediaOutletInfo[] = Object.values(outletMap)
      .sort((a, b) => b.articles - a.articles)
      .slice(0, 20)
      .map(o => ({
        name: o.name,
        domain: o.domain,
        articles: o.articles,
        sentiment: computeDominantSentiment(o.sentiments),
        positive: o.sentiments.filter(s => s === "positivo").length,
        negative: o.sentiments.filter(s => s === "negativo").length,
        neutral: o.sentiments.filter(s => s === "neutral").length,
        lastPublishedAt: o.lastPublishedAt,
      }));

    const dayMap: Record<string, { count: number; negative: number; positive: number }> = {};
    mentions.forEach(m => {
      const date = (m.published_at || m.created_at || "").split("T")[0];
      if (!date) return;
      if (!dayMap[date]) dayMap[date] = { count: 0, negative: 0, positive: 0 };
      dayMap[date].count++;
      if (m.sentiment === "negativo") dayMap[date].negative++;
      if (m.sentiment === "positivo") dayMap[date].positive++;
    });
    const timeline: TimelinePoint[] = Object.entries(dayMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({ date, ...data }));

    // Multiplicadores ajustados a benchmarks de earned reach por red (2024-2025):
    // posts con engagement medible reciben x veces ese engagement en impresiones estimadas.
    const PLATFORM_MULTIPLIERS: Record<string, number> = {
      "twitter.com": 35, "facebook.com": 45, "instagram.com": 40,
      "linkedin.com": 25, "tiktok.com": 60, "youtube.com": 50, "reddit.com": 30,
    };
    // Piso por mención sin métricas, calibrado por tipo de soporte:
    // un post social tiene un piso orgánico mucho mayor a 50; una nota en medio digital
    // alcanza miles de impresiones aunque no expongamos sus métricas.
    const PLATFORM_FLOOR: Record<string, number> = {
      "twitter.com": 400, "facebook.com": 500, "instagram.com": 600,
      "linkedin.com": 300, "tiktok.com": 800, "youtube.com": 700, "reddit.com": 350,
    };
    const PRESS_FLOOR = 1500; // medio digital sin métricas expuestas
    const isPressDomain = (d: string): boolean => {
      if (!d) return false;
      const x = d.toLowerCase();
      return /\.(com|mx|org|net|info|news|press|co)(\.[a-z]{2})?$/.test(x)
        && !/(twitter|facebook|instagram|linkedin|tiktok|youtube|reddit|t\.co|fb\.com|x\.com)/.test(x);
    };

    let estimatedImpressions = 0;
    mentions.forEach(m => {
      const meta = m.raw_metadata as Record<string, unknown> | null;
      const views = Number(meta?.views) || 0;
      const likes = Number(meta?.likes) || 0;
      const comments = Number(meta?.comments) || 0;
      const shares = Number(meta?.shares) || 0;
      const engagement = likes + comments + shares;
      const platform = normalizeDomain(m.source_domain || "unknown");

      if (views > 0) {
        estimatedImpressions += views;
      } else if (engagement > 0) {
        estimatedImpressions += engagement * (PLATFORM_MULTIPLIERS[platform] || 30);
      } else if (isPressDomain(platform)) {
        estimatedImpressions += PRESS_FLOOR;
      } else {
        estimatedImpressions += PLATFORM_FLOOR[platform] || 250;
      }
    });

    // Alcance estimado: 70% de impresiones (ajustado al alza respecto a 65%,
    // ya que earned media de prensa tiene menor duplicación que social).
    const estimatedReach = Math.round(estimatedImpressions * 0.70);
    const totalUniqueAuthors = Object.keys(authorMap).length + Object.keys(outletMap).length;

    return { sourceBreakdown, influencers, mediaOutlets, timeline, estimatedImpressions, estimatedReach, totalUniqueAuthors };
  };

  const generateReport = async (
    mentions: Mention[],
    config: SmartReportConfig
  ): Promise<SmartReportContent | null> => {
    if (mentions.length === 0) {
      toast({
        title: "Sin menciones",
        description: "No hay menciones disponibles para generar el reporte",
        variant: "destructive",
      });
      return null;
    }

    const waitForJob = async (jobId: string): Promise<SmartReportContent> => {
      const maxAttempts = 90;
      const intervalMs = 2000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));

        const { data: statusData, error: statusError } = await supabase.functions.invoke("generate-smart-report-async", {
          body: { action: "status", jobId },
        });

        if (statusError) throw statusError;
        if (statusData?.error) throw new Error(statusData.error);
        if (statusData?.status === "failed") throw new Error(statusData.error || "Error al generar reporte");
        if (statusData?.status === "completed" && statusData.result) return statusData.result as SmartReportContent;
      }

      throw new Error("La generación del reporte tardó demasiado. Intenta de nuevo.");
    };

    setIsGenerating(true);
    setError(null);

    try {
      const analytics = computeAnalytics(mentions);

      const payload = {
        mentions: mentions.map(m => ({
          id: m.id, title: m.title, description: m.description, url: m.url,
          source_domain: m.source_domain, sentiment: m.sentiment,
          created_at: m.created_at, published_at: m.published_at,
          matched_keywords: m.matched_keywords, raw_metadata: m.raw_metadata,
        })),
        ...config,
      };

      const { data, error: fnError } = await supabase.functions.invoke("generate-smart-report-async", {
        body: {
          action: "create",
          payload,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const reportData = data?.jobId
        ? await waitForJob(data.jobId as string)
        : (data as SmartReportContent);

      const enrichedReport: SmartReportContent = {
        ...reportData,
        sourceBreakdown: analytics.sourceBreakdown,
        influencers: analytics.influencers,
        mediaOutlets: analytics.mediaOutlets,
        timeline: analytics.timeline,
        narratives: reportData.narratives || [],
        totalUniqueAuthors: analytics.totalUniqueAuthors,
        metrics: {
          ...reportData.metrics,
          estimatedImpressions: analytics.estimatedImpressions,
          estimatedReach: analytics.estimatedReach,
        },
      };

      setReport(enrichedReport);
      toast({ title: "Reporte generado", description: `"${enrichedReport.title}" está listo` });
      return enrichedReport;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      toast({ title: "Error al generar reporte", description: message, variant: "destructive" });
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
