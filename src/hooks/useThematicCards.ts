import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Mention } from "./useMentions";

export type CardType = "conversation_analysis" | "informative";
export type CardStatus = "draft" | "published";

export interface ConversationAnalysisContent {
  volumeByChannel: {
    mediosDigitales: number;
    facebook: number;
    twitter: number;
    instagram: number;
    linkedin: number;
    tiktok: number;
    otros: number;
  };
  totalMentions: number;
  estimatedReach: string;
  sentimentDistribution: {
    positivo: number;
    neutral: number;
    negativo: number;
  };
  mainNarratives: Array<{
    narrative: string;
    volume: number;
    percentage: number;
  }>;
  relevantActors: Array<{
    name: string;
    type: string;
    mentions: number;
    description: string;
  }>;
  risks: string[];
  recommendations: string[];
  executiveSummary: string;
}

export interface InformativeContent {
  context: string;
  whatIsHappening: Array<{
    title: string;
    description: string;
  }>;
  localImplications: Array<{
    title: string;
    description: string;
  }>;
  sources: Array<{
    name: string;
    url: string;
    date: string;
  }>;
  executiveSummary: string;
}

export interface ThematicCard {
  id: string;
  project_id: string;
  title: string;
  card_type: CardType;
  period_start: string | null;
  period_end: string | null;
  status: CardStatus;
  content: ConversationAnalysisContent | InformativeContent;
  mention_ids: string[];
  created_at: string;
  updated_at: string;
}

export function useThematicCards(projectId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all thematic cards for project
  const { data: cards = [], isLoading, error } = useQuery({
    queryKey: ["thematic-cards", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data } = await api.get(`/projects/${projectId}/thematic-cards`);
      
      return (data || []).map(card => ({
        ...card,
        content: card.content as unknown as ConversationAnalysisContent | InformativeContent,
      })) as ThematicCard[];
    },
    enabled: !!projectId,
  });

  // Generate card content with AI
  const generateMutation = useMutation({
    mutationFn: async ({
      cardType,
      mentions,
      title,
      additionalContext,
    }: {
      cardType: CardType;
      mentions: Mention[];
      title: string;
      additionalContext?: string;
    }) => {
      const { data } = await api.post("/thematic-cards/generate", {
          cardType,
          title,
          additionalContext,
          mentions: mentions.map(m => ({
            id: m.id,
            title: m.title?.substring(0, 450),
            description: m.description?.substring(0, 450),
            url: m.url,
            source_domain: m.source_domain,
            sentiment: m.sentiment,
            created_at: m.created_at,
            matched_keywords: m.matched_keywords || [],
          })),
      });
      if (!data.success) throw new Error(data.error || "Failed to generate content");
      
      return data.content;
    },
  });

  // Regenerate a specific section with AI
  const regenerateSectionMutation = useMutation({
    mutationFn: async ({
      section,
      cardType,
      mentions,
      title,
      currentContent,
    }: {
      section: string;
      cardType: CardType;
      mentions: Mention[];
      title: string;
      currentContent: ConversationAnalysisContent | InformativeContent;
    }) => {
      const { data } = await api.post("/thematic-cards/generate", {
          cardType,
          title,
          regenerateSection: section,
          currentContent,
          mentions: mentions.map(m => ({
            id: m.id,
            title: m.title?.substring(0, 450),
            description: m.description?.substring(0, 450),
            url: m.url,
            source_domain: m.source_domain,
            sentiment: m.sentiment,
            created_at: m.created_at,
            matched_keywords: m.matched_keywords || [],
          })),
      });
      if (!data.success) throw new Error(data.error || "Failed to regenerate section");
      
      return { section: data.section, content: data.content };
    },
    onError: (error) => {
      toast({
        title: "Error al regenerar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create a new thematic card
  const createMutation = useMutation({
    mutationFn: async ({
      title,
      cardType,
      content,
      mentionIds,
      periodStart,
      periodEnd,
    }: {
      title: string;
      cardType: CardType;
      content: ConversationAnalysisContent | InformativeContent;
      mentionIds: string[];
      periodStart?: Date;
      periodEnd?: Date;
    }) => {
      if (!projectId) throw new Error("No project selected");

      const { data } = await api.post("/thematic-cards", {
          project_id: projectId,
          title,
          card_type: cardType,
          content: content,
          mention_ids: mentionIds,
          period_start: periodStart?.toISOString().split("T")[0],
          period_end: periodEnd?.toISOString().split("T")[0],
          status: "draft" as const,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thematic-cards", projectId] });
      toast({ title: "Ficha creada", description: "La ficha temática se guardó como borrador." });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update card content
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<ThematicCard, "title" | "content" | "status">>;
    }) => {
      const { data } = await api.patch(`/thematic-cards/${id}`, updates as Record<string, unknown>);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thematic-cards", projectId] });
      toast({ title: "Ficha actualizada" });
    },
    onError: (error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete a card
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/thematic-cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thematic-cards", projectId] });
      toast({ title: "Ficha eliminada" });
    },
    onError: (error) => {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    cards,
    isLoading,
    error,
    generate: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    regenerateSection: regenerateSectionMutation.mutateAsync,
    isRegenerating: regenerateSectionMutation.isPending,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    delete: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
