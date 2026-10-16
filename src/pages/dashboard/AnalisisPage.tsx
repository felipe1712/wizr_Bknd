import { useSearchParams } from "react-router-dom";
import { Eye, MessageSquareText, GitCompare, Users } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { NoProjectState } from "@/components/layout/NoProjectState";
import InsightsPage from "@/pages/dashboard/InsightsPage";
import SemanticaPage from "@/pages/dashboard/SemanticaPage";
import ComparativaPage from "@/pages/dashboard/ComparativaPage";
import InfluenciadoresPage from "@/pages/dashboard/InfluenciadoresPage";

const VIEWS = [
  { id: "panorama", label: "Panorama", icon: Eye, Component: InsightsPage },
  { id: "semantica", label: "Semántica", icon: MessageSquareText, Component: SemanticaPage },
  { id: "comparativa", label: "Comparativa", icon: GitCompare, Component: ComparativaPage },
  { id: "influenciadores", label: "Influenciadores", icon: Users, Component: InfluenciadoresPage },
] as const;

/**
 * Paso 3 del flujo: un solo destino de análisis con navegación interna,
 * en lugar de cuatro secciones separadas en el sidebar.
 */
const AnalisisPage = () => {
  const [params, setParams] = useSearchParams();
  const { selectedProject } = useProject();
  const active = params.get("v") ?? "panorama";
  const current = VIEWS.find((v) => v.id === active) ?? VIEWS[0];

  if (!selectedProject) {
    return <NoProjectState action="analizar las menciones capturadas" />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="section-label mb-1">Paso 3 · Analizar</p>
        <h1 className="text-2xl font-bold">Análisis</h1>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const isActive = v.id === current.id;
          return (
            <button
              key={v.id}
              onClick={() => setParams({ v: v.id })}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {v.label}
            </button>
          );
        })}
      </div>

      <current.Component />
    </div>
  );
};

export default AnalisisPage;
