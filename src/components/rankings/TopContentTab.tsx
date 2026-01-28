import { useState, useEffect, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
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
  Search
} from "lucide-react";
import { FKProfile, useFetchProfilePosts, FKPost, FKNetwork } from "@/hooks/useFanpageKarma";
import { supabase } from "@/integrations/supabase/client";
import { format, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { NetworkFilter } from "./NetworkFilter";
import { ProfileSelectGrouped } from "./ProfileSelectGrouped";

interface TopContentTabProps {
  profiles: FKProfile[];
  isLoading: boolean;
  dateRange?: { from: Date; to: Date };
}

type SortBy = "engagement" | "likes" | "comments" | "shares" | "date";

// Extended post type that includes the profile_id for multi-profile view
interface FKPostWithProfile extends FKPost {
  profile_id?: string;
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

function PostCard({ post, profileName, rank }: { post: FKPost; profileName: string; rank: number }) {
  const totalEngagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0);
  
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

export function TopContentTab({ profiles, isLoading: profilesLoading, dateRange }: TopContentTabProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>("__all__");
  const [filterNetwork, setFilterNetwork] = useState<FKNetwork | "all">("all");
  const [sortBy, setSortBy] = useState<SortBy>("engagement");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter profiles by network
  const filteredProfiles = filterNetwork === "all" 
    ? profiles 
    : profiles.filter(p => p.network === filterNetwork);

  const isAllProfiles = selectedProfileId === "__all__";
  const selectedProfile = isAllProfiles 
    ? undefined 
    : (filteredProfiles.find(p => p.id === selectedProfileId) || filteredProfiles[0]);

  // Reset selection when filter changes and current selection is filtered out
  useEffect(() => {
    if (selectedProfileId !== "__all__" && selectedProfileId && !filteredProfiles.find(p => p.id === selectedProfileId)) {
      setSelectedProfileId("__all__");
    }
  }, [filterNetwork, filteredProfiles, selectedProfileId]);
  
  // Fetch posts for single profile (when not "all")
  const { 
    data: singleProfilePosts = [], 
    isLoading: singlePostsLoading, 
    refetch: refetchSingle,
    isFetching: isFetchingSingle 
  } = useFetchProfilePosts(selectedProfile);

  // Fetch posts for ALL profiles when "all" is selected
  const allProfileQueries = useFetchMultipleProfilePosts(
    isAllProfiles ? filteredProfiles : []
  );

  const allProfilesPosts: FKPostWithProfile[] = useMemo(() => {
    if (!isAllProfiles) return [];
    return allProfileQueries.flatMap(q => q.posts);
  }, [isAllProfiles, allProfileQueries]);

  const allProfilesLoading = isAllProfiles && allProfileQueries.some(q => q.isLoading);
  const allProfilesFetching = isAllProfiles && allProfileQueries.some(q => q.isFetching);

  // Select the appropriate posts based on mode
  const posts: FKPostWithProfile[] = isAllProfiles 
    ? allProfilesPosts 
    : singleProfilePosts.map(p => ({ ...p, profile_id: selectedProfile?.profile_id }));
  const postsLoading = isAllProfiles ? allProfilesLoading : singlePostsLoading;
  const isFetching = isAllProfiles ? allProfilesFetching : isFetchingSingle;

  const refetch = () => {
    if (isAllProfiles) {
      allProfileQueries.forEach(q => q.refetch());
    } else {
      refetchSingle();
    }
  };

  // Filter posts by date range and search query
  const filteredPosts = useMemo(() => {
    let result = posts;
    
    // Filter by date range
    if (dateRange) {
      result = result.filter(post => {
        if (!post.published_at) return true;
        const postDate = new Date(post.published_at);
        return isWithinInterval(postDate, { start: dateRange.from, end: dateRange.to });
      });
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(post => {
        const text = [post.message, post.title].filter(Boolean).join(" ").toLowerCase();
        return text.includes(query);
      });
    }
    
    return result;
  }, [posts, dateRange, searchQuery]);

  // Sort posts
  const sortedPosts = useMemo(() => {
    return [...filteredPosts].sort((a, b) => {
      switch (sortBy) {
        case "engagement":
          const engA = (a.likes || 0) + (a.comments || 0) + (a.shares || 0);
          const engB = (b.likes || 0) + (b.comments || 0) + (b.shares || 0);
          return engB - engA;
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
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Keyword Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={isAllProfiles 
            ? "Buscar por palabras clave en todos los perfiles..." 
            : "Buscar por palabras clave en el contenido..."
          }
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
                  ? `Comparando ${filteredProfiles.length} perfiles - ` 
                  : ""
                }
                Los posts con mejor engagement ordenados por {
                  sortBy === "engagement" ? "total de interacciones" :
                  sortBy === "likes" ? "likes" :
                  sortBy === "comments" ? "comentarios" :
                  sortBy === "shares" ? "compartidos" : "fecha"
                }
              </CardDescription>
            </div>
            {sortedPosts.length > 0 && (
              <Badge variant="secondary">
                {sortedPosts.length} posts
              </Badge>
            )}
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
              <p>
                {searchQuery 
                  ? `No se encontraron posts con "${searchQuery}".`
                  : isAllProfiles 
                    ? "No hay posts disponibles. Haz clic en 'Actualizar' para cargar."
                    : "No hay posts disponibles para este perfil."
                }
              </p>
              {!searchQuery && (
                <p className="text-sm mt-1">
                  Haz clic en "Actualizar" para obtener los posts más recientes.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPosts.map((post, index) => (
                <PostCard 
                  key={post.id || `${post.profile_id}-${index}`} 
                  post={post} 
                  profileName={post.profile_id || selectedProfile?.profile_id || ""} 
                  rank={index + 1}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Hook to fetch posts from multiple profiles using useQueries (proper React Query pattern)
function useFetchMultipleProfilePosts(profiles: FKProfile[]) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 28);
  const period = `${startDate.toISOString().split("T")[0]}_${endDate.toISOString().split("T")[0]}`;

  const queries = useQueries({
    queries: profiles.map(profile => ({
      queryKey: ["fk-posts-multi", profile.id],
      queryFn: async (): Promise<FKPostWithProfile[]> => {
        const { data, error } = await supabase.functions.invoke("fanpage-karma", {
          body: {
            action: "posts",
            network: profile.network,
            profileId: profile.profile_id,
            period,
          },
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error || "Error al obtener posts");

        const rawData = data.data || {};
        const postsData = Array.isArray(rawData) ? rawData : (rawData.posts || []);
        
        return postsData.slice(0, 100).map((post: Record<string, unknown>, index: number) => {
          const kpi = (post.kpi as Record<string, { title?: string; value?: number; formatted_value?: string }>) || {};
          
          const extractKpiValue = (key: string): number => {
            const metric = kpi[key];
            if (metric && typeof metric === 'object' && 'value' in metric) {
              return Number(metric.value) || 0;
            }
            return 0;
          };
          
          const likes = extractKpiValue('page_posts_likes_count') || 
                        extractKpiValue('profile_post_likes_count') ||
                        extractKpiValue('page_posts_reactions') ||
                        Number(post.likes) || 0;
                        
          const comments = extractKpiValue('page_posts_comments_count') || 
                           extractKpiValue('profile_post_comments_count') ||
                           Number(post.comments) || 0;
                           
          const shares = extractKpiValue('page_posts_shares_count') || 
                         extractKpiValue('profile_post_shares_count') ||
                         Number(post.shares) || 0;
                         
          const totalEngagement = extractKpiValue('page_total_engagement_count') ||
                                  extractKpiValue('profile_total_engagement_count') ||
                                  (likes + comments + shares);
          
          return {
            id: (post.id as string) || `${profile.id}-${index}`,
            url: (post.link as string) || (post.url as string) || undefined,
            title: (post.title as string) || undefined,
            message: (post.message as string) || (post.description as string) || undefined,
            content_type: (post.type as string) || (post.content_type as string) || 'post',
            image_url: (post.image as string) || (post.picture as string) || undefined,
            published_at: (post.date as string) || (post.created_time as string) || undefined,
            likes,
            comments,
            shares,
            engagement: totalEngagement,
            profile_id: profile.profile_id,
          };
        });
      },
      enabled: profiles.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  });

  // Transform useQueries result to match expected format
  return queries.map((query, idx) => ({
    ...query,
    posts: query.data || [],
    refetch: query.refetch,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  }));
}
