import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  RefreshCw,
  Loader2
} from "lucide-react";
import { FKProfile, FKDailyTopPost, getNetworkLabel, FKNetwork } from "@/hooks/useFanpageKarma";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

export function DailyTopPostsPanel({ profiles, topPosts, isLoading, onRefresh }: DailyTopPostsPanelProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync top posts manually
  const handleSyncTopPosts = async () => {
    if (profiles.length === 0) {
      toast.error("No hay perfiles para sincronizar");
      return;
    }

    setIsSyncing(true);
    
    try {
      // Call the scheduled-ranking-sync function manually
      const { data, error } = await supabase.functions.invoke("scheduled-ranking-sync", {
        body: {}
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Sincronización completada: ${data.topPostsSaved || 0} posts top capturados`);
        onRefresh?.();
      } else {
        throw new Error(data?.error || "Error en la sincronización");
      }
    } catch (err) {
      console.error("Error syncing top posts:", err);
      toast.error(`Error al sincronizar: ${err instanceof Error ? err.message : "Error desconocido"}`);
    } finally {
      setIsSyncing(false);
    }
  };
  // Group posts by date
  const postsByDate = useMemo(() => {
    const grouped = new Map<string, FKDailyTopPost[]>();
    
    topPosts.forEach(post => {
      const existing = grouped.get(post.post_date) || [];
      existing.push(post);
      grouped.set(post.post_date, existing);
    });
    
    // Sort by date descending
    return Array.from(grouped.entries()).sort((a, b) => 
      new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }, [topPosts]);

  // Create a map of profile ID to profile for quick lookup
  const profileMap = useMemo(() => {
    const map = new Map<string, FKProfile>();
    profiles.forEach(p => map.set(p.id, p));
    return map;
  }, [profiles]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Top Posts Diarios
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

  if (topPosts.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Top Posts Diarios
          </CardTitle>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleSyncTopPosts}
            disabled={isSyncing || profiles.length === 0}
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar ahora
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              No hay posts top registrados aún.
            </p>
            <p className="text-xs mt-1">
              Presiona "Sincronizar ahora" o espera al corte automático (00:00 UTC).
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Top Posts Diarios
        </CardTitle>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleSyncTopPosts}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[500px] pr-2">
          <div className="space-y-6">
            {postsByDate.map(([date, posts]) => (
              <div key={date} className="space-y-3">
                {/* Date Header */}
                <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {format(new Date(date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {posts.length} {posts.length === 1 ? 'post' : 'posts'}
                  </Badge>
                </div>

                {/* Posts for this date */}
                <div className="grid gap-3">
                  {posts.map(post => {
                    const profile = profileMap.get(post.fk_profile_id);
                    const NetworkIcon = networkIcons[post.network] || SiFacebook;
                    
                    return (
                      <Card 
                        key={post.id} 
                        className="border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <CardContent className="p-3">
                          <div className="flex gap-3">
                            {/* Profile Avatar */}
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage src={profile?.avatar_url || undefined} />
                              <AvatarFallback className={networkColors[post.network]}>
                                <NetworkIcon className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>

                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-2">
                              {/* Header */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm truncate">
                                    {profile?.display_name || profile?.profile_id || 'Perfil'}
                                  </span>
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs ${networkColors[post.network]}`}
                                  >
                                    <NetworkIcon className="h-3 w-3 mr-1" />
                                    {getNetworkLabel(post.network as FKNetwork)}
                                  </Badge>
                                </div>
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
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
