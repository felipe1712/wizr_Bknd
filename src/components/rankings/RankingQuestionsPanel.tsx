import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  HelpCircle, 
  Crown, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Flame,
  Target,
  Zap,
  ChevronRight
} from "lucide-react";
import { FKProfile, FKProfileKPI } from "@/hooks/useFanpageKarma";

interface RankingQuestionsPanelProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  isLoading: boolean;
  onAskAI: (question: string) => void;
}

interface PredefinedQuestion {
  id: string;
  category: "engagement" | "growth" | "activity" | "comparison";
  question: string;
  icon: React.ReactNode;
  getAnswer: (profiles: FKProfile[], kpis: FKProfileKPI[]) => string | null;
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

const predefinedQuestions: PredefinedQuestion[] = [
  {
    id: "best_engagement",
    category: "engagement",
    question: "¿Quién tiene el mejor engagement rate?",
    icon: <Crown className="h-4 w-4 text-amber-500" />,
    getAnswer: (profiles, kpis) => {
      const sorted = kpis
        .filter(k => k.engagement_rate !== null)
        .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
      if (sorted.length === 0) return null;
      const best = sorted[0];
      return `${getProfileName(profiles, best.fk_profile_id)} con ${((best.engagement_rate || 0) * 100).toFixed(2)}% de engagement rate`;
    }
  },
  {
    id: "worst_engagement",
    category: "engagement",
    question: "¿Quién tiene el peor engagement rate?",
    icon: <TrendingDown className="h-4 w-4 text-red-500" />,
    getAnswer: (profiles, kpis) => {
      const sorted = kpis
        .filter(k => k.engagement_rate !== null)
        .sort((a, b) => (a.engagement_rate || 0) - (b.engagement_rate || 0));
      if (sorted.length === 0) return null;
      const worst = sorted[0];
      return `${getProfileName(profiles, worst.fk_profile_id)} con solo ${((worst.engagement_rate || 0) * 100).toFixed(2)}% de engagement rate`;
    }
  },
  {
    id: "most_followers",
    category: "comparison",
    question: "¿Quién tiene más seguidores?",
    icon: <Users className="h-4 w-4 text-blue-500" />,
    getAnswer: (profiles, kpis) => {
      const sorted = kpis
        .filter(k => k.followers !== null)
        .sort((a, b) => (b.followers || 0) - (a.followers || 0));
      if (sorted.length === 0) return null;
      const best = sorted[0];
      return `${getProfileName(profiles, best.fk_profile_id)} con ${formatNumber(best.followers || 0)} seguidores`;
    }
  },
  {
    id: "biggest_growth",
    category: "growth",
    question: "¿Quién creció más en seguidores?",
    icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
    getAnswer: (profiles, kpis) => {
      const sorted = kpis
        .filter(k => k.follower_growth_percent !== null)
        .sort((a, b) => (b.follower_growth_percent || 0) - (a.follower_growth_percent || 0));
      if (sorted.length === 0) return null;
      const best = sorted[0];
      if ((best.follower_growth_percent || 0) <= 0) return "Ningún perfil mostró crecimiento positivo en el período";
      return `${getProfileName(profiles, best.fk_profile_id)} con +${(best.follower_growth_percent || 0).toFixed(2)}% de crecimiento`;
    }
  },
  {
    id: "lost_followers",
    category: "growth",
    question: "¿Quién perdió más seguidores?",
    icon: <TrendingDown className="h-4 w-4 text-red-500" />,
    getAnswer: (profiles, kpis) => {
      const sorted = kpis
        .filter(k => k.follower_growth_percent !== null && (k.follower_growth_percent || 0) < 0)
        .sort((a, b) => (a.follower_growth_percent || 0) - (b.follower_growth_percent || 0));
      if (sorted.length === 0) return "Ningún perfil perdió seguidores en el período";
      const worst = sorted[0];
      return `${getProfileName(profiles, worst.fk_profile_id)} perdió ${Math.abs(worst.follower_growth_percent || 0).toFixed(2)}% de seguidores`;
    }
  },
  {
    id: "most_active",
    category: "activity",
    question: "¿Quién publica más contenido?",
    icon: <Flame className="h-4 w-4 text-orange-500" />,
    getAnswer: (profiles, kpis) => {
      const sorted = kpis
        .filter(k => k.posts_per_day !== null)
        .sort((a, b) => (b.posts_per_day || 0) - (a.posts_per_day || 0));
      if (sorted.length === 0) return null;
      const best = sorted[0];
      return `${getProfileName(profiles, best.fk_profile_id)} con ${(best.posts_per_day || 0).toFixed(1)} posts por día`;
    }
  },
  {
    id: "least_active",
    category: "activity",
    question: "¿Quién publica menos contenido?",
    icon: <Target className="h-4 w-4 text-gray-500" />,
    getAnswer: (profiles, kpis) => {
      const sorted = kpis
        .filter(k => k.posts_per_day !== null)
        .sort((a, b) => (a.posts_per_day || 0) - (b.posts_per_day || 0));
      if (sorted.length === 0) return null;
      const least = sorted[0];
      return `${getProfileName(profiles, least.fk_profile_id)} con solo ${(least.posts_per_day || 0).toFixed(1)} posts por día`;
    }
  },
  {
    id: "best_performance",
    category: "comparison",
    question: "¿Quién tiene el mejor índice de rendimiento?",
    icon: <Zap className="h-4 w-4 text-violet-500" />,
    getAnswer: (profiles, kpis) => {
      const sorted = kpis
        .filter(k => k.page_performance_index !== null)
        .sort((a, b) => (b.page_performance_index || 0) - (a.page_performance_index || 0));
      if (sorted.length === 0) return null;
      const best = sorted[0];
      return `${getProfileName(profiles, best.fk_profile_id)} con un Page Performance Index de ${(best.page_performance_index || 0).toFixed(0)}%`;
    }
  },
];

const categoryLabels: Record<string, string> = {
  engagement: "Engagement",
  growth: "Crecimiento",
  activity: "Actividad",
  comparison: "Comparación",
};

export function RankingQuestionsPanel({ profiles, kpis, isLoading, onAskAI }: RankingQuestionsPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedQuestion, setSelectedQuestion] = useState<PredefinedQuestion | null>(null);

