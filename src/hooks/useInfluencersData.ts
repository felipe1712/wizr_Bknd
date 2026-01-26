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

    // Group by domain
    const domainMap = new Map<string, {
      mentions: typeof mentions;
      keywords: Set<string>;
      entities: Set<string>;
    }>();

    mentions.forEach((mention) => {
      const domain = mention.source_domain || "unknown";
      
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
    const topDomains = influencers.slice(0, 5).map((i) => i.domain);
    const dailyMap = new Map<string, Record<string, number>>();

    mentions.forEach((mention) => {
      const domain = mention.source_domain || "unknown";
      if (!topDomains.includes(domain)) return;

      const date = new Date(mention.created_at).toISOString().split("T")[0];
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {});
      }
      
      const dayData = dailyMap.get(date)!;
      dayData[domain] = (dayData[domain] || 0) + 1;
    });

    const dailyTrends: DailyInfluencerData[] = Array.from(dailyMap.entries())
      .map(([date, domains]) => ({
        date,
        ...topDomains.reduce((acc, d) => ({ ...acc, [d]: domains[d] || 0 }), {}),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      influencers,
      topDomains,
      dailyTrends,
      totalMentions: mentions.length,
      uniqueSources: influencers.length,
    };
  }, [mentionsQuery.data, timeRangeDays]);

  return {
    ...processedData,
    entities: entitiesQuery.data || [],
    isLoading: mentionsQuery.isLoading || entitiesQuery.isLoading,
    error: mentionsQuery.error || entitiesQuery.error,
  };
}
