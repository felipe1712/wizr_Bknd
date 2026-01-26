import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Hash, 
  User, 
  Building2,
  MessageCircle,
  Heart,
  Share2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Platform icons using simple components
const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

type Platform = "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin";

interface SocialSearchResult {
  id: string;
  platform: Platform;
  text?: string;
  author?: string;
  authorUrl?: string;
  url?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  publishedAt?: string;
  raw?: Record<string, unknown>;
}

interface SocialMediaSearchProps {
  projectId: string;
  onResultsSaved?: () => void;
}

const PLATFORM_CONFIG: Record<Platform, { 
  label: string; 
  icon: React.ComponentType; 
  color: string;
  placeholder: string;
  searchTypes: { value: string; label: string }[];
}> = {
  twitter: {
    label: "X (Twitter)",
    icon: TwitterIcon,
    color: "bg-black text-white",
    placeholder: "Término de búsqueda o @usuario",
    searchTypes: [
      { value: "query", label: "Búsqueda general" },
      { value: "username", label: "Por usuario (@)" },
      { value: "hashtag", label: "Por hashtag (#)" },
    ],
  },
  facebook: {
    label: "Facebook",
    icon: FacebookIcon,
    color: "bg-blue-600 text-white",
    placeholder: "Nombre de página o término",
    searchTypes: [
      { value: "query", label: "Búsqueda general" },
      { value: "username", label: "Por página" },
    ],
  },
  tiktok: {
    label: "TikTok",
    icon: TikTokIcon,
    color: "bg-black text-white",
    placeholder: "Usuario, hashtag o término",
    searchTypes: [
      { value: "query", label: "Búsqueda general" },
      { value: "username", label: "Por usuario" },
      { value: "hashtag", label: "Por hashtag (#)" },
    ],
  },
  instagram: {
    label: "Instagram",
    icon: InstagramIcon,
    color: "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white",
    placeholder: "Usuario o hashtag",
    searchTypes: [
      { value: "username", label: "Por usuario" },
      { value: "hashtag", label: "Por hashtag (#)" },
    ],
  },
  linkedin: {
    label: "LinkedIn",
    icon: LinkedInIcon,
    color: "bg-blue-700 text-white",
    placeholder: "URL de empresa o término",
    searchTypes: [
      { value: "query", label: "Búsqueda general" },
      { value: "companyUrl", label: "Por empresa (URL)" },
    ],
  },
};

