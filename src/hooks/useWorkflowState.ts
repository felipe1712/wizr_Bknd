import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/ProjectContext";

export type WorkflowStep = "define" | "capture" | "analyze" | "report";

export interface StepState {
  step: WorkflowStep;
  label: string;
  shortLabel: string;
  description: string;
  status: "pending" | "in_progress" | "complete";
  count: number;
  route: string;
  actionLabel: string;
  actionRoute: string;
}

export interface WorkflowState {
  steps: StepState[];
  currentStep: WorkflowStep;
  nextAction: {
    label: string;
    route: string;
    description: string;
  };
  progress: number; // 0-100
  isLoading: boolean;
}

export function useWorkflowState(): WorkflowState {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id;

  // Fetch entities count
  const { data: entitiesData, isLoading: loadingEntities } = useQuery({
    queryKey: ["workflow-entities", projectId],
    queryFn: async () => {
      if (!projectId) return { count: 0, keywords: 0 };
      const { data, error } = await supabase
        .from("entities")
        .select("id, palabras_clave")
        .eq("project_id", projectId)
        .eq("activo", true);
      if (error) throw error;
      const keywords = (data || []).reduce((sum, e) => sum + (e.palabras_clave?.length || 0), 0);
      return { count: data?.length || 0, keywords };
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  // Fetch mentions count
  const { data: mentionsData, isLoading: loadingMentions } = useQuery({
    queryKey: ["workflow-mentions", projectId],
    queryFn: async () => {
      if (!projectId) return { total: 0, analyzed: 0, unanalyzed: 0 };
      const { data, error } = await supabase
        .from("mentions")
        .select("id, sentiment")
        .eq("project_id", projectId)
        .eq("is_archived", false);
      if (error) throw error;
      const mentions = data || [];
      return {
        total: mentions.length,
        analyzed: mentions.filter((m) => m.sentiment).length,
        unanalyzed: mentions.filter((m) => !m.sentiment).length,
      };
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  // Fetch thematic cards / reports count
  const { data: reportsData, isLoading: loadingReports } = useQuery({
    queryKey: ["workflow-reports", projectId],
    queryFn: async () => {
      if (!projectId) return { cards: 0 };
      const { data, error } = await supabase
        .from("thematic_cards")
        .select("id")
        .eq("project_id", projectId);
      if (error) throw error;
      return { cards: data?.length || 0 };
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const isLoading = loadingEntities || loadingMentions || loadingReports;

  const steps = useMemo((): StepState[] => {
    const entities = entitiesData?.count || 0;
    const keywords = entitiesData?.keywords || 0;
    const mentions = mentionsData?.total || 0;
    const analyzed = mentionsData?.analyzed || 0;
    const cards = reportsData?.cards || 0;

    // Determine statuses
    const defineStatus: StepState["status"] = entities > 0 ? "complete" : "pending";
    const captureStatus: StepState["status"] = mentions > 0 ? "complete" : entities > 0 ? "in_progress" : "pending";
    const analyzeStatus: StepState["status"] = analyzed > 0 ? "complete" : mentions > 0 ? "in_progress" : "pending";
    const reportStatus: StepState["status"] = cards > 0 ? "complete" : analyzed > 0 ? "in_progress" : "pending";

    return [
      {
        step: "define",
        label: "Definir",
        shortLabel: "1",
        description: "Entidades y palabras clave",
        status: defineStatus,
        count: entities,
        route: "/dashboard/configuracion",
        actionLabel: entities > 0 ? "Editar entidades" : "Crear entidad",
        actionRoute: "/dashboard/configuracion",
      },
      {
        step: "capture",
        label: "Capturar",
        shortLabel: "2",
        description: "Buscar y guardar menciones",
        status: captureStatus,
        count: mentions,
        route: "/dashboard/fuentes",
        actionLabel: mentions > 0 ? "Buscar más" : "Buscar menciones",
        actionRoute: "/dashboard/fuentes",
      },
      {
        step: "analyze",
        label: "Analizar",
        shortLabel: "3",
        description: "Procesar datos e insights",
        status: analyzeStatus,
        count: analyzed,
        route: "/dashboard/semantica",
        actionLabel: analyzed > 0 ? "Ver análisis" : "Analizar datos",
        actionRoute: "/dashboard/semantica",
      },
      {
        step: "report",
        label: "Reportar",
        shortLabel: "4",
        description: "Generar entregables",
        status: reportStatus,
        count: cards,
        route: "/dashboard/reportes",
        actionLabel: cards > 0 ? "Ver reportes" : "Crear reporte",
        actionRoute: "/dashboard/reportes",
      },
    ];
  }, [entitiesData, mentionsData, reportsData]);

  const currentStep = useMemo((): WorkflowStep => {
    const pendingStep = steps.find((s) => s.status === "pending" || s.status === "in_progress");
    return pendingStep?.step || "report";
  }, [steps]);

  const nextAction = useMemo(() => {
    const current = steps.find((s) => s.step === currentStep);
    if (!current) {
      return {
        label: "Ver reportes",
        route: "/dashboard/reportes",
        description: "Todos los pasos completados",
      };
    }
    return {
      label: current.actionLabel,
      route: current.actionRoute,
      description: current.description,
    };
  }, [steps, currentStep]);

  const progress = useMemo(() => {
    const completeCount = steps.filter((s) => s.status === "complete").length;
    return (completeCount / steps.length) * 100;
  }, [steps]);

  return {
    steps,
    currentStep,
    nextAction,
    progress,
    isLoading,
  };
}
