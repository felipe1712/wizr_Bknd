import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowState, type StepState } from "@/hooks/useWorkflowState";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WorkflowProgressBarProps {
  compact?: boolean;
}

export function WorkflowProgressBar({ compact = false }: WorkflowProgressBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { steps, nextAction, progress, isLoading } = useWorkflowState();

  const getStepIcon = (step: StepState) => {
    if (step.status === "complete") {
      return <Check className="h-3.5 w-3.5" />;
    }
    if (step.status === "in_progress" && isLoading) {
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    }
    return <span className="text-xs font-semibold">{step.shortLabel}</span>;
  };

  const getStepStyles = (step: StepState, isActive: boolean) => {
    const baseStyles = "flex items-center justify-center rounded-full transition-all duration-200";
    
    if (step.status === "complete") {
      return cn(baseStyles, "bg-primary text-primary-foreground");
    }
    if (step.status === "in_progress") {
      return cn(baseStyles, "bg-primary/20 text-primary border-2 border-primary");
    }
    if (isActive) {
      return cn(baseStyles, "bg-accent text-accent-foreground");
    }
    return cn(baseStyles, "bg-muted text-muted-foreground");
  };

  const isStepActive = (step: StepState) => {
    return location.pathname.startsWith(step.route);
  };

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          {steps.map((step, idx) => {
            const isActive = isStepActive(step);
            return (
              <Tooltip key={step.step}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(step.route)}
                    className={cn(
                      getStepStyles(step, isActive),
                      "h-6 w-6 cursor-pointer hover:scale-110"
                    )}
                  >
                    {getStepIcon(step)}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <p className="font-medium">{step.label}</p>
                  <p className="text-muted-foreground">{step.description}</p>
                  {step.count > 0 && (
                    <p className="text-primary font-medium mt-1">
                      {step.count} {step.step === "define" ? "entidades" : step.step === "capture" ? "menciones" : step.step === "analyze" ? "analizadas" : "reportes"}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Next action button */}
          <div className="ml-2 h-4 w-px bg-border" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
            onClick={() => navigate(nextAction.route)}
          >
            {nextAction.label}
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className="w-full bg-card border-b border-border px-4 py-3">
      <div className="max-w-4xl mx-auto">
        {/* Progress bar background */}
        <div className="relative mb-4">
          <div className="absolute inset-0 h-1 bg-muted rounded-full top-1/2 -translate-y-1/2 mx-8" />
          <motion.div
            className="absolute h-1 bg-primary rounded-full top-1/2 -translate-y-1/2 left-8"
            initial={{ width: 0 }}
            animate={{ width: `calc(${progress}% - 4rem)` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />

          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step, idx) => {
              const isActive = isStepActive(step);
              return (
                <TooltipProvider key={step.step}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => navigate(step.route)}
                        className="flex flex-col items-center gap-2 cursor-pointer group"
                      >
                        <motion.div
                          className={cn(
                            getStepStyles(step, isActive),
                            "h-8 w-8 group-hover:scale-110"
                          )}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {getStepIcon(step)}
                        </motion.div>
                        <div className="text-center">
                          <p className={cn(
                            "text-xs font-medium",
                            isActive ? "text-primary" : "text-foreground"
                          )}>
                            {step.label}
                          </p>
                          {step.count > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              {step.count}
                            </p>
                          )}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{step.description}</p>
                      <p className="text-primary font-medium">{step.actionLabel}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>

        {/* Next action CTA */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <span className="text-sm text-muted-foreground">Siguiente:</span>
          <Button
            size="sm"
            onClick={() => navigate(nextAction.route)}
            className="gap-1"
          >
            {nextAction.label}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
