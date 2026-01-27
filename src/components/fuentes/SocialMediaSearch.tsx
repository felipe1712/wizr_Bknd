import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useSocialScrapeJobs } from "@/hooks/useSocialScrapeJobs";
import { apifyApi } from "@/lib/api/apify";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
  HelpCircle,
  ChevronDown,
  Info,
  CalendarIcon,
  Filter,
} from "lucide-react";
import { format, subDays, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
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

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const RedditIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
  </svg>
);

type Platform = "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube" | "reddit";

interface SocialSearchResult {
  id: string;
  platform: Platform;
  title: string;
  description: string;
  author: {
    name: string;
    username: string;
    url: string;
    avatarUrl?: string;
    verified?: boolean;
    followers?: number;
  };
  metrics: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
    engagement?: number;
  };
  publishedAt: string;
  url: string;
  contentType: "post" | "video" | "image" | "article" | "thread";
  media?: {
    type: "image" | "video" | "carousel";
    url?: string;
    thumbnailUrl?: string;
  };
  hashtags?: string[];
  mentions?: string[];
  raw?: Record<string, unknown>;
}

interface AggregateMetrics {
  totals: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  averageEngagement: number;
  resultCount: number;
  verifiedAuthors: number;
  contentTypes: Record<string, number>;
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
  searchTypes: { value: string; label: string; tooltip: string }[];
  helpText: string;
  disabled?: boolean;
}> = {
  twitter: {
    label: "X (Twitter)",
    icon: TwitterIcon,
    color: "bg-black text-white",
    placeholder: "Ej: Actinver, @actinver, #finanzas",
    searchTypes: [
      { value: "query", label: "Búsqueda general", tooltip: "Busca tweets que contengan palabras clave, usuarios o hashtags. Puedes combinar múltiples términos separados por comas." },
      { value: "username", label: "Por usuario (@)", tooltip: "Busca los tweets de un usuario específico. Ingresa solo el nombre de usuario sin @." },
      { value: "hashtag", label: "Por hashtag (#)", tooltip: "Busca tweets con un hashtag específico. Ingresa sin el símbolo #." },
    ],
    helpText: "Puedes combinar términos, usuarios (@) y hashtags (#) en una sola búsqueda separándolos por comas. Ejemplo: 'Actinver, @actinver, @actinver_trade'",
  },
  facebook: {
    label: "Facebook",
    icon: FacebookIcon,
    color: "bg-blue-600 text-white",
    placeholder: "Ej: Actinver, BBVA México, noticias financieras",
    searchTypes: [
      { value: "query", label: "Búsqueda general", tooltip: "Busca menciones públicas de terceros que contengan los términos especificados. Ideal para encontrar qué dicen otros sobre tu marca." },
      { value: "username", label: "Por página", tooltip: "Extrae contenido directamente de una página de Facebook específica. Requiere el nombre exacto de la página." },
    ],
    helpText: "✅ Ahora soporta búsqueda de menciones de terceros. Usa 'Búsqueda general' para encontrar publicaciones públicas que mencionen tu marca.",
  },
  tiktok: {
    label: "TikTok",
    icon: TikTokIcon,
    color: "bg-black text-white",
    placeholder: "Ej: usuario, #tendencia o término",
    searchTypes: [
      { value: "query", label: "Búsqueda general", tooltip: "Busca videos que contengan palabras clave. Los resultados se filtran para mostrar solo coincidencias exactas." },
      { value: "username", label: "Por usuario", tooltip: "Busca los videos de un creador específico de TikTok." },
      { value: "hashtag", label: "Por hashtag (#)", tooltip: "Busca videos etiquetados con un hashtag específico." },
    ],
    helpText: "⚡ Los resultados se filtran automáticamente para mostrar solo contenido que mencione exactamente tu término de búsqueda, reduciendo falsos positivos.",
  },
  instagram: {
    label: "Instagram",
    icon: InstagramIcon,
    color: "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white",
    placeholder: "Ej: nombredeusuario o #hashtag",
    searchTypes: [
      { value: "username", label: "Por usuario", tooltip: "Busca las publicaciones de un perfil específico de Instagram." },
      { value: "hashtag", label: "Por hashtag (#)", tooltip: "Busca publicaciones etiquetadas con un hashtag específico." },
    ],
    helpText: "Instagram solo permite buscar por usuario específico o por hashtag. No admite búsquedas generales de texto.",
  },
  linkedin: {
    label: "LinkedIn",
    icon: LinkedInIcon,
    color: "bg-blue-700 text-white",
    placeholder: "Ej: Actinver, finanzas, inversiones",
    searchTypes: [
      { value: "query", label: "Búsqueda general", tooltip: "Busca publicaciones públicas que contengan los términos especificados. No requiere cookies ni login." },
    ],
    helpText: "✅ LinkedIn ahora está habilitado. Busca publicaciones públicas por palabras clave.",
  },
  youtube: {
    label: "YouTube",
    icon: YouTubeIcon,
    color: "bg-red-600 text-white",
    placeholder: "Ej: término o URL de canal",
    searchTypes: [
      { value: "query", label: "Búsqueda general", tooltip: "Busca videos que contengan las palabras clave en título o descripción." },
      { value: "channelUrl", label: "Por canal (URL)", tooltip: "Requiere la URL completa del canal. Ejemplo: https://www.youtube.com/@ChannelName" },
    ],
    helpText: "Busca videos por términos generales o extrae contenido de un canal específico usando su URL.",
  },
  reddit: {
    label: "Reddit",
    icon: RedditIcon,
    color: "bg-orange-600 text-white",
    placeholder: "Ej: término o r/subreddit",
    searchTypes: [
      { value: "query", label: "Búsqueda general", tooltip: "Busca posts y comentarios en todo Reddit que contengan los términos especificados." },
      { value: "subreddit", label: "Por subreddit", tooltip: "Busca posts y comentarios dentro de un subreddit específico. Ingresa sin el prefijo r/." },
    ],
    helpText: "💬 Las búsquedas ahora incluyen los 10 comentarios principales de cada publicación para un análisis más completo.",
  },
};

