import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { apifyApi } from "@/lib/api/apify";
import { firecrawlApi, type EntityForSearch } from "@/lib/api/firecrawl";
import { cn } from "@/lib/utils";
import { deduplicateBatch, type DuplicateCandidate } from "@/lib/utils/semanticDedup";
import {
  Search,
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  User,
  Building2,
  Briefcase,
  Tag,
  Calendar,
  Newspaper,
  Globe,
  AlertCircle,
  Save,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Entity } from "@/hooks/useEntities";

// Platform icons
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

type SocialPlatform = "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube" | "reddit";

interface PlatformConfig {
  id: SocialPlatform | "news";
  label: string;
  icon: React.ReactNode;
  description: string;
  enabled: boolean;
}

interface SearchJob {
  id: string;
  platform: string;
  entity: string;
  status: "pending" | "running" | "completed" | "failed";
  resultCount: number;
  error?: string;
}

interface UnifiedSearchProps {
  projectId: string;
  entities: Entity[];
  onSearchComplete: (totalResults: number, savedCount: number) => void;
}

const PLATFORMS: PlatformConfig[] = [
  { id: "news", label: "Noticias", icon: <Newspaper className="h-4 w-4" />, description: "Google News y medios", enabled: true },
  { id: "twitter", label: "Twitter/X", icon: <TwitterIcon />, description: "Posts y menciones", enabled: true },
  { id: "facebook", label: "Facebook", icon: <FacebookIcon />, description: "Posts públicos", enabled: true },
  { id: "youtube", label: "YouTube", icon: <YouTubeIcon />, description: "Videos y shorts", enabled: true },
  { id: "instagram", label: "Instagram", icon: <InstagramIcon />, description: "Posts y reels", enabled: true },
  { id: "tiktok", label: "TikTok", icon: <TikTokIcon />, description: "Videos virales", enabled: true },
  { id: "linkedin", label: "LinkedIn", icon: <LinkedInIcon />, description: "Contenido profesional", enabled: true },
  { id: "reddit", label: "Reddit", icon: <RedditIcon />, description: "Discusiones", enabled: true },
];

const TIME_RANGES = [
  { value: "day", label: "Últimas 24 horas" },
  { value: "week", label: "Última semana" },
  { value: "month", label: "Último mes" },
];

const getEntityIcon = (tipo: string) => {
  switch (tipo) {
    case "persona": return User;
    case "marca": return Briefcase;
    case "institucion": return Building2;
    case "tema": return Tag;
    case "evento": return Calendar;
    default: return Building2;
  }
};

