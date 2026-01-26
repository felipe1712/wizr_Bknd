import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProjectFormData } from "@/pages/ProjectSpecBuilder";

interface StepBasicInfoProps {
  form: UseFormReturn<ProjectFormData>;
}

const StepBasicInfo = ({ form }: StepBasicInfoProps) => {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="nombre"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre del Proyecto *</FormLabel>
            <FormControl>
              <Input
                placeholder="Ej: Monitoreo de Marca Q1 2026"
                {...field}
                className="bg-background"
              />
            </FormControl>
            <FormDescription>
              Un nombre descriptivo que identifique claramente el proyecto
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="descripcion"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Descripción</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Describe brevemente el contexto y alcance del proyecto..."
                className="min-h-[100px] resize-none bg-background"
                {...field}
              />
            </FormControl>
            <FormDescription>
              Opcional. Proporciona contexto adicional sobre el proyecto
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

export default StepBasicInfo;
