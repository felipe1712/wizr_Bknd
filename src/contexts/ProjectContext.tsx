import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type ProjectType = "monitoreo" | "investigacion" | "crisis" | "benchmark";
type SensitivityLevel = "bajo" | "medio" | "alto" | "critico";
type TemporalScope = "tiempo_real" | "diario" | "semanal" | "mensual" | "historico";

export interface Project {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: ProjectType;
  objetivo: string;
  audiencia: string;
  sensibilidad: SensitivityLevel;
  alcance_temporal: TemporalScope;
  alcance_geografico: string[];
  contexto_estrategico: string | null;
  version: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  loading: boolean;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const SELECTED_PROJECT_KEY = "wizr_selected_project_id";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProjectState] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchProjects = async () => {
    if (!user) {
      setProjects([]);
      setSelectedProjectState(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("activo", true)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const projectList = (data as Project[]) || [];
      setProjects(projectList);

      // Restore ONLY if user explicitly selected one before. Never auto-pick.
      const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
      if (savedProjectId) {
        const savedProject = projectList.find((p) => p.id === savedProjectId);
        if (savedProject) {
          setSelectedProjectState(savedProject);
        } else {
          // Saved project no longer exists — clear and stay neutral
          localStorage.removeItem(SELECTED_PROJECT_KEY);
          setSelectedProjectState(null);
        }
      } else {
        setSelectedProjectState(null);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const setSelectedProject = (project: Project | null) => {
    setSelectedProjectState(project);
    if (project) {
      localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
    } else {
      localStorage.removeItem(SELECTED_PROJECT_KEY);
    }
  };

  const refreshProjects = async () => {
    await fetchProjects();
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProject,
        setSelectedProject,
        loading,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
