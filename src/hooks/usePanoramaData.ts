import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { subDays, format, eachDayOfInterval, startOfDay } from "date-fns";

export interface PanoramaMetrics {
  totalMentions: number;
  recentMentions: number; // last 7 days
  sentimentBreakdown: {
    positivo: number;
    neutral: number;
    negativo: number;
    sinAnalizar: number;
  };
  topSources: { domain: string; count: number }[];
  dailyActivity: { date: string; count: number }[];
  trend: "up" | "down" | "stable";
}

export function usePanoramaData(projectId: string | undefined, daysRange: number = 30) {
  const startDate = useMemo(() => subDays(new Date(), daysRange), [daysRange]);

  const { data: mentions, isLoading } = useQuery({
    queryKey: ["panorama-mentions", projectId, daysRange],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("mentions")
        .select("id, sentiment, source_domain, created_at")
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  const metrics = useMemo((): PanoramaMetrics => {
    if (!mentions || mentions.length === 0) {
      return {
        totalMentions: 0,
        recentMentions: 0,
        sentimentBreakdown: { positivo: 0, neutral: 0, negativo: 0, sinAnalizar: 0 },
        topSources: [],
        dailyActivity: [],
        trend: "stable",
      };
    }

    const sevenDaysAgo = subDays(new Date(), 7);

    // Sentiment breakdown
    const sentimentBreakdown = {
      positivo: 0,
      neutral: 0,
      negativo: 0,
      sinAnalizar: 0,
    };

    mentions.forEach((m) => {
      const s = m.sentiment?.toLowerCase();
      if (s === "positivo" || s === "positive") sentimentBreakdown.positivo++;
      else if (s === "negativo" || s === "negative") sentimentBreakdown.negativo++;
      else if (s === "neutral") sentimentBreakdown.neutral++;
      else sentimentBreakdown.sinAnalizar++;
    });

    // Recent mentions
    const recentMentions = mentions.filter(
      (m) => new Date(m.created_at) > sevenDaysAgo
    ).length;

    // Top sources
    const sourceMap = new Map<string, number>();
    mentions.forEach((m) => {
      const domain = m.source_domain || "desconocido";
      sourceMap.set(domain, (sourceMap.get(domain) || 0) + 1);
    });
    const topSources = Array.from(sourceMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Daily activity
    const dateRange = eachDayOfInterval({
      start: startOfDay(startDate),
      end: startOfDay(new Date()),
    });

    const dailyMap = new Map<string, number>();
    mentions.forEach((m) => {
      const dateKey = format(new Date(m.created_at), "yyyy-MM-dd");
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
    });

    const dailyActivity = dateRange.map((d) => ({
      date: format(d, "yyyy-MM-dd"),
      count: dailyMap.get(format(d, "yyyy-MM-dd")) || 0,
    }));

    // Trend calculation
    const olderMentions = mentions.length - recentMentions;
    const avgOlder = olderMentions / Math.max(1, (daysRange - 7) / 7);
    let trend: "up" | "down" | "stable" = "stable";
    if (recentMentions > avgOlder * 1.2) trend = "up";
    else if (recentMentions < avgOlder * 0.8) trend = "down";

    return {
      totalMentions: mentions.length,
      recentMentions,
      sentimentBreakdown,
      topSources,
      dailyActivity,
      trend,
    };
  }, [mentions, startDate, daysRange]);

  return {
    metrics,
    isLoading,
  };
}
