import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { subDays, format, eachDayOfInterval, startOfDay } from "date-fns";

const MENTIONS_PAGE_SIZE = 1000;

function getMentionEffectiveDate(mention: {
  published_at: string | null;
  created_at: string;
}) {
  return new Date(mention.published_at ?? mention.created_at);
}

function buildDateFilter(start: Date, end: Date) {
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  return `and(published_at.gte.${startIso},published_at.lte.${endIso}),and(published_at.is.null,created_at.gte.${startIso},created_at.lte.${endIso})`;
}

export interface PanoramaMetrics {
  totalMentions: number;
  recentMentions: number;
  sentimentBreakdown: {
    positivo: number;
    neutral: number;
    negativo: number;
    sinAnalizar: number;
  };
  topSources: { domain: string; count: number }[];
  dailyActivity: { date: string; count: number; verifiedCount: number; lowConfidence: boolean }[];
  trend: "up" | "down" | "stable";
}

export function usePanoramaData(
  projectId: string | undefined,
  daysRange: number = 30,
  startDate?: Date,
  endDate?: Date
) {
  // Use explicit dates if provided, otherwise fall back to daysRange from now
  const effectiveStart = useMemo(
    () => startDate || subDays(new Date(), daysRange),
    [startDate, daysRange]
  );
  const effectiveEnd = useMemo(
    () => endDate || new Date(),
    [endDate]
  );

  const { data: mentions, isLoading } = useQuery({
    queryKey: ["panorama-mentions", projectId, effectiveStart.toISOString(), effectiveEnd.toISOString()],
    queryFn: async () => {
      if (!projectId) return [];

      const allMentions: Array<{
        id: string;
        sentiment: string | null;
        source_domain: string | null;
        created_at: string;
        published_at: string | null;
      }> = [];

      const dateFilter = buildDateFilter(effectiveStart, effectiveEnd);

      for (let page = 0; ; page += 1) {
        const from = page * MENTIONS_PAGE_SIZE;
        const to = from + MENTIONS_PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from("mentions")
          .select("id, sentiment, source_domain, created_at, published_at")
          .eq("project_id", projectId)
          .eq("is_archived", false)
          .or(dateFilter)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allMentions.push(...data);

        if (data.length < MENTIONS_PAGE_SIZE) break;
      }

      return allMentions.filter((mention) => {
        const effectiveDate = getMentionEffectiveDate(mention);
        return effectiveDate >= effectiveStart && effectiveDate <= effectiveEnd;
      });
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

    const sentimentBreakdown = { positivo: 0, neutral: 0, negativo: 0, sinAnalizar: 0 };
    mentions.forEach((m) => {
      const s = m.sentiment?.toLowerCase();
      if (s === "positivo" || s === "positive") sentimentBreakdown.positivo++;
      else if (s === "negativo" || s === "negative") sentimentBreakdown.negativo++;
      else if (s === "neutral") sentimentBreakdown.neutral++;
      else sentimentBreakdown.sinAnalizar++;
    });

    const recentMentions = mentions.filter((m) => {
      const effectiveDate = getMentionEffectiveDate(m);
      return effectiveDate > sevenDaysAgo;
    }).length;

    const sourceMap = new Map<string, number>();
    mentions.forEach((m) => {
      const domain = m.source_domain || "desconocido";
      sourceMap.set(domain, (sourceMap.get(domain) || 0) + 1);
    });
    const topSources = Array.from(sourceMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const dateRange = eachDayOfInterval({
      start: startOfDay(effectiveStart),
      end: startOfDay(effectiveEnd),
    });

    // Track count + low-confidence count per day.
    // A day is "lowConfidence" when >= 50% of its mentions had no real
    // published_at (we fell back to created_at), so the bar reflects capture
    // time, not actual publication time.
    const dailyMap = new Map<string, { count: number; verified: number; lowConf: number }>();
    mentions.forEach((m) => {
      const dateKey = format(getMentionEffectiveDate(m), "yyyy-MM-dd");
      const entry = dailyMap.get(dateKey) || { count: 0, verified: 0, lowConf: 0 };
      entry.count += 1;
      if (m.published_at) entry.verified += 1;
      else entry.lowConf += 1;
      dailyMap.set(dateKey, entry);
    });

    const dailyActivity = dateRange.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const entry = dailyMap.get(key) || { count: 0, verified: 0, lowConf: 0 };
      return {
        date: key,
        count: entry.count,
        verifiedCount: entry.verified,
        lowConfidence: entry.count > 0 && entry.lowConf / entry.count >= 0.5,
      };
    });

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
  }, [mentions, effectiveStart, effectiveEnd, daysRange]);

  return { metrics, isLoading };
}
