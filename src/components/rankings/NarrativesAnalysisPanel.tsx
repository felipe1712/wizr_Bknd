import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BookOpen, 
  RefreshCw, 
  Sparkles, 
  MessageSquareText,
  TrendingUp,
  TrendingDown,
  Minus,
  Quote,
  Hash,
  Target
} from "lucide-react";
import { FKProfile, useFetchProfilePosts, FKPost, FKNetwork } from "@/hooks/useFanpageKarma";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NetworkFilter } from "./NetworkFilter";
import { ProfileSelectGrouped } from "./ProfileSelectGrouped";

interface NarrativesAnalysisPanelProps {
  profiles: FKProfile[];
  isLoading: boolean;
  dateRange?: { from: Date; to: Date };
}

interface NarrativeAnalysis {
  dominantNarratives: Array<{
    theme: string;
    description: string;
    frequency: number;
    sentiment: "positive" | "neutral" | "negative";
    examplePosts: string[];
  }>;
  toneAnalysis: {
    overall: "formal" | "informal" | "mixed";
    emotionalTone: string;
    callToAction: boolean;
  };
  topHashtags: Array<{
    tag: string;
    count: number;
  }>;
  contentStrategy: {
    primaryFocus: string;
    strengths: string[];
    opportunities: string[];
  };
  summary: string;
}

const getSentimentIcon = (sentiment: string) => {
  switch (sentiment) {
    case "positive":
      return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    case "negative":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
};

const getSentimentLabel = (sentiment: string) => {
  switch (sentiment) {
    case "positive": return "Positivo";
    case "negative": return "Negativo";
    default: return "Neutral";
  }
};

export function NarrativesAnalysisPanel({ profiles, isLoading: profilesLoading, dateRange }: NarrativesAnalysisPanelProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [filterNetwork, setFilterNetwork] = useState<FKNetwork | "all">("all");
  const [analysis, setAnalysis] = useState<NarrativeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Filter profiles by network
  const filteredProfiles = filterNetwork === "all" 
    ? profiles 
    : profiles.filter(p => p.network === filterNetwork);

  const selectedProfile = filteredProfiles.find(p => p.id === selectedProfileId) || filteredProfiles[0];

  // Reset selection when filter changes
  useEffect(() => {
    if (selectedProfileId && !filteredProfiles.find(p => p.id === selectedProfileId)) {
      setSelectedProfileId(filteredProfiles[0]?.id || "");
    }
  }, [filterNetwork, filteredProfiles, selectedProfileId]);

  const { 
    data: posts = [], 
    isLoading: postsLoading,
    refetch: refetchPosts
  } = useFetchProfilePosts(selectedProfile);

  const analyzeNarratives = async () => {
    if (!selectedProfile || posts.length === 0) {
      toast.error("No hay posts disponibles para analizar");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      // Prepare content for analysis
      const postsContent = posts.map(post => ({
        message: post.message || post.title || "",
        contentType: post.content_type || "post",
        engagement: (post.likes || 0) + (post.comments || 0) + (post.shares || 0),
        date: post.published_at
      })).filter(p => p.message.trim().length > 0);

      if (postsContent.length === 0) {
        toast.error("Los posts no tienen contenido textual para analizar");
        setIsAnalyzing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("analyze-narratives", {
        body: {
          profileName: selectedProfile.display_name || selectedProfile.profile_id,
          network: selectedProfile.network,
          posts: postsContent,
          dateRange: dateRange ? {
            from: dateRange.from.toISOString(),
            to: dateRange.to.toISOString()
          } : null
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Error al analizar narrativas");

      setAnalysis(data.analysis);
      toast.success("Análisis de narrativas completado");
    } catch (err) {
      console.error("Error analyzing narratives:", err);
      toast.error(`Error: ${(err as Error).message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (profilesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <Card className="py-12">
        <CardContent className="text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sin perfiles</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Agrega perfiles en la pestaña de Configuración para analizar sus narrativas.
          </p>
        </CardContent>
      </Card>
    );
  }

  const profileNetworks = profiles.map(p => p.network as FKNetwork);

  return (
    <div className="space-y-6">
      {/* Network Filter */}
      <NetworkFilter
        networks={profileNetworks}
        selected={filterNetwork}
        onChange={setFilterNetwork}
      />

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Perfil:</span>
          <ProfileSelectGrouped
            profiles={profiles}
            value={selectedProfileId || selectedProfile?.id || ""}
            onValueChange={setSelectedProfileId}
            filterNetwork={filterNetwork}
          />
        </div>

        <Button 
          onClick={analyzeNarratives}
          disabled={isAnalyzing || postsLoading || posts.length === 0}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Analizar Narrativas
            </>
          )}
        </Button>

        {posts.length > 0 && (
          <Badge variant="secondary">
            {posts.length} posts disponibles
          </Badge>
        )}
      </div>

      {/* Analysis Results */}
      {isAnalyzing && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {analysis && !isAnalyzing && (
        <div className="space-y-6">
          {/* Summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquareText className="h-5 w-5 text-primary" />
                Resumen de Narrativas - @{selectedProfile?.profile_id}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{analysis.summary}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Dominant Narratives */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Narrativas Dominantes
                </CardTitle>
                <CardDescription>
                  Los temas principales que caracterizan el contenido
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    {analysis.dominantNarratives.map((narrative, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium">{narrative.theme}</h4>
                          <div className="flex items-center gap-2">
                            {getSentimentIcon(narrative.sentiment)}
                            <Badge variant="outline" className="text-xs">
                              {narrative.frequency}%
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {narrative.description}
                        </p>
                        {narrative.examplePosts.length > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Ejemplos:</p>
                            {narrative.examplePosts.slice(0, 2).map((example, i) => (
                              <div key={i} className="flex items-start gap-1 text-xs text-muted-foreground">
                                <Quote className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2">{example}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Content Strategy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Estrategia de Contenido
                </CardTitle>
                <CardDescription>
                  Análisis del enfoque y oportunidades
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Enfoque Principal</p>
                  <p className="text-sm text-muted-foreground">
                    {analysis.contentStrategy.primaryFocus}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Fortalezas</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.contentStrategy.strengths.map((strength, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {strength}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Oportunidades</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.contentStrategy.opportunities.map((opp, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {opp}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tone Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Análisis de Tono</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Tono General</p>
                    <p className="font-medium capitalize">{analysis.toneAnalysis.overall}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tono Emocional</p>
                    <p className="font-medium">{analysis.toneAnalysis.emotionalTone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Call to Action</p>
                    <Badge variant={analysis.toneAnalysis.callToAction ? "default" : "secondary"}>
                      {analysis.toneAnalysis.callToAction ? "Frecuente" : "Poco frecuente"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Hashtags */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Hash className="h-4 w-4" />
                  Hashtags Principales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.topHashtags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      #{tag.tag}
                      <span className="ml-1 text-xs text-muted-foreground">({tag.count})</span>
                    </Badge>
                  ))}
                  {analysis.topHashtags.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No se identificaron hashtags frecuentes
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!analysis && !isAnalyzing && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Análisis de Narrativas</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-4">
              Descubre las narrativas dominantes, tono y estrategia de contenido de cada perfil. 
              Selecciona un perfil y haz clic en "Analizar Narrativas".
            </p>
            {posts.length === 0 && selectedProfile && (
              <p className="text-sm text-amber-600">
                Haz clic en "Contenido Top" primero para cargar los posts del perfil.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
