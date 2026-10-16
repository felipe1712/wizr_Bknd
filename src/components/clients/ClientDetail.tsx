import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format as formatDate, parseISO, differenceInDays } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ArrowLeft, BarChart3, Settings, Building2, TrendingUp, FileText,
  Sparkles, MessageCircle, BookOpen, FileBarChart, Users2, Target, History, Info,
  AlertTriangle,
} from "lucide-react";
import { Client } from "@/hooks/useClients";
import { useFKProfilesByClient } from "@/hooks/useClients";
import { useFKProfileKPIs, useFKAllKPIs, useFKTopPosts, useFKPeriodPostMetrics, FKNetwork, FKProfile } from "@/hooks/useFanpageKarma";
import { FKExcelImporter } from "./FKExcelImporter";
import { UnclassifiedProfilesDialog } from "./UnclassifiedProfilesDialog";
import { ProfilesList } from "@/components/rankings/ProfilesList";
import { RankingTable } from "@/components/rankings/RankingTable";
import { RankingChart } from "@/components/rankings/RankingChart";
import { AvgEngagementByNetworkChart } from "@/components/rankings/AvgEngagementByNetworkChart";
import { TrendsTab } from "@/components/rankings/TrendsTab";
import { TopContentTab } from "@/components/rankings/TopContentTab";
import { RankingInsightsPanel } from "@/components/rankings/RankingInsightsPanel";
import { RankingQuestionsPanel } from "@/components/rankings/RankingQuestionsPanel";
import { RankingAIChat } from "@/components/rankings/RankingAIChat";
import { NarrativesAnalysisPanel } from "@/components/rankings/NarrativesAnalysisPanel";
import { RankingDateFilter, DateRangePreset, getDateRangeFromPreset } from "@/components/rankings/RankingDateFilter";
import { DailyTopPostsPanel } from "@/components/rankings/DailyTopPostsPanel";
import { DateRange } from "react-day-picker";
import { ClientEvolutionTab } from "./ClientEvolutionTab";
import { PerformanceReportGenerator } from "./PerformanceReportGenerator";
import { SharedReportsList } from "@/components/reports/SharedReportsList";

interface Props {
  client: Client;
  onBack: () => void;
}

type ViewMode = "brand" | "benchmark";

