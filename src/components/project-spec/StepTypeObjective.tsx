import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ProjectFormData } from "@/pages/ProjectSpecBuilder";
import { Search, FileSearch, AlertTriangle, BarChart3 } from "lucide-react";

interface StepTypeObjectiveProps {
  form: UseFormReturn<ProjectFormData>;
}

const PROJECT_TYPES = [
  {
    value: "monitoreo",
    label: "Monitoreo",
    description: "Seguimiento continuo de conversaciones y menciones",
    icon: Search,
  },
  {
    value: "investigacion",
    label: "Investigación",
    description: "Análisis profundo de un tema específico",
    icon: FileSearch,
  },
  {
    value: "crisis",
    label: "Crisis",
    description: "Gestión y seguimiento de situaciones críticas",
    icon: AlertTriangle,
  },
  {
    value: "benchmark",
    label: "Benchmark",
    description: "Comparación con competidores o industria",
    icon: BarChart3,
  },
];

const StepTypeObjective = ({ form }: StepTypeObjectiveProps) => {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="tipo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de Proyecto *</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value}
                className="grid grid-cols-1 gap-3 md:grid-cols-2"
              >
                {PROJECT_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <label
                      key={type.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                        field.value === type.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value={type.value} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="font-medium">{type.label}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {type.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="objetivo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Objetivo del Proyecto *</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Ej: Identificar el sentimiento público hacia nuestra marca en redes sociales para optimizar nuestra estrategia de comunicación..."
                className="min-h-[120px] resize-none bg-background"
                {...field}
              />
            </FormControl>
            <FormDescription>
              Describe qué quieres lograr con este análisis. Sé específico sobre las preguntas que quieres responder.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

export default StepTypeObjective;
