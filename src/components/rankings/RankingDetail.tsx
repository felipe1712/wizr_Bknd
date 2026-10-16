import { useState } from "react";
import { format as formatDate } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BarChart3, Settings, Trophy, TrendingUp, FileText, Sparkles, MessageCircle, BookOpen, FileBarChart } from "lucide-react";
import { Ranking } from "@/hooks/useRankings";
import { useFKProfilesByRanking, useFKProfileKPIs, useFKAllKPIs, useFKTopPosts, FKNetwork } from "@/hooks/useFanpageKarma";
import { RankingBatchForm } from "./RankingBatchForm";
import { FKCSVImporter } from "./FKCSVImporter";
import { ProfilesList } from "./ProfilesList";
import { RankingTable } from "./RankingTable";
import { RankingChart } from "./RankingChart";
import { TrendsTab } from "./TrendsTab";
import { TopContentTab } from "./TopContentTab";
import { RankingInsightsPanel } from "./RankingInsightsPanel";
import { RankingQuestionsPanel } from "./RankingQuestionsPanel";
import { RankingAIChat } from "./RankingAIChat";
import { NarrativesAnalysisPanel } from "./NarrativesAnalysisPanel";
import { RankingDateFilter, DateRangePreset, getDateRangeFromPreset } from "./RankingDateFilter";
import { RankingReportGenerator } from "./RankingReportGenerator";
import { DailyTopPostsPanel } from "./DailyTopPostsPanel";
import { DateRange } from "react-day-picker";

interface RankingDetailProps {
  ranking: Ranking;
  onBack: () => void;
}