export function ClientDetail({ client, onBack }: Props) {
  const qc = useQueryClient();
  const isBenchmarkOnly = client.client_type === "benchmark";
  const [view, setView] = useState<ViewMode>(isBenchmarkOnly ? "benchmark" : "brand");
  const [activeTab, setActiveTab] = useState<
    "ranking" | "insights" | "evolution" | "narratives" | "trends" | "content" | "reports" | "ai" | "config"
  >("ranking");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("28d");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [appliedPreset, setAppliedPreset] = useState<DateRangePreset>("28d");
  const [appliedCustomRange, setAppliedCustomRange] = useState<DateRange | undefined>();
  const [aiInitialQuestion, setAiInitialQuestion] = useState("");
  const [filterNet, setFilterNet] = useState<FKNetwork | "all">("all");
  const [classifyDialogOpen, setClassifyDialogOpen] = useState(false);
  const [classifyShowAll, setClassifyShowAll] = useState(false);

  const dateRange = getDateRangeFromPreset(appliedPreset, appliedCustomRange);
  const periodStart = formatDate(dateRange.from, "yyyy-MM-dd");
  const periodEnd = formatDate(dateRange.to, "yyyy-MM-dd");

  const periodStartTop = formatDate(dateRange.from, "yyyy-MM-dd");
  const periodEndTop = formatDate(dateRange.to, "yyyy-MM-dd");

  const { data: rawProfiles = [], isLoading: loadingProfiles } = useFKProfilesByClient(client.id, "all");

  // Para clientes "branded": vista marca = solo classification_status === "brand".
  // Para clientes "benchmark puro": todos los clasificados son pares.
  const profiles = useMemo<FKProfile[]>(() => {
    return rawProfiles
      .filter((p) => {
        if (isBenchmarkOnly) return p.classification_status !== "unclassified";
        if (view === "brand") return p.classification_status === "brand";
        // view === "benchmark": brand + competitor (excluye unclassified)
        return p.classification_status === "brand" || p.classification_status === "competitor";
      })
      .map((p) => ({
        ...p,
        project_id: null,
        ranking_id: null,
        is_own_profile: p.classification_status === "brand",
        network: p.network as FKNetwork,
      })) as unknown as FKProfile[];
  }, [rawProfiles, view, isBenchmarkOnly]);

  const profileIds = profiles.map((p) => p.id);
  const { data: kpis = [], isLoading: loadingKpis } = useFKProfileKPIs(profileIds, periodStart, periodEnd);
  const { data: allKpis = [], isLoading: loadingAllKpis } = useFKAllKPIs(profileIds);
  const { data: dailyTopPosts = [], isLoading: loadingTop } = useFKTopPosts(profileIds, periodStartTop, periodEndTop);
  const { data: periodMetrics, isLoading: loadingPeriodMetrics } = useFKPeriodPostMetrics(profileIds, periodStart, periodEnd);

  const brandCount = rawProfiles.filter((p) => p.classification_status === "brand").length;
  const compCount = rawProfiles.filter((p) => p.classification_status === "competitor").length;
  const unclassifiedCount = rawProfiles.filter((p) => p.classification_status === "unclassified").length;
  // Banner solo aplica a clientes branded — en benchmark puro la distinción no existe.
  const showUnclassifiedBanner = !isBenchmarkOnly && unclassifiedCount > 0;

  const handleApplyDateRange = (preset?: DateRangePreset, custom?: DateRange) => {
    setAppliedPreset(preset ?? datePreset);
    setAppliedCustomRange(custom ?? customDateRange);
  };
  const handleAskAI = (q: string) => { setAiInitialQuestion(q); setActiveTab("ai"); };
  const handleRefreshTopPosts = () => {
    qc.invalidateQueries({ queryKey: ["fk-daily-top-posts"] });
    qc.invalidateQueries({ queryKey: ["fk-kpis"] });
    qc.invalidateQueries({ queryKey: ["fk-profiles-client"] });
  };

  const openClassifyPending = () => {
    setClassifyShowAll(false);
    setClassifyDialogOpen(true);
  };
  const openClassifyAll = () => {
    setClassifyShowAll(true);
    setClassifyDialogOpen(true);
  };

  // Banner: detecta si TODOS los KPIs vienen como fallback (ningún snapshot exacto).
  // También determina si el período seleccionado cae *dentro* del único snapshot disponible,
  // caso en el que cambiar el filtro no afectará los datos mostrados.
  const fallbackInfo = useMemo(() => {
    if (!kpis || kpis.length === 0) return null;
    const allFallback = kpis.every((k) => k.isFallback);
    if (!allFallback) return null;
    // Snapshot dominante: el más reciente entre los disponibles
    const sorted = [...kpis].sort((a, b) =>
      (b.period_end || "").localeCompare(a.period_end || "")
    );
    const top = sorted[0];
    if (!top?.period_start || !top?.period_end) return null;
    const start = parseISO(top.period_start);
    const end = parseISO(top.period_end);
    const ageDays = differenceInDays(new Date(), end);

    // ¿Hay un único snapshot cubriendo a todos los perfiles? Y ¿el filtro está dentro de él?
    const uniquePeriods = new Set(
      kpis.map((k) => `${k.period_start}|${k.period_end}`)
    );
    const singleSnapshot = uniquePeriods.size === 1;
    const filterInsideSnapshot =
      singleSnapshot &&
      dateRange.from >= start &&
      dateRange.to <= end;

    return {
      label: `${formatDate(start, "d MMM yyyy", { locale: esLocale })} – ${formatDate(end, "d MMM yyyy", { locale: esLocale })}`,
      from: start,
      to: end,
      stale: ageDays > 90,
      filterInsideSnapshot,
    };
  }, [kpis, dateRange]);

  const applySnapshotPeriod = () => {
    if (!fallbackInfo) return;
    const range: DateRange = { from: fallbackInfo.from, to: fallbackInfo.to };
    setDatePreset("custom");
    setCustomDateRange(range);
    setAppliedPreset("custom");
    setAppliedCustomRange(range);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
            {client.description && (
              <p className="text-muted-foreground text-sm">{client.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/dashboard/clientes/${client.id}/portal`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" /> Administrar Portal
            </Button>
          </Link>
          <Link to={`/portal/${client.id}`}>
            <Button variant="default" size="sm" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Portal Ejecutivo
            </Button>
          </Link>
          {isBenchmarkOnly ? (
            <Badge variant="secondary" className="gap-1">
              <Users2 className="h-3 w-3" /> {rawProfiles.length} perfiles
            </Badge>
          ) : (
            <>
              <Badge variant="secondary">{brandCount} marca</Badge>
              <Badge variant="outline">{compCount} competencia</Badge>
              {unclassifiedCount > 0 && (
                <Badge variant="outline" className="border-wizr-orange text-wizr-orange gap-1">
                  <AlertTriangle className="h-3 w-3" /> {unclassifiedCount} sin clasificar
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {showUnclassifiedBanner && (
        <Alert className="border-wizr-orange/50 bg-wizr-orange/5">
          <AlertTriangle className="h-4 w-4 text-wizr-orange" />
          <AlertTitle>{unclassifiedCount} {unclassifiedCount === 1 ? "perfil sin clasificar" : "perfiles sin clasificar"}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              El toggle <strong>Marca / Benchmark</strong> no funcionará correctamente hasta que clasifiques estos perfiles como Mi marca o Competencia.
            </span>
            <Button size="sm" variant="outline" className="border-wizr-orange text-wizr-orange hover:bg-wizr-orange/10" onClick={openClassifyPending}>
              Clasificar ahora
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!isBenchmarkOnly && (
        <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            Vista actual
          </div>
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as ViewMode)}>
            <ToggleGroupItem value="brand" className="gap-2">
              <Building2 className="h-4 w-4" /> Marca ({brandCount})
            </ToggleGroupItem>
            <ToggleGroupItem value="benchmark" className="gap-2">
              <Users2 className="h-4 w-4" /> Benchmark ({brandCount + compCount})
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {activeTab !== "config" && activeTab !== "evolution" && profiles.length > 0 && (
        <>
          <RankingDateFilter
            preset={datePreset}
            customRange={customDateRange}
            onPresetChange={setDatePreset}
            onCustomRangeChange={setCustomDateRange}
            onApply={handleApplyDateRange}
          />
          {fallbackInfo && (
            <Alert variant={fallbackInfo.stale ? "destructive" : "default"}>
              <Info className="h-4 w-4" />
              <AlertTitle>
                {fallbackInfo.filterInsideSnapshot
                  ? "El filtro no afecta los datos: solo hay un snapshot importado"
                  : "Mostrando el snapshot más reciente disponible"}
              </AlertTitle>
              <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {fallbackInfo.filterInsideSnapshot ? (
                    <>
                      Los <strong>seguidores y crecimiento</strong> vienen del snapshot importado <strong>{fallbackInfo.label}</strong> y no cambian con el filtro. El <strong>engagement y la actividad del período</strong> sí se recalculan desde los posts reales (columnas "Posts", "Eng. promedio" y "Top post").
                    </>
                  ) : (
                    <>
                      Los datos KPI agregados cubren <strong>{fallbackInfo.label}</strong>. Las métricas del período (posts y engagement) se calculan desde los posts publicados en el rango activo.
                    </>
                  )}
                </span>
                {!fallbackInfo.filterInsideSnapshot && (
                  <Button size="sm" variant="outline" onClick={applySnapshotPeriod}>
                    Usar período del snapshot
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="ranking"><BarChart3 className="h-4 w-4 mr-2" />Ranking</TabsTrigger>
          <TabsTrigger value="insights" disabled={profiles.length === 0}><Sparkles className="h-4 w-4 mr-2" />Insights</TabsTrigger>
          <TabsTrigger value="evolution" disabled={profiles.length === 0}><History className="h-4 w-4 mr-2" />Evolución</TabsTrigger>
          <TabsTrigger value="trends" disabled={profiles.length === 0}><TrendingUp className="h-4 w-4 mr-2" />Tendencias</TabsTrigger>
          <TabsTrigger value="content" disabled={profiles.length === 0}><FileText className="h-4 w-4 mr-2" />Contenido</TabsTrigger>
          <TabsTrigger value="narratives" disabled={profiles.length === 0}><BookOpen className="h-4 w-4 mr-2" />Narrativas</TabsTrigger>
          <TabsTrigger value="reports" disabled={profiles.length === 0}><FileBarChart className="h-4 w-4 mr-2" />Reportes</TabsTrigger>
          <TabsTrigger value="ai" disabled={profiles.length === 0}><MessageCircle className="h-4 w-4 mr-2" />IA</TabsTrigger>
          <TabsTrigger value="config"><Settings className="h-4 w-4 mr-2" />Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-6">
          {profiles.length === 0 ? (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {isBenchmarkOnly
                  ? "Aún no hay perfiles cargados"
                  : view === "brand" ? "Aún no hay perfiles de marca" : "Aún no hay perfiles cargados"}
              </h3>
              <p className="text-muted-foreground mb-4">
                Ve a Configuración para importar Excel de KPIs y Posts.
              </p>
              <Button onClick={() => setActiveTab("config")}>
                <Settings className="h-4 w-4 mr-2" />Ir a Configuración
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <RankingInsightsPanel
                profiles={profiles}
                kpis={kpis}
                isLoading={loadingProfiles || loadingKpis || loadingPeriodMetrics}
                periodMetrics={periodMetrics}
              />
              <RankingTable
                profiles={profiles}
                kpis={kpis}
                isLoading={loadingProfiles || loadingKpis}
                sortBy="period_avg_engagement"
                filterNetwork={filterNet}
                onNetworkChange={setFilterNet}
                periodMetrics={periodMetrics}
                isLoadingPeriodMetrics={loadingPeriodMetrics}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <RankingChart profiles={profiles} kpis={kpis} isLoading={loadingProfiles || loadingKpis} filterNetwork={filterNet} metric="engagement_rate" />
                <RankingChart profiles={profiles} kpis={kpis} isLoading={loadingProfiles || loadingKpis} filterNetwork={filterNet} metric="followers" />
              </div>
              <AvgEngagementByNetworkChart
                profiles={profiles}
                posts={dailyTopPosts}
                isLoading={loadingProfiles || loadingTop}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <div className="space-y-6">
            <DailyTopPostsPanel profiles={profiles} topPosts={dailyTopPosts} isLoading={loadingProfiles || loadingTop} onRefresh={handleRefreshTopPosts} />
            <div className="grid gap-6 lg:grid-cols-2">
              <RankingQuestionsPanel profiles={profiles} kpis={kpis} isLoading={loadingProfiles || loadingKpis} onAskAI={handleAskAI} />
              <RankingAIChat profiles={profiles} kpis={kpis} rankingName={`${client.name}${isBenchmarkOnly ? " (Comparativo)" : ` (${view === "brand" ? "Marca" : "Benchmark"})`}`} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="evolution" className="mt-6">
          <ClientEvolutionTab
            profiles={profiles}
            allKpis={allKpis}
            isLoading={loadingProfiles || loadingAllKpis}
            brandCount={brandCount}
            compCount={compCount}
          />
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <TrendsTab profiles={profiles} kpis={allKpis} isLoading={loadingProfiles || loadingAllKpis} />
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <TopContentTab profiles={profiles} isLoading={loadingProfiles} dateRange={dateRange} analysisContext={isBenchmarkOnly ? "benchmark" : view} brandName={isBenchmarkOnly ? undefined : client.name} />
        </TabsContent>

        <TabsContent value="narratives" className="mt-6">
          <NarrativesAnalysisPanel profiles={profiles} isLoading={loadingProfiles} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <div className="space-y-6">
            <PerformanceReportGenerator
              reportMode={isBenchmarkOnly ? "comparative" : view}
              clientId={client.id}
              clientName={client.name}
              brandName={isBenchmarkOnly ? undefined : client.name}
              profiles={profiles}
              kpis={kpis}
              topPosts={dailyTopPosts}
              dateRange={dateRange}
            />
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Reportes publicados</h3>
              <SharedReportsList clientId={client.id} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <RankingAIChat
              profiles={profiles}
              kpis={kpis}
              rankingName={`${client.name}${isBenchmarkOnly ? " (Comparativo)" : ` (${view === "brand" ? "Marca" : "Benchmark"})`}`}
              initialQuestion={aiInitialQuestion}
            />
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <div className="space-y-6">
            <FKExcelImporter clientId={client.id} />
            {!isBenchmarkOnly && rawProfiles.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="text-sm">
                  <div className="font-medium">Clasificación de perfiles</div>
                  <div className="text-xs text-muted-foreground">
                    {brandCount} marca · {compCount} competencia{unclassifiedCount > 0 ? ` · ${unclassifiedCount} sin clasificar` : ""}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={openClassifyAll}>
                  Re-clasificar perfiles
                </Button>
              </div>
            )}
            <ProfilesList
              profiles={rawProfiles as unknown as FKProfile[]}
              isLoading={loadingProfiles}
              rankingId={client.id}
            />
          </div>
        </TabsContent>
      </Tabs>

      <UnclassifiedProfilesDialog
        open={classifyDialogOpen}
        onOpenChange={setClassifyDialogOpen}
        profiles={rawProfiles}
        showAll={classifyShowAll}
      />
    </div>
  );
}
