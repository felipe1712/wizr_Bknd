import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  Users, 
  Target,
  AlertTriangle,
  Crown,
  Sparkles,
  BarChart3
} from "lucide-react";
import { FKProfile, FKProfileKPI, FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";
import { NetworkFilter } from "./NetworkFilter";

interface RankingInsightsPanelProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  isLoading: boolean;
}

interface InsightCard {
  title: string;
  question: string;
  answer: string;
  detail: string;
  icon: React.ReactNode;
  variant: "success" | "warning" | "info" | "danger";
  value?: string;
  network?: FKNetwork;
}

function getProfileInfo(profiles: FKProfile[], profileId: string): { name: string; network: FKNetwork | null } {
  const profile = profiles.find(p => p.id === profileId);
  return {
    name: profile?.display_name || profile?.profile_id || "Desconocido",
    network: profile?.network as FKNetwork || null
  };
}

function generateInsights(profiles: FKProfile[], kpis: FKProfileKPI[], filterNetwork: FKNetwork | "all"): InsightCard[] {
  const insights: InsightCard[] = [];
  
  if (kpis.length === 0) {
    return [];
  }

  // Filter profiles by network
  const filteredProfileIds = filterNetwork === "all" 
    ? profiles.map(p => p.id)
    : profiles.filter(p => p.network === filterNetwork).map(p => p.id);

  // Get the latest KPI for each filtered profile
  const latestKpiByProfile = new Map<string, FKProfileKPI>();
  kpis.forEach(kpi => {
    if (!filteredProfileIds.includes(kpi.fk_profile_id)) return;
    const existing = latestKpiByProfile.get(kpi.fk_profile_id);
    if (!existing || new Date(kpi.period_end) > new Date(existing.period_end)) {
      latestKpiByProfile.set(kpi.fk_profile_id, kpi);
    }
  });

  const latestKpis = Array.from(latestKpiByProfile.values());

  if (latestKpis.length === 0) return [];

  // 1. Best engagement rate
  const sortedByEngagement = latestKpis
    .filter(k => k.engagement_rate !== null)
    .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
  
  if (sortedByEngagement.length > 0) {
    const best = sortedByEngagement[0];
    const info = getProfileInfo(profiles, best.fk_profile_id);
    insights.push({
      title: "Mejor Engagement",
      question: "¿Quién tiene el mejor engagement rate?",
      answer: info.name,
      detail: `${((best.engagement_rate || 0) * 100).toFixed(2)}% de engagement`,
      icon: <Crown className="h-5 w-5 text-amber-500" />,
      variant: "success",
      value: `${((best.engagement_rate || 0) * 100).toFixed(2)}%`,
      network: info.network || undefined
    });
  }

  // 2. Worst engagement rate
  if (sortedByEngagement.length > 1) {
    const worst = sortedByEngagement[sortedByEngagement.length - 1];
    const info = getProfileInfo(profiles, worst.fk_profile_id);
    insights.push({
      title: "Menor Engagement",
      question: "¿Quién tiene el peor engagement?",
      answer: info.name,
      detail: `Solo ${((worst.engagement_rate || 0) * 100).toFixed(2)}% de engagement`,
      icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
      variant: "danger",
      value: `${((worst.engagement_rate || 0) * 100).toFixed(2)}%`,
      network: info.network || undefined
    });
  }

  // 3. Most followers
  const sortedByFollowers = latestKpis
    .filter(k => k.followers !== null)
    .sort((a, b) => (b.followers || 0) - (a.followers || 0));
  
  if (sortedByFollowers.length > 0) {
    const best = sortedByFollowers[0];
    const info = getProfileInfo(profiles, best.fk_profile_id);
    insights.push({
      title: "Mayor Audiencia",
      question: "¿Quién tiene más seguidores?",
      answer: info.name,
      detail: `${(best.followers || 0).toLocaleString()} seguidores`,
      icon: <Users className="h-5 w-5 text-blue-500" />,
      variant: "info",
      value: formatNumber(best.followers || 0),
      network: info.network || undefined
    });
  }

  // 4. Highest follower growth
  const sortedByGrowth = latestKpis
    .filter(k => k.follower_growth_percent !== null)
    .sort((a, b) => (b.follower_growth_percent || 0) - (a.follower_growth_percent || 0));
  
  if (sortedByGrowth.length > 0 && (sortedByGrowth[0].follower_growth_percent || 0) > 0) {
    const best = sortedByGrowth[0];
    const info = getProfileInfo(profiles, best.fk_profile_id);
    insights.push({
      title: "Mayor Crecimiento",
      question: "¿Quién creció más?",
      answer: info.name,
      detail: `Creció ${(best.follower_growth_percent || 0).toFixed(2)}% en el período`,
      icon: <TrendingUp className="h-5 w-5 text-emerald-500" />,
      variant: "success",
      value: `+${(best.follower_growth_percent || 0).toFixed(2)}%`,
      network: info.network || undefined
    });
  }

  // 5. Lowest/negative growth
  if (sortedByGrowth.length > 1) {
    const worst = sortedByGrowth[sortedByGrowth.length - 1];
    if ((worst.follower_growth_percent || 0) < 0) {
      const info = getProfileInfo(profiles, worst.fk_profile_id);
      insights.push({
        title: "Pérdida de Seguidores",
        question: "¿Quién perdió seguidores?",
        answer: info.name,
        detail: `Perdió ${Math.abs(worst.follower_growth_percent || 0).toFixed(2)}%`,
        icon: <TrendingDown className="h-5 w-5 text-destructive" />,
        variant: "danger",
        value: `${(worst.follower_growth_percent || 0).toFixed(2)}%`,
        network: info.network || undefined
      });
    }
  }

  // 6. Most active (posts per day)
  const sortedByActivity = latestKpis
    .filter(k => k.posts_per_day !== null)
    .sort((a, b) => (b.posts_per_day || 0) - (a.posts_per_day || 0));
  
  if (sortedByActivity.length > 0) {
    const best = sortedByActivity[0];
    const info = getProfileInfo(profiles, best.fk_profile_id);
    insights.push({
      title: "Más Activo",
      question: "¿Quién publica más?",
      answer: info.name,
      detail: `${(best.posts_per_day || 0).toFixed(1)} posts por día`,
      icon: <Flame className="h-5 w-5 text-orange-500" />,
      variant: "info",
      value: `${(best.posts_per_day || 0).toFixed(1)}/día`,
      network: info.network || undefined
    });
  }

  // 7. Least active
  if (sortedByActivity.length > 1) {
    const least = sortedByActivity[sortedByActivity.length - 1];
    const info = getProfileInfo(profiles, least.fk_profile_id);
    insights.push({
      title: "Menos Activo",
      question: "¿Quién publica menos?",
      answer: info.name,
      detail: `Solo ${(least.posts_per_day || 0).toFixed(1)} posts por día`,
      icon: <Target className="h-5 w-5 text-gray-500" />,
      variant: "warning",
      value: `${(least.posts_per_day || 0).toFixed(1)}/día`,
      network: info.network || undefined
    });
  }

  // 8. Best page performance index
  const sortedByPPI = latestKpis
    .filter(k => k.page_performance_index !== null)
    .sort((a, b) => (b.page_performance_index || 0) - (a.page_performance_index || 0));
  
  if (sortedByPPI.length > 0) {
    const best = sortedByPPI[0];
    const info = getProfileInfo(profiles, best.fk_profile_id);
    insights.push({
      title: "Mejor Rendimiento",
      question: "¿Mejor índice de rendimiento?",
      answer: info.name,
      detail: `Page Performance Index de ${(best.page_performance_index || 0).toFixed(0)}%`,
      icon: <BarChart3 className="h-5 w-5 text-violet-500" />,
      variant: "success",
      value: `${(best.page_performance_index || 0).toFixed(0)}%`,
      network: info.network || undefined
    });
  }

  return insights;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getVariantClasses(variant: InsightCard["variant"]): string {
  switch (variant) {
    case "success":
      return "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20";
    case "warning":
      return "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20";
    case "danger":
      return "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20";
    case "info":
    default:
      return "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20";
  }
}

const NETWORK_BADGE_COLORS: Record<FKNetwork, string> = {
  facebook: "bg-blue-100 text-blue-700 border-blue-200",
  instagram: "bg-pink-100 text-pink-700 border-pink-200",
  youtube: "bg-red-100 text-red-700 border-red-200",
  linkedin: "bg-sky-100 text-sky-700 border-sky-200",
  tiktok: "bg-slate-100 text-slate-700 border-slate-200",
  threads: "bg-gray-100 text-gray-700 border-gray-200",
  twitter: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

export function RankingInsightsPanel({ profiles, kpis, isLoading }: RankingInsightsPanelProps) {
  const [filterNetwork, setFilterNetwork] = useState<FKNetwork | "all">("all");
  
  const profileNetworks = profiles.map(p => p.network as FKNetwork);
  const insights = useMemo(
    () => generateInsights(profiles, kpis, filterNetwork), 
    [profiles, kpis, filterNetwork]
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <Card className="py-8">
        <CardContent className="text-center">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sin datos para generar insights</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Sincroniza los perfiles del ranking para ver respuestas automáticas a preguntas clave.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Insights del Ranking</h3>
          <Badge variant="secondary" className="ml-2">
            {insights.length} respuestas
          </Badge>
        </div>
        
        <NetworkFilter
          networks={profileNetworks}
          selected={filterNetwork}
          onChange={setFilterNetwork}
        />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {insights.map((insight, index) => (
          <Card key={index} className={`${getVariantClasses(insight.variant)} transition-all hover:shadow-md`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {insight.icon}
                  {insight.title}
                </CardTitle>
                <div className="flex items-center gap-1">
                  {insight.network && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${NETWORK_BADGE_COLORS[insight.network]}`}>
                      {getNetworkLabel(insight.network)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-1">{insight.question}</p>
              <div className="flex items-baseline gap-2">
                <p className="font-semibold text-lg">{insight.answer}</p>
                {insight.value && (
                  <Badge variant="outline" className="text-xs font-bold">
                    {insight.value}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{insight.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
