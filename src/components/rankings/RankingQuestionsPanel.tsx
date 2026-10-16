import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  HelpCircle, 
  Crown, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Flame,
  Target,
  Zap,
  ChevronRight,
  BarChart3,
  Percent,
  ArrowUpDown,
  Activity,
  Award
} from "lucide-react";
import { FKProfile, FKProfileKPI, FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";
import { NetworkFilter } from "./NetworkFilter";

interface RankingQuestionsPanelProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  isLoading: boolean;
  onAskAI: (question: string) => void;
}

interface PredefinedQuestion {
  id: string;
  category: "engagement" | "growth" | "activity" | "comparison" | "strategy" | "performance";
  question: string;
  shortQuestion: string;
  icon: React.ReactNode;
  getAnswer: (profiles: FKProfile[], kpis: FKProfileKPI[], filterNetwork: FKNetwork | "all") => string | null;
}

function getProfileName(profiles: FKProfile[], profileId: string): string {
  const profile = profiles.find(p => p.id === profileId);
  return `@${profile?.profile_id || "desconocido"}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getFilteredKpis(profiles: FKProfile[], kpis: FKProfileKPI[], filterNetwork: FKNetwork | "all"): FKProfileKPI[] {
  const filteredProfileIds = filterNetwork === "all" 
    ? profiles.map(p => p.id)
    : profiles.filter(p => p.network === filterNetwork).map(p => p.id);

  const shouldReplaceKpi = (candidate: FKProfileKPI, existing: FKProfileKPI) => {
    const candidateEnd = new Date(`${candidate.period_end}T00:00:00Z`).getTime();
    const existingEnd = new Date(`${existing.period_end}T00:00:00Z`).getTime();

    if (candidateEnd !== existingEnd) return candidateEnd > existingEnd;
    if (!!candidate.isFallback !== !!existing.isFallback) return !candidate.isFallback;

    return new Date(candidate.fetched_at).getTime() > new Date(existing.fetched_at).getTime();
  };
  
  const latestKpiByProfile = new Map<string, FKProfileKPI>();
  kpis.forEach(kpi => {
    if (!filteredProfileIds.includes(kpi.fk_profile_id)) return;
    const existing = latestKpiByProfile.get(kpi.fk_profile_id);
    if (!existing || shouldReplaceKpi(kpi, existing)) {
      latestKpiByProfile.set(kpi.fk_profile_id, kpi);
    }
  });
  
  return Array.from(latestKpiByProfile.values());
}

const predefinedQuestions: PredefinedQuestion[] = [
  // ENGAGEMENT QUESTIONS
  {
    id: "best_engagement",
    category: "engagement",
    question: "¿Quién tiene el mejor engagement rate del ranking?",
    shortQuestion: "Mejor engagement",
    icon: <Crown className="h-4 w-4 text-amber-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const sorted = filtered.filter(k => k.engagement_rate !== null).sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
      if (sorted.length === 0) return null;
      const best = sorted[0];
      return `${getProfileName(profiles, best.fk_profile_id)} lidera con ${((best.engagement_rate || 0) * 100).toFixed(2)}% de engagement`;
    }
  },
  {
    id: "worst_engagement",
    category: "engagement",
    question: "¿Quién tiene el peor engagement rate?",
    shortQuestion: "Menor engagement",
    icon: <TrendingDown className="h-4 w-4 text-red-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const sorted = filtered.filter(k => k.engagement_rate !== null).sort((a, b) => (a.engagement_rate || 0) - (b.engagement_rate || 0));
      if (sorted.length === 0) return null;
      const worst = sorted[0];
      return `${getProfileName(profiles, worst.fk_profile_id)} tiene el menor engagement con ${((worst.engagement_rate || 0) * 100).toFixed(2)}%`;
    }
  },
  {
    id: "engagement_gap",
    category: "engagement",
    question: "¿Cuál es la brecha de engagement entre el líder y el último?",
    shortQuestion: "Brecha de engagement",
    icon: <ArrowUpDown className="h-4 w-4 text-violet-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const sorted = filtered.filter(k => k.engagement_rate !== null).sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
      if (sorted.length < 2) return null;
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const gap = ((best.engagement_rate || 0) - (worst.engagement_rate || 0)) * 100;
      return `La brecha es de ${gap.toFixed(2)} puntos: ${getProfileName(profiles, best.fk_profile_id)} (${((best.engagement_rate || 0) * 100).toFixed(2)}%) vs ${getProfileName(profiles, worst.fk_profile_id)} (${((worst.engagement_rate || 0) * 100).toFixed(2)}%)`;
    }
  },

  // FOLLOWERS & GROWTH QUESTIONS
  {
    id: "most_followers",
    category: "comparison",
    question: "¿Quién tiene más seguidores?",
    shortQuestion: "Mayor audiencia",
    icon: <Users className="h-4 w-4 text-blue-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const sorted = filtered.filter(k => k.followers !== null).sort((a, b) => (b.followers || 0) - (a.followers || 0));
      if (sorted.length === 0) return null;
      const best = sorted[0];
      return `${getProfileName(profiles, best.fk_profile_id)} con ${formatNumber(best.followers || 0)} seguidores`;
    }
  },
  {
    id: "smallest_audience",
    category: "comparison",
    question: "¿Quién tiene la audiencia más pequeña?",
    shortQuestion: "Menor audiencia",
    icon: <Users className="h-4 w-4 text-gray-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const sorted = filtered.filter(k => k.followers !== null && k.followers > 0).sort((a, b) => (a.followers || 0) - (b.followers || 0));
      if (sorted.length === 0) return null;
      const smallest = sorted[0];
      return `${getProfileName(profiles, smallest.fk_profile_id)} con ${formatNumber(smallest.followers || 0)} seguidores`;
    }
  },
  {
    id: "biggest_growth",
    category: "growth",
    question: "¿Quién creció más en seguidores este período?",
    shortQuestion: "Mayor crecimiento",
    icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const sorted = filtered.filter(k => k.follower_growth_percent !== null).sort((a, b) => (b.follower_growth_percent || 0) - (a.follower_growth_percent || 0));
      if (sorted.length === 0) return null;
      const best = sorted[0];
      if ((best.follower_growth_percent || 0) <= 0) return "Ningún perfil mostró crecimiento positivo en el período";
      return `${getProfileName(profiles, best.fk_profile_id)} creció +${(best.follower_growth_percent || 0).toFixed(2)}%`;
    }
  },
  {
    id: "lost_followers",
    category: "growth",
    question: "¿Quién perdió más seguidores?",
    shortQuestion: "Mayor pérdida",
    icon: <TrendingDown className="h-4 w-4 text-red-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const sorted = filtered.filter(k => k.follower_growth_percent !== null && (k.follower_growth_percent || 0) < 0).sort((a, b) => (a.follower_growth_percent || 0) - (b.follower_growth_percent || 0));
      if (sorted.length === 0) return "Ningún perfil perdió seguidores en el período";
      const worst = sorted[0];
      return `${getProfileName(profiles, worst.fk_profile_id)} perdió ${Math.abs(worst.follower_growth_percent || 0).toFixed(2)}% de seguidores`;
    }
  },

  // ACTIVITY QUESTIONS
  {
    id: "most_active",
    category: "activity",
    question: "¿Quién publica más contenido?",
    shortQuestion: "Más activo",
    icon: <Flame className="h-4 w-4 text-orange-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const sorted = filtered.filter(k => k.posts_per_day !== null).sort((a, b) => (b.posts_per_day || 0) - (a.posts_per_day || 0));
      if (sorted.length === 0) return null;
      const best = sorted[0];
      return `${getProfileName(profiles, best.fk_profile_id)} con ${(best.posts_per_day || 0).toFixed(1)} posts/día`;
    }
  },
  {
    id: "least_active",
    category: "activity",
    question: "¿Quién publica menos contenido?",
    shortQuestion: "Menos activo",
    icon: <Target className="h-4 w-4 text-gray-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const sorted = filtered.filter(k => k.posts_per_day !== null).sort((a, b) => (a.posts_per_day || 0) - (b.posts_per_day || 0));
      if (sorted.length === 0) return null;
      const least = sorted[0];
      return `${getProfileName(profiles, least.fk_profile_id)} con solo ${(least.posts_per_day || 0).toFixed(1)} posts/día`;
    }
  },
  {
    id: "activity_average",
    category: "activity",
    question: "¿Cuál es el promedio de publicaciones del ranking?",
    shortQuestion: "Promedio de actividad",
    icon: <Activity className="h-4 w-4 text-blue-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const withData = filtered.filter(k => k.posts_per_day !== null);
      if (withData.length === 0) return null;
      const avg = withData.reduce((sum, k) => sum + (k.posts_per_day || 0), 0) / withData.length;
      return `El promedio del ranking es ${avg.toFixed(1)} posts por día entre ${withData.length} perfiles`;
    }
  },

  // PERFORMANCE QUESTIONS
  {
    id: "best_performance",
    category: "performance",
    question: "¿Quién tiene el mejor índice de rendimiento?",
    shortQuestion: "Mejor rendimiento",
    icon: <Zap className="h-4 w-4 text-violet-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const sorted = filtered.filter(k => k.page_performance_index !== null).sort((a, b) => (b.page_performance_index || 0) - (a.page_performance_index || 0));
      if (sorted.length === 0) return null;
      const best = sorted[0];
      return `${getProfileName(profiles, best.fk_profile_id)} con un Page Performance Index de ${(best.page_performance_index || 0).toFixed(0)}%`;
    }
  },

  // STRATEGY QUESTIONS
  {
    id: "quality_vs_quantity",
    category: "strategy",
    question: "¿Quién logra más engagement con menos publicaciones?",
    shortQuestion: "Calidad vs cantidad",
    icon: <Award className="h-4 w-4 text-amber-600" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const withData = filtered.filter(k => k.engagement_rate !== null && k.posts_per_day !== null && k.posts_per_day > 0);
      if (withData.length === 0) return null;
      // Calculate efficiency = engagement / posts_per_day
      const sorted = withData.sort((a, b) => {
        const effA = (a.engagement_rate || 0) / (a.posts_per_day || 1);
        const effB = (b.engagement_rate || 0) / (b.posts_per_day || 1);
        return effB - effA;
      });
      const best = sorted[0];
      return `${getProfileName(profiles, best.fk_profile_id)} es el más eficiente: ${((best.engagement_rate || 0) * 100).toFixed(2)}% engagement con ${(best.posts_per_day || 0).toFixed(1)} posts/día`;
    }
  },
  {
    id: "top_3",
    category: "comparison",
    question: "¿Cuáles son los top 3 perfiles por engagement?",
    shortQuestion: "Top 3 engagement",
    icon: <BarChart3 className="h-4 w-4 text-primary" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const sorted = filtered.filter(k => k.engagement_rate !== null).sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0)).slice(0, 3);
      if (sorted.length === 0) return null;
      return sorted.map((k, i) => `${i + 1}. ${getProfileName(profiles, k.fk_profile_id)} (${((k.engagement_rate || 0) * 100).toFixed(2)}%)`).join(" | ");
    }
  },
  {
    id: "market_leader",
    category: "comparison",
    question: "¿Quién domina el mercado en audiencia total?",
    shortQuestion: "Líder de mercado",
    icon: <Crown className="h-4 w-4 text-amber-500" />,
    getAnswer: (profiles, kpis, filterNetwork) => {
      const filtered = getFilteredKpis(profiles, kpis, filterNetwork);
      const withData = filtered.filter(k => k.followers !== null && k.followers > 0);
      if (withData.length === 0) return null;
      const total = withData.reduce((sum, k) => sum + (k.followers || 0), 0);
      const sorted = withData.sort((a, b) => (b.followers || 0) - (a.followers || 0));
      const leader = sorted[0];
      const share = ((leader.followers || 0) / total) * 100;
      return `${getProfileName(profiles, leader.fk_profile_id)} domina con ${formatNumber(leader.followers || 0)} seguidores (${share.toFixed(1)}% del total)`;
    }
  },
];

const categoryLabels: Record<string, string> = {
  engagement: "Engagement",
  growth: "Crecimiento",
  activity: "Actividad",
  comparison: "Comparación",
  strategy: "Estrategia",
  performance: "Rendimiento",
};

export function RankingQuestionsPanel({ profiles, kpis, isLoading, onAskAI }: RankingQuestionsPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterNetwork, setFilterNetwork] = useState<FKNetwork | "all">("all");
  const [selectedQuestion, setSelectedQuestion] = useState<PredefinedQuestion | null>(null);

  const profileNetworks = profiles.map(p => p.network as FKNetwork);

  const filteredQuestions = selectedCategory === "all" 
    ? predefinedQuestions 
    : predefinedQuestions.filter(q => q.category === selectedCategory);

  const handleQuestionClick = (question: PredefinedQuestion) => {
    setSelectedQuestion(question);
  };

  const answer = selectedQuestion?.getAnswer(profiles, kpis, filterNetwork);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Preguntas Rápidas
        </CardTitle>
        <CardDescription>
          Respuestas instantáneas sobre el ranking. Filtra por red y categoría.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Network filter */}
        <NetworkFilter
          networks={profileNetworks}
          selected={filterNetwork}
          onChange={setFilterNetwork}
        />

        {/* Category filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-1">Categoría:</span>
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedCategory("all")}
          >
            Todas
          </Button>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <Button
              key={value}
              variant={selectedCategory === value ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedCategory(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Questions list */}
        <ScrollArea className="h-64">
          <div className="grid gap-2">
            {filteredQuestions.map((q) => (
              <Button
                key={q.id}
                variant={selectedQuestion?.id === q.id ? "default" : "ghost"}
                className="justify-start h-auto py-2 px-3 text-left"
                onClick={() => handleQuestionClick(q)}
                disabled={isLoading}
              >
                <span className="mr-2 flex-shrink-0">{q.icon}</span>
                <span className="flex-1 text-sm truncate">{q.shortQuestion}</span>
                <ChevronRight className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" />
              </Button>
            ))}
          </div>
        </ScrollArea>

        {/* Answer display */}
        {selectedQuestion && (
          <Card className="bg-muted/50 border-primary/20">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">{selectedQuestion.question}</p>
              {answer ? (
                <p className="font-medium">{answer}</p>
              ) : (
                <p className="text-muted-foreground italic">
                  No hay datos suficientes. Sincroniza los perfiles primero.
                </p>
              )}
              {filterNetwork !== "all" && (
                <Badge variant="outline" className="mt-2 text-xs">
                  Filtrado por {getNetworkLabel(filterNetwork)}
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI question button */}
        <div className="pt-4 border-t">
          <Button 
            variant="secondary" 
            className="w-full"
            onClick={() => onAskAI(selectedQuestion?.question || "")}
          >
            <Zap className="h-4 w-4 mr-2" />
            Pregunta personalizada con IA
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
