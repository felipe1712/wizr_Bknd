import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useMemo } from "react";
import { format, subDays } from "date-fns";

export interface InfluencerMetrics {
  domain: string;
  totalMentions: number;
  sentiment: {
    positivo: number;
    neutral: number;
    negativo: number;
  };
  sentimentScore: number; // -1 to 1
  recentMentions: number; // last 7 days
  trend: "up" | "down" | "stable";
  topKeywords: string[];
  entities: string[];
  lastMentionDate: string | null;
}

export interface DailyInfluencerData {
  date: string;
  [domain: string]: number | string;
}

export function useInfluencersData(
  projectId: string | undefined,
  timeRangeDays: number = 30,
  selectedEntityIds: string[] = []
) {
  const startDate = useMemo(
    () => subDays(new Date(), timeRangeDays),
    [timeRangeDays]
  );

  const mentionsQuery = useQuery({
    queryKey: ["influencers-mentions", projectId, timeRangeDays, selectedEntityIds],
    queryFn: async () => {
      if (!projectId) return [];

      const { data } = await api.get(`/projects/${projectId}/influencers-mentions`, {
        params: {
          startDate: startDate.toISOString(),
          selectedEntityIds: selectedEntityIds.join(','),
        }
      });
      return data || [];
    },
    enabled: !!projectId,
  });

  const entitiesQuery = useQuery({
    queryKey: ["influencers-entities", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data } = await api.get(`/projects/${projectId}/entities`);
      return data || [];
    },
    enabled: !!projectId,
  });

  const processedData = useMemo(() => {
    const mentions = mentionsQuery.data || [];
    const sevenDaysAgo = subDays(new Date(), 7);

    // Helper to get the effective date for a mention (published_at preferred, fallback to created_at)
    const getEffectiveDate = (mention: { published_at?: string | null; created_at: string }) => {
      return mention.published_at ? new Date(mention.published_at) : new Date(mention.created_at);
    };

    // Normalize domain function - convert to consistent format
    const normalizeDomain = (domain: string): string => {
      if (!domain) return "unknown";
      const lower = domain.toLowerCase().trim();
      
      // Handle variants of the same platform
      if (lower === "linkedin" || lower.includes("linkedin.com")) return "linkedin";
      if (lower === "twitter" || lower === "x.com" || lower.includes("twitter.com")) return "twitter";
      if (lower === "facebook" || lower.includes("facebook.com")) return "facebook";
      if (lower === "instagram" || lower.includes("instagram.com")) return "instagram";
      if (lower === "youtube" || lower.includes("youtube.com")) return "youtube";
      if (lower === "tiktok" || lower.includes("tiktok.com")) return "tiktok";
      if (lower.includes("threads.")) return "threads";
      
      // For other domains, use the base domain
      return lower.replace(/^www\./, "").split("/")[0];
    };

    // Group by normalized domain
    const domainMap = new Map<string, {
      mentions: typeof mentions;
      keywords: Set<string>;
      entities: Set<string>;
    }>();

    mentions.forEach((mention) => {
      const domain = normalizeDomain(mention.source_domain || "unknown");
      
      if (!domainMap.has(domain)) {
        domainMap.set(domain, {
          mentions: [],
          keywords: new Set(),
          entities: new Set(),
        });
      }

      const data = domainMap.get(domain)!;
      data.mentions.push(mention);
      
      (mention.matched_keywords || []).forEach((kw: string) => data.keywords.add(kw));
      
      if (mention.entity?.nombre) {
        data.entities.add(mention.entity.nombre);
      }
    });

    // Calculate metrics for each domain
    const influencers: InfluencerMetrics[] = [];

    domainMap.forEach((data, domain) => {
      const total = data.mentions.length;
      const sentiment = {
        positivo: data.mentions.filter((m) => m.sentiment === "positivo").length,
        neutral: data.mentions.filter((m) => m.sentiment === "neutral").length,
        negativo: data.mentions.filter((m) => m.sentiment === "negativo").length,
      };

      // Calculate sentiment score (-1 to 1)
      const sentimentScore = total > 0
        ? (sentiment.positivo - sentiment.negativo) / total
        : 0;

      // Recent mentions (last 7 days) - use effective date
      const recentMentions = data.mentions.filter(
        (m) => getEffectiveDate(m) > sevenDaysAgo
      ).length;

      // Trend calculation
      const olderMentions = total - recentMentions;
      const avgOlder = olderMentions / Math.max(1, (timeRangeDays - 7) / 7);
      let trend: "up" | "down" | "stable" = "stable";
      if (recentMentions > avgOlder * 1.2) trend = "up";
      else if (recentMentions < avgOlder * 0.8) trend = "down";

      // Last mention date - use effective date
      const sortedMentions = [...data.mentions].sort(
        (a, b) => getEffectiveDate(b).getTime() - getEffectiveDate(a).getTime()
      );
      const lastMention = sortedMentions[0];
      const lastMentionDate = lastMention 
        ? (lastMention.published_at || lastMention.created_at) 
        : null;

      influencers.push({
        domain,
        totalMentions: total,
        sentiment,
        sentimentScore,
        recentMentions,
        trend,
        topKeywords: Array.from(data.keywords).slice(0, 5),
        entities: Array.from(data.entities),
        lastMentionDate,
      });
    });

    // Sort by total mentions
    influencers.sort((a, b) => b.totalMentions - a.totalMentions);

    // Daily data for trend chart (top 5 domains)
    const topInfluencersList = influencers.slice(0, 5);
    const topDomains = topInfluencersList.map((i) => i.domain);

    // Recharts treats dots in dataKey as nested paths (e.g. "msn.com" => msn.com),
    // so we generate safe keys and keep labels separate.
    const toChartKey = (d: string) => d.replace(/[^a-z0-9]/gi, "_");
    const chartKeyByDomain: Record<string, string> = {};
    const chartLabelByKey: Record<string, string> = {};
    topDomains.forEach((d) => {
      const key = toChartKey(d);
      chartKeyByDomain[d] = key;
      chartLabelByKey[key] = d;
    });
    
    // Build daily map with all dates filled (including today)
    const dailyMap = new Map<string, Record<string, number>>();
    // timeRangeDays days ago to today = timeRangeDays + 1 entries, but we want exactly timeRangeDays
    // So we go from (timeRangeDays - 1) days ago up to today (i=0)
    for (let i = timeRangeDays - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      // IMPORTANT: Use the same date key logic as the mention bucketing below.
      // Using toISOString() can shift the day depending on timezone and cause
      // mismatches (all zeros) when dailyMap doesn't contain the mention date key.
      const dateStr = format(date, "yyyy-MM-dd");
      const initialData: Record<string, number> = {};
      topDomains.forEach((d) => {
        initialData[chartKeyByDomain[d]] = 0;
      });
      dailyMap.set(dateStr, initialData);
    }

    // Count mentions per day per domain - use effective date (published_at or created_at)
    mentions.forEach((mention) => {
      const domain = normalizeDomain(mention.source_domain || "unknown");
      if (!topDomains.includes(domain)) return;

      // Use published_at if available, otherwise fall back to created_at
      const effectiveDate = mention.published_at 
        ? new Date(mention.published_at) 
        : new Date(mention.created_at);
      const dateKey = format(effectiveDate, "yyyy-MM-dd");
      
      if (dailyMap.has(dateKey)) {
        const dayData = dailyMap.get(dateKey)!;
        const key = chartKeyByDomain[domain];
        dayData[key] = (dayData[key] || 0) + 1;
      }
    });

    const dailyTrends: DailyInfluencerData[] = Array.from(dailyMap.entries())
      .map(([date, domains]) => ({
        date,
        ...domains,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      influencers,
      topDomains: topDomains.map((d) => chartKeyByDomain[d]),
      topDomainLabels: chartLabelByKey,
      dailyTrends,
      totalMentions: mentions.length,
      uniqueSources: influencers.length,
    };
  }, [mentionsQuery.data, timeRangeDays]);

  // Format raw mentions for table consumption
  const rawMentions = useMemo(() => {
    return (mentionsQuery.data || []).map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      url: m.url,
      source_domain: m.source_domain,
      sentiment: m.sentiment,
      created_at: m.created_at,
      published_at: m.published_at,
      matched_keywords: m.matched_keywords || [],
    }));
  }, [mentionsQuery.data]);

  return {
    ...processedData,
    rawMentions,
    entities: entitiesQuery.data || [],
    isLoading: mentionsQuery.isLoading || entitiesQuery.isLoading,
    error: mentionsQuery.error || entitiesQuery.error,
  };
}
