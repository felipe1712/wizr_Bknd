import { useProject } from "@/contexts/ProjectContext";
import { usePanoramaData } from "@/hooks/usePanoramaData";
import { useDateRangeFilter } from "@/hooks/useDateRangeFilter";
import { DateRangeSelector } from "@/components/reports/DateRangeSelector";
import { DataOriginBreadcrumb } from "@/components/analysis/DataOriginBreadcrumb";
import { ActivityChart } from "@/components/panorama/ActivityChart";
import { SentimentOverview } from "@/components/panorama/SentimentOverview";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Globe,
  Users,
  LayoutDashboard,
  AlertCircle,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  Activity,
} from "lucide-react";

const REGION_LABELS: Record<string, string> = {
  mexico: "México",
  latam: "Latinoamérica",
  usa: "Estados Unidos",
  espana: "España",
  global: "Global",
};

const TEMPORAL_LABELS: Record<string, string> = {
  tiempo_real: "Tiempo Real",
  diario: "Diario",
  semanal: "Semanal",
  mensual: "Mensual",
  historico: "Histórico",
};

const PanoramaPage = () => {
  const { selectedProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const { dateConfig, setDateConfig, daysRange, startDate, endDate } = useDateRangeFilter("30d");
  const { metrics, isLoading: metricsLoading } = usePanoramaData(selectedProject?.id, daysRange);

  const loading = projectLoading || metricsLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="col-span-2 h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-muted p-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Sin proyecto seleccionado</h2>
        <p className="mt-2 max-w-md text-center text-muted-foreground">
          Crea o selecciona un proyecto para ver el panorama de análisis
        </p>
        <Button className="mt-4" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Proyecto
        </Button>
      </div>
    );
  }

  const TrendIcon =
    metrics.trend === "up" ? TrendingUp : metrics.trend === "down" ? TrendingDown : Minus;

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{selectedProject.nombre}</h1>
            <Badge variant="outline" className="capitalize">
              {selectedProject.tipo}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">{selectedProject.objetivo}</p>
        </div>
      </div>

      {/* Date Range Selector */}
      <DateRangeSelector value={dateConfig} onChange={setDateConfig} />

      {/* Data Origin Breadcrumb */}
      <DataOriginBreadcrumb 
        mentionCount={metrics.totalMentions} 
        dateRange={startDate && endDate ? { start: startDate, end: endDate } : undefined}
      />

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Menciones</p>
              <p className="text-2xl font-bold">{metrics.totalMentions}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-secondary p-3">
              <Activity className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Últimos 7 días</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{metrics.recentMentions}</p>
                <TrendIcon
                  className={`h-4 w-4 ${
                    metrics.trend === "up"
                      ? "text-green-500"
                      : metrics.trend === "down"
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-green-500/10 p-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Positivas</p>
              <p className="text-2xl font-bold">{metrics.sentimentBreakdown.positivo}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-red-500/10 p-3">
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Negativas</p>
              <p className="text-2xl font-bold">{metrics.sentimentBreakdown.negativo}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="col-span-2">
          <ActivityChart data={metrics.dailyActivity} />
        </div>
        <SentimentOverview data={metrics.sentimentBreakdown} />
      </div>

      {/* Project Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-muted p-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Alcance Temporal</p>
              <p className="font-semibold">
                {TEMPORAL_LABELS[selectedProject.alcance_temporal]}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-muted p-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cobertura</p>
              <p className="font-semibold">
                {selectedProject.alcance_geografico
                  .map((r) => REGION_LABELS[r] || r)
                  .join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-muted p-3">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Audiencia</p>
              <p className="line-clamp-1 font-semibold">{selectedProject.audiencia}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-muted p-3">
              <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Versión</p>
              <p className="font-semibold">v{selectedProject.version}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PanoramaPage;