  // Get latest KPI for each profile
  const latestKpiByProfile = new Map<string, FKProfileKPI>();
  kpis.forEach(kpi => {
    const existing = latestKpiByProfile.get(kpi.fk_profile_id);
    if (!existing || new Date(kpi.period_end) > new Date(existing.period_end)) {
      latestKpiByProfile.set(kpi.fk_profile_id, kpi);
    }
  });
  const latestKpis = Array.from(latestKpiByProfile.values());

  const filteredQuestions = selectedCategory === "all" 
    ? predefinedQuestions 
    : predefinedQuestions.filter(q => q.category === selectedCategory);

  const handleQuestionClick = (question: PredefinedQuestion) => {
    setSelectedQuestion(question);
  };

  const answer = selectedQuestion?.getAnswer(profiles, latestKpis);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Preguntas Rápidas
        </CardTitle>
        <CardDescription>
          Selecciona una pregunta predefinida o haz una pregunta personalizada con IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filtrar por:</span>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Questions grid */}
        <div className="grid gap-2 md:grid-cols-2">
          {filteredQuestions.map((q) => (
            <Button
              key={q.id}
              variant={selectedQuestion?.id === q.id ? "default" : "outline"}
              className="justify-start h-auto py-3 px-4 text-left whitespace-normal"
              onClick={() => handleQuestionClick(q)}
              disabled={isLoading}
            >
              <span className="mr-2 flex-shrink-0">{q.icon}</span>
              <span className="flex-1 text-sm text-left break-words">{q.question}</span>
              <ChevronRight className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" />
            </Button>
          ))}
        </div>

        {/* Answer display */}
        {selectedQuestion && (
          <Card className="bg-muted/50 border-primary/20">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-2">{selectedQuestion.question}</p>
              {answer ? (
                <p className="font-medium text-lg">{answer}</p>
              ) : (
                <p className="text-muted-foreground italic">
                  No hay datos suficientes para responder. Sincroniza los perfiles primero.
                </p>
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
            Hacer pregunta personalizada con IA
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
