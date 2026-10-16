import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "@/contexts/ProjectContext";
import { useMentions, useMentionStats } from "@/hooks/useMentions";
import { useEntities } from "@/hooks/useEntities";
import { DateRangeSelector, DateRangeConfig, calculateDateRange } from "@/components/reports/DateRangeSelector";
import { SmartReportGenerator } from "@/components/reports/SmartReportGenerator";
import { SharedReportsList } from "@/components/reports/SharedReportsList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileBarChart,
  Loader2,
  AlertCircle,
  Database,
  ArrowRight,
  TrendingUp,
  Calendar,
  Sparkles,
  Filter,
  Users,
  BarChart3,
} from "lucide-react";
import { format, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

const ReportesPage = () => {
  const { selectedProject } = useProject();
  const navigate = useNavigate();
  const [dateConfig, setDateConfig] = useState<DateRangeConfig>({
    type: "30d",
    cutoffHour: 8,
  });

  const dateRange = useMemo(() => calculateDateRange(dateConfig), [dateConfig]);

  const { mentions, isLoading, error } = useMentions(selectedProject?.id, { isArchived: false });
  const { data: stats } = useMentionStats(selectedProject?.id);
  const { entities } = useEntities(selectedProject?.id);

  const entityNames = useMemo(() => entities.map(e => e.nombre), [entities]);

  // Filter mentions by date range
  const filteredMentions = useMemo(() => {
    if (!mentions) return [];
    return mentions.filter(m => {
      const mentionDate = new Date(m.published_at || m.created_at);
      return isWithinInterval(mentionDate, {
        start: dateRange.startDate,
        end: dateRange.endDate,
      });
    });
  }, [mentions, dateRange]);

  // Calculate sentiment breakdown for filtered mentions
  const sentimentBreakdown = useMemo(() => {
    const breakdown = {
      positivo: 0,
      neutral: 0,
      negativo: 0,
      sinAnalizar: 0,
    };
    filteredMentions.forEach(m => {
      if (m.sentiment === "positivo") breakdown.positivo++;
      else if (m.sentiment === "neutral") breakdown.neutral++;
      else if (m.sentiment === "negativo") breakdown.negativo++;
      else breakdown.sinAnalizar++;
    });
    return breakdown;
  }, [filteredMentions]);

  // Unique sources
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    filteredMentions.forEach(m => {
      if (m.source_domain) sources.add(m.source_domain);
    });
    return sources.size;
  }, [filteredMentions]);

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

      {/* Data Source Card - Makes connection to mentions explicit */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Datos para el Reporte</CardTitle>
                <CardDescription>
                  Los reportes se generan a partir de las menciones guardadas en tu proyecto
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/dashboard/fuentes")}
              className="gap-2"
            >
              <Database className="h-4 w-4" />
              Ir a Fuentes
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Mentions in range */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredMentions.length}</p>
                <p className="text-xs text-muted-foreground">Menciones en período</p>
              </div>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <Calendar className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-medium">{dateRange.label}</p>
                <p className="text-xs text-muted-foreground">
                  {format(dateRange.startDate, "dd MMM", { locale: es })} - {format(dateRange.endDate, "dd MMM", { locale: es })}
                </p>
              </div>
            </div>

            {/* Entities */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Users className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{entities.length}</p>
                <p className="text-xs text-muted-foreground">Entidades</p>
              </div>
            </div>

            {/* Unique sources */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <BarChart3 className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueSources}</p>
                <p className="text-xs text-muted-foreground">Fuentes únicas</p>
              </div>
            </div>

            {/* Sentiment summary */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-background border">
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  +{sentimentBreakdown.positivo}
                </Badge>
                <Badge variant="outline" className="text-gray-600 border-gray-200 bg-gray-50">
                  ~{sentimentBreakdown.neutral}
                </Badge>
                <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                  -{sentimentBreakdown.negativo}
                </Badge>
                {sentimentBreakdown.sinAnalizar > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                    ?{sentimentBreakdown.sinAnalizar}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Empty state warning */}
          {filteredMentions.length === 0 && !isLoading && (
            <Alert className="mt-4 border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                No hay menciones guardadas en el período seleccionado. 
                <Button 
                  variant="link" 
                  className="text-amber-800 underline p-0 h-auto ml-1"
                  onClick={() => navigate("/dashboard/fuentes")}
                >
                  Ve a Fuentes para recopilar menciones
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Low data warning */}
          {filteredMentions.length > 0 && filteredMentions.length < 10 && !isLoading && (
            <Alert className="mt-4 border-blue-200 bg-blue-50">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Para reportes más completos, recopila más menciones. 
                Actualmente tienes {filteredMentions.length} menciones en este período.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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
          mentions={filteredMentions}
          projectId={selectedProject.id}
          projectName={selectedProject.nombre}
          projectAudience={selectedProject.audiencia}
          projectObjective={selectedProject.objetivo}
          strategicContext={selectedProject.contexto_estrategico || undefined}
          entityNames={entityNames}
          entities={entities}
          dateRange={{
            start: dateRange.startDate.toISOString(),
            end: dateRange.endDate.toISOString(),
            label: dateRange.label,
          }}
        />
      )}

      {/* Reportes publicados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileBarChart className="h-4 w-4 text-primary" />
            Reportes publicados
          </CardTitle>
          <CardDescription>
            Links públicos compartidos para este proyecto. Puedes revocarlos o eliminarlos en cualquier momento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SharedReportsList projectId={selectedProject.id} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportesPage;
