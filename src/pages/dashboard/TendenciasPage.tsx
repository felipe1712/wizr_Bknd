import { useState } from "react";
import { useDateRangeFilter } from "@/hooks/useDateRangeFilter";
import { DateRangeSelector } from "@/components/reports/DateRangeSelector";
import { useProject } from "@/contexts/ProjectContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useMentions } from "@/hooks/useMentions";
import { useEntities } from "@/hooks/useEntities";
import { useTrendsData } from "@/hooks/useTrendsData";
import { EntityTrendsChart } from "@/components/tendencias/EntityTrendsChart";
import {
  AlertCircle,
  Plus,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileSearch,
  User,
  Building2,
  Briefcase,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

const TendenciasPage = () => {
  const { selectedProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const { dateConfig, setDateConfig, daysRange } = useDateRangeFilter("30d");
  const timeRange = dateConfig.type === "7d" ? "7d" : dateConfig.type === "90d" ? "90d" : "30d";
  const [selectedEntityId, setSelectedEntityId] = useState<string>("all");

  const { mentions, isLoading: mentionsLoading } = useMentions(
    selectedProject?.id,
    { isArchived: false }
  );

  const { entities } = useEntities(selectedProject?.id);

  const { trendData, summary, entityBreakdown, hasData } = useTrendsData(
    mentions,
    timeRange,
    selectedEntityId
  );

  const loading = projectLoading || mentionsLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
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
          Crea o selecciona un proyecto para ver las tendencias
        </p>
        <Button className="mt-4" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Proyecto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-7 w-7" />
            Tendencias
          </h1>
          <p className="text-muted-foreground">
            Evolución temporal y patrones —{" "}
            <span className="font-medium">{selectedProject.nombre}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Entity Filter */}
          <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
            <SelectTrigger className="w-48 bg-background">
              <SelectValue placeholder="Filtrar por entidad" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todas las entidades</SelectItem>
              {entities.map((entity) => {
                const Icon =
                  entity.tipo === "persona"
                    ? User
                    : entity.tipo === "marca"
                    ? Briefcase
                    : Building2;
                return (
                  <SelectItem key={entity.id} value={entity.id}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-3 w-3" />
                      {entity.nombre}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Date Range Selector */}
      <DateRangeSelector value={dateConfig} onChange={setDateConfig} />

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4">
              <FileSearch className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Sin menciones guardadas</h3>
            <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
              Para ver tendencias, primero necesitas buscar y guardar menciones desde
              la sección de Fuentes.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => navigate("/fuentes")}
            >
              Ir a Fuentes
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Menciones Totales"
              value={summary.totalMentions.toLocaleString()}
              change={summary.changePercent}
              subtitle={`Promedio: ${summary.avgPerDay}/día`}
            />
            <MetricCard
              title="Positivas"
              value={summary.sentimentBreakdown.positivo.toString()}
              subtitle={`${Math.round(
                (summary.sentimentBreakdown.positivo / summary.totalMentions) * 100
              ) || 0}% del total`}
              variant="positive"
            />
            <MetricCard
              title="Neutrales"
              value={summary.sentimentBreakdown.neutral.toString()}
              subtitle={`${Math.round(
                (summary.sentimentBreakdown.neutral / summary.totalMentions) * 100
              ) || 0}% del total`}
              variant="neutral"
            />
            <MetricCard
              title="Negativas"
              value={summary.sentimentBreakdown.negativo.toString()}
              subtitle={`${Math.round(
                (summary.sentimentBreakdown.negativo / summary.totalMentions) * 100
              ) || 0}% del total`}
              variant="negative"
            />
          </div>

          {/* Charts */}
          <Tabs defaultValue="volume" className="space-y-4">
            <TabsList>
              <TabsTrigger value="volume">Volumen</TabsTrigger>
              <TabsTrigger value="sentiment">Sentimiento</TabsTrigger>
              <TabsTrigger value="entities">Por Entidad</TabsTrigger>
            </TabsList>

            <TabsContent value="volume">
              <Card>
                <CardHeader>
                  <CardTitle>Volumen de Menciones</CardTitle>
                  <CardDescription>
                    Evolución del número de menciones a lo largo del tiempo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={trendData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorMenciones" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="5%"
                              stopColor="hsl(var(--primary))"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="hsl(var(--primary))"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          className="text-xs"
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis
                          className="text-xs"
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="menciones"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorMenciones)"
                          name="Menciones"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sentiment">
              <Card>
                <CardHeader>
                  <CardTitle>Evolución de Sentimiento</CardTitle>
                  <CardDescription>
                    Distribución de menciones por tipo de sentimiento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          className="text-xs"
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis
                          className="text-xs"
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="positivo"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                          name="Positivo"
                        />
                        <Line
                          type="monotone"
                          dataKey="neutral"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          name="Neutral"
                        />
                        <Line
                          type="monotone"
                          dataKey="negativo"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={false}
                          name="Negativo"
                        />
                        <Line
                          type="monotone"
                          dataKey="sinAnalizar"
                          stroke="#94a3b8"
                          strokeWidth={1}
                          strokeDasharray="5 5"
                          dot={false}
                          name="Sin analizar"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="entities">
              <EntityTrendsChart entities={entityBreakdown} />
            </TabsContent>
          </Tabs>

          {/* Info Banner if no sentiment analyzed */}
          {summary.sentimentBreakdown.sinAnalizar > 0 && (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="rounded-full bg-amber-500/10 p-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {summary.sentimentBreakdown.sinAnalizar} menciones sin analizar
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ejecuta un análisis semántico para clasificar el sentimiento de las
                    menciones.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/semantica")}>
                  Ir a Semántica
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

// Helper Components
interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  subtitle: string;
  variant?: "default" | "positive" | "neutral" | "negative";
}

const MetricCard = ({
  title,
  value,
  change,
  subtitle,
  variant = "default",
}: MetricCardProps) => {
  const isPositive = change !== undefined && change > 0;
  const isNeutral = change === 0;

  const variantStyles = {
    default: "",
    positive: "border-l-4 border-l-green-500",
    neutral: "border-l-4 border-l-blue-500",
    negative: "border-l-4 border-l-red-500",
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {change !== undefined && (
            <span
              className={`flex items-center text-xs font-medium ${
                isNeutral
                  ? "text-muted-foreground"
                  : isPositive
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {isNeutral ? (
                <Minus className="mr-0.5 h-3 w-3" />
              ) : isPositive ? (
                <ArrowUpRight className="mr-0.5 h-3 w-3" />
              ) : (
                <ArrowDownRight className="mr-0.5 h-3 w-3" />
              )}
              {Math.abs(change)}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
};

export default TendenciasPage;
