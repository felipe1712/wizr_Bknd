import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  ExternalLink, 
  Heart, 
  MessageCircle, 
  Share2, 
  RefreshCw,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
  Flame,
  Search,
  Sparkles,
  Database,
} from "lucide-react";
import { FKProfile, FKPost, FKNetwork, FKDailyTopPost } from "@/hooks/useFanpageKarma";
import { supabase } from "@/integrations/supabase/client";
import { format, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { NetworkFilter } from "./NetworkFilter";
import { ProfileSelectGrouped } from "./ProfileSelectGrouped";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ContentAnalysisDisplay, type ContentAnalysisData } from "./ContentAnalysisDisplay";
import { NetworkBadge } from "./NetworkBadge";

interface TopContentTabProps {
  profiles: FKProfile[];
  isLoading: boolean;
  dateRange?: { from: Date; to: Date };
  /**
   * Contexto del análisis. 'brand' = análisis de UNA marca propia (Performance/Listening),
   * 'benchmark' = análisis de un ECOSISTEMA COMPETITIVO (Benchmarking).
   * Determina cómo el AI redacta narrativas, fortalezas y oportunidades.
   */
  analysisContext?: "brand" | "benchmark";
  /** Nombre de la marca foco cuando analysisContext === 'brand' (ej. "Actinver") */
  brandName?: string;
}

type SortBy = "engagement" | "likes" | "comments" | "shares" | "date";

