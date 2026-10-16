import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { getMentionAuthorInfo } from "@/lib/mentionAuthors";

export interface InfluencerMetrics {
  authorKey: string;
  authorName: string;
  authorUsername: string;
  authorUrl: string;
  authorAvatarUrl: string;
  platform: string;
  totalMentions: number;
  sentiment: {
    positivo: number;
    neutral: number;
    negativo: number;
  };
  sentimentScore: number;
  recentMentions: number;
  trend: "up" | "down" | "stable";
  topKeywords: string[];
  entities: string[];
  lastMentionDate: string | null;
  totalEngagement: number;
  totalViews: number;
  domain: string;
}

export interface DailyInfluencerData {
  date: string;
  [key: string]: number | string;
}

const SOCIAL_DOMAINS = ["twitter", "x.com", "facebook", "instagram", "youtube", "linkedin", "tiktok", "threads", "reddit"];

const isSocialDomain = (domain: string | null): boolean => {
  if (!domain) return false;
  const lower = domain.toLowerCase().replace("www.", "");
  return SOCIAL_DOMAINS.some((sd) => lower.includes(sd));
};

const normalizePlatform = (domain: string): string => {
  if (!domain) return "unknown";
  const lower = domain.toLowerCase().trim();
  if (lower === "linkedin" || lower.includes("linkedin.com")) return "LinkedIn";
  if (lower === "twitter" || lower === "x.com" || lower.includes("twitter.com")) return "Twitter/X";
  if (lower === "facebook" || lower.includes("facebook.com")) return "Facebook";
  if (lower === "instagram" || lower.includes("instagram.com")) return "Instagram";
  if (lower === "youtube" || lower.includes("youtube.com")) return "YouTube";
  if (lower === "tiktok" || lower.includes("tiktok.com")) return "TikTok";
  if (lower.includes("threads.")) return "Threads";
  if (lower.includes("reddit")) return "Reddit";
  return lower.replace(/^www\./, "").split("/")[0];
};

