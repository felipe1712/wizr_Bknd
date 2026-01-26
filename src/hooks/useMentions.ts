import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SearchResult } from "@/lib/api/firecrawl";
import type { Json } from "@/integrations/supabase/types";

export type SentimentType = "positivo" | "neutral" | "negativo";

export interface Mention {
  id: string;
  project_id: string;
  entity_id: string | null;
  url: string;
  title: string | null;
  description: string | null;
  source_domain: string | null;
  published_at: string | null;
  matched_keywords: string[];
  sentiment: SentimentType | null;
  relevance_score: number | null;
  raw_metadata: Json;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  entity?: {
    id: string;
    nombre: string;
    tipo: string;
  } | null;
}

interface CreateMentionData {
  project_id: string;
  entity_id?: string | null;
  url: string;
  title?: string | null;
  description?: string | null;
  source_domain?: string | null;
  published_at?: string | null;
  matched_keywords?: string[];
  sentiment?: SentimentType | null;
  relevance_score?: number | null;
  raw_metadata?: Json;
}

interface MentionFilters {
  entityId?: string;
  sentiment?: SentimentType;
  isRead?: boolean;
  isArchived?: boolean;
  sourceDomain?: string;
  startDate?: Date;
  endDate?: Date;
}

export function useMentions(projectId: string | undefined, filters?: MentionFilters) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mentionsQuery = useQuery({
    queryKey: ["mentions", projectId, filters],
    queryFn: async () => {
      if (!projectId) return [];

      let query = supabase
        .from("mentions")
        .select(`
          *,
          entity:entities(id, nombre, tipo)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters?.entityId) {
        query = query.eq("entity_id", filters.entityId);
      }
      if (filters?.sentiment) {
        query = query.eq("sentiment", filters.sentiment);
      }
      if (filters?.isRead !== undefined) {
        query = query.eq("is_read", filters.isRead);
      }
      if (filters?.isArchived !== undefined) {
        query = query.eq("is_archived", filters.isArchived);
      }
      if (filters?.sourceDomain) {
        query = query.eq("source_domain", filters.sourceDomain);
      }
      if (filters?.startDate) {
        query = query.gte("created_at", filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        query = query.lte("created_at", filters.endDate.toISOString());
      }

      const { data, error } = await query.limit(500);

      if (error) throw error;
      return data as Mention[];
    },
    enabled: !!projectId,
  });

  const saveMentionMutation = useMutation({
    mutationFn: async (data: CreateMentionData) => {
      const { data: mention, error } = await supabase
        .from("mentions")
        .upsert(data, { onConflict: "project_id,url" })
        .select()
        .single();

      if (error) throw error;
      return mention as Mention;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentions", projectId] });
    },
    onError: (error) => {
      console.error("Error saving mention:", error);
    },
  });

  const saveManyMentionsMutation = useMutation({
    mutationFn: async (mentions: CreateMentionData[]) => {
      if (mentions.length === 0) return [];

      const { data, error } = await supabase
        .from("mentions")
        .upsert(mentions, { onConflict: "project_id,url", ignoreDuplicates: true })
        .select();

      if (error) throw error;
      return data as Mention[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mentions", projectId] });
      toast({
        title: "Menciones guardadas",
        description: `Se guardaron ${data.length} menciones nuevas`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudieron guardar las menciones: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateMentionMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; is_read?: boolean; is_archived?: boolean; sentiment?: SentimentType | null }) => {
      const { data, error } = await supabase
        .from("mentions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Mention;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentions", projectId] });
    },
  });

  const deleteMentionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("mentions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentions", projectId] });
      toast({
        title: "Mención eliminada",
        description: "La mención se ha eliminado correctamente",
      });
    },
  });

  // Helper to convert search results to mention data
  const searchResultsToMentions = (
    results: SearchResult[],
    projectId: string
  ): CreateMentionData[] => {
    return results.map((result) => ({
      project_id: projectId,
      entity_id: result.matchedEntityId || null,
      url: result.url,
      title: result.title || null,
      description: result.description || result.metadata?.description || null,
      source_domain: extractDomain(result.url),
      published_at: result.metadata?.publishedDate || null,
      matched_keywords: result.matchedKeywords || [],
      raw_metadata: (result.metadata || {}) as Json,
    }));
  };

  return {
    mentions: mentionsQuery.data || [],
    isLoading: mentionsQuery.isLoading,
    error: mentionsQuery.error,
    saveMention: saveMentionMutation.mutate,
    saveManyMentions: saveManyMentionsMutation.mutate,
    updateMention: updateMentionMutation.mutate,
    deleteMention: deleteMentionMutation.mutate,
    isSaving: saveMentionMutation.isPending || saveManyMentionsMutation.isPending,
    searchResultsToMentions,
  };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

// Stats hook for dashboard
export function useMentionStats(projectId: string | undefined) {
  return useQuery({
    queryKey: ["mention-stats", projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const { data, error } = await supabase
        .from("mentions")
        .select("id, sentiment, source_domain, created_at, is_read")
        .eq("project_id", projectId)
        .eq("is_archived", false);

      if (error) throw error;

      const mentions = data || [];
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      return {
        total: mentions.length,
        unread: mentions.filter((m) => !m.is_read).length,
        last24h: mentions.filter((m) => new Date(m.created_at) > oneDayAgo).length,
        lastWeek: mentions.filter((m) => new Date(m.created_at) > oneWeekAgo).length,
        bySentiment: {
          positivo: mentions.filter((m) => m.sentiment === "positivo").length,
          neutral: mentions.filter((m) => m.sentiment === "neutral").length,
          negativo: mentions.filter((m) => m.sentiment === "negativo").length,
          unknown: mentions.filter((m) => !m.sentiment).length,
        },
        topDomains: Object.entries(
          mentions.reduce((acc, m) => {
            if (m.source_domain) {
              acc[m.source_domain] = (acc[m.source_domain] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>)
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
      };
    },
    enabled: !!projectId,
  });
}
