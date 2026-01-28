import { useState, useMemo } from "react";
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
} from "lucide-react";
import type { Mention, SentimentType } from "@/hooks/useMentions";

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

const SENTIMENT_CONFIG = {
  positivo: { label: "Positivo", icon: Smile, color: "text-green-600", bg: "bg-green-100" },
  neutral: { label: "Neutral", icon: Meh, color: "text-gray-600", bg: "bg-gray-100" },
  negativo: { label: "Negativo", icon: Frown, color: "text-red-600", bg: "bg-red-100" },
  unknown: { label: "Sin analizar", icon: HelpCircle, color: "text-gray-400", bg: "bg-gray-50" },
};

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
}

export function MentionsHubTab({
  mentions,
  entities,
  isLoading,
  onUpdateMention,
  onDeleteMention,
}: MentionsHubTabProps) {
  const navigate = useNavigate();
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("__all__");
  const [selectedSentiment, setSelectedSentiment] = useState<string>("__all__");
  const [selectedEntity, setSelectedEntity] = useState<string>("__all__");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [currentPage, setCurrentPage] = useState(1);

  // Extract unique platforms
  const platforms = useMemo(() => {
    const uniqueDomains = new Set<string>();
    mentions.forEach((m) => {
      if (m.source_domain) {
        uniqueDomains.add(m.source_domain.toLowerCase().replace("www.", ""));
      }
    });
    return Array.from(uniqueDomains).sort();
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
        if (!matchesTitle && !matchesDesc && !matchesKeywords) return false;
      }

      // Platform filter
      if (selectedPlatform !== "__all__") {
        const domain = mention.source_domain?.toLowerCase().replace("www.", "") || "";
        if (!domain.includes(selectedPlatform)) return false;
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
  }, [mentions, searchQuery, selectedPlatform, selectedSentiment, selectedEntity, dateFrom, dateTo]);

  // Pagination
  const totalPages = Math.ceil(filteredMentions.length / ITEMS_PER_PAGE);
  const paginatedMentions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMentions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMentions, currentPage]);

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

    return { bySentiment, byPlatform };
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
    setDateFrom(subDays(new Date(), 30));
    setDateTo(new Date());
    setCurrentPage(1);
  };

  const activeFiltersCount = [
    searchQuery.trim(),
    selectedPlatform !== "__all__",
    selectedSentiment !== "__all__",
    selectedEntity !== "__all__",
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

      {/* Sentiment Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Resumen de Sentimiento
          </CardTitle>
          <CardDescription>
            Distribución de las {filteredMentions.length} menciones filtradas
          </CardDescription>
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
                      : "border-border hover:border-primary/50"
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
                  placeholder="Buscar en título, descripción o keywords..."
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {filteredMentions.length} menciones encontradas
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Página {currentPage} de {totalPages || 1}
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
                            <Badge variant="outline" className="text-xs gap-1">
                              <PlatformIcon className="h-3 w-3" />
                              {getPlatformLabel(mention.source_domain)}
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