export function useInfluencersData(
  projectId: string | undefined,
  timeRangeDays: number = 30,
  selectedEntityIds: string[] = []
) {
  const startDate = useMemo(() => subDays(new Date(), timeRangeDays), [timeRangeDays]);

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
          published_at,
          raw_metadata,
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

    const getEffectiveDate = (mention: { published_at?: string | null; created_at: string }) =>
      mention.published_at ? new Date(mention.published_at) : new Date(mention.created_at);

    const authorMap = new Map<string, {
      authorName: string;
      authorUsername: string;
      authorUrl: string;
      authorAvatarUrl: string;
      platform: string;
      mentions: typeof mentions;
      keywords: Set<string>;
      entities: Set<string>;
      totalEngagement: number;
      totalViews: number;
    }>();

    mentions.forEach((mention) => {
      const domain = mention.source_domain || "";
      if (!isSocialDomain(domain)) return;

      const authorInfo = getMentionAuthorInfo(mention);
      if (!authorInfo) return;

      const meta = (mention.raw_metadata && typeof mention.raw_metadata === "object" && !Array.isArray(mention.raw_metadata)
        ? (mention.raw_metadata as Record<string, unknown>)
        : null);
      const platform = normalizePlatform(domain);
      const key = `${(authorInfo.username || authorInfo.name).toLowerCase()}@${platform.toLowerCase()}`;

      if (!authorMap.has(key)) {
        authorMap.set(key, {
          authorName: authorInfo.name,
          authorUsername: authorInfo.username,
          authorUrl: authorInfo.url,
          authorAvatarUrl: ((meta?.authorAvatarUrl as string) || (meta?.author_avatar_url as string) || ""),
          platform,
          mentions: [],
          keywords: new Set(),
          entities: new Set(),
          totalEngagement: 0,
          totalViews: 0,
        });
      }

      const data = authorMap.get(key)!;
      data.mentions.push(mention);

      const engagement = Number(meta?.engagement || 0) || Number(meta?.likes || 0) + Number(meta?.comments || 0) + Number(meta?.shares || 0);
      data.totalEngagement += engagement;
      data.totalViews += Number(meta?.views || 0);

      (mention.matched_keywords || []).forEach((kw: string) => data.keywords.add(kw));
      if (mention.entity?.nombre) data.entities.add(mention.entity.nombre);
    });

    const influencers: InfluencerMetrics[] = [];

    authorMap.forEach((data, key) => {
      const total = data.mentions.length;
      const sentiment = {
        positivo: data.mentions.filter((m) => m.sentiment === "positivo").length,
        neutral: data.mentions.filter((m) => m.sentiment === "neutral").length,
        negativo: data.mentions.filter((m) => m.sentiment === "negativo").length,
      };

      const sentimentScore = total > 0 ? (sentiment.positivo - sentiment.negativo) / total : 0;
      const recentMentions = data.mentions.filter((m) => getEffectiveDate(m) > sevenDaysAgo).length;
      const olderMentions = total - recentMentions;
      const avgOlder = olderMentions / Math.max(1, (timeRangeDays - 7) / 7);
      let trend: "up" | "down" | "stable" = "stable";
      if (recentMentions > avgOlder * 1.2) trend = "up";
      else if (recentMentions < avgOlder * 0.8) trend = "down";

      const sortedMentions = [...data.mentions].sort((a, b) => getEffectiveDate(b).getTime() - getEffectiveDate(a).getTime());
      const lastMention = sortedMentions[0];
      const lastMentionDate = lastMention ? (lastMention.published_at || lastMention.created_at) : null;

      influencers.push({
        authorKey: key,
        authorName: data.authorName,
        authorUsername: data.authorUsername,
        authorUrl: data.authorUrl,
        authorAvatarUrl: data.authorAvatarUrl,
        platform: data.platform,
        domain: data.platform.toLowerCase().replace(/\//g, ""),
        totalMentions: total,
        sentiment,
        sentimentScore,
        recentMentions,
        trend,
        topKeywords: Array.from(data.keywords).slice(0, 5),
        entities: Array.from(data.entities),
        lastMentionDate,
        totalEngagement: data.totalEngagement,
        totalViews: data.totalViews,
      });
    });

    influencers.sort((a, b) => (b.totalEngagement + b.totalMentions * 10) - (a.totalEngagement + a.totalMentions * 10));

    const topInfluencersList = influencers.slice(0, 5);
    const toChartKey = (d: string) => d.replace(/[^a-z0-9]/gi, "_");
    const chartKeyByAuthor: Record<string, string> = {};
    const chartLabelByKey: Record<string, string> = {};
    topInfluencersList.forEach((inf) => {
      const key = toChartKey(inf.authorKey);
      chartKeyByAuthor[inf.authorKey] = key;
      chartLabelByKey[key] = `${inf.authorName} (${inf.platform})`;
    });

    const topKeys = topInfluencersList.map((i) => i.authorKey);
    const dailyMap = new Map<string, Record<string, number>>();

    for (let i = timeRangeDays - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, "yyyy-MM-dd");
      const initialData: Record<string, number> = {};
      topKeys.forEach((k) => { initialData[chartKeyByAuthor[k]] = 0; });
      dailyMap.set(dateStr, initialData);
    }

    mentions.forEach((mention) => {
      const domain = mention.source_domain || "";
      if (!isSocialDomain(domain)) return;

      const authorInfo = getMentionAuthorInfo(mention);
      if (!authorInfo) return;

      const platform = normalizePlatform(domain);
      const authorKey = `${(authorInfo.username || authorInfo.name).toLowerCase()}@${platform.toLowerCase()}`;
      if (!topKeys.includes(authorKey)) return;

      const effectiveDate = mention.published_at ? new Date(mention.published_at) : new Date(mention.created_at);
      const dateKey = format(effectiveDate, "yyyy-MM-dd");
      if (!dailyMap.has(dateKey)) return;

      const dayData = dailyMap.get(dateKey)!;
      const key = chartKeyByAuthor[authorKey];
      dayData[key] = (dayData[key] || 0) + 1;
    });

    const dailyTrends: DailyInfluencerData[] = Array.from(dailyMap.entries())
      .map(([date, domains]) => ({ date, ...domains }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      influencers,
      topDomains: topKeys.map((k) => chartKeyByAuthor[k]),
      topDomainLabels: chartLabelByKey,
      dailyTrends,
      totalMentions: mentions.filter((m) => isSocialDomain(m.source_domain)).length,
      uniqueSources: influencers.length,
    };
  }, [mentionsQuery.data, timeRangeDays]);

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