export function UnifiedSearch({ projectId, entities, onSearchComplete }: UnifiedSearchProps) {
  const { toast } = useToast();
  
  // Selection state
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set(entities.map(e => e.id)));
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set(["news", "twitter", "facebook"]));
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month">("week");
  const [maxResultsPerPlatform, setMaxResultsPerPlatform] = useState(25);
  
  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [existingMentions, setExistingMentions] = useState<DuplicateCandidate[]>([]);
  const [duplicatesSkipped, setDuplicatesSkipped] = useState(0);

  // Load existing mentions for semantic deduplication
  useEffect(() => {
    const loadExistingMentions = async () => {
      const { data } = await api.get("/mentions", { 
        params: { 
          projectId, 
          limit: 500 
        } 
      });
      
      if (data) {
        setExistingMentions(data);
      }
    };
    loadExistingMentions();
  }, [projectId]);
  
  // Calculate progress
  const progress = useMemo(() => {
    if (jobs.length === 0) return 0;
    const completed = jobs.filter(j => j.status === "completed" || j.status === "failed").length;
    return Math.round((completed / jobs.length) * 100);
  }, [jobs]);
  
  const totalResults = useMemo(() => 
    jobs.reduce((sum, j) => sum + j.resultCount, 0), 
  [jobs]);

  // Toggle entity selection
  const toggleEntity = (id: string) => {
    const newSet = new Set(selectedEntities);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedEntities(newSet);
  };

  // Toggle platform selection
  const togglePlatform = (id: string) => {
    const newSet = new Set(selectedPlatforms);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPlatforms(newSet);
  };

  // Select all entities
  const selectAllEntities = () => {
    if (selectedEntities.size === entities.length) {
      setSelectedEntities(new Set());
    } else {
      setSelectedEntities(new Set(entities.map(e => e.id)));
    }
  };

  // Select all platforms
  const selectAllPlatforms = () => {
    if (selectedPlatforms.size === PLATFORMS.length) {
      setSelectedPlatforms(new Set());
    } else {
      setSelectedPlatforms(new Set(PLATFORMS.map(p => p.id)));
    }
  };

  // Build search query from entity keywords
  const buildSearchQuery = (entity: Entity): string => {
    // Prioritize keywords, fallback to name + aliases
    if (entity.palabras_clave && entity.palabras_clave.length > 0) {
      return entity.palabras_clave.join(", ");
    }
    const terms = [entity.nombre, ...entity.aliases].filter(Boolean);
    return terms.join(", ");
  };

  // Run unified search
  const runUnifiedSearch = useCallback(async () => {
    if (selectedEntities.size === 0) {
      toast({
        title: "Sin entidades seleccionadas",
        description: "Selecciona al menos una entidad para buscar",
        variant: "destructive",
      });
      return;
    }

    if (selectedPlatforms.size === 0) {
      toast({
        title: "Sin plataformas seleccionadas",
        description: "Selecciona al menos una plataforma",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setShowDetails(true);
    
    // Create job list
    const selectedEntityList = entities.filter(e => selectedEntities.has(e.id));
    const jobList: SearchJob[] = [];
    
    for (const entity of selectedEntityList) {
      for (const platformId of selectedPlatforms) {
        jobList.push({
          id: `${entity.id}-${platformId}`,
          platform: platformId,
          entity: entity.nombre,
          status: "pending",
          resultCount: 0,
        });
      }
    }
    
    setJobs(jobList);

    let totalSaved = 0;
    let totalDuplicatesSkipped = 0;
    const allExistingMentions = [...existingMentions];

    // Execute searches in parallel (batched)
    const updateJob = (jobId: string, updates: Partial<SearchJob>) => {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j));
    };

    // Process each entity-platform combination
    const promises = jobList.map(async (job) => {
      const entity = entities.find(e => e.nombre === job.entity);
      if (!entity) return;

      updateJob(job.id, { status: "running" });

      try {
        let results: Array<{ url: string; title?: string; description?: string; source_domain?: string; published_at?: string }> = [];

        if (job.platform === "news") {
          // Use Firecrawl for news
          const entityForSearch: EntityForSearch = {
            id: entity.id,
            nombre: entity.nombre,
            palabras_clave: entity.palabras_clave,
            aliases: entity.aliases,
          };
          
          const response = await firecrawlApi.searchMultipleEntities([entityForSearch], timeRange, maxResultsPerPlatform);
          
          if (response.success && response.data) {
            results = response.data.map(r => ({
              url: r.url,
              title: r.title,
              description: r.description,
              source_domain: r.url ? new URL(r.url).hostname.replace("www.", "") : undefined,
              published_at: r.metadata?.publishedDate,
            }));
          }
        } else {
          // Use Apify for social platforms
          const searchQuery = buildSearchQuery(entity);
          
          const scrapeResult = await apifyApi.startScrape({
            platform: job.platform as "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube" | "reddit",
            query: searchQuery,
            maxResults: maxResultsPerPlatform,
          });

          if (!scrapeResult.success) throw new Error(scrapeResult.error || "Search failed to start");

          if (scrapeResult.data?.runId) {
            // Poll for completion
            let attempts = 0;
            const maxAttempts = 60; // 2 minutes max
            
            while (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              const statusData = await apifyApi.checkStatus(
                scrapeResult.data.runId, 
                job.platform as "twitter" | "facebook" | "tiktok" | "instagram" | "linkedin" | "youtube" | "reddit"
              );

              if (!statusData.success) throw new Error(statusData.error || "Failed to get status");
              
              const data = statusData.data;

              if (data?.status === "SUCCEEDED" || data?.status === "completed") {
                results = (data.items || []).map((r: Record<string, unknown>) => ({
                  url: (r as { url?: string }).url || "",
                  title: (r as { title?: string }).title,
                  description: (r as { description?: string; text?: string }).description || (r as { text?: string }).text,
                  source_domain: job.platform,
                  published_at: (r as { publishedAt?: string; timestamp?: string }).publishedAt || (r as { timestamp?: string }).timestamp,
                }));
                break;
              }

              if (data?.status === "FAILED" || data?.status === "failed") {
                throw new Error(data?.error || "Search failed");
              }

              attempts++;
            }

            if (attempts >= maxAttempts) {
              throw new Error("Search timeout");
            }
          }
        }

        // Save results to mentions table with semantic deduplication
        if (results.length > 0) {
          const mentionsToCheck = results.map(r => ({
            project_id: projectId,
            url: r.url,
            title: r.title || null,
            description: r.description || null,
            source_domain: r.source_domain || null,
            entity_id: entity.id,
            matched_keywords: entity.palabras_clave || [],
            published_at: r.published_at || null,
          }));

          // Apply semantic deduplication
          const { unique, duplicates } = deduplicateBatch(
            mentionsToCheck,
            allExistingMentions,
            0.7 // 70% similarity threshold
          );

          totalDuplicatesSkipped += duplicates.length;

          if (unique.length > 0) {
            const { data: savedData } = await api.post('/mentions/bulk', { mentions: unique });

            if (savedData) {
              totalSaved += unique.length;
              // Add newly saved mentions to existing list for cross-job deduplication
              if (savedData.mentions) {
                allExistingMentions.push(...savedData.mentions);
              }
            }
          }
        }

        updateJob(job.id, { status: "completed", resultCount: results.length });
      } catch (error) {
        console.error(`Error in job ${job.id}:`, error);
        updateJob(job.id, { 
          status: "failed", 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    });

    // Wait for all jobs
    await Promise.allSettled(promises);

    setIsRunning(false);
    setDuplicatesSkipped(totalDuplicatesSkipped);

    // Calculate final stats
    const finalJobs = jobList;
    const totalFound = finalJobs.reduce((sum, j) => sum + j.resultCount, 0);
    const successCount = finalJobs.filter(j => j.status === "completed").length;
    const failedCount = finalJobs.filter(j => j.status === "failed").length;

    toast({
      title: "Búsqueda completada",
      description: `${totalFound} menciones encontradas, ${totalSaved} guardadas${totalDuplicatesSkipped > 0 ? `, ${totalDuplicatesSkipped} duplicados omitidos` : ""}. ${successCount} búsquedas exitosas${failedCount > 0 ? `, ${failedCount} fallidas` : ""}.`,
    });

    onSearchComplete(totalFound, totalSaved);
  }, [entities, selectedEntities, selectedPlatforms, timeRange, maxResultsPerPlatform, projectId, toast, onSearchComplete, existingMentions]);

  if (entities.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Sin entidades configuradas</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            Para usar la búsqueda unificada, primero define las entidades (personas, marcas, instituciones) 
            que deseas monitorear en tu proyecto.
          </p>
          <Button variant="outline" onClick={() => window.location.href = "/dashboard/configuracion"}>
            <Tag className="mr-2 h-4 w-4" />
            Configurar Entidades
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Card */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Búsqueda Unificada</CardTitle>
                <CardDescription>
                  Dispara búsquedas en múltiples redes con un solo clic usando las palabras clave de tus entidades
                </CardDescription>
              </div>
            </div>
            {isRunning && (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Buscando...
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Entities Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Entidades a monitorear</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={selectAllEntities}
                className="h-7 text-xs"
              >
                {selectedEntities.size === entities.length ? "Deseleccionar todo" : "Seleccionar todo"}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {entities.map((entity) => {
                const Icon = getEntityIcon(entity.tipo);
                const isSelected = selectedEntities.has(entity.id);
                return (
                  <button
                    key={entity.id}
                    onClick={() => toggleEntity(entity.id)}
                    disabled={isRunning}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50",
                      isRunning && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{entity.nombre}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {entity.palabras_clave.length} keywords
                      </p>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Platforms Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Plataformas</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={selectAllPlatforms}
                className="h-7 text-xs"
              >
                {selectedPlatforms.size === PLATFORMS.length ? "Deseleccionar todo" : "Seleccionar todo"}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PLATFORMS.map((platform) => {
                const isSelected = selectedPlatforms.has(platform.id);
                return (
                  <button
                    key={platform.id}
                    onClick={() => togglePlatform(platform.id)}
                    disabled={isRunning}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50",
                      isRunning && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn("shrink-0", isSelected ? "text-primary" : "text-muted-foreground")}>
                      {platform.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{platform.label}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Options Row */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Período:</Label>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)} disabled={isRunning}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Label className="text-sm">Max resultados:</Label>
              <Select 
                value={maxResultsPerPlatform.toString()} 
                onValueChange={(v) => setMaxResultsPerPlatform(Number(v))}
                disabled={isRunning}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1" />

            <Button 
              onClick={runUnifiedSearch} 
              disabled={isRunning || selectedEntities.size === 0 || selectedPlatforms.size === 0}
              className="gap-2"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando... ({progress}%)
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Iniciar Búsqueda ({selectedEntities.size} entidades × {selectedPlatforms.size} plataformas)
                </>
              )}
            </Button>
          </div>

          {/* Progress */}
          {isRunning && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {jobs.filter(j => j.status === "completed").length} de {jobs.length} búsquedas completadas • 
                {totalResults} menciones encontradas
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Details */}
      {jobs.length > 0 && (
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Detalle de búsquedas
                    <Badge variant="outline">
                      {jobs.filter(j => j.status === "completed").length}/{jobs.length}
                    </Badge>
                  </CardTitle>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showDetails && "rotate-180")} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {jobs.map((job) => (
                      <div 
                        key={job.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          job.status === "completed" && "bg-green-50 border-green-200",
                          job.status === "failed" && "bg-red-50 border-red-200",
                          job.status === "running" && "bg-blue-50 border-blue-200",
                          job.status === "pending" && "bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {/* Status icon */}
                          {job.status === "pending" && <Clock className="h-4 w-4 text-muted-foreground" />}
                          {job.status === "running" && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                          {job.status === "completed" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {job.status === "failed" && <XCircle className="h-4 w-4 text-red-600" />}
                          
                          {/* Platform icon */}
                          <div className="text-muted-foreground">
                            {PLATFORMS.find(p => p.id === job.platform)?.icon}
                          </div>
                          
                          <div>
                            <p className="font-medium text-sm">{job.entity}</p>
                            <p className="text-xs text-muted-foreground">
                              {PLATFORMS.find(p => p.id === job.platform)?.label}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          {job.status === "completed" && (
                            <Badge variant="secondary">{job.resultCount} resultados</Badge>
                          )}
                          {job.status === "failed" && (
                            <span className="text-xs text-red-600">{job.error || "Error"}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
