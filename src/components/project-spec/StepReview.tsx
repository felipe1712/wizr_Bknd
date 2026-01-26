import { UseFormReturn } from "react-hook-form";
import { ProjectFormData } from "@/pages/ProjectSpecBuilder";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Target, Users, Shield, Clock, Globe } from "lucide-react";

interface StepReviewProps {
  form: UseFormReturn<ProjectFormData>;
}

const TYPE_LABELS: Record<string, string> = {
  monitoreo: "Monitoreo",
  investigacion: "Investigación",
  crisis: "Crisis",
  benchmark: "Benchmark",
};

const SENSITIVITY_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  bajo: { label: "Bajo", variant: "outline" },
  medio: { label: "Medio", variant: "secondary" },
  alto: { label: "Alto", variant: "default" },
  critico: { label: "Crítico", variant: "destructive" },
};

const TEMPORAL_LABELS: Record<string, string> = {
  tiempo_real: "Tiempo Real",
  diario: "Diario",
  semanal: "Semanal",
  mensual: "Mensual",
  historico: "Histórico",
};

const REGION_LABELS: Record<string, string> = {
  mexico: "México",
  latam: "Latinoamérica",
  usa: "Estados Unidos",
  espana: "España",
  global: "Global",
};

const StepReview = ({ form }: StepReviewProps) => {
  const values = form.getValues();

  const ReviewItem = ({
    icon: Icon,
    label,
    value,
    badge,
  }: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    badge?: { text: string; variant: "default" | "secondary" | "destructive" | "outline" };
  }) => (
    <div className="flex items-start gap-3 py-3">
      <div className="rounded-lg bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="mt-1 flex items-center gap-2">
          {typeof value === "string" ? (
            <p className="font-medium">{value}</p>
          ) : (
            value
          )}
          {badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          Revisa cuidadosamente los detalles de tu proyecto antes de crearlo.
          Podrás modificarlo después si es necesario.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="p-4">
          <h3 className="text-lg font-semibold">{values.nombre}</h3>
          {values.descripcion && (
            <p className="mt-1 text-sm text-muted-foreground">{values.descripcion}</p>
          )}
        </div>

        <Separator />

        <div className="divide-y divide-border px-4">
          <ReviewItem
            icon={FileText}
            label="Tipo de Proyecto"
            value={TYPE_LABELS[values.tipo] || values.tipo}
          />

          <ReviewItem
            icon={Target}
            label="Objetivo"
            value={values.objetivo}
          />

          <ReviewItem
            icon={Users}
            label="Audiencia"
            value={values.audiencia}
          />

          <ReviewItem
            icon={Shield}
            label="Sensibilidad"
            value={SENSITIVITY_LABELS[values.sensibilidad]?.label || values.sensibilidad}
            badge={
              SENSITIVITY_LABELS[values.sensibilidad]
                ? { text: SENSITIVITY_LABELS[values.sensibilidad].label, variant: SENSITIVITY_LABELS[values.sensibilidad].variant }
                : undefined
            }
          />

          <ReviewItem
            icon={Clock}
            label="Alcance Temporal"
            value={TEMPORAL_LABELS[values.alcance_temporal] || values.alcance_temporal}
          />

          <ReviewItem
            icon={Globe}
            label="Alcance Geográfico"
            value={
              <div className="flex flex-wrap gap-1">
                {values.alcance_geografico?.map((region) => (
                  <Badge key={region} variant="secondary">
                    {REGION_LABELS[region] || region}
                  </Badge>
                ))}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
};

export default StepReview;
