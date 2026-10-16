import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AutoSaveConfig {
  id: string;
  project_id: string;
  is_enabled: boolean;
  required_keywords: string[];
  min_relevance_score: number;
  created_at: string;
  updated_at: string;
}

export interface AutoSaveConfigInput {
  is_enabled: boolean;
  required_keywords: string[];
  min_relevance_score: number;
}

export function useAutoSaveConfig(projectId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["auto-save-config", projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const { data, error } = await supabase
        .from("auto_save_configs")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error) throw error;
      return data as AutoSaveConfig | null;
    },
    enabled: !!projectId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (input: AutoSaveConfigInput) => {
      if (!projectId) throw new Error("No project selected");

      const { data, error } = await supabase
        .from("auto_save_configs")
        .upsert(
          {
            project_id: projectId,
            ...input,
          },
          { onConflict: "project_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data as AutoSaveConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-save-config", projectId] });
      toast({
        title: "Configuración guardada",
        description: "Las reglas de auto-guardado se han actualizado",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar la configuración",
        variant: "destructive",
      });
    },
  });

  /**
   * Evalúa si un resultado debe ser auto-guardado según las reglas configuradas
   */
  const shouldAutoSave = (
    text: string,
    matchedKeywords: string[] = []
  ): { shouldSave: boolean; relevanceScore: number; matchedRequired: string[] } => {
    if (!config?.is_enabled) {
      return { shouldSave: false, relevanceScore: 0, matchedRequired: [] };
    }

    const textLower = text.toLowerCase();
    const requiredKeywords = config.required_keywords || [];
    
    // Check which required keywords are present
    const matchedRequired = requiredKeywords.filter((kw) =>
      textLower.includes(kw.toLowerCase())
    );

    // Calculate relevance score based on keyword matches
    let relevanceScore = 0;
    if (requiredKeywords.length > 0) {
      relevanceScore = Math.round((matchedRequired.length / requiredKeywords.length) * 100);
    } else if (matchedKeywords.length > 0) {
      // If no required keywords configured, use matched keywords from search
      relevanceScore = Math.min(100, matchedKeywords.length * 20);
    }

    const meetsRelevance = relevanceScore >= config.min_relevance_score;
    const hasRequiredKeyword = requiredKeywords.length === 0 || matchedRequired.length > 0;

    return {
      shouldSave: meetsRelevance && hasRequiredKeyword,
      relevanceScore,
      matchedRequired,
    };
  };

  return {
    config,
    isLoading,
    isEnabled: config?.is_enabled ?? false,
    updateConfig: upsertMutation.mutate,
    isUpdating: upsertMutation.isPending,
    shouldAutoSave,
  };
}
