import { useState, useMemo } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useMentions } from "@/hooks/useMentions";
import { useEntities } from "@/hooks/useEntities";
import { DateRangeSelector, DateRangeConfig, calculateDateRange } from "@/components/reports/DateRangeSelector";
import { SmartReportGenerator } from "@/components/reports/SmartReportGenerator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileBarChart,
  Loader2,
  AlertCircle,
} from "lucide-react";

const ReportesPage = () => {
  const { selectedProject } = useProject();
  const [dateConfig, setDateConfig] = useState<DateRangeConfig>({
    type: "30d",
    cutoffHour: 8,
  });

  const dateRange = useMemo(() => calculateDateRange(dateConfig), [dateConfig]);

  const { mentions, isLoading, error } = useMentions(selectedProject?.id, { isArchived: false });
  const { entities } = useEntities(selectedProject?.id);

  const entityNames = useMemo(() => entities.map(e => e.nombre), [entities]);

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <FileBarChart className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Reportes</h2>
        <p className="text-muted-foreground max-w-md">
          Selecciona un proyecto para generar reportes inteligentes con datos de menciones
          y análisis semántico.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">
            Genera informes inteligentes del proyecto {selectedProject.nombre}
          </p>
        </div>

        <DateRangeSelector value={dateConfig} onChange={setDateConfig} />
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error al cargar los datos: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Smart Reports */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <SmartReportGenerator
          mentions={mentions}
          projectName={selectedProject.nombre}
          projectAudience={selectedProject.audiencia}
          projectObjective={selectedProject.objetivo}
          entityNames={entityNames}
          dateRange={{
            start: dateRange.startDate.toISOString(),
            end: dateRange.endDate.toISOString(),
            label: dateRange.label,
          }}
        />
      )}
    </div>
  );
};

export default ReportesPage;
