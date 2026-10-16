import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectsOverview, type ProjectWorkflowSummary } from "@/hooks/useProjectsOverview";
import {
  Plus,
  ArrowRight,
  ArrowLeft,
  Trophy,
  Sparkles,
  Check,
  Settings,
  Search,
  BarChart3,
  FileText,
  FolderOpen,
} from "lucide-react";

const STEP_ICONS = [Settings, Search, BarChart3, FileText];
const STEP_NAMES = ["Definir", "Capturar", "Analizar", "Reportar"];
const STEP_ROUTES = [
  "/dashboard/configuracion",
  "/dashboard/fuentes",
  "/dashboard/analizar",
  "/dashboard/reportes",
];

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedProject, setSelectedProject } = useProject();
  const { summaries, isLoading } = useProjectsOverview();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    (user?.email ? user.email.split("@")[0] : "");

  const active: ProjectWorkflowSummary | undefined = selectedProject
    ? summaries.find((s) => s.project.id === selectedProject.id)
    : undefined;

  const renderHeader = () => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
      <p className="section-label mb-2 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        Wizr
      </p>
      <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-4xl">
        {greeting}
        {firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground md:text-base">
        {active
          ? "Este es el estado del proyecto en el que estás trabajando."
          : "¿En qué proyecto vamos a trabajar?"}
      </p>
    </motion.div>
  );

  const benchmarking = (
    <>
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Otros módulos
      </h2>
      <Card
        onClick={() => navigate("/dashboard/performance")}
        className="group cursor-pointer border-accent/20 bg-gradient-to-br from-accent/10 to-accent/5 transition-all hover:shadow-md"
      >
        <CardContent className="flex items-center gap-4 p-5">
          <div className="rounded-lg bg-accent/15 p-2.5 text-accent-foreground">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">Benchmarking competitivo</h3>
            <p className="text-xs text-muted-foreground">
              Desempeño de perfiles por cliente, rankings y reportes de performance.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </CardContent>
      </Card>
    </>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        {renderHeader()}
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        {renderHeader()}
        <Card className="data-card">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no tienes proyectos. Crea el primero con el asistente conversacional.
            </p>
            <Button className="gap-1.5" onClick={() => navigate("/nuevo-proyecto")}>
              <Plus className="h-4 w-4" />
              Crear proyecto
            </Button>
          </CardContent>
        </Card>
        {benchmarking}
      </div>
    );
  }

  // ---- Estado 2: ya hay proyecto de trabajo -> solo su información ----
  if (active) {
    const stepValues = [active.entities, active.mentions, active.analyzed, active.reports];
    const others = summaries.filter((s) => s.project.id !== active.project.id);

    return (
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        {renderHeader()}

        <Card className="border-primary/30">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="section-label mb-1">Proyecto en curso</p>
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-semibold md:text-xl">
                    {active.project.nombre}
                  </h2>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {active.project.tipo}
                  </Badge>
                </div>
                {active.project.descripcion && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {active.project.descripcion}
                  </p>
                )}
              </div>
              <Button size="sm" className="gap-1.5" onClick={() => navigate(active.nextRoute)}>
                {active.nextLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Progress value={active.progress} className="mt-4 h-1.5" />

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STEP_NAMES.map((name, idx) => {
                const Icon = STEP_ICONS[idx];
                const value = stepValues[idx];
                const done = value > 0;
                return (
                  <button
                    key={name}
                    onClick={() => navigate(STEP_ROUTES[idx])}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors hover:border-primary/40 ${
                      done
                        ? "border-primary/30 bg-primary/5 text-foreground"
                        : "border-border bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {done ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : (
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate">{name}</span>
                    <span className="ml-auto font-semibold tabular-nums">{value}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setSelectedProject(null)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cambiar de proyecto
          </Button>
          {others.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {others.length} {others.length === 1 ? "otro proyecto" : "otros proyectos"} disponibles
            </span>
          )}
        </div>

        {benchmarking}
      </div>
    );
  }

  // ---- Estado 1: sin proyecto -> elegir en qué proyecto trabajar ----
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      {renderHeader()}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Elige un proyecto
        </h2>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="h-3.5 w-3.5" />
          Nuevo proyecto
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {summaries.map((s, i) => (
          <motion.button
            key={s.project.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i }}
            onClick={() => setSelectedProject(s.project)}
            className="rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <h3 className="truncate text-base font-semibold">{s.project.nombre}</h3>
              <Badge variant="outline" className="ml-auto text-[10px] capitalize">
                {s.project.tipo}
              </Badge>
            </div>
            {s.project.descripcion && (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {s.project.descripcion}
              </p>
            )}
            <Progress value={s.progress} className="mt-3 h-1" />
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              {s.mentions} menciones · sigue: <span className="font-medium text-foreground">{s.nextLabel}</span>
              <ArrowRight className="h-3 w-3" />
            </p>
          </motion.button>
        ))}
      </div>

      {benchmarking}
    </div>
  );
};

export default DashboardHomePage;
