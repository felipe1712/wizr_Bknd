import { useMemo } from "react";
import { Mention, SentimentType } from "./useMentions";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

export interface TrendDataPoint {
  date: string;
  fullDate: Date;
  menciones: number;
  positivo: number;
  neutral: number;
  negativo: number;
  sinAnalizar: number;
}

export interface EntityTrendData {
  entityId: string;
  entityName: string;
  entityType: string;
  data: TrendDataPoint[];
  totals: {
    menciones: number;
    positivo: number;
    neutral: number;
    negativo: number;
  };
}

export interface TrendsSummary {
  totalMentions: number;
  avgPerDay: number;
  lastDayMentions: number;
  previousDayMentions: number;
  changePercent: number;
  sentimentBreakdown: {
    positivo: number;
    neutral: number;
    negativo: number;
    sinAnalizar: number;
  };
}

type TimeRange = "7d" | "30d" | "90d";

export function useTrendsData(
  mentions: Mention[],
  timeRange: TimeRange,
  entityId?: string | "all"
) {
  const { startDate, endDate, days } = useMemo(() => {
    const end = startOfDay(new Date());
    const daysCount = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const start = subDays(end, daysCount - 1);
    return { startDate: start, endDate: end, days: daysCount };
  }, [timeRange]);

  // Filter mentions by entity if specified
  const filteredMentions = useMemo(() => {
    if (!entityId || entityId === "all") return mentions;
    return mentions.filter((m) => m.entity_id === entityId);
  }, [mentions, entityId]);

  // Generate trend data
  const trendData = useMemo<TrendDataPoint[]>(() => {
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Create a map of date -> mentions
    const mentionsByDate = new Map<string, Mention[]>();
    
    filteredMentions.forEach((mention) => {
      // Use published_at if available, otherwise fall back to created_at
      const effectiveDate = mention.published_at 
        ? new Date(mention.published_at) 
        : new Date(mention.created_at);
      const mentionDate = startOfDay(effectiveDate);
      const dateKey = format(mentionDate, "yyyy-MM-dd");
      
      if (!mentionsByDate.has(dateKey)) {
        mentionsByDate.set(dateKey, []);
      }
      mentionsByDate.get(dateKey)!.push(mention);
    });

    return dateRange.map((date) => {
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
  }, [filteredMentions, startDate, endDate]);

  // Calculate summary
  const summary = useMemo<TrendsSummary>(() => {
    const totalMentions = trendData.reduce((sum, d) => sum + d.menciones, 0);
    const avgPerDay = days > 0 ? Math.round(totalMentions / days) : 0;
    
    const lastDayMentions = trendData[trendData.length - 1]?.menciones || 0;
    const previousDayMentions = trendData[trendData.length - 2]?.menciones || 0;
    
    const changePercent =
      previousDayMentions > 0
        ? Math.round(((lastDayMentions - previousDayMentions) / previousDayMentions) * 100)
        : 0;

    const sentimentBreakdown = trendData.reduce(
      (acc, d) => ({
        positivo: acc.positivo + d.positivo,
        neutral: acc.neutral + d.neutral,
        negativo: acc.negativo + d.negativo,
        sinAnalizar: acc.sinAnalizar + d.sinAnalizar,
      }),
      { positivo: 0, neutral: 0, negativo: 0, sinAnalizar: 0 }
    );

    return {
      totalMentions,
      avgPerDay,
      lastDayMentions,
      previousDayMentions,
      changePercent,
      sentimentBreakdown,
    };
  }, [trendData, days]);

  // Entity breakdown data
  const entityBreakdown = useMemo<EntityTrendData[]>(() => {
    if (entityId && entityId !== "all") return [];

    // Group mentions by entity
    const entitiesMap = new Map<string, { mentions: Mention[]; entity: Mention["entity"] }>();
    
    mentions.forEach((m) => {
      if (m.entity_id && m.entity) {
        if (!entitiesMap.has(m.entity_id)) {
          entitiesMap.set(m.entity_id, { mentions: [], entity: m.entity });
        }
        entitiesMap.get(m.entity_id)!.mentions.push(m);
      }
    });

    // Generate trend data for each entity
    return Array.from(entitiesMap.entries()).map(([id, { mentions: entityMentions, entity }]) => {
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
      
      const mentionsByDate = new Map<string, Mention[]>();
      entityMentions.forEach((m) => {
        // Use published_at if available, otherwise fall back to created_at
        const effectiveDate = m.published_at ? new Date(m.published_at) : new Date(m.created_at);
        const dateKey = format(startOfDay(effectiveDate), "yyyy-MM-dd");
        if (!mentionsByDate.has(dateKey)) mentionsByDate.set(dateKey, []);
        mentionsByDate.get(dateKey)!.push(m);
      });

      const data = dateRange.map((date) => {
        const dateKey = format(date, "yyyy-MM-dd");
        const dayMentions = mentionsByDate.get(dateKey) || [];
        
        return {
          date: format(date, "d MMM", { locale: es }),
          fullDate: date,
          menciones: dayMentions.length,
          positivo: dayMentions.filter((m) => m.sentiment === "positivo").length,
          neutral: dayMentions.filter((m) => m.sentiment === "neutral").length,
          negativo: dayMentions.filter((m) => m.sentiment === "negativo").length,
          sinAnalizar: dayMentions.filter((m) => !m.sentiment).length,
        };
      });

      const totals = {
        menciones: entityMentions.length,
        positivo: entityMentions.filter((m) => m.sentiment === "positivo").length,
        neutral: entityMentions.filter((m) => m.sentiment === "neutral").length,
        negativo: entityMentions.filter((m) => m.sentiment === "negativo").length,
      };

      return {
        entityId: id,
        entityName: entity?.nombre || "Sin nombre",
        entityType: entity?.tipo || "desconocido",
        data,
        totals,
      };
    }).sort((a, b) => b.totals.menciones - a.totals.menciones);
  }, [mentions, entityId, startDate, endDate]);

  return {
    trendData,
    summary,
    entityBreakdown,
    hasData: filteredMentions.length > 0,
  };
}
