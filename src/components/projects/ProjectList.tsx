import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { Search, FileSearch, AlertTriangle, BarChart3, Calendar, Globe, MoreHorizontal, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ProjectType = "monitoreo" | "investigacion" | "crisis" | "benchmark";
type SensitivityLevel = "bajo" | "medio" | "alto" | "critico";
type TemporalScope = "tiempo_real" | "diario" | "semanal" | "mensual" | "historico";

interface Project {
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

const TYPE_CONFIG: Record<ProjectType, { label: string; icon: React.ElementType; color: string }> = {
  monitoreo: { label: "Monitoreo", icon: Search, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
  investigacion: { label: "Investigación", icon: FileSearch, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
  crisis: { label: "Crisis", icon: AlertTriangle, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
  benchmark: { label: "Benchmark", icon: BarChart3, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
};

const SENSITIVITY_BADGES: Record<SensitivityLevel, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  bajo: { label: "Bajo", variant: "outline" },
  medio: { label: "Medio", variant: "secondary" },
  alto: { label: "Alto", variant: "default" },
  critico: { label: "Crítico", variant: "destructive" },
};

const REGION_LABELS: Record<string, string> = {
  mexico: "México",
  latam: "Latinoamérica",
  usa: "Estados Unidos",
  espana: "España",
  global: "Global",
};

const ProjectList = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects((data as Project[]) || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesType = typeFilter === "all" || project.tipo === typeFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "activo" && project.activo) ||
      (statusFilter === "inactivo" && !project.activo);
    return matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tipo:</span>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 bg-background">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="monitoreo">Monitoreo</SelectItem>
              <SelectItem value="investigacion">Investigación</SelectItem>
              <SelectItem value="crisis">Crisis</SelectItem>
              <SelectItem value="benchmark">Benchmark</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Estado:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-background">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="inactivo">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-sm text-muted-foreground">
          {filteredProjects.length} proyecto{filteredProjects.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Project Grid */}
      {filteredProjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4">
              <FileSearch className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No hay proyectos</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {projects.length === 0
                ? "Crea tu primer proyecto para comenzar"
                : "No hay proyectos que coincidan con los filtros"}
            </p>
            {projects.length === 0 && (
              <Button className="mt-4" onClick={() => navigate("/nuevo-proyecto")}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Proyecto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const typeConfig = TYPE_CONFIG[project.tipo];
            const TypeIcon = typeConfig.icon;

            return (
              <Card
                key={project.id}
                className={`group cursor-pointer transition-all hover:shadow-md ${
                  !project.activo ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-lg p-2 ${typeConfig.color}`}>
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {typeConfig.label}
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem>Ver detalles</DropdownMenuItem>
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardTitle className="mt-2 line-clamp-1 text-lg">
                    {project.nombre}
                  </CardTitle>
                  {project.descripcion && (
                    <CardDescription className="line-clamp-2">
                      {project.descripcion}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {project.objetivo}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={SENSITIVITY_BADGES[project.sensibilidad].variant}>
                      {SENSITIVITY_BADGES[project.sensibilidad].label}
                    </Badge>
                    {!project.activo && (
                      <Badge variant="outline" className="border-muted-foreground/30">
                        Inactivo
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(project.created_at), "d MMM yyyy", { locale: es })}
                    </div>
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {project.alcance_geografico
                        .slice(0, 2)
                        .map((r) => REGION_LABELS[r] || r)
                        .join(", ")}
                      {project.alcance_geografico.length > 2 && (
                        <span>+{project.alcance_geografico.length - 2}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectList;
