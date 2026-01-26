import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ProjectFormData } from "@/pages/ProjectSpecBuilder";
import { Shield, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";

interface StepAudienceSensitivityProps {
  form: UseFormReturn<ProjectFormData>;
}

const SENSITIVITY_LEVELS = [
  {
    value: "bajo",
    label: "Bajo",
    description: "Información pública, sin restricciones de acceso",
    icon: ShieldOff,
    color: "text-green-600",
  },
  {
    value: "medio",
    label: "Medio",
    description: "Acceso limitado al equipo del proyecto",
    icon: Shield,
    color: "text-yellow-600",
  },
  {
    value: "alto",
    label: "Alto",
    description: "Información confidencial, acceso restringido",
    icon: ShieldCheck,
    color: "text-orange-600",
  },
  {
    value: "critico",
    label: "Crítico",
    description: "Máxima confidencialidad, solo directivos",
    icon: ShieldAlert,
    color: "text-red-600",
  },
];

const StepAudienceSensitivity = ({ form }: StepAudienceSensitivityProps) => {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="audiencia"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Audiencia Objetivo *</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Ej: Equipo de marketing y comunicación corporativa, directivos de la empresa..."
                className="min-h-[100px] resize-none bg-background"
                {...field}
              />
            </FormControl>
            <FormDescription>
              ¿Quién consumirá los resultados de este análisis? Define los roles o departamentos interesados.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="sensibilidad"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nivel de Sensibilidad *</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value}
                className="grid grid-cols-1 gap-3 md:grid-cols-2"
              >
                {SENSITIVITY_LEVELS.map((level) => {
                  const Icon = level.icon;
                  return (
                    <label
                      key={level.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                        field.value === level.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value={level.value} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${level.color}`} />
                          <span className="font-medium">{level.label}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {level.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </FormControl>
            <FormDescription>
              Define el nivel de confidencialidad de los datos y resultados del proyecto.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

export default StepAudienceSensitivity;
