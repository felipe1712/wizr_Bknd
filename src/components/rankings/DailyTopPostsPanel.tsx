import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Trophy, 
  Heart, 
  MessageCircle, 
  Share2, 
  Eye, 
  ExternalLink,
  Sparkles,
  Calendar,
  Clock,
  AlertCircle
} from "lucide-react";
import { FKProfile, FKDailyTopPost, getNetworkLabel, FKNetwork } from "@/hooks/useFanpageKarma";
import { 
  SiFacebook, 
  SiInstagram, 
  SiYoutube, 
  SiLinkedin, 
  SiTiktok, 
  SiThreads,
  SiX 
} from "react-icons/si";

interface DailyTopPostsPanelProps {
  profiles: FKProfile[];
  topPosts: FKDailyTopPost[];
  isLoading: boolean;
  onRefresh?: () => void;
}

const networkIcons: Record<string, React.ElementType> = {
  facebook: SiFacebook,
  instagram: SiInstagram,
  youtube: SiYoutube,
  linkedin: SiLinkedin,
  tiktok: SiTiktok,
  threads: SiThreads,
  twitter: SiX,
};

const networkColors: Record<string, string> = {
  facebook: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  youtube: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  linkedin: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  tiktok: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  threads: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  twitter: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-400",
};

// All networks we track
const ALL_NETWORKS: FKNetwork[] = ["facebook", "instagram", "twitter", "tiktok", "youtube", "linkedin", "threads"];

export function DailyTopPostsPanel({ profiles, topPosts, isLoading, onRefresh }: DailyTopPostsPanelProps) {
  // Create a map of profile ID to profile for quick lookup
  const profileMap = useMemo(() => {
    const map = new Map<string, FKProfile>();
    profiles.forEach(p => map.set(p.id, p));
    return map;
  }, [profiles]);

  // Get unique networks that have profiles in this ranking
  const networksInRanking = useMemo(() => {
    const networks = new Set<FKNetwork>();
    profiles.forEach(p => networks.add(p.network as FKNetwork));
    return Array.from(networks);
  }, [profiles]);

  // Fallback: si no hay daily top posts, traemos los mejores 20 desde fk_posts.
  const profileIds = useMemo(() => profiles.map((p) => p.id), [profiles]);
  const needsFallback = !isLoading && topPosts.length === 0 && profileIds.length > 0;

  const { data: fallbackPosts = [] } = useQuery({
    queryKey: ["fk-daily-top-posts-fallback", profileIds],
    enabled: needsFallback,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fk_posts")
        .select("id, fk_profile_id, network, published_at, message, link, post_image_url, engagement, likes, comments, shares, raw_data")
        .in("fk_profile_id", profileIds)
        .order("engagement", { ascending: false, nullsFirst: false })
        .limit(20);
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        fk_profile_id: p.fk_profile_id,
        network: p.network,
        post_date: (p.published_at || "").slice(0, 10),
        post_url: p.link || null,
        post_content: p.message || null,
        post_image_url: p.post_image_url || null,
        engagement: p.engagement || 0,
        likes: p.likes || 0,
        comments: p.comments || 0,
        shares: p.shares || 0,
        views: 0,
        raw_data: p.raw_data || {},
        fetched_at: p.published_at || new Date().toISOString(),
      })) as FKDailyTopPost[];
    },
  });

  const effectiveTopPosts = topPosts.length > 0 ? topPosts : fallbackPosts;
  const usingFallback = topPosts.length === 0 && fallbackPosts.length > 0;

  // Get the top post per network within the already-filtered period
  const topPostsByNetwork = useMemo(() => {
    const result = new Map<FKNetwork, FKDailyTopPost | null>();
    
    // Initialize all networks in ranking as null (no data)
    networksInRanking.forEach(network => {
      result.set(network, null);
    });

    // Group posts by network
    const postsByNetwork = new Map<string, FKDailyTopPost[]>();
    effectiveTopPosts.forEach(post => {
      const existing = postsByNetwork.get(post.network) || [];
      existing.push(post);
      postsByNetwork.set(post.network, existing);
    });

    // For each network, find the highest-engagement post within the selected period
    postsByNetwork.forEach((posts, network) => {
      if (posts.length > 0) {
        const sorted = [...posts].sort((a, b) => {
          const engagementDiff = (b.engagement || 0) - (a.engagement || 0);
          if (engagementDiff !== 0) return engagementDiff;

          return new Date(b.post_date).getTime() - new Date(a.post_date).getTime();
        });
        result.set(network as FKNetwork, sorted[0]);
      }
    });

    return result;
  }, [effectiveTopPosts, networksInRanking]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Top Posts por Red Social
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (networksInRanking.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Top Posts por Red Social
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              Agrega perfiles de redes sociales para ver los top posts.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Top Post por Red Social
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {usingFallback
              ? "Sin snapshot diario para el período: mostramos los 20 posts con mayor engagement importados."
              : "Mejor publicación por red dentro del período seleccionado."}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[600px] pr-2">
          <div className="space-y-3">
            {networksInRanking.map(network => {
              const post = topPostsByNetwork.get(network);
              const NetworkIcon = networkIcons[network] || SiFacebook;
              const profile = post ? profileMap.get(post.fk_profile_id) : null;
              
              return (
                <Card 
                  key={network} 
                  className={`border ${post ? 'bg-muted/30 hover:bg-muted/50' : 'bg-muted/10'} transition-colors`}
                >
                  <CardContent className="p-4">
                    {/* Network Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <Badge 
                        variant="secondary" 
                        className={`${networkColors[network]}`}
                      >
                        <NetworkIcon className="h-3.5 w-3.5 mr-1.5" />
                        {getNetworkLabel(network)}
                      </Badge>
                      {post && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(post.post_date), "d MMM yyyy", { locale: es })}
                          {post.raw_data && typeof post.raw_data === 'object' && 'published_at' in post.raw_data && (
                            <>
                              <Clock className="h-3 w-3 ml-2" />
                              {format(new Date(post.raw_data.published_at as string), "HH:mm", { locale: es })}
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    {post ? (
                      <div className="flex gap-3">
                        {/* Profile Avatar */}
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={profile?.avatar_url || undefined} />
                          <AvatarFallback className={networkColors[network]}>
                            <NetworkIcon className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm truncate">
                              {profile?.display_name || profile?.profile_id || 'Perfil'}
                            </span>
                            {post.post_url && (
                              <a
                                href={post.post_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>

                          {/* Post Content Preview */}
                          {post.post_content && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {post.post_content}
                            </p>
                          )}

                          {/* Metrics */}
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <Trophy className="h-3.5 w-3.5" />
                              <span>{post.engagement?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex items-center gap-1 text-rose-500">
                              <Heart className="h-3.5 w-3.5" />
                              <span>{post.likes?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex items-center gap-1 text-blue-500">
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>{post.comments?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex items-center gap-1 text-green-500">
                              <Share2 className="h-3.5 w-3.5" />
                              <span>{post.shares?.toLocaleString() || 0}</span>
                            </div>
                            {post.views > 0 && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Eye className="h-3.5 w-3.5" />
                                <span>{post.views?.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 py-2 text-muted-foreground">
                        <AlertCircle className="h-5 w-5 opacity-50" />
                        <div>
                          <p className="text-sm">Sin datos de posts para esta red</p>
                          <p className="text-xs opacity-70">
                            El post top se registrará en la próxima sincronización (00:00 UTC)
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
