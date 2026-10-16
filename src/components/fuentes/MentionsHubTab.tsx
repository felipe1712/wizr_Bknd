import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Search,
  Filter,
  X,
  ExternalLink,
  CalendarIcon,
  TrendingUp,
  PieChart,
  Users,
  BarChart3,
  FileText,
  ArrowRight,
  Globe,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Smile,
  Meh,
  Frown,
  HelpCircle,
  Eye,
  Archive,
  Trash2,
  Loader2,
  Sparkles,
  Download,
  User,
  Newspaper,
  Share2,
  ArrowUpDown,
  AlertCircle,
} from "lucide-react";
import type { Mention, SentimentType } from "@/hooks/useMentions";
import { getMentionAuthorInfo } from "@/lib/mentionAuthors";
import { ExecutiveSummaryCard } from "@/components/fuentes/ExecutiveSummaryCard";
import { useProject } from "@/contexts/ProjectContext";

// Platform icons mapping
const PLATFORM_ICONS: Record<string, React.ElementType> = {
  "twitter.com": Twitter,
  "x.com": Twitter,
  "facebook.com": Facebook,
  "instagram.com": Instagram,
  "youtube.com": Youtube,
  "linkedin.com": Linkedin,
  "tiktok.com": MessageSquare,
  "reddit.com": MessageSquare,
};

const SOCIAL_DOMAINS = ["twitter", "x.com", "facebook", "instagram", "youtube", "linkedin", "tiktok", "threads", "reddit"];

const isSocialDomain = (domain: string | null): boolean => {
  if (!domain) return false;
  const normalized = domain.toLowerCase().replace("www.", "");
  return SOCIAL_DOMAINS.some((sd) => normalized.includes(sd));
};

const getPlatformIcon = (domain: string | null) => {
  if (!domain) return Globe;
  const normalized = domain.toLowerCase().replace("www.", "");
  return PLATFORM_ICONS[normalized] || Globe;
};

const getPlatformLabel = (domain: string | null): string => {
  if (!domain) return "Web";
  const normalized = domain.toLowerCase().replace("www.", "");
  if (normalized.includes("twitter") || normalized.includes("x.com")) return "Twitter/X";
  if (normalized.includes("facebook")) return "Facebook";
  if (normalized.includes("instagram")) return "Instagram";
  if (normalized.includes("youtube")) return "YouTube";
  if (normalized.includes("linkedin")) return "LinkedIn";
  if (normalized.includes("tiktok")) return "TikTok";
  if (normalized.includes("reddit")) return "Reddit";
  return domain;
};

const getAuthorInfo = (mention: Mention) => getMentionAuthorInfo(mention);

// Extract engagement metrics from raw_metadata
const getEngagementMetrics = (mention: Mention) => {
  const meta = mention.raw_metadata as Record<string, unknown> | null;
  if (!meta) return null;
  const likes = typeof meta.likes === "number" ? meta.likes : 0;
  const comments = typeof meta.comments === "number" ? meta.comments : 0;
  const shares = typeof meta.shares === "number" ? meta.shares : 0;
  const views = typeof meta.views === "number" ? meta.views : 0;
  // Check if metadata actually has ANY engagement keys at all
  const hasEngagementKeys = "likes" in meta || "comments" in meta || "shares" in meta || "views" in meta;
  if (!hasEngagementKeys) return null;
  return { likes, comments, shares, views, total: likes + comments + shares + views };
};

const SENTIMENT_CONFIG = {
  positivo: { label: "Positivo", icon: Smile, color: "text-green-600", bg: "bg-green-100" },
  neutral: { label: "Neutral", icon: Meh, color: "text-gray-600", bg: "bg-gray-100" },
  negativo: { label: "Negativo", icon: Frown, color: "text-red-600", bg: "bg-red-100" },
  unknown: { label: "Sin analizar", icon: HelpCircle, color: "text-gray-400", bg: "bg-gray-50" },
};

