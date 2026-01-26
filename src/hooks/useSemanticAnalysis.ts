import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mention, SentimentType } from "./useMentions";

export interface Topic {
  name: string;
  relevance: number;
  mentionCount: number;
}

export interface KeywordAnalysis {
  word: string;
  frequency: number;
  sentiment: SentimentType;
}

export interface SentimentDistribution {
  positivo: number;
  neutral: number;
  negativo: number;
}

export interface MentionSentiment {
  id: string;
  sentiment: SentimentType;
  confidence: number;
}

export interface SemanticAnalysisResult {
  topics: Topic[];
  keywords: KeywordAnalysis[];
  sentimentDistribution: SentimentDistribution;
  summary: string;
  mentionSentiments: MentionSentiment[];
  analyzedAt: Date;
  mentionCount: number;
}

interface AnalyzeResponse {
  success: boolean;
  analysis?: Omit<SemanticAnalysisResult, "analyzedAt" | "mentionCount">;
  error?: string;
}

export function useSemanticAnalysis(projectId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cachedResult, setCachedResult] = useState<SemanticAnalysisResult | null>(null);

  const MAX_MENTIONS_FOR_ANALYSIS = 120;
  const MAX_TEXT_CHARS = 900;

  const truncate = (value: string | null | undefined, max = MAX_TEXT_CHARS) => {
    if (!value) return null;
    const s = value.trim();
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…`;
  };

  const analyzeMutation = useMutation({
    mutationFn: async (mentions: Mention[]): Promise<SemanticAnalysisResult> => {
      if (!mentions.length) {
        throw new Error("No hay menciones para analizar");
      }

      const mentionsLimited = mentions.slice(0, MAX_MENTIONS_FOR_ANALYSIS);

      if (mentions.length > mentionsLimited.length) {
        toast({
          title: "Análisis parcial",
          description: `Para evitar errores de envío, se analizarán ${mentionsLimited.length} de ${mentions.length} menciones (las más recientes).`,
        });
      }

      // Prepare mentions for analysis (only send necessary fields)
      const mentionsForAnalysis = mentionsLimited.map((m) => ({
        id: m.id,
        title: truncate(m.title),
        description: truncate(m.description),
        url: m.url,
        source_domain: m.source_domain,
        matched_keywords: Array.isArray(m.matched_keywords) ? m.matched_keywords.slice(0, 25) : [],
      }));

      const { data, error } = await supabase.functions.invoke<AnalyzeResponse>(
        "analyze-semantics",
        { body: { mentions: mentionsForAnalysis } }
      );

      if (error) throw error;
      if (!data?.success || !data.analysis) {
        throw new Error(data?.error || "Error en el análisis");
      }

      const result: SemanticAnalysisResult = {
        ...data.analysis,
        analyzedAt: new Date(),
        mentionCount: mentionsLimited.length,
      };

      return result;
    },
    onSuccess: (result) => {
      setCachedResult(result);
      toast({
        title: "Análisis completado",
        description: `Se analizaron ${result.mentionCount} menciones exitosamente`,
      });
    },
    onError: (error) => {
      console.error("Semantic analysis error:", error);
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast({
        title: "Error en análisis",
        description: message,
        variant: "destructive",
      });
    },
  });

  const updateMentionsSentiment = useMutation({
    mutationFn: async (sentiments: MentionSentiment[]) => {
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
        description: error instanceof Error ? error.message : "No se pudieron actualizar los sentimientos",
        variant: "destructive",
      });
    },
  });

  const clearCache = () => setCachedResult(null);

  return {
    analyze: analyzeMutation.mutate,
    analyzeAsync: analyzeMutation.mutateAsync,
    isAnalyzing: analyzeMutation.isPending,
    result: cachedResult,
    clearCache,
    updateMentionsSentiment: updateMentionsSentiment.mutate,
    isUpdatingSentiments: updateMentionsSentiment.isPending,
  };
}