// Unified post type used for display
interface DisplayPost {
  id: string;
  url?: string;
  title?: string;
  message?: string;
  content_type?: string;
  image_url?: string;
  published_at?: string;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  profile_id?: string;
  display_name?: string;
  network?: string;
}

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const getContentTypeIcon = (type?: string) => {
  switch (type?.toLowerCase()) {
    case "video":
    case "reel":
      return <Video className="h-4 w-4" />;
    case "photo":
    case "image":
      return <ImageIcon className="h-4 w-4" />;
    case "link":
      return <LinkIcon className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

function PostCard({ post, profileName, rank }: { post: DisplayPost; profileName: string; rank: number }) {
  const totalEngagement = post.engagement || ((post.likes || 0) + (post.comments || 0) + (post.shares || 0));
  
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank indicator */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            rank === 1 ? "bg-amber-100 text-amber-700" :
            rank === 2 ? "bg-gray-100 text-gray-700" :
            rank === 3 ? "bg-orange-100 text-orange-700" :
            "bg-muted text-muted-foreground"
          }`}>
            {rank}
          </div>

          {/* Thumbnail if available */}
          {post.image_url && (
            <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted">
              <img 
                src={post.image_url} 
                alt="" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                @{profileName}
              </Badge>
              {post.network && (
                <NetworkBadge network={post.network} size="xs" />
              )}
              {post.content_type && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  {getContentTypeIcon(post.content_type)}
                  {post.content_type}
                </Badge>
              )}
              {post.published_at && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(post.published_at), "dd MMM yyyy", { locale: es })}
                </span>
              )}
            </div>
            
            {/* Content preview */}
            <p className="text-sm line-clamp-2 mb-3">
              {post.message || post.title || "Sin texto"}
            </p>
            
            {/* Metrics */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-rose-600">
                <Heart className="h-4 w-4" />
                <span className="font-medium">{formatNumber(post.likes)}</span>
              </div>
              <div className="flex items-center gap-1 text-blue-600">
                <MessageCircle className="h-4 w-4" />
                <span className="font-medium">{formatNumber(post.comments)}</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-600">
                <Share2 className="h-4 w-4" />
                <span className="font-medium">{formatNumber(post.shares)}</span>
              </div>
              <div className="flex items-center gap-1 text-orange-600 ml-auto">
                <Flame className="h-4 w-4" />
                <span className="font-medium">{formatNumber(totalEngagement)}</span>
              </div>
              {post.url && (
                <a 
                  href={post.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const POSTS_PER_PAGE = 20;

/**
 * Hook that reads ALL posts from fk_posts table (DB) instead of calling the API.
 * Reads from the full historical posts table — not the per-day top, so the user
 * sees every imported post (not just the daily best).
 * Paginates with .range() to get past the default 1000-row Supabase limit.
 */
function useAllPostsFromDB(profileIds: string[], startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["fk-posts-db", profileIds, startDate, endDate],
    queryFn: async () => {
      if (profileIds.length === 0) return [];

      const PAGE = 1000;
      const all: any[] = [];
      let from = 0;
      // Hard upper bound to avoid runaway loops
      while (from < 20000) {
        let query = supabase
          .from("fk_posts")
          .select("id, fk_profile_id, network, external_id, published_at, message, link, post_image_url, post_type, likes, comments, shares, engagement, reach")
          .in("fk_profile_id", profileIds)
          .order("published_at", { ascending: false })
          .range(from, from + PAGE - 1);

        if (startDate) {
          query = query.gte("published_at", `${startDate}T00:00:00`);
        }
        if (endDate) {
          query = query.lte("published_at", `${endDate}T23:59:59`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
    enabled: profileIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function TopContentTab({ profiles, isLoading: profilesLoading, dateRange, analysisContext = "benchmark", brandName }: TopContentTabProps) {
  const { toast } = useToast();
  const [selectedProfileId, setSelectedProfileId] = useState<string>("__all__");
  const [filterNetwork, setFilterNetwork] = useState<FKNetwork | "all">("all");
  const [sortBy, setSortBy] = useState<SortBy>("engagement");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ContentAnalysisData | null>(null);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);

  // Filter profiles by network
  const filteredProfiles = filterNetwork === "all" 
    ? profiles 
    : profiles.filter(p => p.network === filterNetwork);

  const isAllProfiles = selectedProfileId === "__all__";
  const selectedProfile = isAllProfiles 
    ? undefined 
    : (filteredProfiles.find(p => p.id === selectedProfileId) || filteredProfiles[0]);

  // Determine which profile IDs to query
  const queryProfileIds = useMemo(() => {
    if (isAllProfiles) return filteredProfiles.map(p => p.id);
    if (selectedProfile) return [selectedProfile.id];
    return [];
  }, [isAllProfiles, filteredProfiles, selectedProfile]);

  // Date range for query
  const dbStartDate = dateRange ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const dbEndDate = dateRange ? format(dateRange.to, "yyyy-MM-dd") : undefined;

  // Fetch from DB instead of API!
  const { data: dbPosts = [], isLoading: postsLoading, isFetching, refetch } = useAllPostsFromDB(
    queryProfileIds,
    dbStartDate,
    dbEndDate
  );

  // Build a profile lookup map
  const profileMap = useMemo(() => {
    const map = new Map<string, FKProfile>();
    profiles.forEach(p => map.set(p.id, p));
    return map;
  }, [profiles]);

  // Convert DB posts to display format
  const posts: DisplayPost[] = useMemo(() => {
    return dbPosts.map((post: any) => {
      const profile = profileMap.get(post.fk_profile_id);
      return {
        id: post.id,
        url: post.link || undefined,
        message: post.message || undefined,
        content_type: post.post_type || undefined,
        image_url: post.post_image_url || undefined,
        published_at: post.published_at,
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0,
        engagement: post.engagement || ((post.likes || 0) + (post.comments || 0) + (post.shares || 0)),
        profile_id: profile?.profile_id,
        display_name: profile?.display_name || profile?.profile_id,
        network: post.network || profile?.network,
      };
    });
  }, [dbPosts, profileMap]);

  // Reset selection when filter changes
  useEffect(() => {
    if (selectedProfileId !== "__all__" && selectedProfileId && !filteredProfiles.find(p => p.id === selectedProfileId)) {
      setSelectedProfileId("__all__");
    }
  }, [filterNetwork, filteredProfiles, selectedProfileId]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterNetwork, sortBy, dateRange, selectedProfileId]);

  // Filter posts by search query
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const query = searchQuery.toLowerCase().trim();
    return posts.filter(post => {
      const text = [post.message, post.title].filter(Boolean).join(" ").toLowerCase();
      return text.includes(query);
    });
  }, [posts, searchQuery]);

  // Sort posts
  const sortedPosts = useMemo(() => {
    return [...filteredPosts].sort((a, b) => {
      switch (sortBy) {
        case "engagement":
          return (b.engagement || 0) - (a.engagement || 0);
        case "likes":
          return (b.likes || 0) - (a.likes || 0);
        case "comments":
          return (b.comments || 0) - (a.comments || 0);
        case "shares":
          return (b.shares || 0) - (a.shares || 0);
        case "date":
          const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
          const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
          return dateB - dateA;
        default:
          return 0;
      }
    });
  }, [filteredPosts, sortBy]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    return sortedPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);
  }, [sortedPosts, currentPage]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  // Quick analysis function - uses posts already in memory (no API call)
  const handleQuickAnalysis = async () => {
    if (sortedPosts.length === 0) {
      toast({
        title: "Sin posts",
        description: "No hay posts para analizar",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const postsForAnalysis = sortedPosts.slice(0, 50).map(post => ({
        message: post.message || post.title || "",
        contentType: post.content_type || "post",
        engagement: post.engagement,
        date: post.published_at,
      }));

      const { data, error } = await supabase.functions.invoke("analyze-narratives", {
        body: {
          profileName: isAllProfiles ? `${filteredProfiles.length} perfiles` : (selectedProfile?.profile_id || "Perfil"),
          network: isAllProfiles ? "múltiples redes" : (selectedProfile?.network || "social"),
          posts: postsForAnalysis,
          dateRange: dateRange ? {
            from: format(dateRange.from, "yyyy-MM-dd"),
            to: format(dateRange.to, "yyyy-MM-dd"),
          } : null,
          analysisContext,
          brandName,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Error en el análisis");

      const analysis = data.analysis;
      const structuredAnalysis: ContentAnalysisData = {
        summary: analysis.summary || "",
        dominantNarratives: (analysis.dominantNarratives || []).map((n: { theme: string; description: string; frequency: number }) => ({
          theme: n.theme,
          description: n.description,
          frequency: n.frequency,
        })),
        toneAnalysis: {
          overall: analysis.toneAnalysis?.overall || "mixed",
          emotionalTone: analysis.toneAnalysis?.emotionalTone || "",
          callToAction: analysis.toneAnalysis?.callToAction || false,
        },
        contentStrategy: {
          primaryFocus: analysis.contentStrategy?.primaryFocus || "",
          strengths: analysis.contentStrategy?.strengths || [],
          opportunities: analysis.contentStrategy?.opportunities || [],
        },
      };

      setAnalysisResult(structuredAnalysis);
      setShowAnalysisDialog(true);
    } catch (err) {
      console.error("Analysis error:", err);
      toast({
        title: "Error en el análisis",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (profilesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <Card className="py-12">
        <CardContent className="text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sin perfiles</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Agrega perfiles en la pestaña de Configuración para ver su contenido top.
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
            value={selectedProfileId}
            onValueChange={setSelectedProfileId}
            filterNetwork={filterNetwork}
            showAllOption={true}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Ordenar:</span>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="engagement">Total Engagement</option>
            <option value="likes">Likes</option>
            <option value="comments">Comentarios</option>
            <option value="shares">Compartidos</option>
            <option value="date">Más reciente</option>
          </select>
        </div>
        
        <Badge variant="outline" className="flex items-center gap-1 text-xs">
          <Database className="h-3 w-3" />
          Datos locales (sin consumo API)
        </Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por palabras clave en el contenido..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        {searchQuery && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {sortedPosts.length} resultados
          </span>
        )}
      </div>

      {/* Posts list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                {isAllProfiles 
                  ? `Contenido Top de Todos los Perfiles` 
                  : `Contenido Top de @${selectedProfile?.profile_id}`
                }
              </CardTitle>
              <CardDescription>
                {isAllProfiles 
                  ? `${filteredProfiles.length} perfiles — ` 
                  : ""
                }
                Posts con mejor engagement (datos sincronizados)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {sortedPosts.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleQuickAnalysis}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Analizando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analizar
                      </>
                    )}
                  </Button>
                  <Badge variant="secondary">
                    {sortedPosts.length} posts
                  </Badge>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {postsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : sortedPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              {searchQuery ? (
                <p>No se encontraron posts con "{searchQuery}".</p>
              ) : (
                <>
                  <p className="font-medium mb-1">Sin datos de contenido</p>
                  <p className="text-sm">
                    Los posts se capturan automáticamente en la sincronización diaria.
                    Sincroniza los perfiles desde la pestaña de Configuración para poblar estos datos.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pagination info */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-3">
                  <span>
                    Mostrando {((currentPage - 1) * POSTS_PER_PAGE) + 1} - {Math.min(currentPage * POSTS_PER_PAGE, sortedPosts.length)} de {sortedPosts.length} posts
                  </span>
                  <span>
                    Página {currentPage} de {totalPages}
                  </span>
                </div>
              )}

              {/* Posts */}
              {paginatedPosts.map((post, index) => (
                <PostCard 
                  key={post.id || `${post.profile_id}-${index}`} 
                  post={post} 
                  profileName={post.display_name || post.profile_id || selectedProfile?.display_name || selectedProfile?.profile_id || ""} 
                  rank={((currentPage - 1) * POSTS_PER_PAGE) + index + 1}
                />
              ))}

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="pt-4 border-t">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {getPageNumbers().map((page, idx) => (
                        <PaginationItem key={idx}>
                          {page === "ellipsis" ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Result Dialog */}
      <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Análisis de Contenido
            </DialogTitle>
          </DialogHeader>
          {analysisResult && (
            <ContentAnalysisDisplay analysis={analysisResult} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
