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

  // Muestreo estratificado: hasta 60 menciones balanceadas por fecha, fuente y sentimiento
  const MAX_STRATIFIED_SAMPLE = 60;
  const MAX_TEXT_CHARS = 350; // Reducido para permitir más menciones

  const truncate = (value: string | null | undefined, max = MAX_TEXT_CHARS) => {
    if (!value) return null;
    const s = value.trim();
    if (s.length <= max) return s;
    return `${s.slice(0, max)}…`;
  };

  /**
   * Muestreo estratificado: selecciona menciones representativas
   * distribuyendo por fecha, fuente y sentimiento
   */
  const stratifiedSample = (mentions: Mention[], targetSize: number): Mention[] => {
    if (mentions.length <= targetSize) return mentions;

    // 1. Agrupar por semana
    const byWeek = new Map<string, Mention[]>();
    mentions.forEach((m) => {
      const date = m.published_at ? new Date(m.published_at) : new Date(m.created_at);
      const weekKey = `${date.getFullYear()}-W${Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7)}`;
      if (!byWeek.has(weekKey)) byWeek.set(weekKey, []);
      byWeek.get(weekKey)!.push(m);
    });

    // 2. Dentro de cada semana, agrupar por fuente
    const stratifiedGroups: Mention[][] = [];
    byWeek.forEach((weekMentions) => {
      const bySource = new Map<string, Mention[]>();
      weekMentions.forEach((m) => {
        const source = m.source_domain || "unknown";
        if (!bySource.has(source)) bySource.set(source, []);
        bySource.get(source)!.push(m);
      });
      bySource.forEach((sourceMentions) => {
        // 3. Dentro de cada fuente, agrupar por sentimiento
        const bySentiment = new Map<string, Mention[]>();
        sourceMentions.forEach((m) => {
          const sent = m.sentiment || "unanalyzed";
          if (!bySentiment.has(sent)) bySentiment.set(sent, []);
          bySentiment.get(sent)!.push(m);
        });
        bySentiment.forEach((sentMentions) => stratifiedGroups.push(sentMentions));
      });
    });

    // 4. Selección round-robin de cada grupo
    const selected: Mention[] = [];
    const groupIndices = stratifiedGroups.map(() => 0);
    let groupIdx = 0;
    
    while (selected.length < targetSize) {
      const group = stratifiedGroups[groupIdx];
      const idx = groupIndices[groupIdx];
      if (idx < group.length) {
        selected.push(group[idx]);
        groupIndices[groupIdx]++;
      }
      groupIdx = (groupIdx + 1) % stratifiedGroups.length;
      
      // Si ya recorrimos todos los grupos sin añadir nada, terminamos
      if (groupIndices.every((i, gi) => i >= stratifiedGroups[gi].length)) break;
    }

    return selected;
  };

  const analyzeMutation = useMutation({
    mutationFn: async (mentions: Mention[]): Promise<SemanticAnalysisResult> => {
      if (!mentions.length) {
        throw new Error("No hay menciones para analizar");
      }

      // Aplicar muestreo estratificado
      const sampledMentions = stratifiedSample(mentions, MAX_STRATIFIED_SAMPLE);

      if (mentions.length > sampledMentions.length) {
        toast({
          title: "Muestreo estratificado aplicado",
          description: `Se seleccionaron ${sampledMentions.length} menciones representativas de ${mentions.length} totales (balanceadas por fecha, fuente y sentimiento).`,
        });
      }

      // Prepare mentions for analysis (only send necessary fields)
      const mentionsForAnalysis = sampledMentions.map((m) => ({
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
        mentionCount: sampledMentions.length,
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
      if (!sentiments.length) return 0;
      
      // Update sentiments in batch
      const results = await Promise.all(
        sentiments.map(async (s) => {
          const { error, count } = await supabase
            .from("mentions")
            .update({ sentiment: s.sentiment })
            .eq("id", s.id);
          
          return { id: s.id, sentiment: s.sentiment, error, count };
        })
      );
      
      const failed = results.filter((r) => r.error);
      
      if (failed.length > 0) {
        console.error("Sentiment update failures:", failed);
        throw new Error(
          `${failed.length} actualizaciones fallaron: ${failed.map(f => f.error?.message || "Error desconocido").join(", ")}`
        );
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
