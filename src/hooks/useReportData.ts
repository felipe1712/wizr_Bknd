import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { subDays, startOfDay, eachDayOfInterval, format } from "date-fns";
import { es } from "date-fns/locale";
import type { Mention, SentimentType } from "./useMentions";
import type { InfluencerMetrics } from "./useInfluencersData";
import type { TrendDataPoint, TrendsSummary } from "./useTrendsData";
import type { SemanticAnalysisResult } from "./useSemanticAnalysis";

export interface ProjectInfo {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  objetivo: string;
}

export interface ReportData {
  project: ProjectInfo;
  mentions: Mention[];
  influencers: InfluencerMetrics[];
  trends: {
    data: TrendDataPoint[];
    summary: TrendsSummary;
  };
  semanticAnalysis: SemanticAnalysisResult | null;
  generatedAt: Date;
  timeRange: string;
}

type TimeRange = "7d" | "30d" | "90d";

export function useReportData(
  projectId: string | undefined,
  timeRange: TimeRange = "30d",
  semanticResult: SemanticAnalysisResult | null = null
) {
  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
  const startDate = useMemo(() => subDays(new Date(), days), [days]);

  // Fetch project info
  const projectQuery = useQuery({
    queryKey: ["report-project", projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const { data, error } = await supabase
        .from("projects")
        .select("id, nombre, descripcion, tipo, objetivo")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      return data as ProjectInfo;
    },
    enabled: !!projectId,
  });

  // Fetch all mentions for the time range
  const mentionsQuery = useQuery({
    queryKey: ["report-mentions", projectId, timeRange],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("mentions")
        .select(`
          *,
          entity:entities(id, nombre, tipo)
        `)
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Mention[];
    },
    enabled: !!projectId,
  });

  // Process influencers data
  const influencers = useMemo<InfluencerMetrics[]>(() => {
    const mentions = mentionsQuery.data || [];
    const sevenDaysAgo = subDays(new Date(), 7);

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

    const result: InfluencerMetrics[] = [];

    domainMap.forEach((data, domain) => {
      const total = data.mentions.length;
      const sentiment = {
        positivo: data.mentions.filter((m) => m.sentiment === "positivo").length,
        neutral: data.mentions.filter((m) => m.sentiment === "neutral").length,
        negativo: data.mentions.filter((m) => m.sentiment === "negativo").length,
      };

      const sentimentScore = total > 0
        ? (sentiment.positivo - sentiment.negativo) / total
        : 0;

      const recentMentions = data.mentions.filter(
        (m) => new Date(m.created_at) > sevenDaysAgo
      ).length;

      const olderMentions = total - recentMentions;
      const avgOlder = olderMentions / Math.max(1, (days - 7) / 7);
      let trend: "up" | "down" | "stable" = "stable";
      if (recentMentions > avgOlder * 1.2) trend = "up";
      else if (recentMentions < avgOlder * 0.8) trend = "down";

      const sortedMentions = [...data.mentions].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMentionDate = sortedMentions[0]?.created_at || null;

      result.push({
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

    return result.sort((a, b) => b.totalMentions - a.totalMentions);
  }, [mentionsQuery.data, days]);

  // Process trends data
  const trends = useMemo(() => {
    const mentions = mentionsQuery.data || [];
    const endDate = startOfDay(new Date());
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    const mentionsByDate = new Map<string, Mention[]>();

    mentions.forEach((mention) => {
      const mentionDate = startOfDay(new Date(mention.created_at));
      const dateKey = format(mentionDate, "yyyy-MM-dd");

      if (!mentionsByDate.has(dateKey)) {
        mentionsByDate.set(dateKey, []);
      }
      mentionsByDate.get(dateKey)!.push(mention);
    });

    const data: TrendDataPoint[] = dateRange.map((date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const dayMentions = mentionsByDate.get(dateKey) || [];

      const sentimentCounts = dayMentions.reduce(
        (acc, m) => {
          const sentiment = m.sentiment as SentimentType | null;
          if (sentiment === "positivo") acc.positivo++;
          else if (sentiment === "neutral") acc.neutral++;
          else if (sentiment === "negativo") acc.negativo++;
          else acc.sinAnalizar++;
          return acc;
        },
        { positivo: 0, neutral: 0, negativo: 0, sinAnalizar: 0 }
      );

      return {
        date: format(date, "d MMM", { locale: es }),
        fullDate: date,
        menciones: dayMentions.length,
        ...sentimentCounts,
      };
    });

    const totalMentions = data.reduce((sum, d) => sum + d.menciones, 0);
    const avgPerDay = days > 0 ? Math.round(totalMentions / days) : 0;

    const lastDayMentions = data[data.length - 1]?.menciones || 0;
    const previousDayMentions = data[data.length - 2]?.menciones || 0;

    const changePercent =
      previousDayMentions > 0
        ? Math.round(((lastDayMentions - previousDayMentions) / previousDayMentions) * 100)
        : 0;

    const sentimentBreakdown = data.reduce(
      (acc, d) => ({
        positivo: acc.positivo + d.positivo,
        neutral: acc.neutral + d.neutral,
        negativo: acc.negativo + d.negativo,
        sinAnalizar: acc.sinAnalizar + d.sinAnalizar,
      }),
      { positivo: 0, neutral: 0, negativo: 0, sinAnalizar: 0 }
    );

    const summary: TrendsSummary = {
      totalMentions,
      avgPerDay,
      lastDayMentions,
      previousDayMentions,
      changePercent,
      sentimentBreakdown,
    };

    return { data, summary };
  }, [mentionsQuery.data, startDate, days]);

  // Compile full report data
  const reportData = useMemo<ReportData | null>(() => {
    if (!projectQuery.data) return null;

    const timeRangeLabel =
      timeRange === "7d" ? "Últimos 7 días" :
      timeRange === "30d" ? "Últimos 30 días" : "Últimos 90 días";

    return {
      project: projectQuery.data,
      mentions: mentionsQuery.data || [],
      influencers,
      trends,
      semanticAnalysis: semanticResult,
      generatedAt: new Date(),
      timeRange: timeRangeLabel,
    };
  }, [projectQuery.data, mentionsQuery.data, influencers, trends, semanticResult, timeRange]);

  return {
    reportData,
    isLoading: projectQuery.isLoading || mentionsQuery.isLoading,
    error: projectQuery.error || mentionsQuery.error,
  };
}
