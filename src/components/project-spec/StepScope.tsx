import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ProjectFormData } from "@/pages/ProjectSpecBuilder";
import { Clock, Calendar, CalendarDays, CalendarRange, History } from "lucide-react";

interface StepScopeProps {
  form: UseFormReturn<ProjectFormData>;
}

const TEMPORAL_SCOPES = [
  { value: "tiempo_real", label: "Tiempo Real", description: "Monitoreo continuo 24/7", icon: Clock },
  { value: "diario", label: "Diario", description: "Reportes cada 24 horas", icon: Calendar },
  { value: "semanal", label: "Semanal", description: "Análisis cada 7 días", icon: CalendarDays },
  { value: "mensual", label: "Mensual", description: "Reportes mensuales", icon: CalendarRange },
  { value: "historico", label: "Histórico", description: "Análisis de datos pasados", icon: History },
];

const GEOGRAPHIC_REGIONS = [
  { value: "mexico", label: "México" },
  { value: "latam", label: "Latinoamérica" },
  { value: "usa", label: "Estados Unidos" },
  { value: "espana", label: "España" },
  { value: "global", label: "Global" },
];

const StepScope = ({ form }: StepScopeProps) => {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="alcance_temporal"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Alcance Temporal *</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value}
                className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
              >
                {TEMPORAL_SCOPES.map((scope) => {
                  const Icon = scope.icon;
                  return (
                    <label
                      key={scope.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                        field.value === scope.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value={scope.value} />
                      <Icon className="h-4 w-4 text-primary" />
                      <div>
                        <span className="font-medium">{scope.label}</span>
                        <p className="text-xs text-muted-foreground">{scope.description}</p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </FormControl>
            <FormDescription>
              ¿Con qué frecuencia necesitas actualizar los datos?
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="alcance_geografico"
        render={() => (
          <FormItem>
            <FormLabel>Alcance Geográfico *</FormLabel>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {GEOGRAPHIC_REGIONS.map((region) => (
                <FormField
                  key={region.value}
                  control={form.control}
                  name="alcance_geografico"
                  render={({ field }) => (
                    <FormItem
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                        field.value?.includes(region.value)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(region.value)}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            if (checked) {
                              field.onChange([...current, region.value]);
                            } else {
                              field.onChange(current.filter((v) => v !== region.value));
                            }
                          }}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer font-normal">
                        {region.label}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <FormDescription>
              Selecciona las regiones donde se realizará el análisis
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

export default StepScope;
