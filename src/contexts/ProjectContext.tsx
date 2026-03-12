import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";
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
      const { data } = await api.get("/projects", {
        params: {
          activo: true
        }
      });

      const projectList = (data as Project[]) || [];
      setProjects(projectList);

      // Restore previously selected project from localStorage
      const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
      if (savedProjectId) {
        const savedProject = projectList.find((p) => p.id === savedProjectId);
        if (savedProject) {
          setSelectedProjectState(savedProject);
        } else if (projectList.length > 0) {
          // Saved project no longer exists, select first
          setSelectedProjectState(projectList[0]);
          localStorage.setItem(SELECTED_PROJECT_KEY, projectList[0].id);
        }
      } else if (projectList.length > 0) {
        // No saved project, select first
        setSelectedProjectState(projectList[0]);
        localStorage.setItem(SELECTED_PROJECT_KEY, projectList[0].id);
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
