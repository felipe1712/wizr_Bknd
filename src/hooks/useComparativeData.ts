import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, startOfDay, eachDayOfInterval } from "date-fns";

interface Entity {
  id: string;
  nombre: string;
  tipo: string;
}

interface MentionData {
  id: string;
  entity_id: string | null;
  sentiment: string | null;
  source_domain: string | null;
  created_at: string;
}

interface EntityMetrics {
  entityId: string;
  entityName: string;
  entityType: string;
  totalMentions: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  sources: { domain: string; count: number }[];
  dailyTrend: { date: string; count: number }[];
}

interface ComparativeData {
  entities: EntityMetrics[];
  shareOfVoice: { name: string; value: number; percentage: number }[];
  sentimentComparison: {
    entity: string;
    positive: number;
    neutral: number;
    negative: number;
  }[];
  trendComparison: {
    date: string;
    [entityName: string]: string | number;
  }[];
}

export function useComparativeData(
  projectId: string | undefined,
  selectedEntityIds: string[],
  daysRange: number = 30
) {
  const startDate = useMemo(() => subDays(new Date(), daysRange), [daysRange]);

  const { data: entities, isLoading: entitiesLoading } = useQuery({
    queryKey: ["entities-for-comparison", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("entities")
        .select("id, nombre, tipo")
        .eq("project_id", projectId)
        .eq("activo", true);

      if (error) throw error;
      return data as Entity[];
    },
    enabled: !!projectId,
  });

  const { data: mentions, isLoading: mentionsLoading } = useQuery({
    queryKey: ["mentions-for-comparison", projectId, daysRange],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("mentions")
        .select("id, entity_id, sentiment, source_domain, created_at")
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .gte("created_at", startDate.toISOString());

      if (error) throw error;
      return data as MentionData[];
    },
    enabled: !!projectId,
  });

  const comparativeData = useMemo((): ComparativeData | null => {
    if (!entities || !mentions) return null;

    const filteredEntities =
      selectedEntityIds.length > 0
        ? entities.filter((e) => selectedEntityIds.includes(e.id))
        : entities;

    if (filteredEntities.length === 0) {
      return {
        entities: [],
        shareOfVoice: [],
        sentimentComparison: [],
        trendComparison: [],
      };
    }

    const dateRange = eachDayOfInterval({
      start: startOfDay(startDate),
      end: startOfDay(new Date()),
    });

    const entityMetricsMap = new Map<string, EntityMetrics>();

    // Initialize metrics for each entity
    for (const entity of filteredEntities) {
      entityMetricsMap.set(entity.id, {
        entityId: entity.id,
        entityName: entity.nombre,
        entityType: entity.tipo,
        totalMentions: 0,
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
        sources: [],
        dailyTrend: dateRange.map((d) => ({
          date: format(d, "yyyy-MM-dd"),
          count: 0,
        })),
      });
    }

    // Process mentions
    const sourceCounts = new Map<string, Map<string, number>>();
    
    for (const mention of mentions) {
      if (!mention.entity_id) continue;
      
      const metrics = entityMetricsMap.get(mention.entity_id);
      if (!metrics) continue;

      metrics.totalMentions++;

      // Sentiment
      const sentiment = mention.sentiment?.toLowerCase() || "neutral";
      if (sentiment === "positive" || sentiment === "positivo") {
        metrics.sentimentBreakdown.positive++;
      } else if (sentiment === "negative" || sentiment === "negativo") {
        metrics.sentimentBreakdown.negative++;
      } else {
        metrics.sentimentBreakdown.neutral++;
      }

      // Sources
      if (mention.source_domain) {
        if (!sourceCounts.has(mention.entity_id)) {
          sourceCounts.set(mention.entity_id, new Map());
        }
        const entitySources = sourceCounts.get(mention.entity_id)!;
        entitySources.set(
          mention.source_domain,
          (entitySources.get(mention.source_domain) || 0) + 1
        );
      }

      // Daily trend
      const mentionDate = format(new Date(mention.created_at), "yyyy-MM-dd");
      const dayEntry = metrics.dailyTrend.find((d) => d.date === mentionDate);
      if (dayEntry) {
        dayEntry.count++;
      }
    }

    // Finalize sources
    for (const [entityId, sources] of sourceCounts) {
      const metrics = entityMetricsMap.get(entityId);
      if (metrics) {
        metrics.sources = Array.from(sources.entries())
          .map(([domain, count]) => ({ domain, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
      }
    }

    const entityMetrics = Array.from(entityMetricsMap.values());

    // Share of voice
    const totalMentions = entityMetrics.reduce(
      (sum, e) => sum + e.totalMentions,
      0
    );
    const shareOfVoice = entityMetrics.map((e) => ({
      name: e.entityName,
      value: e.totalMentions,
      percentage:
        totalMentions > 0
          ? Math.round((e.totalMentions / totalMentions) * 100)
          : 0,
    }));

    // Sentiment comparison
    const sentimentComparison = entityMetrics.map((e) => ({
      entity: e.entityName,
      positive: e.sentimentBreakdown.positive,
      neutral: e.sentimentBreakdown.neutral,
      negative: e.sentimentBreakdown.negative,
    }));

    // Trend comparison - combine all entity trends
    const trendComparison: ComparativeData["trendComparison"] = dateRange.map(
      (d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const entry: { date: string; [key: string]: string | number } = {
          date: format(d, "dd/MM"),
        };

        for (const metrics of entityMetrics) {
          const dayData = metrics.dailyTrend.find((t) => t.date === dateStr);
          entry[metrics.entityName] = dayData?.count || 0;
        }

        return entry;
      }
    );

    return {
      entities: entityMetrics,
      shareOfVoice,
      sentimentComparison,
      trendComparison,
    };
  }, [entities, mentions, selectedEntityIds, startDate]);

  return {
    entities: entities || [],
    comparativeData,
    isLoading: entitiesLoading || mentionsLoading,
  };
}
