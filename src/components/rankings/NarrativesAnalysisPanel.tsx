import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Target,
  Users,
  GitCompare,
  Lightbulb,
  Search
} from "lucide-react";
import { FKProfile, useFetchProfilePosts, FKPost, FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NetworkFilter } from "./NetworkFilter";

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

interface ProfileAnalysis {
  profileId: string;
  profileName: string;
  network: string;
  analysis: NarrativeAnalysis;
}

interface ComparativeResult {
  profiles: ProfileAnalysis[];
  comparison?: {
    commonThemes: string[];
    differentiators: Array<{
      profileName: string;
      uniqueAspect: string;
    }>;
    leaderInEngagement?: string;
    mostFormalTone?: string;
    overallInsight: string;
  };
}

const MAX_PROFILES = 5;

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

export function NarrativesAnalysisPanel({ profiles, isLoading: profilesLoading, dateRange }: NarrativesAnalysisPanelProps) {
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [filterNetwork, setFilterNetwork] = useState<FKNetwork | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [comparativeResult, setComparativeResult] = useState<ComparativeResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [profilePosts, setProfilePosts] = useState<Map<string, FKPost[]>>(new Map());
  const [activeProfileTab, setActiveProfileTab] = useState<string>("");

  // Filter profiles by network and search query
  const filteredProfiles = useMemo(() => {
    let filtered = filterNetwork === "all" 
      ? profiles 
      : profiles.filter(p => p.network === filterNetwork);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.profile_id.toLowerCase().includes(query) ||
        (p.display_name && p.display_name.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [profiles, filterNetwork, searchQuery]);

  // Selected profiles data
  const selectedProfiles = useMemo(() => 
    profiles.filter(p => selectedProfileIds.has(p.id)),
    [profiles, selectedProfileIds]
  );

  // Reset selection when filter changes
  useEffect(() => {
    const validIds = new Set(filteredProfiles.map(p => p.id));
    setSelectedProfileIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [filteredProfiles]);

  // Set first profile as active tab when results arrive
  useEffect(() => {
    if (comparativeResult?.profiles.length && !activeProfileTab) {
      setActiveProfileTab(comparativeResult.profiles[0].profileId);
    }
  }, [comparativeResult, activeProfileTab]);

  const handleToggleProfile = (profileId: string) => {
    setSelectedProfileIds(prev => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else if (next.size < MAX_PROFILES) {
        next.add(profileId);
      } else {
        toast.warning(`Máximo ${MAX_PROFILES} perfiles permitidos`);
        return prev;
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const toSelect = filteredProfiles.slice(0, MAX_PROFILES);
    setSelectedProfileIds(new Set(toSelect.map(p => p.id)));
  };

  const handleClearSelection = () => {
    setSelectedProfileIds(new Set());
  };

  const fetchPostsForProfiles = async (profilesToFetch: FKProfile[]) => {
    setLoadingPosts(true);
    const newPosts = new Map<string, FKPost[]>();

    for (const profile of profilesToFetch) {
      try {
        const { data, error } = await supabase.functions.invoke("fanpage-karma", {
          body: {
            action: "posts",
            profileId: profile.profile_id,
            network: profile.network,
          },
        });

        if (error) throw error;
        
        // Fanpage Karma returns { success, data: { posts: [...] } }
        const postsData = data?.data?.posts || data?.posts || [];
        if (data.success && postsData.length > 0) {
          // Normalize posts structure from Fanpage Karma response
          const normalizedPosts: FKPost[] = postsData.map((post: any) => ({
            id: post.id,
            url: post.link || post.url,
            title: post.title,
            message: post.message || post.text || post.caption || post.description || "",
            content_type: post.type || "post",
            image_url: post.image,
            published_at: post.date,
            likes: post.kpi?.page_posts_likes_count?.value || post.likes || 0,
            comments: post.kpi?.page_posts_comments_count?.value || post.comments || 0,
            shares: post.kpi?.page_posts_shares_count?.value || post.shares || 0,
            engagement: post.kpi?.page_total_engagement_count?.value || post.engagement || 0,
          }));
          newPosts.set(profile.id, normalizedPosts);
        }
      } catch (err) {
        console.error(`Error fetching posts for ${profile.profile_id}:`, err);
      }
    }

    setProfilePosts(newPosts);
    setLoadingPosts(false);
    return newPosts;
  };

  const analyzeNarratives = async () => {
    if (selectedProfiles.length === 0) {
      toast.error("Selecciona al menos un perfil para analizar");
      return;
    }

    setIsAnalyzing(true);
    setComparativeResult(null);

    try {
      // Fetch posts for selected profiles
      const posts = await fetchPostsForProfiles(selectedProfiles);

      // Build profiles array for API
      const profilesData = selectedProfiles.map(profile => {
        const profilePostsData = posts.get(profile.id) || [];
        return {
          profileName: profile.display_name || profile.profile_id,
          network: profile.network,
          posts: profilePostsData.map(post => ({
            message: post.message || post.title || "",
            contentType: post.content_type || "post",
            engagement: (post.likes || 0) + (post.comments || 0) + (post.shares || 0),
            date: post.published_at
          })).filter(p => p.message.trim().length > 0)
        };
      }).filter(p => p.posts.length > 0);

      if (profilesData.length === 0) {
        toast.error("No hay posts con contenido para analizar");
        setIsAnalyzing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("analyze-narratives", {
        body: {
          profiles: profilesData,
          dateRange: dateRange ? {
            from: dateRange.from.toISOString(),
            to: dateRange.to.toISOString()
          } : null
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Error al analizar narrativas");

      if (data.comparative) {
        setComparativeResult(data.comparative);
        setActiveProfileTab(data.comparative.profiles[0]?.profileId || "");
      } else if (data.analysis) {
        // Single profile fallback
        const singleResult: ComparativeResult = {
          profiles: [{
            profileId: selectedProfiles[0].profile_id,
            profileName: selectedProfiles[0].display_name || selectedProfiles[0].profile_id,
            network: selectedProfiles[0].network,
            analysis: data.analysis
          }]
        };
        setComparativeResult(singleResult);
        setActiveProfileTab(singleResult.profiles[0].profileId);
      }

      toast.success(`Análisis completado para ${profilesData.length} perfil(es)`);
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

      {/* Profile Selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Seleccionar Perfiles (máx. {MAX_PROFILES})
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleSelectAll} disabled={selectedProfileIds.size >= MAX_PROFILES}>
                Seleccionar {Math.min(MAX_PROFILES, filteredProfiles.length)}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearSelection} disabled={selectedProfileIds.size === 0}>
                Limpiar
              </Button>
            </div>
          </div>
          <CardDescription>
            Selecciona hasta {MAX_PROFILES} perfiles de cualquier red para análisis comparativo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar perfil... (ej: dep, cultura, deporte)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {filteredProfiles.length} resultado{filteredProfiles.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <ScrollArea className="h-48">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProfiles.map((profile) => {
                const isSelected = selectedProfileIds.has(profile.id);
                const isDisabled = !isSelected && selectedProfileIds.size >= MAX_PROFILES;
                
                return (
                  <label
                    key={profile.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : isDisabled 
                          ? "opacity-50 cursor-not-allowed border-muted" 
                          : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleProfile(profile.id)}
                      disabled={isDisabled}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {getNetworkLabel(profile.network as FKNetwork)}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm truncate mt-1">
                        @{profile.profile_id}
                      </p>
                      {profile.display_name && profile.display_name !== profile.profile_id && (
                        <p className="text-xs text-muted-foreground truncate">
                          {profile.display_name}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
          
          {/* Selection Summary & Analyze Button */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t">
            <div className="flex flex-wrap gap-2">
              {selectedProfiles.map(p => (
                <Badge key={p.id} variant="secondary" className="text-xs">
                  @{p.profile_id} ({getNetworkLabel(p.network as FKNetwork)})
                </Badge>
              ))}
              {selectedProfiles.length === 0 && (
                <span className="text-sm text-muted-foreground">Ningún perfil seleccionado</span>
              )}
            </div>
            
            <Button 
              onClick={analyzeNarratives}
              disabled={isAnalyzing || loadingPosts || selectedProfiles.length === 0}
            >
              {isAnalyzing || loadingPosts ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {loadingPosts ? "Cargando posts..." : "Analizando..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analizar {selectedProfiles.length > 1 ? `${selectedProfiles.length} Perfiles` : "Narrativas"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {isAnalyzing && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      )}

      {comparativeResult && !isAnalyzing && (
        <div className="space-y-6">
          {/* Comparison Card (if multiple profiles) */}
          {comparativeResult.comparison && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCompare className="h-5 w-5 text-primary" />
                  Análisis Comparativo
                </CardTitle>
                <CardDescription>
                  Comparación entre {comparativeResult.profiles.length} perfiles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Overall Insight */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                  <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm">{comparativeResult.comparison.overallInsight}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Common Themes */}
                  <div>
                    <p className="text-sm font-medium mb-2">Temas en Común</p>
                    <div className="flex flex-wrap gap-1">
                      {comparativeResult.comparison.commonThemes.map((theme, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {theme}
                        </Badge>
                      ))}
                      {comparativeResult.comparison.commonThemes.length === 0 && (
                        <span className="text-xs text-muted-foreground">Sin temas comunes identificados</span>
                      )}
                    </div>
                  </div>

                  {/* Differentiators */}
                  <div>
                    <p className="text-sm font-medium mb-2">Diferenciadores</p>
                    <div className="space-y-1">
                      {comparativeResult.comparison.differentiators.map((diff, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-medium">@{diff.profileName}:</span>{" "}
                          <span className="text-muted-foreground">{diff.uniqueAspect}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Leaders */}
                {(comparativeResult.comparison.leaderInEngagement || comparativeResult.comparison.mostFormalTone) && (
                  <div className="flex flex-wrap gap-4 text-xs pt-2 border-t">
                    {comparativeResult.comparison.leaderInEngagement && (
                      <div>
                        <span className="text-muted-foreground">Mejor engagement:</span>{" "}
                        <span className="font-medium">@{comparativeResult.comparison.leaderInEngagement}</span>
                      </div>
                    )}
                    {comparativeResult.comparison.mostFormalTone && (
                      <div>
                        <span className="text-muted-foreground">Más institucional:</span>{" "}
                        <span className="font-medium">@{comparativeResult.comparison.mostFormalTone}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Individual Profile Analyses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Análisis Individual por Perfil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab}>
                <TabsList className="flex-wrap h-auto gap-1 mb-4">
                  {comparativeResult.profiles.map(p => (
                    <TabsTrigger key={p.profileId} value={p.profileId} className="text-xs">
                      @{p.profileName}
                      <Badge variant="outline" className="ml-1 text-[9px]">
                        {getNetworkLabel(p.network as FKNetwork)}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {comparativeResult.profiles.map(profileData => (
                  <TabsContent key={profileData.profileId} value={profileData.profileId}>
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm">{profileData.analysis.summary}</p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Narratives */}
                        <div className="space-y-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <MessageSquareText className="h-4 w-4" />
                            Narrativas Dominantes
                          </h4>
                          <ScrollArea className="h-52">
                            <div className="space-y-3 pr-3">
                              {profileData.analysis.dominantNarratives.map((narrative, i) => (
                                <div key={i} className="border rounded-lg p-3">
                                  <div className="flex items-start justify-between mb-1">
                                    <h5 className="font-medium text-sm">{narrative.theme}</h5>
                                    <div className="flex items-center gap-1">
                                      {getSentimentIcon(narrative.sentiment)}
                                      <Badge variant="outline" className="text-xs">
                                        {narrative.frequency}%
                                      </Badge>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{narrative.description}</p>
                                  {narrative.examplePosts.length > 0 && (
                                    <div className="mt-2 pt-2 border-t">
                                      {narrative.examplePosts.slice(0, 1).map((ex, j) => (
                                        <div key={j} className="flex items-start gap-1 text-xs text-muted-foreground">
                                          <Quote className="h-3 w-3 mt-0.5 shrink-0" />
                                          <span className="line-clamp-2">{ex}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>

                        {/* Strategy */}
                        <div className="space-y-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Estrategia de Contenido
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-medium mb-1">Enfoque Principal</p>
                              <p className="text-sm text-muted-foreground">
                                {profileData.analysis.contentStrategy.primaryFocus}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1">Fortalezas</p>
                              <div className="flex flex-wrap gap-1">
                                {profileData.analysis.contentStrategy.strengths.map((s, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1">Oportunidades</p>
                              <div className="flex flex-wrap gap-1">
                                {profileData.analysis.contentStrategy.opportunities.map((o, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {o}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Tone & Hashtags */}
                          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                            <div>
                              <p className="text-xs text-muted-foreground">Tono</p>
                              <p className="text-sm font-medium capitalize">
                                {profileData.analysis.toneAnalysis.overall} • {profileData.analysis.toneAnalysis.emotionalTone}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">CTA</p>
                              <Badge variant={profileData.analysis.toneAnalysis.callToAction ? "default" : "secondary"} className="text-xs">
                                {profileData.analysis.toneAnalysis.callToAction ? "Frecuente" : "Poco frecuente"}
                              </Badge>
                            </div>
                          </div>

                          {profileData.analysis.topHashtags.length > 0 && (
                            <div className="pt-3 border-t">
                              <p className="text-xs font-medium mb-2 flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                Top Hashtags
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {profileData.analysis.topHashtags.slice(0, 6).map((tag, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    #{tag.tag} ({tag.count})
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {!comparativeResult && !isAnalyzing && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Análisis de Narrativas Comparativo</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-4">
              Selecciona hasta {MAX_PROFILES} perfiles de cualquier red social para comparar sus narrativas, 
              tono y estrategia de contenido.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