export const SocialMediaSearch = ({ projectId, onResultsSaved }: SocialMediaSearchProps) => {
  const { toast } = useToast();
  const { createJob, updateJob, saveResults, refetchJobs } = useSocialScrapeJobs(projectId);
  const [platform, setPlatform] = useState<Platform>("twitter");
  const [searchType, setSearchType] = useState("query");
  const [searchValue, setSearchValue] = useState("");
  const [maxResults, setMaxResults] = useState(25);
  const [isSearching, setIsSearching] = useState(false);
  const [jobStatus, setJobStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [results, setResults] = useState<SocialSearchResult[]>([]);
  
  // Date filter state
  const [dateFilterEnabled, setDateFilterEnabled] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 7));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  
  // Progress tracking for real-time feedback
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [rawResultsCount, setRawResultsCount] = useState<number>(0);
  const [filteredResultsCount, setFilteredResultsCount] = useState<number>(0);

  const config = PLATFORM_CONFIG[platform];
  const PlatformIcon = config.icon;

  // Filter results by date range (client-side post-processing)
  const filteredResults = useMemo(() => {
    if (!dateFilterEnabled || !dateFrom || !dateTo) {
      return results;
    }
    
    const fromStart = startOfDay(dateFrom);
    const toEnd = endOfDay(dateTo);
    
    return results.filter((r) => {
      const pubDate = new Date(r.publishedAt);
      if (isNaN(pubDate.getTime())) return true; // Keep items without valid date
      return !isBefore(pubDate, fromStart) && !isAfter(pubDate, toEnd);
    });
  }, [results, dateFilterEnabled, dateFrom, dateTo]);

  // Results are now normalized by the backend - sort chronologically
  const processBackendResults = (items: SocialSearchResult[]): SocialSearchResult[] => {
    return (items || [])
      .map((item, idx) => ({
        ...item,
        id: item.id || `${platform}-${idx}-${Date.now()}`,
      }))
      // Sort by publishedAt descending (newest first) - backend should do this too, but ensure consistency
      .sort((a, b) => {
        const dateA = new Date(a.publishedAt).getTime();
        const dateB = new Date(b.publishedAt).getTime();
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
      });
  };

  const checkJobStatus = useCallback(async (jobRunId: string, filterKw?: string) => {
    try {
      // Pass filterKeyword to backend for TikTok exact-match filtering
      const result = await apifyApi.checkStatus(jobRunId, platform, filterKw);

      if (!result.success || !result.data) {
        throw new Error(result.error || "Error al verificar estado");
      }

      const data = result.data;

      if (data.status === "SUCCEEDED") {
        setJobStatus("completed");
        setProgress(100);
        setProgressMessage("¡Completado!");
        // Results are now pre-normalized by the backend
        const processed = processBackendResults((data.items || []) as SocialSearchResult[]);
        
        // Capture filter stats from backend response if available
        if (data.rawCount !== undefined) {
          setRawResultsCount(data.rawCount);
          setFilteredResultsCount(processed.length);
        }
        setResults(processed);
        
        // Auto-save job and results to database
        if (currentJobId && processed.length > 0) {
          try {
            // Update job status
            await updateJob({
              id: currentJobId,
              updates: {
                status: "completed",
                completed_at: new Date().toISOString(),
                results_count: processed.length,
              },
            });
            
            // Save results
            await saveResults({
              jobId: currentJobId,
              results: processed.map((r) => ({
                platform: r.platform,
                external_id: r.id,
                title: r.title || "",
                description: r.description || "",
                author_name: r.author?.name || "",
                author_username: r.author?.username || "",
                author_url: r.author?.url || "",
                author_avatar_url: r.author?.avatarUrl,
                author_verified: r.author?.verified,
                author_followers: r.author?.followers,
                likes: r.metrics?.likes || 0,
                comments: r.metrics?.comments || 0,
                shares: r.metrics?.shares || 0,
                views: r.metrics?.views,
                engagement: r.metrics?.engagement,
                published_at: r.publishedAt,
                url: r.url || "",
                content_type: r.contentType || "post",
                hashtags: r.hashtags,
                mentions: r.mentions,
                raw_data: JSON.parse(JSON.stringify(r.raw || {})),
              })),
            });
            
            refetchJobs();
          } catch (saveError) {
            console.error("Error saving to database:", saveError);
          }
        }
        
        toast({
          title: "Búsqueda completada",
          description: `Se encontraron ${processed.length} resultados en ${config.label}`,
        });
      } else if (data.status === "FAILED" || data.status === "ABORTED" || data.status === "TIMED-OUT") {
        setJobStatus("failed");
        
        // Update job status in database
        if (currentJobId) {
          try {
            await updateJob({
              id: currentJobId,
              updates: {
                status: "failed",
                completed_at: new Date().toISOString(),
                error_message: `Job ${data.status}`,
              },
            });
            refetchJobs();
          } catch (updateError) {
            console.error("Error updating job status:", updateError);
          }
        }
        
        toast({
          title: "Error en la búsqueda",
          description: "El scraping falló o fue cancelado",
          variant: "destructive",
        });
      } else {
        // Still running - update progress with real-time feedback
        const stats = data.stats || {};
        const pagesLoaded = stats.pagesLoaded || 0;
        const itemsFound = stats.itemsFound || stats.requestsFinished || 0;
        const estimatedProgress = Math.min(90, Math.max(pagesLoaded * 10, itemsFound * 2));
        setProgress(estimatedProgress);
        
        // Show meaningful progress message
        if (itemsFound > 0) {
          setProgressMessage(`Extrayendo datos... ${itemsFound} items encontrados`);
        } else if (pagesLoaded > 0) {
          setProgressMessage(`Procesando... ${pagesLoaded} páginas cargadas`);
        } else {
          setProgressMessage("Iniciando extracción...");
        }
        
        // Faster polling: 2 seconds instead of 3 for more responsive UX
        setTimeout(() => checkJobStatus(jobRunId, filterKw), 2000);
      }
    } catch (error) {
      console.error("Error checking job status:", error);
      setJobStatus("failed");
    }
  }, [platform, config.label, toast, currentJobId, updateJob, saveResults, refetchJobs]);

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
    setProgressMessage("Conectando con " + config.label + "...");
    setResults([]);
    setCurrentJobId(null);
    setRawResultsCount(0);
    setFilteredResultsCount(0);

    try {
      // Create job in database first
      const job = await createJob({
        project_id: projectId,
        platform,
        search_type: searchType,
        search_value: searchValue,
        max_results: maxResults,
      });
      
      setCurrentJobId(job.id);

      const result = await apifyApi.startScrape({
        platform,
        query: searchType === "query" ? searchValue : undefined,
        username: searchType === "username" ? searchValue.replace("@", "") : undefined,
        hashtag: searchType === "hashtag" ? searchValue.replace("#", "") : undefined,
        companyUrl: searchType === "companyUrl" ? searchValue : undefined,
        channelUrl: searchType === "channelUrl" ? searchValue : undefined,
        subreddit: searchType === "subreddit" ? searchValue.replace("r/", "") : undefined,
        maxResults,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Error al iniciar la búsqueda");
      }

      const data = result.data;

      if (data.success && data.runId) {
        setRunId(data.runId);
        setProgress(10);
        
        // Update job with runId and datasetId
        await updateJob({
          id: job.id,
          updates: {
            run_id: data.runId,
            dataset_id: data.datasetId,
            status: "running",
          },
        });
        
        // Start polling for status - pass searchValue as filter keyword for ALL platforms
        // Most Apify actors return noisy results that need post-filtering by keyword
        setTimeout(() => checkJobStatus(data.runId!, searchValue), 3000);
      } else {
        throw new Error(data.error || "Error al iniciar la búsqueda");
      }
    } catch (error) {
      console.error("Search error:", error);
      setJobStatus("failed");
      setIsSearching(false);
      
      // Update job status if it was created
      if (currentJobId) {
        try {
          await updateJob({
            id: currentJobId,
            updates: {
              status: "failed",
              error_message: error instanceof Error ? error.message : "Unknown error",
              completed_at: new Date().toISOString(),
            },
          });
        } catch (updateError) {
          console.error("Error updating job:", updateError);
        }
      }
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al realizar la búsqueda",
        variant: "destructive",
      });
    }
  };

  const handleSaveResults = async () => {
    if (filteredResults.length === 0) return;

    try {
      // Convert normalized results to mentions format (use filtered results)
      const mentions = filteredResults.map((result) => ({
        project_id: projectId,
        url: result.url || `https://${platform}.com`,
        title: result.title || result.description?.substring(0, 200) || "Sin título",
        description: result.description,
        source_domain: platform,
        published_at: result.publishedAt,
        matched_keywords: [searchValue],
        raw_metadata: JSON.parse(JSON.stringify({
          platform,
          author: result.author?.name || null,
          authorUrl: result.author?.url || null,
          authorUsername: result.author?.username || null,
          authorVerified: result.author?.verified || false,
          authorFollowers: result.author?.followers || null,
          likes: result.metrics?.likes ?? null,
          comments: result.metrics?.comments ?? null,
          shares: result.metrics?.shares ?? null,
          views: result.metrics?.views ?? null,
          engagement: result.metrics?.engagement ?? null,
          contentType: result.contentType,
          hashtags: result.hashtags || [],
          mentions: result.mentions || [],
        })),
      }));

      const { error } = await supabase.from("mentions").insert(mentions);

      if (error) throw error;

      toast({
        title: "Guardado exitoso",
        description: `${filteredResults.length} menciones guardadas de ${config.label}`,
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
    <TooltipProvider>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Redes Sociales
        </CardTitle>
        <CardDescription>
          Busca publicaciones y menciones en Twitter/X, Facebook, TikTok, Instagram, LinkedIn, YouTube y Reddit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Help Section */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                ¿Cómo usar esta herramienta?
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="font-medium mb-1">Tipos de búsqueda</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li><strong>Búsqueda general:</strong> Permite múltiples términos separados por comas (ej: "Actinver, @actinver, @actinver_trade")</li>
                    <li><strong>Por usuario/página:</strong> Busca contenido de un perfil específico</li>
                    <li><strong>Por hashtag:</strong> Busca por etiqueta o tendencia</li>
                    <li><strong>Por empresa/canal (URL):</strong> Requiere la URL completa del perfil</li>
                  </ul>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="font-medium mb-1">Por plataforma</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li><strong>X/Twitter, Facebook, TikTok:</strong> Admiten búsqueda general con múltiples términos</li>
                    <li><strong>Instagram:</strong> Solo permite buscar por usuario o hashtag específico</li>
                    <li><strong>LinkedIn:</strong> Para empresas, usa la URL completa (ej: linkedin.com/company/nombre/)</li>
                    <li><strong>YouTube:</strong> Busca videos o extrae de un canal por URL</li>
                    <li><strong>Reddit:</strong> Busca en todo Reddit o dentro de un subreddit</li>
                  </ul>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        {/* Platform Selection */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((plat) => {
            const cfg = PLATFORM_CONFIG[plat];
            const Icon = cfg.icon;
            const isDisabled = cfg.disabled;
            return (
              <Tooltip key={plat}>
                <TooltipTrigger asChild>
                  <Button
                    variant={platform === plat ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setPlatform(plat);
                      setSearchType(cfg.searchTypes[0].value);
                      resetSearch();
                    }}
                    className={`flex flex-col h-auto py-2 gap-1 relative ${platform === plat ? cfg.color : ""} ${isDisabled ? "opacity-60" : ""}`}
                  >
                    <Icon />
                    <span className="text-xs">{cfg.label.split(" ")[0]}</span>
                    {isDisabled && (
                      <span className="absolute -top-1 -right-1 text-[10px] bg-destructive text-destructive-foreground rounded-full px-1">⚠️</span>
                    )}
                  </Button>
                </TooltipTrigger>
                {isDisabled && (
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p>Temporalmente deshabilitado por restricciones de API</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

        {/* Search Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label>Tipo de búsqueda</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[250px]">
                  <p>{config.searchTypes.find(t => t.value === searchType)?.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </div>
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
            <div className="flex items-center gap-1">
              <Label>Búsqueda / URL de empresa o término</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px]">
                  <p>{config.helpText}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              placeholder={config.placeholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isSearching && handleSearch()}
              className="bg-background"
            />
          </div>
        </div>

        {/* Date Filter Section */}
        <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2">
            <Button
              variant={dateFilterEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setDateFilterEnabled(!dateFilterEnabled)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtrar por fecha
            </Button>
          </div>
          
          {dateFilterEnabled && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[130px] justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "d MMM yyyy", { locale: es }) : "Inicio"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover border shadow-lg z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-[130px] justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "d MMM yyyy", { locale: es }) : "Fin"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover border shadow-lg z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {results.length > 0 && filteredResults.length !== results.length && (
                <Badge variant="secondary" className="text-xs">
                  Mostrando {filteredResults.length} de {results.length}
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleSearch} 
            disabled={isSearching || jobStatus === "running" || config.disabled}
            className={config.color}
          >
            {config.disabled ? (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Plataforma no disponible
              </>
            ) : isSearching || jobStatus === "running" ? (
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

          {filteredResults.length > 0 && (
            <Button variant="secondary" onClick={handleSaveResults}>
              Guardar ({filteredResults.length})
            </Button>
          )}

          {(jobStatus === "completed" || jobStatus === "failed") && (
            <Button variant="outline" onClick={resetSearch}>
              Nueva búsqueda
            </Button>
          )}
        </div>

        {/* Progress Indicator - More informative with real-time feedback */}
        {jobStatus === "running" && (
          <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground flex items-center gap-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {progressMessage || `Extrayendo datos de ${config.label}...`}
              </span>
              <Badge variant="outline" className="tabular-nums">{progress}%</Badge>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Polling cada 2 segundos para resultados en tiempo real</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs text-destructive hover:text-destructive"
                onClick={() => {
                  setJobStatus("failed");
                  setIsSearching(false);
                  toast({
                    title: "Búsqueda cancelada",
                    description: "Puedes iniciar una nueva búsqueda",
                  });
                }}
              >
                Cancelar
              </Button>
            </div>
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

        {/* Completed Status with Filter Stats */}
        {jobStatus === "completed" && results.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                ¡Búsqueda completada!
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                {rawResultsCount > 0 && rawResultsCount !== results.length 
                  ? `${results.length} resultados relevantes de ${rawResultsCount} extraídos (filtrado por keywords)`
                  : `${results.length} resultados obtenidos de ${config.label}`
                }
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {filteredResults.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                {dateFilterEnabled && filteredResults.length !== results.length 
                  ? `Mostrando ${filteredResults.length} de ${results.length} resultados (filtrado por fecha)`
                  : `${filteredResults.length} resultados de ${config.label}`
                }
                <span className="text-xs">• Ordenados por fecha (más recientes primero)</span>
              </p>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {filteredResults.map((result) => (
                  <Card key={result.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`rounded-full p-2 ${config.color}`}>
                          <PlatformIcon />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Author */}
                          {result.author?.name && (
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {result.author.url ? (
                                <a 
                                  href={result.author.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium hover:text-primary flex items-center gap-1"
                                >
                                  @{result.author.username || result.author.name}
                                  {result.author.verified && (
                                    <CheckCircle2 className="h-3 w-3 text-blue-500" />
                                  )}
                                </a>
                              ) : (
                                <span className="text-sm font-medium flex items-center gap-1">
                                  @{result.author.username || result.author.name}
                                  {result.author.verified && (
                                    <CheckCircle2 className="h-3 w-3 text-blue-500" />
                                  )}
                                </span>
                              )}
                              {result.author.followers ? (
                                <span className="text-xs text-muted-foreground">
                                  ({result.author.followers.toLocaleString()} seguidores)
                                </span>
                              ) : null}
                            </div>
                          )}

                          {/* Title/Description */}
                          <p className="text-sm line-clamp-3">
                            {result.title || result.description || "Sin contenido"}
                          </p>

                          {/* Content type badge */}
                          {result.contentType && result.contentType !== "post" && (
                            <Badge variant="outline" className="text-xs">
                              {result.contentType === "video" ? "📹 Video" : 
                               result.contentType === "image" ? "📷 Imagen" : 
                               result.contentType === "article" ? "📰 Artículo" : 
                               result.contentType === "thread" ? "🧵 Hilo" : result.contentType}
                            </Badge>
                          )}

                          {/* Metrics */}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {result.metrics?.likes !== undefined && (
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                {result.metrics.likes.toLocaleString()}
                              </span>
                            )}
                            {result.metrics?.comments !== undefined && (
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-3 w-3" />
                                {result.metrics.comments.toLocaleString()}
                              </span>
                            )}
                            {result.metrics?.shares !== undefined && result.metrics.shares > 0 && (
                              <span className="flex items-center gap-1">
                                <Share2 className="h-3 w-3" />
                                {result.metrics.shares.toLocaleString()}
                              </span>
                            )}
                            {result.metrics?.views !== undefined && result.metrics.views > 0 && (
                              <span className="flex items-center gap-1">
                                👁 {result.metrics.views.toLocaleString()}
                              </span>
                            )}
                            {result.metrics?.engagement !== undefined && result.metrics.engagement > 0 && (
                              <span className="flex items-center gap-1 text-green-600">
                                📊 {result.metrics.engagement}% eng.
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
    </TooltipProvider>
  );
};

export default SocialMediaSearch;
