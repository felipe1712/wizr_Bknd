import { useNavigate, useLocation } from "react-router-dom";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWorkflowState, type StepState } from "@/hooks/useWorkflowState";
import { useProject } from "@/contexts/ProjectContext";

const countLabel: Record<StepState["step"], string> = {
  define: "entidades",
  capture: "menciones",
  analyze: "analizadas",
  report: "reportes",
};

/**
 * Barra de flujo del trabajo: Definir -> Capturar -> Analizar -> Reportar.
 * Siempre visible (incluido móvil) para que el usuario sepa dónde está.
 */
export function WorkflowFlowBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProject } = useProject();
  const { steps, nextAction, isLoading } = useWorkflowState();

  if (!selectedProject) return null;

  const isStepActive = (step: StepState) => location.pathname.startsWith(step.route);

  return (
    <div className="border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2">
        <div className="flex flex-1 items-center gap-1">
          {steps.map((step, idx) => {
            const active = isStepActive(step);
            const done = step.status === "complete";
            const inProgress = step.status === "in_progress";

            return (
              <div key={step.step} className="flex shrink-0 items-center">
                <button
                  onClick={() => navigate(step.route)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                      done
                        ? "bg-primary text-primary-foreground"
                        : inProgress
                        ? "border border-primary bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {done ? (
                      <Check className="h-3 w-3" />
                    ) : inProgress && isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      step.shortLabel
                    )}
                  </span>
                  <span className="font-medium">{step.label}</span>
                  {step.count > 0 && (
                    <span className="hidden text-[10px] text-muted-foreground sm:inline">
                      {step.count} {countLabel[step.step]}
                    </span>
                  )}
                </button>
                {idx < steps.length - 1 && (
                  <ArrowRight className="mx-0.5 h-3 w-3 shrink-0 text-border" />
                )}
              </div>
            );
          })}
        </div>

        <Button
          size="sm"
          variant="secondary"
          className="ml-auto h-7 shrink-0 gap-1 text-xs"
          onClick={() => navigate(nextAction.route)}
        >
          <span className="hidden sm:inline">Siguiente:</span>
          {nextAction.label}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
