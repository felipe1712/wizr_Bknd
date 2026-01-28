import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BarChart3, Settings, Trophy, TrendingUp, Bell, FileText } from "lucide-react";
import { Ranking } from "@/hooks/useRankings";
import { useFKProfilesByRanking, useFKProfileKPIs } from "@/hooks/useFanpageKarma";
import { RankingBatchForm } from "./RankingBatchForm";
import { ProfilesList } from "./ProfilesList";
import { RankingTable } from "./RankingTable";

type SortMetric = "followers" | "engagement_rate" | "follower_growth_percent" | "posts_per_day";

interface RankingDetailProps {
  ranking: Ranking;
  onBack: () => void;
}

export function RankingDetail({ ranking, onBack }: RankingDetailProps) {
  const [activeTab, setActiveTab] = useState<"ranking" | "config" | "trends" | "content">("ranking");

  const { data: profiles = [], isLoading: loadingProfiles } = useFKProfilesByRanking(ranking.id);
  const profileIds = profiles.map((p) => p.id);
  const { data: kpis = [], isLoading: loadingKPIs } = useFKProfileKPIs(profileIds);

  const syncedCount = profiles.filter((p) => p.last_synced_at).length;

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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="ranking">
            <BarChart3 className="h-4 w-4 mr-2" />
            Ranking
          </TabsTrigger>
          <TabsTrigger value="trends" disabled={profiles.length === 0}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Tendencias
          </TabsTrigger>
          <TabsTrigger value="content" disabled={profiles.length === 0}>
            <FileText className="h-4 w-4 mr-2" />
            Contenido Top
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
            <RankingTable 
              profiles={profiles} 
              kpis={kpis} 
              isLoading={loadingProfiles || loadingKPIs}
              sortBy="engagement_rate"
              filterNetwork="all"
            />
          )}
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <div className="text-center py-12 border rounded-lg border-dashed">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Tendencias Históricas</h3>
            <p className="text-muted-foreground">
              Próximamente: Gráficos de evolución de posiciones y métricas a lo largo del tiempo.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <div className="text-center py-12 border rounded-lg border-dashed">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Contenido Top</h3>
            <p className="text-muted-foreground">
              Próximamente: Análisis de los posts con mejor engagement de cada perfil.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
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
