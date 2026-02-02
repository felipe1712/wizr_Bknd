import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Settings,
  Search,
  BarChart3,
  FileText,
  ChevronRight,
  Sparkles,
  Check,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useWorkflowState, type StepState } from "@/hooks/useWorkflowState";
import { useProject } from "@/contexts/ProjectContext";
import { cn } from "@/lib/utils";

const stepIcons: Record<string, typeof Settings> = {
  define: Settings,
  capture: Search,
  analyze: BarChart3,
  report: FileText,
};

const stepColors: Record<string, string> = {
  define: "from-violet-500 to-purple-600",
  capture: "from-blue-500 to-cyan-600",
  analyze: "from-emerald-500 to-teal-600",
  report: "from-orange-500 to-amber-600",
};

const stepBgColors: Record<string, string> = {
  define: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  capture: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  analyze: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  report: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

interface StepCardProps {
  step: StepState;
  index: number;
  isNext: boolean;
}

function StepCard({ step, index, isNext }: StepCardProps) {
  const navigate = useNavigate();
  const Icon = stepIcons[step.step];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-300 cursor-pointer group",
          isNext && "ring-2 ring-primary ring-offset-2",
          step.status === "complete" && "bg-muted/30"
        )}
        onClick={() => navigate(step.route)}
      >
        {/* Gradient accent bar */}
        <div
          className={cn(
            "absolute top-0 left-0 right-0 h-1 bg-gradient-to-r",
            stepColors[step.step],
            step.status === "pending" && "opacity-30"
          )}
        />

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          {step.status === "complete" ? (
            <Badge variant="secondary" className="bg-primary/10 text-primary gap-1">
              <Check className="h-3 w-3" />
              Completado
            </Badge>
          ) : step.status === "in_progress" ? (
            <Badge className="gap-1 animate-pulse">
              <Sparkles className="h-3 w-3" />
              En progreso
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Pendiente
            </Badge>
          )}
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-lg",
                stepBgColors[step.step]
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-muted-foreground font-normal">Paso {index + 1}:</span>
                {step.label}
              </CardTitle>
              <CardDescription>{step.description}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div>
              {step.count > 0 && (
                <p className="text-2xl font-bold text-foreground">
                  {step.count}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    {step.step === "define"
                      ? "entidades"
                      : step.step === "capture"
                      ? "menciones"
                      : step.step === "analyze"
                      ? "analizadas"
                      : "reportes"}
                  </span>
                </p>
              )}
            </div>

            <Button
              variant={isNext ? "default" : "outline"}
              size="sm"
              className="gap-1 group-hover:gap-2 transition-all"
            >
              {step.actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function WorkflowStatusLanding() {
  const navigate = useNavigate();
  const { selectedProject } = useProject();
  const { steps, currentStep, nextAction, progress, isLoading } = useWorkflowState();

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Settings className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sin proyecto seleccionado</h2>
        <p className="text-muted-foreground mb-4">
          Selecciona o crea un proyecto para comenzar
        </p>
        <Button onClick={() => navigate("/nuevo-proyecto")}>
          Crear proyecto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Panel de Control
          </h1>
          <p className="text-muted-foreground">
            Proyecto: <span className="font-medium text-foreground">{selectedProject.nombre}</span>
          </p>
        </div>

        <Button onClick={() => navigate(nextAction.route)} size="lg" className="gap-2">
          <Sparkles className="h-4 w-4" />
          {nextAction.label}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Overall Progress */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold">Progreso del Análisis</h3>
              <p className="text-sm text-muted-foreground">
                {progress === 100
                  ? "¡Flujo completado! Puedes generar reportes."
                  : `Siguiente paso: ${nextAction.description}`}
              </p>
            </div>
            <span className="text-2xl font-bold text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Step Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <StepCard
            key={step.step}
            step={step}
            index={index}
            isNext={step.step === currentStep}
          />
        ))}
      </div>

      {/* Quick Tips */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary flex-shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Consejo del flujo</h4>
              <p className="text-sm text-muted-foreground">
                {currentStep === "define" &&
                  "Comienza definiendo las entidades y palabras clave que quieres monitorear. Esto mejorará la precisión de las búsquedas."}
                {currentStep === "capture" &&
                  "Busca menciones en noticias y redes sociales. Guarda las que sean relevantes para tu análisis."}
                {currentStep === "analyze" &&
                  "Ejecuta el análisis semántico para obtener insights sobre sentimiento, temas y tendencias."}
                {currentStep === "report" &&
                  "Genera reportes inteligentes para compartir los hallazgos con tu equipo o clientes."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
