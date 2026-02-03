import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { subDays } from "date-fns";

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

      let query = supabase
        .from("mentions")
        .select(`
          id,
          title,
          description,
          url,
          source_domain,
          sentiment,
          matched_keywords,
          entity_id,
          created_at,
          entity:entities(id, nombre)
        `)
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .gte("created_at", startDate.toISOString());

      if (selectedEntityIds.length > 0) {
        query = query.in("entity_id", selectedEntityIds);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  const entitiesQuery = useQuery({
    queryKey: ["influencers-entities", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("entities")
        .select("id, nombre, tipo")
        .eq("project_id", projectId)
        .eq("activo", true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  const processedData = useMemo(() => {
    const mentions = mentionsQuery.data || [];
    const sevenDaysAgo = subDays(new Date(), 7);

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

      // Recent mentions (last 7 days)
      const recentMentions = data.mentions.filter(
        (m) => new Date(m.created_at) > sevenDaysAgo
      ).length;

      // Trend calculation
      const olderMentions = total - recentMentions;
      const avgOlder = olderMentions / Math.max(1, (timeRangeDays - 7) / 7);
      let trend: "up" | "down" | "stable" = "stable";
      if (recentMentions > avgOlder * 1.2) trend = "up";
      else if (recentMentions < avgOlder * 0.8) trend = "down";

      // Last mention date
      const sortedMentions = [...data.mentions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMentionDate = sortedMentions[0]?.created_at || null;

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
    
    // Build daily map with all dates filled
    const dailyMap = new Map<string, Record<string, number>>();
    for (let i = 0; i < timeRangeDays; i++) {
      const date = subDays(new Date(), timeRangeDays - 1 - i);
      const dateStr = date.toISOString().split("T")[0];
      const initialData: Record<string, number> = {};
      topDomains.forEach((d) => {
        initialData[chartKeyByDomain[d]] = 0;
      });
      dailyMap.set(dateStr, initialData);
    }

    // Count mentions per day per domain
    mentions.forEach((mention) => {
      const domain = normalizeDomain(mention.source_domain || "unknown");
      if (!topDomains.includes(domain)) return;

      const date = new Date(mention.created_at).toISOString().split("T")[0];
      
      if (dailyMap.has(date)) {
        const dayData = dailyMap.get(date)!;
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
