import { useNavigate } from "react-router-dom";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/ProjectContext";

interface NoProjectStateProps {
  /** Qué podría hacer el usuario aquí una vez tenga proyecto */
  action?: string;
}

/**
 * Estado vacío único y guiado para todas las vistas que dependen de un proyecto.
 */
export function NoProjectState({ action = "trabajar en esta vista" }: NoProjectStateProps) {
  const navigate = useNavigate();
  const { projects, setSelectedProject } = useProject();

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center py-16 text-center">
      <div className="rounded-2xl bg-primary/10 p-4">
        <FolderOpen className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Elige un proyecto para empezar</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Necesitas un proyecto activo para {action}. Selecciónalo abajo o créalo desde cero.
      </p>

      {projects.length > 0 && (
        <div className="mt-6 w-full space-y-2">
          {projects.slice(0, 5).map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-muted"
            >
              <span className="truncate font-medium">{p.nombre}</span>
              <span className="text-xs capitalize text-muted-foreground">{p.tipo}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => navigate("/nuevo-proyecto")} className="gap-2">
          <Plus className="h-4 w-4" />
          Crear proyecto
        </Button>
        <Button variant="outline" onClick={() => navigate("/dashboard/proyectos")}>
          Ver todos
        </Button>
      </div>
    </div>
  );
}

export default NoProjectState;
