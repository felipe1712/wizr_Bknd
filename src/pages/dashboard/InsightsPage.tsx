import { useState } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { usePanoramaData } from "@/hooks/usePanoramaData";
import { useDateRangeFilter } from "@/hooks/useDateRangeFilter";
import { useMentions } from "@/hooks/useMentions";
import { useEntities } from "@/hooks/useEntities";
import { useTrendsData } from "@/hooks/useTrendsData";
import { DateRangeSelector } from "@/components/reports/DateRangeSelector";
import { ActivityChart } from "@/components/panorama/ActivityChart";
import { SentimentOverview } from "@/components/panorama/SentimentOverview";
import { MentionsSummaryCard } from "@/components/panorama/MentionsSummaryCard";
import { PanoramaMentionsDrawer, MentionsFilter } from "@/components/panorama/PanoramaMentionsDrawer";
import { EntityTrendsChart } from "@/components/tendencias/EntityTrendsChart";
import { AlertsSidePanel } from "@/components/alertas/AlertsSidePanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
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
import {
  AlertCircle,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  Activity,
  Bell,
  LayoutDashboard,
  User,
  Building2,
  Briefcase,
  FileSearch,
} from "lucide-react";

const InsightsPage = () => {
  const { selectedProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const { dateConfig, setDateConfig, daysRange } = useDateRangeFilter("30d");
  const { metrics, isLoading: metricsLoading } = usePanoramaData(selectedProject?.id, daysRange);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("all");
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  
  // Mentions drawer state
  const [mentionsDrawerOpen, setMentionsDrawerOpen] = useState(false);
  const [mentionsFilter, setMentionsFilter] = useState<MentionsFilter | null>(null);

  const timeRange = dateConfig.type === "7d" ? "7d" : dateConfig.type === "90d" ? "90d" : "30d";

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

  const loading = projectLoading || metricsLoading || mentionsLoading;

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
          Crea o selecciona un proyecto para ver el análisis
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
            <LayoutDashboard className="h-7 w-7" />
            <h1 className="text-2xl font-bold">{selectedProject.nombre}</h1>
            <Badge variant="outline" className="capitalize">
              {selectedProject.tipo}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">{selectedProject.objetivo}</p>
        </div>

        {/* Alerts Panel Toggle */}
        <Sheet open={alertsPanelOpen} onOpenChange={setAlertsPanelOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Bell className="h-4 w-4" />
              Alertas
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <AlertsSidePanel projectId={selectedProject.id} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-4">
        <DateRangeSelector value={dateConfig} onChange={setDateConfig} />
        
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

      {/* Mentions Summary Card - Clear explanation of data */}
      <MentionsSummaryCard 
        mentions={mentions} 
        projectName={selectedProject.nombre}
        onPlatformClick={(platform, label) => {
          setMentionsFilter({ type: "platform", value: platform, label });
          setMentionsDrawerOpen(true);
        }}
        onSentimentClick={(sentiment, label) => {
          setMentionsFilter({ type: "sentiment", value: sentiment, label });
          setMentionsDrawerOpen(true);
        }}
      />

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Menciones"
          value={metrics.totalMentions}
          icon={MessageSquare}
          iconBg="bg-primary/10"
          iconColor="text-primary"
        />
        <MetricCard
          title="Últimos 7 días"
          value={metrics.recentMentions}
          icon={Activity}
          iconBg="bg-secondary"
          iconColor="text-secondary-foreground"
          trend={metrics.trend}
        />
        <MetricCard
          title="Positivas"
          value={metrics.sentimentBreakdown.positivo}
          icon={TrendingUp}
          iconBg="bg-green-500/10"
          iconColor="text-green-500"
        />
        <MetricCard
          title="Negativas"
          value={metrics.sentimentBreakdown.negativo}
          icon={TrendingDown}
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="volume">Volumen</TabsTrigger>
          <TabsTrigger value="sentiment">Sentimiento</TabsTrigger>
          <TabsTrigger value="entities">Por Entidad</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Overview Charts */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="col-span-2">
              <ActivityChart 
                data={metrics.dailyActivity} 
                onDateClick={(date, label) => {
                  setMentionsFilter({ type: "date", value: date, label });
                  setMentionsDrawerOpen(true);
                }}
              />
            </div>
            <SentimentOverview 
              data={metrics.sentimentBreakdown} 
              onSentimentClick={(sentiment, label) => {
                setMentionsFilter({ type: "sentiment", value: sentiment, label });
                setMentionsDrawerOpen(true);
              }}
            />
          </div>

          {/* Top Sources */}
          {metrics.topSources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Principales Fuentes</CardTitle>
                <CardDescription>Dominios con más menciones</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {metrics.topSources.map((source, idx) => (
                    <Badge key={idx} variant="secondary" className="text-sm">
                      {source.domain} ({source.count})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="volume">
          {!hasData ? (
            <EmptyDataCard onNavigate={() => navigate("/dashboard/fuentes")} />
          ) : (
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
          )}
        </TabsContent>

        <TabsContent value="sentiment">
          {!hasData ? (
            <EmptyDataCard onNavigate={() => navigate("/dashboard/fuentes")} />
          ) : (
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
          )}
        </TabsContent>

        <TabsContent value="entities">
          <EntityTrendsChart entities={entityBreakdown} />
        </TabsContent>
      </Tabs>

      {/* Info Banner if no sentiment analyzed */}
      {hasData && summary.sentimentBreakdown.sinAnalizar > 0 && (
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
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/semantica")}>
              Ir a Semántica
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Mentions Drawer */}
      <PanoramaMentionsDrawer
        open={mentionsDrawerOpen}
        onOpenChange={setMentionsDrawerOpen}
        mentions={mentions}
        filter={mentionsFilter}
      />
    </div>
  );
};

// Helper Components
interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  trend?: "up" | "down" | "stable";
}

const MetricCard = ({ title, value, icon: Icon, iconBg, iconColor, trend }: MetricCardProps) => {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-lg ${iconBg} p-3`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            {trend && (
              <>
                {trend === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
                {trend === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
                {trend === "stable" && <Minus className="h-4 w-4 text-muted-foreground" />}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface EmptyDataCardProps {
  onNavigate: () => void;
}

const EmptyDataCard = ({ onNavigate }: EmptyDataCardProps) => (
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
      <Button className="mt-4" variant="outline" onClick={onNavigate}>
        Ir a Fuentes
      </Button>
    </CardContent>
  </Card>
);

export default InsightsPage;
