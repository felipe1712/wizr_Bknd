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
import { FKProfile, FKProfileKPI, FKNetwork, FKPeriodPostMetrics, getNetworkLabel } from "@/hooks/useFanpageKarma";
import { NetworkFilter } from "./NetworkFilter";

interface RankingInsightsPanelProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  isLoading: boolean;
  periodMetrics?: Map<string, FKPeriodPostMetrics>;
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

function shouldReplaceKpi(candidate: FKProfileKPI, existing: FKProfileKPI) {
  const candidateEnd = new Date(`${candidate.period_end}T00:00:00Z`).getTime();
  const existingEnd = new Date(`${existing.period_end}T00:00:00Z`).getTime();

  if (candidateEnd !== existingEnd) return candidateEnd > existingEnd;
  if (!!candidate.isFallback !== !!existing.isFallback) return !candidate.isFallback;

  return new Date(candidate.fetched_at).getTime() > new Date(existing.fetched_at).getTime();
}

// Insights automáticos: Top performers y alertas críticas
// NO duplica las preguntas del RankingQuestionsPanel
function generateInsights(
  profiles: FKProfile[],
  kpis: FKProfileKPI[],
  filterNetwork: FKNetwork | "all",
  periodMetrics?: Map<string, FKPeriodPostMetrics>,
): InsightCard[] {
  const insights: InsightCard[] = [];

  if (kpis.length === 0) {
    return [];
  }

  const filteredProfileIds = filterNetwork === "all"
    ? profiles.map(p => p.id)
    : profiles.filter(p => p.network === filterNetwork).map(p => p.id);

  const latestKpiByProfile = new Map<string, FKProfileKPI>();
  kpis.forEach(kpi => {
    if (!filteredProfileIds.includes(kpi.fk_profile_id)) return;
    const existing = latestKpiByProfile.get(kpi.fk_profile_id);
    if (!existing || shouldReplaceKpi(kpi, existing)) {
      latestKpiByProfile.set(kpi.fk_profile_id, kpi);
    }
  });

  const latestKpis = Array.from(latestKpiByProfile.values());
  if (latestKpis.length === 0) return [];

  const enriched = latestKpis.map((kpi) => ({
    kpi,
    period: periodMetrics?.get(kpi.fk_profile_id) ?? null,
  }));

  const withGrowth = [...latestKpis]
    .filter(k => k.follower_growth_percent !== null)
    .sort((a, b) => (b.follower_growth_percent || 0) - (a.follower_growth_percent || 0));

  const withPeriodEngagement = enriched
    .filter(item => (item.period?.postCount || 0) > 0)
    .sort((a, b) => (b.period?.avgEngagement || 0) - (a.period?.avgEngagement || 0));

  const withSnapshotEngagement = [...latestKpis]
    .filter(k => k.engagement_rate !== null)
    .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));

  if (withGrowth.length > 0 && (withPeriodEngagement.length > 0 || withSnapshotEngagement.length > 0)) {
    const usePeriodEngagement = withPeriodEngagement.length > 0;
    const scores = enriched.map(item => {
      const engagementRank = usePeriodEngagement
        ? withPeriodEngagement.findIndex(entry => entry.kpi.fk_profile_id === item.kpi.fk_profile_id)
        : withSnapshotEngagement.findIndex(entry => entry.fk_profile_id === item.kpi.fk_profile_id);
      const growthRank = withGrowth.findIndex(k => k.fk_profile_id === item.kpi.fk_profile_id);

      return {
        item,
        score: (engagementRank >= 0 ? (usePeriodEngagement ? withPeriodEngagement.length : withSnapshotEngagement.length) - engagementRank : 0) +
          (growthRank >= 0 ? withGrowth.length - growthRank : 0),
      };
    }).sort((a, b) => b.score - a.score);

    if (scores.length > 0 && scores[0].score > 0) {
      const best = scores[0].item;
      const info = getProfileInfo(profiles, best.kpi.fk_profile_id);
      insights.push({
        title: "Top Performer",
        question: "¿Quién destaca en rendimiento general?",
        answer: info.name,
        detail: usePeriodEngagement
          ? "Líder en engagement promedio del período y crecimiento combinado"
          : "Líder en engagement y crecimiento combinado",
        icon: <Crown className="h-5 w-5 text-amber-500" />,
        variant: "success",
        network: info.network || undefined,
      });
    }
  }

  const smallAccounts = [...latestKpis].filter(k =>
    k.followers !== null &&
    k.follower_growth_percent !== null &&
    k.followers > 0,
  );
  const medianFollowers = smallAccounts.length > 0
    ? [...smallAccounts].sort((a, b) => (a.followers || 0) - (b.followers || 0))[Math.floor(smallAccounts.length / 2)]?.followers || 0
    : 0;

  const risingStars = smallAccounts
    .filter(k => (k.followers || 0) < medianFollowers && (k.follower_growth_percent || 0) > 0)
    .sort((a, b) => (b.follower_growth_percent || 0) - (a.follower_growth_percent || 0));

  if (risingStars.length > 0) {
    const star = risingStars[0];
    const info = getProfileInfo(profiles, star.fk_profile_id);
    insights.push({
      title: "Estrella Emergente",
      question: "¿Qué cuenta pequeña crece más rápido?",
      answer: info.name,
      detail: `+${(star.follower_growth_percent || 0).toFixed(2)}% con ${formatNumber(star.followers || 0)} seguidores`,
      icon: <Sparkles className="h-5 w-5 text-yellow-500" />,
      variant: "success",
      value: `+${(star.follower_growth_percent || 0).toFixed(2)}%`,
      network: info.network || undefined,
    });
  }

  if (withPeriodEngagement.length > 0) {
    const best = withPeriodEngagement[0];
    const info = getProfileInfo(profiles, best.kpi.fk_profile_id);
    insights.push({
      title: "Más Eficiente",
      question: "¿Quién logra más con menos publicaciones?",
      answer: info.name,
      detail: `${formatNumber(best.period?.avgEngagement || 0)} engagement promedio con ${best.period?.postCount || 0} posts en el período`,
      icon: <Target className="h-5 w-5 text-emerald-500" />,
      variant: "success",
      network: info.network || undefined,
    });
  } else {
    const withActivity = [...latestKpis].filter(k =>
      k.engagement_rate !== null &&
      k.posts_per_day !== null &&
      (k.posts_per_day || 0) > 0,
    );

    if (withActivity.length > 0) {
      const sorted = withActivity.sort((a, b) => {
        const effA = (a.engagement_rate || 0) / (a.posts_per_day || 1);
        const effB = (b.engagement_rate || 0) / (b.posts_per_day || 1);
        return effB - effA;
      });
      const best = sorted[0];
      const info = getProfileInfo(profiles, best.fk_profile_id);
      insights.push({
        title: "Más Eficiente",
        question: "¿Quién logra más con menos publicaciones?",
        answer: info.name,
        detail: `${((best.engagement_rate || 0) * 100).toFixed(2)}% engagement con ${(best.posts_per_day || 0).toFixed(1)} posts/día`,
        icon: <Target className="h-5 w-5 text-emerald-500" />,
        variant: "success",
        network: info.network || undefined,
      });
    }
  }

  const losingFollowers = [...latestKpis]
    .filter(k => k.follower_growth_percent !== null && (k.follower_growth_percent || 0) < -1)
    .sort((a, b) => (a.follower_growth_percent || 0) - (b.follower_growth_percent || 0));

  if (losingFollowers.length > 0) {
    const worst = losingFollowers[0];
    const info = getProfileInfo(profiles, worst.fk_profile_id);
    insights.push({
      title: "Alerta: Pérdida",
      question: "¿Quién pierde seguidores significativamente?",
      answer: info.name,
      detail: `Perdió ${Math.abs(worst.follower_growth_percent || 0).toFixed(2)}% de su audiencia`,
      icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
      variant: "danger",
      value: `${(worst.follower_growth_percent || 0).toFixed(2)}%`,
      network: info.network || undefined,
    });
  }

  const withFollowers = [...latestKpis].filter(k => k.followers !== null && (k.followers || 0) > 0);
  if (withFollowers.length >= 2) {
    const total = withFollowers.reduce((sum, k) => sum + (k.followers || 0), 0);
    const sorted = withFollowers.sort((a, b) => (b.followers || 0) - (a.followers || 0));
    const leader = sorted[0];
    const share = ((leader.followers || 0) / total) * 100;
    const info = getProfileInfo(profiles, leader.fk_profile_id);
    insights.push({
      title: "Cuota de Mercado",
      question: "¿Quién domina la audiencia total?",
      answer: info.name,
      detail: `${share.toFixed(1)}% del total de seguidores del ranking`,
      icon: <Users className="h-5 w-5 text-blue-500" />,
      variant: "info",
      value: `${share.toFixed(1)}%`,
      network: info.network || undefined,
    });
  }

  const withPeriodActivity = enriched
    .filter(item => (item.period?.postCount || 0) > 0)
    .sort((a, b) => (b.period?.postCount || 0) - (a.period?.postCount || 0));

  if (withPeriodActivity.length >= 2) {
    const avg = withPeriodActivity.reduce((sum, item) => sum + (item.period?.postCount || 0), 0) / withPeriodActivity.length;
    const mostActive = withPeriodActivity[0];

    if (avg > 0 && (mostActive.period?.postCount || 0) > avg * 2) {
      const info = getProfileInfo(profiles, mostActive.kpi.fk_profile_id);
      insights.push({
        title: "Hiperactividad",
        question: "¿Quién publica muy por encima del promedio?",
        answer: info.name,
        detail: `${mostActive.period?.postCount || 0} posts en el período vs promedio ${avg.toFixed(1)}`,
        icon: <Flame className="h-5 w-5 text-orange-500" />,
        variant: "warning",
        value: `${((mostActive.period?.postCount || 0) / avg).toFixed(1)}x`,
        network: info.network || undefined,
      });
    }
  } else {
    const sortedByActivity = [...latestKpis]
      .filter(k => k.posts_per_day !== null)
      .sort((a, b) => (b.posts_per_day || 0) - (a.posts_per_day || 0));

    if (sortedByActivity.length >= 2) {
      const avg = sortedByActivity.reduce((sum, k) => sum + (k.posts_per_day || 0), 0) / sortedByActivity.length;
      const mostActive = sortedByActivity[0];

      if ((mostActive.posts_per_day || 0) > avg * 2) {
        const info = getProfileInfo(profiles, mostActive.fk_profile_id);
        insights.push({
          title: "Hiperactividad",
          question: "¿Quién publica muy por encima del promedio?",
          answer: info.name,
          detail: `${(mostActive.posts_per_day || 0).toFixed(1)} posts/día vs promedio ${avg.toFixed(1)}`,
          icon: <Flame className="h-5 w-5 text-orange-500" />,
          variant: "warning",
          value: `${((mostActive.posts_per_day || 0) / avg).toFixed(1)}x`,
          network: info.network || undefined,
        });
      }
    }
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

export function RankingInsightsPanel({ profiles, kpis, isLoading, periodMetrics }: RankingInsightsPanelProps) {
  const [filterNetwork, setFilterNetwork] = useState<FKNetwork | "all">("all");
  
  const profileNetworks = profiles.map(p => p.network as FKNetwork);
  const insights = useMemo(
    () => generateInsights(profiles, kpis, filterNetwork, periodMetrics), 
    [profiles, kpis, filterNetwork, periodMetrics]
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
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-1 line-clamp-1">{insight.question}</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="font-semibold text-base truncate max-w-[140px]" title={insight.answer}>
                  {insight.answer}
                </p>
                {insight.value && (
                  <Badge
                    variant="outline"
                    className="text-xs font-bold flex-shrink-0 max-w-[120px] truncate"
                    title={insight.value}
                  >
                    {insight.value}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{insight.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
