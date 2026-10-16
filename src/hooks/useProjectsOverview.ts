import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject, type Project } from "@/contexts/ProjectContext";

export interface ProjectWorkflowSummary {
  project: Project;
  entities: number;
  mentions: number;
  analyzed: number;
  reports: number;
  /** Paso pendiente del ciclo */
  nextStep: "define" | "capture" | "analyze" | "report" | "done";
  nextLabel: string;
  nextRoute: string;
  progress: number; // 0-100
}

const NEXT_META: Record<
  ProjectWorkflowSummary["nextStep"],
  { label: string; route: string }
> = {
  define: { label: "Definir entidades", route: "/dashboard/configuracion" },
  capture: { label: "Capturar menciones", route: "/dashboard/fuentes" },
  analyze: { label: "Analizar datos", route: "/dashboard/analizar" },
  report: { label: "Generar reporte", route: "/dashboard/reportes" },
  done: { label: "Ver reportes", route: "/dashboard/reportes" },
};

/**
 * Resumen del estado de flujo de todos los proyectos (para el Inicio).
 * Solo lecturas agregadas, sin cambios de lógica de negocio.
 */
export function useProjectsOverview() {
  const { projects, loading } = useProject();
  const ids = projects.map((p) => p.id);

  const { data, isLoading } = useQuery({
    queryKey: ["projects-overview", ids],
    enabled: ids.length > 0,
    staleTime: 60000,
    queryFn: async () => {
      const counts = new Map<
        string,
        { entities: number; mentions: number; analyzed: number; reports: number }
      >();

      // Conteos exactos por proyecto (head:true evita traer filas y el límite de 1000)
      await Promise.all(
        ids.map(async (id) => {
          const [entities, mentions, analyzed, reports] = await Promise.all([
            supabase
              .from("entities")
              .select("id", { count: "exact", head: true })
              .eq("project_id", id)
              .eq("activo", true),
            supabase
              .from("mentions")
              .select("id", { count: "exact", head: true })
              .eq("project_id", id)
              .eq("is_archived", false),
            supabase
              .from("mentions")
              .select("id", { count: "exact", head: true })
              .eq("project_id", id)
              .eq("is_archived", false)
              .not("sentiment", "is", null),
            supabase.from("thematic_cards").select("id", { count: "exact", head: true }).eq("project_id", id),
          ]);

          counts.set(id, {
            entities: entities.count || 0,
            mentions: mentions.count || 0,
            analyzed: analyzed.count || 0,
            reports: reports.count || 0,
          });
        })
      );

      return counts;
    },
  });

  const summaries: ProjectWorkflowSummary[] = projects.map((project) => {
    const c = data?.get(project.id) || { entities: 0, mentions: 0, analyzed: 0, reports: 0 };
    const nextStep: ProjectWorkflowSummary["nextStep"] =
      c.entities === 0
        ? "define"
        : c.mentions === 0
        ? "capture"
        : c.analyzed === 0
        ? "analyze"
        : c.reports === 0
        ? "report"
        : "done";
    const completed = [c.entities > 0, c.mentions > 0, c.analyzed > 0, c.reports > 0].filter(
      Boolean
    ).length;

    return {
      project,
      ...c,
      nextStep,
      nextLabel: NEXT_META[nextStep].label,
      nextRoute: NEXT_META[nextStep].route,
      progress: (completed / 4) * 100,
    };
  });

  return { summaries, isLoading: loading || isLoading };
}