export const SocialMediaSearch = ({ projectId, onResultsSaved }: SocialMediaSearchProps) => {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<Platform>("twitter");
  const [searchType, setSearchType] = useState("query");
  const [searchValue, setSearchValue] = useState("");
  const [maxResults, setMaxResults] = useState(25);
  const [isSearching, setIsSearching] = useState(false);
  const [jobStatus, setJobStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [results, setResults] = useState<SocialSearchResult[]>([]);

  const config = PLATFORM_CONFIG[platform];
  const PlatformIcon = config.icon;

  const normalizeResults = (rawItems: unknown[], plat: Platform): SocialSearchResult[] => {
    return (rawItems || []).map((item: unknown, idx: number) => {
      const data = item as Record<string, unknown>;
      let result: SocialSearchResult = {
        id: `${plat}-${idx}-${Date.now()}`,
        platform: plat,
        raw: data,
      };

      switch (plat) {
        case "twitter": {
          const user = data.user as Record<string, unknown> | undefined;
          const author = data.author as Record<string, unknown> | undefined;
          const screenName = user?.screen_name as string || author?.userName as string || "";
          result = {
            ...result,
            text: (data.full_text || data.text || "") as string,
            author: screenName,
            authorUrl: screenName ? `https://x.com/${screenName}` : undefined,
            url: data.url as string || (data.id ? `https://x.com/i/status/${data.id}` : undefined),
            likes: (data.favorite_count || data.likeCount || 0) as number,
            comments: (data.reply_count || data.replyCount || 0) as number,
            shares: (data.retweet_count || data.retweetCount || 0) as number,
            publishedAt: (data.created_at || data.createdAt) as string,
          };
          break;
        }
        case "facebook": {
          const fbUser = data.user as Record<string, unknown> | undefined;
          result = {
            ...result,
            text: (data.text || data.message || "") as string,
            author: (data.pageName || fbUser?.name || "") as string,
            url: data.url as string,
            likes: (data.likes || data.likesCount || 0) as number,
            comments: (data.comments || data.commentsCount || 0) as number,
            shares: (data.shares || data.sharesCount || 0) as number,
            publishedAt: (data.time || data.publishedAt) as string,
          };
          break;
        }
        case "tiktok": {
          const authorMeta = data.authorMeta as Record<string, unknown> | undefined;
          const tikTokName = authorMeta?.name as string || data.author as string || "";
          result = {
            ...result,
            text: (data.text || data.desc || "") as string,
            author: tikTokName,
            authorUrl: tikTokName ? `https://tiktok.com/@${tikTokName}` : undefined,
            url: data.webVideoUrl as string || data.url as string,
            likes: (data.diggCount || data.likes || 0) as number,
            comments: (data.commentCount || data.comments || 0) as number,
            shares: (data.shareCount || data.shares || 0) as number,
            publishedAt: data.createTime ? new Date((data.createTime as number) * 1000).toISOString() : undefined,
          };
          break;
        }
        case "instagram":
          result = {
            ...result,
            text: (data.caption || "") as string,
            author: (data.ownerUsername || "") as string,
            authorUrl: data.ownerUsername ? `https://instagram.com/${data.ownerUsername}` : undefined,
            url: data.url as string,
            likes: (data.likesCount || 0) as number,
            comments: (data.commentsCount || 0) as number,
            publishedAt: data.timestamp as string,
          };
          break;
        case "linkedin": {
          const linkedAuthor = data.author as Record<string, unknown> | undefined;
          result = {
            ...result,
            text: (data.text || data.commentary || "") as string,
            author: (linkedAuthor?.name || data.companyName || "") as string,
            url: data.url as string,
            likes: (data.numLikes || 0) as number,
            comments: (data.numComments || 0) as number,
            shares: (data.numShares || 0) as number,
            publishedAt: data.postedAt as string,
          };
          break;
        }
      }

      return result;
    });
  };

  const checkJobStatus = useCallback(async (jobRunId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("apify-status", {
        body: { runId: jobRunId },
      });

      if (error) throw error;

      if (data.status === "SUCCEEDED") {
        setJobStatus("completed");
        setProgress(100);
        const normalized = normalizeResults(data.items || [], platform);
        setResults(normalized);
        toast({
          title: "Búsqueda completada",
          description: `Se encontraron ${normalized.length} resultados en ${config.label}`,
        });
      } else if (data.status === "FAILED" || data.status === "ABORTED" || data.status === "TIMED-OUT") {
        setJobStatus("failed");
        toast({
          title: "Error en la búsqueda",
          description: "El scraping falló o fue cancelado",
          variant: "destructive",
        });
      } else {
        // Still running - update progress and check again
        const stats = data.stats || {};
        const pagesLoaded = stats.pagesLoaded || 0;
        const estimatedProgress = Math.min(90, pagesLoaded * 10);
        setProgress(estimatedProgress);
        
        // Poll again in 3 seconds
        setTimeout(() => checkJobStatus(jobRunId), 3000);
      }
    } catch (error) {
      console.error("Error checking job status:", error);
      setJobStatus("failed");
    }
  }, [platform, config.label, toast]);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      toast({
        title: "Campo vacío",
        description: "Ingresa un término de búsqueda",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setJobStatus("running");
    setProgress(5);
    setResults([]);

    try {
      const body: Record<string, unknown> = {
        platform,
        maxResults,
      };

      // Set the appropriate field based on search type
      if (searchType === "query") {
        body.query = searchValue;
      } else if (searchType === "username") {
        body.username = searchValue.replace("@", "");
      } else if (searchType === "hashtag") {
        body.hashtag = searchValue.replace("#", "");
      } else if (searchType === "companyUrl") {
        body.companyUrl = searchValue;
      }

      const { data, error } = await supabase.functions.invoke("apify-scrape", {
        body,
      });

      if (error) throw error;

      if (data.success && data.runId) {
        setRunId(data.runId);
        setProgress(10);
        // Start polling for status
        setTimeout(() => checkJobStatus(data.runId), 3000);
      } else {
        throw new Error(data.error || "Error al iniciar la búsqueda");
      }
    } catch (error) {
      console.error("Search error:", error);
      setJobStatus("failed");
      setIsSearching(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al realizar la búsqueda",
        variant: "destructive",
      });
    }
  };

  const handleSaveResults = async () => {
    if (results.length === 0) return;

    try {
      // Convert results to mentions format
      const mentions = results.map((result) => ({
        project_id: projectId,
        url: result.url || `https://${platform}.com`,
        title: result.text?.substring(0, 200) || "Sin título",
        description: result.text,
        source_domain: platform,
        published_at: result.publishedAt,
        matched_keywords: [searchValue],
        raw_metadata: JSON.parse(JSON.stringify({
          platform,
          author: result.author || null,
          authorUrl: result.authorUrl || null,
          likes: result.likes ?? null,
          comments: result.comments ?? null,
          shares: result.shares ?? null,
        })),
      }));

      const { error } = await supabase.from("mentions").insert(mentions);

      if (error) throw error;

      toast({
        title: "Guardado exitoso",
        description: `${results.length} menciones guardadas de ${config.label}`,
      });

      onResultsSaved?.();
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error al guardar",
        description: "No se pudieron guardar las menciones",
        variant: "destructive",
      });
    }
  };

  const resetSearch = () => {
    setJobStatus("idle");
    setProgress(0);
    setResults([]);
    setRunId(null);
    setIsSearching(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Redes Sociales
        </CardTitle>
        <CardDescription>
          Busca publicaciones y menciones en Twitter/X, Facebook, TikTok, Instagram y LinkedIn
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform Selection */}
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((plat) => {
            const cfg = PLATFORM_CONFIG[plat];
            const Icon = cfg.icon;
            return (
              <Button
                key={plat}
                variant={platform === plat ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setPlatform(plat);
                  setSearchType(cfg.searchTypes[0].value);
                  resetSearch();
                }}
                className={`flex flex-col h-auto py-2 gap-1 ${platform === plat ? cfg.color : ""}`}
              >
                <Icon />
                <span className="text-xs">{cfg.label.split(" ")[0]}</span>
              </Button>
            );
          })}
        </div>

        {/* Search Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tipo de búsqueda</Label>
            <Select value={searchType} onValueChange={setSearchType}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {config.searchTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Resultados máximos</Label>
            <Select value={maxResults.toString()} onValueChange={(v) => setMaxResults(parseInt(v))}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="10">10 resultados</SelectItem>
                <SelectItem value="25">25 resultados</SelectItem>
                <SelectItem value="50">50 resultados</SelectItem>
                <SelectItem value="100">100 resultados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Búsqueda</Label>
            <Input
              placeholder={config.placeholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isSearching && handleSearch()}
              className="bg-background"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleSearch} 
            disabled={isSearching || jobStatus === "running"}
            className={config.color}
          >
            {isSearching || jobStatus === "running" ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Buscar en {config.label}
              </>
            )}
          </Button>

          {results.length > 0 && (
            <Button variant="secondary" onClick={handleSaveResults}>
              Guardar ({results.length})
            </Button>
          )}

          {(jobStatus === "completed" || jobStatus === "failed") && (
            <Button variant="outline" onClick={resetSearch}>
              Nueva búsqueda
            </Button>
          )}
        </div>

        {/* Progress Indicator */}
        {jobStatus === "running" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Extrayendo datos de {config.label}...
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Este proceso puede tomar de 30 segundos a varios minutos dependiendo del volumen
            </p>
          </div>
        )}

        {/* Status Messages */}
        {jobStatus === "completed" && results.length === 0 && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
            <XCircle className="h-5 w-5" />
            <span>No se encontraron resultados para esta búsqueda</span>
          </div>
        )}

        {jobStatus === "failed" && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
            <XCircle className="h-5 w-5" />
            <span>Error en la búsqueda. Intenta de nuevo o cambia los parámetros.</span>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {results.length} resultados de {config.label}
              </p>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {results.map((result) => (
                  <Card key={result.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`rounded-full p-2 ${config.color}`}>
                          <PlatformIcon />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Author */}
                          {result.author && (
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {result.authorUrl ? (
                                <a 
                                  href={result.authorUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium hover:text-primary"
                                >
                                  @{result.author}
                                </a>
                              ) : (
                                <span className="text-sm font-medium">@{result.author}</span>
                              )}
                            </div>
                          )}

                          {/* Text */}
                          <p className="text-sm line-clamp-3">
                            {result.text || "Sin contenido"}
                          </p>

                          {/* Metrics */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {result.likes !== undefined && (
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                {result.likes.toLocaleString()}
                              </span>
                            )}
                            {result.comments !== undefined && (
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" />
                                {result.comments.toLocaleString()}
                              </span>
                            )}
                            {result.shares !== undefined && (
                              <span className="flex items-center gap-1">
                                <Share2 className="h-3 w-3" />
                                {result.shares.toLocaleString()}
                              </span>
                            )}
                            {result.publishedAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(result.publishedAt), "d MMM yyyy", { locale: es })}
                              </span>
                            )}
                            {result.url && (
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Ver original
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SocialMediaSearch;