export function RankingDetail({ ranking, onBack }: RankingDetailProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"ranking" | "insights" | "narratives" | "trends" | "content" | "reports" | "ai" | "config">("ranking");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("1d");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [appliedPreset, setAppliedPreset] = useState<DateRangePreset>("1d");
  const [appliedCustomRange, setAppliedCustomRange] = useState<DateRange | undefined>(undefined);
  const [aiInitialQuestion, setAiInitialQuestion] = useState<string>("");
  const [rankingFilterNetwork, setRankingFilterNetwork] = useState<FKNetwork | "all">("all");

  // Get the applied date range (only changes when Apply is clicked)
  const dateRange = getDateRangeFromPreset(appliedPreset, appliedCustomRange);
  const periodStart = formatDate(dateRange.from, "yyyy-MM-dd");
  const periodEnd = formatDate(dateRange.to, "yyyy-MM-dd");

  const { data: profiles = [], isLoading: loadingProfiles } = useFKProfilesByRanking(ranking.id);
  const profileIds = profiles.map((p) => p.id);
  const { data: kpis = [], isLoading: loadingKPIs } = useFKProfileKPIs(profileIds, periodStart, periodEnd);
  const { data: allKpis = [], isLoading: loadingAllKpis } = useFKAllKPIs(profileIds);
  const { data: dailyTopPosts = [], isLoading: loadingTopPosts } = useFKTopPosts(profileIds, periodStart, periodEnd);

  const syncedCount = profiles.filter((p) => p.last_synced_at).length;

  const handleAskAI = (question: string) => {
    setAiInitialQuestion(question);
    setActiveTab("ai");
  };

  const handleApplyDateRange = (preset?: DateRangePreset, custom?: DateRange) => {
    setAppliedPreset(preset ?? datePreset);
    setAppliedCustomRange(custom ?? customDateRange);
  };

  const handleRefreshTopPosts = () => {
    queryClient.invalidateQueries({ queryKey: ["fk-daily-top-posts"] });
    queryClient.invalidateQueries({ queryKey: ["fk-kpis"] });
    queryClient.invalidateQueries({ queryKey: ["fk-profiles-ranking"] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{ranking.name}</h1>
              {ranking.description && (
                <p className="text-muted-foreground text-sm">{ranking.description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {profiles.length} perfiles
          </Badge>
          <Badge variant={syncedCount === profiles.length && profiles.length > 0 ? "default" : "outline"}>
            {syncedCount}/{profiles.length} sincronizados
          </Badge>
        </div>
      </div>

      {/* Date filter - shown on all data tabs */}
      {activeTab !== "config" && profiles.length > 0 && (
        <RankingDateFilter
          preset={datePreset}
          customRange={customDateRange}
          onPresetChange={setDatePreset}
          onCustomRangeChange={setCustomDateRange}
          onApply={handleApplyDateRange}
        />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="ranking">
            <BarChart3 className="h-4 w-4 mr-2" />
            Ranking
          </TabsTrigger>
          <TabsTrigger value="insights" disabled={profiles.length === 0}>
            <Sparkles className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="trends" disabled={profiles.length === 0}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Tendencias
          </TabsTrigger>
          <TabsTrigger value="content" disabled={profiles.length === 0}>
            <FileText className="h-4 w-4 mr-2" />
            Contenido Top
          </TabsTrigger>
          <TabsTrigger value="narratives" disabled={profiles.length === 0}>
            <BookOpen className="h-4 w-4 mr-2" />
            Narrativas
          </TabsTrigger>
          <TabsTrigger value="reports" disabled={profiles.length === 0}>
            <FileBarChart className="h-4 w-4 mr-2" />
            Reportes
          </TabsTrigger>
          <TabsTrigger value="ai" disabled={profiles.length === 0}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Preguntar IA
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-6">
          {profiles.length === 0 ? (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Agrega perfiles para comenzar</h3>
              <p className="text-muted-foreground mb-4">
                Ve a la pestaña de Configuración para agregar los perfiles que deseas comparar.
              </p>
              <Button onClick={() => setActiveTab("config")}>
                <Settings className="h-4 w-4 mr-2" />
                Ir a Configuración
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Quick insights at the top */}
              <RankingInsightsPanel 
                profiles={profiles} 
                kpis={kpis} 
                isLoading={loadingProfiles || loadingKPIs}
              />
              
              {/* Ranking table with chart */}
              <RankingTable 
                profiles={profiles} 
                kpis={kpis} 
                isLoading={loadingProfiles || loadingKPIs}
                sortBy="engagement_rate"
                filterNetwork={rankingFilterNetwork}
                onNetworkChange={setRankingFilterNetwork}
              />
              
              {/* Chart for current filter */}
              <div className="grid gap-4 md:grid-cols-2">
                <RankingChart
                  profiles={profiles}
                  kpis={kpis}
                  isLoading={loadingProfiles || loadingKPIs}
                  filterNetwork={rankingFilterNetwork}
                  metric="engagement_rate"
                />
                <RankingChart
                  profiles={profiles}
                  kpis={kpis}
                  isLoading={loadingProfiles || loadingKPIs}
                  filterNetwork={rankingFilterNetwork}
                  metric="followers"
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <div className="space-y-6">
            {/* Daily Top Posts */}
            <DailyTopPostsPanel
              profiles={profiles}
              topPosts={dailyTopPosts}
              isLoading={loadingProfiles || loadingTopPosts}
              onRefresh={handleRefreshTopPosts}
            />
            
            {/* Questions and AI Chat */}
            <div className="grid gap-6 lg:grid-cols-2">
              <RankingQuestionsPanel
                profiles={profiles}
                kpis={kpis}
                isLoading={loadingProfiles || loadingKPIs}
                onAskAI={handleAskAI}
              />
              <RankingAIChat
                profiles={profiles}
                kpis={kpis}
                rankingName={ranking.name}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <TrendsTab 
            profiles={profiles} 
            kpis={allKpis} 
            isLoading={loadingProfiles || loadingAllKpis} 
          />
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <TopContentTab 
            profiles={profiles} 
            isLoading={loadingProfiles}
            dateRange={dateRange}
            analysisContext="benchmark"
          />
        </TabsContent>

        <TabsContent value="narratives" className="mt-6">
          <NarrativesAnalysisPanel
            profiles={profiles}
            isLoading={loadingProfiles}
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <RankingReportGenerator
            rankingName={ranking.name}
            profiles={profiles}
            kpis={kpis}
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <RankingAIChat
              profiles={profiles}
              kpis={kpis}
              rankingName={ranking.name}
              initialQuestion={aiInitialQuestion}
            />
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <div className="space-y-6">
            <FKCSVImporter rankingId={ranking.id} />
            <RankingBatchForm rankingId={ranking.id} />
            <ProfilesList 
              profiles={profiles} 
              isLoading={loadingProfiles}
              rankingId={ranking.id}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
