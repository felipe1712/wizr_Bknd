import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type SentimentType = "positivo" | "neutral" | "negativo";

export interface SentimentResult {
  id: string;
  sentiment: SentimentType;
  confidence: number;
}

interface MentionForAnalysis {
  id: string;
  title: string | null;
  description: string | null;
}

interface AnalyzeSentimentResponse {
  success: boolean;
  results?: SentimentResult[];
  error?: string;
}

/**
 * Hook for analyzing sentiment of mentions
 * Uses Lovable AI for classification
 */
export function useSentimentAnalysis(projectId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const analyzeMutation = useMutation({
    mutationFn: async (mentions: MentionForAnalysis[]): Promise<SentimentResult[]> => {
      if (!mentions.length) return [];

      // Batch analyze in chunks of 25
      const BATCH_SIZE = 25;
      const results: SentimentResult[] = [];

      for (let i = 0; i < mentions.length; i += BATCH_SIZE) {
        const batch = mentions.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase.functions.invoke<AnalyzeSentimentResponse>(
          "analyze-sentiment",
          { body: { mentions: batch } }
        );

        if (error) throw error;
        if (!data?.success) {
          throw new Error(data?.error || "Error en análisis de sentimiento");
        }

        if (data.results) {
          results.push(...data.results);
        }
      }

      return results;
    },
    onError: (error) => {
      console.error("Sentiment analysis error:", error);
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast({
        title: "Error en análisis",
        description: message,
        variant: "destructive",
      });
    },
  });

  const updateMentionsSentiment = useMutation({
    mutationFn: async (sentiments: SentimentResult[]) => {
      if (!sentiments.length) return 0;

      // Update sentiments in batch
      const updates = sentiments.map((s) =>
        supabase
          .from("mentions")
          .update({ sentiment: s.sentiment })
          .eq("id", s.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        throw new Error(`${errors.length} actualizaciones fallaron`);
      }

      return sentiments.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["mentions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["mention-stats", projectId] });
      toast({
        title: "Sentimientos actualizados",
        description: `Se actualizaron ${count} menciones`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudieron actualizar",
        variant: "destructive",
      });
    },
  });

  /**
   * Analyze and persist sentiment for mentions
   */
  const analyzeAndSave = async (mentions: MentionForAnalysis[]) => {
    const results = await analyzeMutation.mutateAsync(mentions);
    if (results.length > 0) {
      await updateMentionsSentiment.mutateAsync(results);
    }
    return results;
  };

  /**
   * Analyze a single text string and return the sentiment
   */
  const analyzeText = async (text: string): Promise<SentimentType | null> => {
    if (!text?.trim()) return null;

    try {
      const { data, error } = await supabase.functions.invoke<AnalyzeSentimentResponse>(
        "analyze-sentiment",
        { body: { mentions: [{ id: "temp", title: text, description: null }] } }
      );

      if (error) throw error;
      if (!data?.success || !data.results?.length) return null;

      return data.results[0].sentiment;
    } catch (err) {
      console.error("Text sentiment analysis error:", err);
      return null;
    }
  };

  return {
    analyze: analyzeMutation.mutate,
    analyzeAsync: analyzeMutation.mutateAsync,
    analyzeAndSave,
    analyzeText,
    isAnalyzing: analyzeMutation.isPending,
    updateMentionsSentiment: updateMentionsSentiment.mutate,
    isUpdatingSentiments: updateMentionsSentiment.isPending,
  };
}