type SourceCategory = "__all__" | "social" | "news";

const ITEMS_PER_PAGE = 15;

interface Entity {
  id: string;
  nombre: string;
  tipo: string;
}

interface MentionsHubTabProps {
  mentions: Mention[];
  entities: Entity[];
  isLoading: boolean;
  onUpdateMention: (params: { id: string; is_read?: boolean; is_archived?: boolean }) => void;
  onDeleteMention: (id: string) => void;
  onAnalyzeUnanalyzed?: () => void;
  isAnalyzing?: boolean;
}

export function MentionsHubTab({
  mentions,
  entities,
  isLoading,
  onUpdateMention,
  onDeleteMention,
  onAnalyzeUnanalyzed,
  isAnalyzing,
}: MentionsHubTabProps) {
  const navigate = useNavigate();
  const { selectedProject } = useProject();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("__all__");
  const [selectedSentiment, setSelectedSentiment] = useState<string>("__all__");
  const [selectedEntity, setSelectedEntity] = useState<string>("__all__");
  const [sourceCategory, setSourceCategory] = useState<SourceCategory>("__all__");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "engagement_desc" | "engagement_asc">("date_desc");

  // Normalize social domains to canonical display names
  const normalizePlatformDomain = (domain: string): string => {
    const d = domain.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, "");
    if (d.includes("twitter") || d.includes("x.com")) return "X (Twitter)";
    if (d.includes("facebook")) return "Facebook";
    if (d.includes("instagram")) return "Instagram";
    if (d.includes("tiktok")) return "TikTok";
    if (d.includes("youtube")) return "YouTube";
    if (d.includes("reddit")) return "Reddit";
    if (d.includes("linkedin")) return "LinkedIn";
    return d;
  };

  // Extract unique platforms grouped by category
  const { platforms, socialCount, newsCount } = useMemo(() => {
    const uniqueLabels = new Set<string>();
    let sc = 0, nc = 0;
    mentions.forEach((m) => {
      if (m.source_domain) {
        const label = normalizePlatformDomain(m.source_domain);
        uniqueLabels.add(label);
        if (isSocialDomain(m.source_domain)) sc++; else nc++;
      }
    });
    return { platforms: Array.from(uniqueLabels).sort(), socialCount: sc, newsCount: nc };
  }, [mentions]);

  // Filter mentions
  const filteredMentions = useMemo(() => {
    return mentions.filter((mention) => {
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = mention.title?.toLowerCase().includes(query);
        const matchesDesc = mention.description?.toLowerCase().includes(query);
        const matchesKeywords = mention.matched_keywords?.some((k) => k.toLowerCase().includes(query));
        const author = getAuthorInfo(mention);
        const matchesAuthor = author && (author.name.toLowerCase().includes(query) || author.username.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDesc && !matchesKeywords && !matchesAuthor) return false;
      }

      // Source category filter (social vs news)
      if (sourceCategory !== "__all__") {
        const social = isSocialDomain(mention.source_domain);
        if (sourceCategory === "social" && !social) return false;
        if (sourceCategory === "news" && social) return false;
      }

      // Platform filter
      if (selectedPlatform !== "__all__") {
        const label = normalizePlatformDomain(mention.source_domain || "");
        if (label !== selectedPlatform) return false;
      }

      // Sentiment filter
      if (selectedSentiment !== "__all__") {
        if (selectedSentiment === "unknown") {
          if (mention.sentiment) return false;
        } else if (mention.sentiment !== selectedSentiment) {
          return false;
        }
      }

      // Entity filter
      if (selectedEntity !== "__all__" && mention.entity_id !== selectedEntity) {
        return false;
      }

      // Date filter
      if (dateFrom || dateTo) {
        const mentionDate = new Date(mention.published_at || mention.created_at);
        if (dateFrom && mentionDate < startOfDay(dateFrom)) return false;
        if (dateTo && mentionDate > endOfDay(dateTo)) return false;
      }

      return true;
    });
  }, [mentions, searchQuery, selectedPlatform, selectedSentiment, selectedEntity, sourceCategory, dateFrom, dateTo]);

  // Sort mentions
  const sortedMentions = useMemo(() => {
    const sorted = [...filteredMentions];
    sorted.sort((a, b) => {
      if (sortBy === "date_desc" || sortBy === "date_asc") {
        const dateA = new Date(a.published_at || a.created_at).getTime();
        const dateB = new Date(b.published_at || b.created_at).getTime();
        return sortBy === "date_desc" ? dateB - dateA : dateA - dateB;
      }
      const metricsA = getEngagementMetrics(a);
      const metricsB = getEngagementMetrics(b);
      // Mentions without engagement data go to the bottom
      if (!metricsA && !metricsB) return 0;
      if (!metricsA) return 1;
      if (!metricsB) return -1;
      const engA = metricsA.total;
      const engB = metricsB.total;
      return sortBy === "engagement_desc" ? engB - engA : engA - engB;
    });
    return sorted;
  }, [filteredMentions, sortBy]);

  // Pagination
  const totalPages = Math.ceil(sortedMentions.length / ITEMS_PER_PAGE);
  const paginatedMentions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedMentions.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedMentions, currentPage]);

  // In-range counts (only date filter applied) — used to show "X total (Y en rango)"
  const inRangeCounts = useMemo(() => {
    let total = 0, social = 0, news = 0;
    mentions.forEach((m) => {
      if (dateFrom || dateTo) {
        const d = new Date(m.published_at || m.created_at);
        if (dateFrom && d < startOfDay(dateFrom)) return;
        if (dateTo && d > endOfDay(dateTo)) return;
      }
      total++;
      if (m.source_domain) {
        if (isSocialDomain(m.source_domain)) social++;
        else news++;
      }
    });
    return { total, social, news };
  }, [mentions, dateFrom, dateTo]);

  const hasDateFilter = !!(dateFrom || dateTo);

  // Stats for analysis panels
  const stats = useMemo(() => {
    const bySentiment = {
      positivo: filteredMentions.filter((m) => m.sentiment === "positivo").length,
      neutral: filteredMentions.filter((m) => m.sentiment === "neutral").length,
      negativo: filteredMentions.filter((m) => m.sentiment === "negativo").length,
      unknown: filteredMentions.filter((m) => !m.sentiment).length,
    };

    const byPlatform: Record<string, number> = {};
    filteredMentions.forEach((m) => {
      const platform = getPlatformLabel(m.source_domain);
      byPlatform[platform] = (byPlatform[platform] || 0) + 1;
    });

    // Engagement coverage
    const withEngagement = filteredMentions.filter((m) => getEngagementMetrics(m) !== null).length;
    const withoutEngagement = filteredMentions.length - withEngagement;

    return { bySentiment, byPlatform, withEngagement, withoutEngagement };
  }, [filteredMentions]);

  // Reset page when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedPlatform("__all__");
    setSelectedSentiment("__all__");
    setSelectedEntity("__all__");
    setSourceCategory("__all__");
    setDateFrom(subDays(new Date(), 30));
    setDateTo(new Date());
    setCurrentPage(1);
  };

  // Export CSV
  const exportCSV = useCallback(() => {
    const headers = ["Título", "Descripción", "URL", "Plataforma", "Autor", "Username", "Sentimiento", "Fecha", "Keywords", "Likes", "Comentarios", "Shares", "Vistas", "Engagement Total", "Entidad"];
    const rows = sortedMentions.map((m) => {
      const author = getAuthorInfo(m);
      const metrics = getEngagementMetrics(m);
      const entity = entities.find((e) => e.id === m.entity_id);
      const totalEng = metrics ? metrics.likes + metrics.comments + metrics.shares + metrics.views : 0;
      return [
        (m.title || "").replace(/"/g, '""'),
        (m.description || "").replace(/"/g, '""'),
        m.url,
        getPlatformLabel(m.source_domain),
        author?.name || "",
        author?.username || "",
        m.sentiment || "sin analizar",
        m.published_at || m.created_at,
        (m.matched_keywords || []).join("; "),
        metrics?.likes ?? "",
        metrics?.comments ?? "",
        metrics?.shares ?? "",
        metrics?.views ?? "",
        totalEng || "",
        entity?.nombre || "",
      ].map((v) => `"${v}"`).join(",");
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menciones_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedMentions, entities]);

  const activeFiltersCount = [
    searchQuery.trim(),
    selectedPlatform !== "__all__",
    selectedSentiment !== "__all__",
    selectedEntity !== "__all__",
    sourceCategory !== "__all__",
  ].filter(Boolean).length;

  // Navigate to analysis panels with context
  const goToAnalysis = (path: string) => {
    // In future: pass date range as query params
    navigate(path);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Cards - Link to Analysis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-primary/20 hover:border-primary/40"
          onClick={() => goToAnalysis("/dashboard/panorama")}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Panorama</p>
                  <p className="text-xs text-muted-foreground">{filteredMentions.length} menciones</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-primary/20 hover:border-primary/40"
          onClick={() => goToAnalysis("/dashboard/semantica")}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-500/10 rounded-lg">
                  <PieChart className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Semántica</p>
                  <p className="text-xs text-muted-foreground">Analizar temas</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-primary/20 hover:border-primary/40"
          onClick={() => goToAnalysis("/dashboard/influenciadores")}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Users className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Influenciadores</p>
                  <p className="text-xs text-muted-foreground">{Object.keys(stats.byPlatform).length} fuentes</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow border-primary/20 hover:border-primary/40"
          onClick={() => goToAnalysis("/dashboard/reportes")}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <FileText className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Reportes</p>
                  <p className="text-xs text-muted-foreground">Generar PDF</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Executive Summary */}
      <ExecutiveSummaryCard
        mentions={filteredMentions}
        projectName={selectedProject?.nombre}
        dateFrom={dateFrom}
        dateTo={dateTo}
        activeFiltersLabel={activeFiltersCount > 0 ? `${activeFiltersCount} filtro${activeFiltersCount > 1 ? "s" : ""} activo${activeFiltersCount > 1 ? "s" : ""}` : undefined}
      />

      {/* Sentiment Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Resumen de Sentimiento
              </CardTitle>
              <CardDescription>
                Distribución de las {filteredMentions.length} menciones filtradas
              </CardDescription>
            </div>
            {stats.bySentiment.unknown > 0 && onAnalyzeUnanalyzed && (
              <Button
                variant="default"
                size="sm"
                onClick={onAnalyzeUnanalyzed}
                disabled={isAnalyzing}
                className="gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analizando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analizar {stats.bySentiment.unknown} pendientes
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(stats.bySentiment) as [keyof typeof SENTIMENT_CONFIG, number][]).map(([key, count]) => {
              const config = SENTIMENT_CONFIG[key];
              const Icon = config.icon;
              const percentage = filteredMentions.length > 0 
                ? Math.round((count / filteredMentions.length) * 100) 
                : 0;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedSentiment(selectedSentiment === key ? "__all__" : key);
                    handleFilterChange();
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                    selectedSentiment === key
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/50",
                    key === "unknown" && count > 0 && "border-amber-300 bg-amber-50"
                  )}
                >
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <span className="font-medium">{count}</span>
                  <span className="text-xs text-muted-foreground">
                    {config.label} ({percentage}%)
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Source Category Tabs + Export */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border bg-muted p-1">
          <Button
            variant={sourceCategory === "__all__" ? "default" : "ghost"}
            size="sm"
            onClick={() => { setSourceCategory("__all__"); handleFilterChange(); }}
          >
            Todas ({mentions.length}{hasDateFilter && inRangeCounts.total !== mentions.length ? ` · ${inRangeCounts.total} en rango` : ""})
          </Button>
          <Button
            variant={sourceCategory === "social" ? "default" : "ghost"}
            size="sm"
            onClick={() => { setSourceCategory("social"); handleFilterChange(); }}
            className="gap-1"
          >
            <Share2 className="h-3.5 w-3.5" />
            Redes Sociales ({socialCount}{hasDateFilter && inRangeCounts.social !== socialCount ? ` · ${inRangeCounts.social} en rango` : ""})
          </Button>
          <Button
            variant={sourceCategory === "news" ? "default" : "ghost"}
            size="sm"
            onClick={() => { setSourceCategory("news"); handleFilterChange(); }}
            className="gap-1"
          >
            <Newspaper className="h-3.5 w-3.5" />
            Medios Digitales ({newsCount}{hasDateFilter && inRangeCounts.news !== newsCount ? ` · ${inRangeCounts.news} en rango` : ""})
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros Avanzados
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount} activo{activeFiltersCount > 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar en título, descripción, keywords o autor..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleFilterChange();
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Platform */}
            <Select
              value={selectedPlatform}
              onValueChange={(v) => {
                setSelectedPlatform(v);
                handleFilterChange();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="__all__">Todas las plataformas</SelectItem>
                {platforms.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {getPlatformLabel(platform)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Entity */}
            <Select
              value={selectedEntity}
              onValueChange={(v) => {
                setSelectedEntity(v);
                handleFilterChange();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Entidad" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="__all__">Todas las entidades</SelectItem>
                {entities.map((entity) => (
                  <SelectItem key={entity.id} value={entity.id}>
                    {entity.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom && dateTo ? (
                    <span className="truncate">
                      {format(dateFrom, "d MMM", { locale: es })} - {format(dateTo, "d MMM", { locale: es })}
                    </span>
                  ) : (
                    <span>Rango de fechas</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                <div className="flex gap-2 p-3 border-b">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDateFrom(subDays(new Date(), 7));
                      setDateTo(new Date());
                      handleFilterChange();
                    }}
                  >
                    7 días
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDateFrom(subDays(new Date(), 30));
                      setDateTo(new Date());
                      handleFilterChange();
                    }}
                  >
                    30 días
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDateFrom(subDays(new Date(), 90));
                      setDateTo(new Date());
                      handleFilterChange();
                    }}
                  >
                    90 días
                  </Button>
                </div>
                <div className="flex">
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground mb-1 px-2">Desde</p>
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => {
                        setDateFrom(date);
                        handleFilterChange();
                      }}
                      className="pointer-events-auto"
                    />
                  </div>
                  <Separator orientation="vertical" />
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground mb-1 px-2">Hasta</p>
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => {
                        setDateTo(date);
                        handleFilterChange();
                      }}
                      className="pointer-events-auto"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">
                {filteredMentions.length} menciones encontradas
              </CardTitle>
              {(sortBy === "engagement_desc" || sortBy === "engagement_asc") && stats.withoutEngagement > 0 && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {stats.withEngagement} con datos de engagement · {stats.withoutEngagement} sin datos (capturadas vía búsqueda web)
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v as typeof sortBy); setCurrentPage(1); }}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <ArrowUpDown className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="date_desc">Más recientes</SelectItem>
                  <SelectItem value="date_asc">Más antiguas</SelectItem>
                  <SelectItem value="engagement_desc">Mayor engagement</SelectItem>
                  <SelectItem value="engagement_asc">Menor engagement</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                Página {currentPage} de {totalPages || 1}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredMentions.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No se encontraron menciones con los filtros actuales
              </p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {paginatedMentions.map((mention, index) => {
                  const PlatformIcon = getPlatformIcon(mention.source_domain);
                  const sentimentKey = (mention.sentiment || "unknown") as keyof typeof SENTIMENT_CONFIG;
                  const sentimentConfig = SENTIMENT_CONFIG[sentimentKey];
                  const SentimentIcon = sentimentConfig.icon;
                  const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  const author = getAuthorInfo(mention);
                  const metrics = getEngagementMetrics(mention);
                  const isSocial = isSocialDomain(mention.source_domain);

                  return (
                    <div
                      key={mention.id}
                      className={cn(
                        "p-4 rounded-lg border transition-all hover:shadow-sm",
                        !mention.is_read && "border-l-4 border-l-primary bg-primary/5"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Number */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                          {globalIndex}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {/* Author line */}
                              {author && (
                                <div className="flex items-center gap-1.5 mb-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  {author.url ? (
                                    <a
                                      href={author.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-semibold text-primary hover:underline"
                                    >
                                      {author.name}
                                    </a>
                                  ) : (
                                    <span className="text-xs font-semibold text-foreground">{author.name}</span>
                                  )}
                                  {author.username && author.username !== author.name && (
                                    <span className="text-xs text-muted-foreground">@{author.username}</span>
                                  )}
                                </div>
                              )}
                              <a
                                href={mention.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-sm hover:text-primary transition-colors line-clamp-2"
                                onClick={() => !mention.is_read && onUpdateMention({ id: mention.id, is_read: true })}
                              >
                                {mention.title || "Sin título"}
                              </a>
                              {mention.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {mention.description}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => onUpdateMention({ id: mention.id, is_archived: true })}
                                title="Archivar"
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => onDeleteMention(mention.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              <a
                                href={mention.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>

                          {/* Meta */}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="outline" className={cn("text-xs gap-1", isSocial ? "border-primary/30" : "border-muted-foreground/30")}>
                              <PlatformIcon className="h-3 w-3" />
                              {getPlatformLabel(mention.source_domain)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {isSocial ? "Red Social" : "Medio Digital"}
                            </Badge>
                            <Badge className={cn("text-xs gap-1", sentimentConfig.bg, sentimentConfig.color)}>
                              <SentimentIcon className="h-3 w-3" />
                              {sentimentConfig.label}
                            </Badge>
                            {mention.entity?.nombre && (
                              <Badge variant="secondary" className="text-xs">
                                {mention.entity.nombre}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(mention.published_at || mention.created_at), "d MMM yyyy HH:mm", { locale: es })}
                            </span>
                          </div>

                          {/* Engagement metrics for social */}
                          {metrics ? (
                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs">
                              <span className="font-semibold text-foreground">
                                📊 {metrics.total.toLocaleString()} eng.
                              </span>
                              {metrics.views > 0 && <span className="text-muted-foreground">👁 {metrics.views.toLocaleString()}</span>}
                              {metrics.likes > 0 && <span className="text-muted-foreground">❤️ {metrics.likes.toLocaleString()}</span>}
                              {metrics.comments > 0 && <span className="text-muted-foreground">💬 {metrics.comments.toLocaleString()}</span>}
                              {metrics.shares > 0 && <span className="text-muted-foreground">🔄 {metrics.shares.toLocaleString()}</span>}
                            </div>
                          ) : isSocial ? (
                            <p className="text-xs text-muted-foreground/60 mt-1.5 italic">
                              Sin datos de engagement — recapturar desde Redes Sociales
                            </p>
                          ) : null}

                          {/* Keywords */}
                          {mention.matched_keywords && mention.matched_keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {mention.matched_keywords.slice(0, 5).map((keyword, i) => (
                                <Badge key={i} variant="outline" className="text-xs bg-muted/50">
                                  {keyword}
                                </Badge>
                              ))}
                              {mention.matched_keywords.length > 5 && (
                                <Badge variant="outline" className="text-xs">
                                  +{mention.matched_keywords.length - 5}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "ghost"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
