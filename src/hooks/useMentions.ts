import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
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

      const { data } = await api.get(`/projects/${projectId}/mentions`, {
        params: {
          ...filters,
          startDate: filters?.startDate?.toISOString(),
          endDate: filters?.endDate?.toISOString()
        }
      });
      return data as Mention[];
    },
    enabled: !!projectId,
  });

  const saveMentionMutation = useMutation({
    mutationFn: async (data: CreateMentionData) => {
      const { data: mention } = await api.post(`/projects/${data.project_id}/mentions`, data);
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
    mutationFn: async (params: { mentions: CreateMentionData[]; analyzeSentiment?: boolean }) => {
      const { data } = await api.post(`/projects/mentions/batch`, params);
      return data as Mention[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mentions", projectId] });
      toast({
        title: "Menciones guardadas",
        description: `Se guardaron ${data.length} menciones nuevas. Analizando sentimiento...`,
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
      const { data } = await api.patch(`/mentions/${id}`, updates);
      return data as Mention;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentions", projectId] });
    },
  });

  const deleteMentionMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/mentions/${id}`);
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

  // Helper to wrap the mutation with the new signature
  const saveManyMentions = (mentions: CreateMentionData[], analyzeSentiment = true) => {
    saveManyMentionsMutation.mutate({ mentions, analyzeSentiment });
  };

  // Mutation to analyze unanalyzed mentions on demand
  const analyzeUnanalyzedMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) return { analyzed: 0, errors: 0 };

      const { data } = await api.post(`/projects/${projectId}/mentions/analyze-sentiment`);
      return data as { analyzed: number; errors: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["mentions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["mention-stats", projectId] });
      toast({
        title: "Análisis completado",
        description: `Se analizaron ${result.analyzed} menciones${result.errors > 0 ? ` (${result.errors} errores)` : ""}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error en análisis",
        description: `No se pudo completar el análisis: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  return {
    mentions: mentionsQuery.data || [],
    isLoading: mentionsQuery.isLoading,
    error: mentionsQuery.error,
    saveMention: saveMentionMutation.mutate,
    saveManyMentions,
    updateMention: updateMentionMutation.mutate,
    deleteMention: deleteMentionMutation.mutate,
    isSaving: saveMentionMutation.isPending || saveManyMentionsMutation.isPending,
    searchResultsToMentions,
    analyzeUnanalyzed: analyzeUnanalyzedMutation.mutate,
    isAnalyzing: analyzeUnanalyzedMutation.isPending,
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

      const { data } = await api.get(`/projects/${projectId}/mentions/stats`);
      return data;
    },
    enabled: !!projectId,
  });
}
