import { useState, useEffect, useCallback, useMemo } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useEntities, EntityType } from "@/hooks/useEntities";
import { useMentions, useMentionStats } from "@/hooks/useMentions";
import { firecrawlApi, SearchResult, EntityForSearch } from "@/lib/api/firecrawl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { EntityForm } from "@/components/entities/EntityForm";
import { SocialMediaSearch } from "@/components/fuentes/SocialMediaSearch";
import { SocialHistoryTab } from "@/components/fuentes/SocialHistoryTab";
import { GoogleNewsSearch } from "@/components/fuentes/GoogleNewsSearch";
import { CommentsAnalysisTab } from "@/components/fuentes/CommentsAnalysisTab";
import wizrLogoIcon from "@/assets/wizr-logo-icon.png";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertCircle,
  Plus,
  Database,
  Search,
  RefreshCw,
  ExternalLink,
  Clock,
  Newspaper,
  Globe,
  User,
  Building2,
  Briefcase,
  Tag,
  Filter,
  Save,
  History,
  TrendingUp,
  Eye,
  Archive,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarIcon,
  X,
  MessageCircle,
} from "lucide-react";
import { format, formatDistanceToNow, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

type SearchMode = "manual" | "entities";
type ViewMode = "search" | "google-news" | "social" | "social-history" | "comments" | "history";
type SearchSource = "news" | "social";

const ITEMS_PER_PAGE = 10;

// Extract unique domains from results or mentions
const extractDomains = (items: { url?: string; source_domain?: string }[]): string[] => {
  const domains = new Set<string>();
  items.forEach((item) => {
    let domain = "";
    if (item.source_domain) {
      domain = item.source_domain.trim();
    } else if (item.url) {
      try {
        domain = new URL(item.url).hostname.replace("www.", "").trim();
      } catch {
        // ignore invalid URLs
      }
    }
    // Only add non-empty domains
    if (domain) {
      domains.add(domain);
    }
  });
  return Array.from(domains).sort();
};

const FuentesPage = () => {
  const { selectedProject, loading: projectLoading } = useProject();
  const { entities, isLoading: entitiesLoading, createEntity, isCreating } = useEntities(selectedProject?.id);
  const { 
    mentions, 
    isLoading: mentionsLoading, 
    saveManyMentions, 
    isSaving,
    searchResultsToMentions,
    updateMention,
  } = useMentions(selectedProject?.id, { isArchived: false });
  const { data: stats } = useMentionStats(selectedProject?.id);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [viewMode, setViewMode] = useState<ViewMode>("search");
  const [searchMode, setSearchMode] = useState<SearchMode>("entities");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<"hour" | "day" | "week" | "month">("day");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const [showEntityForm, setShowEntityForm] = useState(false);
  
  // Pagination state
  const [searchPage, setSearchPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  // Filter state for search results
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [searchFilterDomain, setSearchFilterDomain] = useState<string>("");
  const [searchFilterKeyword, setSearchFilterKeyword] = useState("");
  const [searchFilterDateFrom, setSearchFilterDateFrom] = useState<Date | undefined>();
  const [searchFilterDateTo, setSearchFilterDateTo] = useState<Date | undefined>();

  // Filter state for history
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
  const [historyFilterDomain, setHistoryFilterDomain] = useState<string>("");
  const [historyFilterKeyword, setHistoryFilterKeyword] = useState("");
  const [historyFilterDateFrom, setHistoryFilterDateFrom] = useState<Date | undefined>();
  const [historyFilterDateTo, setHistoryFilterDateTo] = useState<Date | undefined>();
  const [historyFilterEntityId, setHistoryFilterEntityId] = useState<string>("");

  // Auto-select all entities when they load
  useEffect(() => {
    if (entities.length > 0 && selectedEntityIds.size === 0) {
      setSelectedEntityIds(new Set(entities.map((e) => e.id)));
    }
  }, [entities, selectedEntityIds.size]);

  // Reset when project changes
  useEffect(() => {
    setResults([]);
    setHasSearched(false);
    setSearchQuery(selectedProject?.nombre || "");
    setSearchPage(1);
    setHistoryPage(1);
    // Reset filters
    clearSearchFilters();
    clearHistoryFilters();
  }, [selectedProject]);

  // Available domains for filter dropdowns
  const searchDomains = useMemo(() => extractDomains(results), [results]);
  const historyDomains = useMemo(() => extractDomains(mentions), [mentions]);

  // Filtered search results
  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      // Domain filter
      if (searchFilterDomain) {
        try {
          const resultDomain = new URL(result.url).hostname.replace("www.", "");
          if (resultDomain !== searchFilterDomain) return false;
        } catch {
          return false;
        }
      }
      // Keyword filter
      if (searchFilterKeyword.trim()) {
        const keyword = searchFilterKeyword.toLowerCase();
        const inTitle = result.title?.toLowerCase().includes(keyword);
        const inDescription = result.description?.toLowerCase().includes(keyword);
        if (!inTitle && !inDescription) return false;
      }
      // Date filter
      if (searchFilterDateFrom || searchFilterDateTo) {
        const pubDate = result.metadata?.publishedDate 
          ? new Date(result.metadata.publishedDate) 
          : null;
        if (!pubDate) return false;
        if (searchFilterDateFrom && pubDate < startOfDay(searchFilterDateFrom)) return false;
        if (searchFilterDateTo && pubDate > endOfDay(searchFilterDateTo)) return false;
      }
      return true;
    });
  }, [results, searchFilterDomain, searchFilterKeyword, searchFilterDateFrom, searchFilterDateTo]);

  // Filtered history mentions
  const filteredMentions = useMemo(() => {
    return mentions.filter((mention) => {
      // Domain filter
      if (historyFilterDomain && mention.source_domain !== historyFilterDomain) return false;
      // Keyword filter
      if (historyFilterKeyword.trim()) {
        const keyword = historyFilterKeyword.toLowerCase();
        const inTitle = mention.title?.toLowerCase().includes(keyword);
        const inDescription = mention.description?.toLowerCase().includes(keyword);
        const inKeywords = mention.matched_keywords?.some((k) => k.toLowerCase().includes(keyword));
        if (!inTitle && !inDescription && !inKeywords) return false;
      }
      // Date filter
      if (historyFilterDateFrom || historyFilterDateTo) {
        const createdAt = new Date(mention.created_at);
        if (historyFilterDateFrom && createdAt < startOfDay(historyFilterDateFrom)) return false;
        if (historyFilterDateTo && createdAt > endOfDay(historyFilterDateTo)) return false;
      }
      // Entity filter
      if (historyFilterEntityId && mention.entity_id !== historyFilterEntityId) return false;
      return true;
    });
  }, [mentions, historyFilterDomain, historyFilterKeyword, historyFilterDateFrom, historyFilterDateTo, historyFilterEntityId]);

  // Paginated results (using filtered)
  const paginatedResults = useMemo(() => {
    const startIndex = (searchPage - 1) * ITEMS_PER_PAGE;
    return filteredResults.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredResults, searchPage]);

  const totalSearchPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);

  // Paginated mentions (using filtered)
  const paginatedMentions = useMemo(() => {
    const startIndex = (historyPage - 1) * ITEMS_PER_PAGE;
    return filteredMentions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMentions, historyPage]);

  const totalHistoryPages = Math.ceil(filteredMentions.length / ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => {
    setSearchPage(1);
  }, [searchFilterDomain, searchFilterKeyword, searchFilterDateFrom, searchFilterDateTo]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyFilterDomain, historyFilterKeyword, historyFilterDateFrom, historyFilterDateTo, historyFilterEntityId]);

  // Count active filters
  const activeSearchFilters = [searchFilterDomain, searchFilterKeyword, searchFilterDateFrom, searchFilterDateTo].filter(Boolean).length;
  const activeHistoryFilters = [historyFilterDomain, historyFilterKeyword, historyFilterDateFrom, historyFilterDateTo, historyFilterEntityId].filter(Boolean).length;

  const clearSearchFilters = () => {
    setSearchFilterDomain("");
    setSearchFilterKeyword("");
    setSearchFilterDateFrom(undefined);
    setSearchFilterDateTo(undefined);
  };

  const clearHistoryFilters = () => {
    setHistoryFilterDomain("");
    setHistoryFilterKeyword("");
    setHistoryFilterDateFrom(undefined);
    setHistoryFilterDateTo(undefined);
    setHistoryFilterEntityId("");
  };

  const handleToggleEntity = (entityId: string) => {
    const newSelected = new Set(selectedEntityIds);
    if (newSelected.has(entityId)) {
      newSelected.delete(entityId);
    } else {
      newSelected.add(entityId);
    }
    setSelectedEntityIds(newSelected);
  };

  const handleSelectAllEntities = () => {
    if (selectedEntityIds.size === entities.length) {
      setSelectedEntityIds(new Set());
    } else {
      setSelectedEntityIds(new Set(entities.map((e) => e.id)));
    }
  };

  const handleManualSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Búsqueda vacía",
        description: "Ingresa un término de búsqueda",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchPage(1); // Reset to first page on new search

    try {
      const response = await firecrawlApi.searchNews(searchQuery, timeRange, 15);

      if (response.success && response.data) {
        setResults(response.data);
        toast({
          title: "Búsqueda completada",
          description: `Se encontraron ${response.data.length} resultados`,
        });
      } else {
        toast({
          title: "Error en la búsqueda",
          description: response.error || "No se pudieron obtener resultados",
          variant: "destructive",
        });
        setResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al realizar la búsqueda",
        variant: "destructive",
      });
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, timeRange, toast]);

  const handleEntitySearch = useCallback(async () => {
    if (selectedEntityIds.size === 0) {
      toast({
        title: "Sin entidades seleccionadas",
        description: "Selecciona al menos una entidad para buscar",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSearchPage(1); // Reset to first page on new search

    try {
      const selectedEntities: EntityForSearch[] = entities
        .filter((e) => selectedEntityIds.has(e.id))
        .map((e) => ({
          id: e.id,
          nombre: e.nombre,
          palabras_clave: e.palabras_clave,
          aliases: e.aliases,
        }));

      const response = await firecrawlApi.searchMultipleEntities(
        selectedEntities,
        timeRange,
        50 // Increased limit per entity for better coverage
      );

      if (response.success && response.data) {
        setResults(response.data);
        toast({
          title: "Búsqueda completada",
          description: `Se encontraron ${response.data.length} menciones para ${selectedEntities.length} entidad(es)`,
        });
      } else {
        toast({
          title: "Error en la búsqueda",
          description: response.error || "No se pudieron obtener resultados",
          variant: "destructive",
        });
        setResults([]);
      }
    } catch (error) {
      console.error("Entity search error:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al buscar menciones",
        variant: "destructive",
      });
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [entities, selectedEntityIds, timeRange, toast]);

  const handleSearch = () => {
    if (searchMode === "manual") {
      handleManualSearch();
    } else {
      handleEntitySearch();
    }
  };

  const handleSaveResults = () => {
    if (!selectedProject || results.length === 0) return;
    
    const mentionData = searchResultsToMentions(results, selectedProject.id);
    saveManyMentions(mentionData);
  };

  const handleMarkAsRead = (mentionId: string) => {
    updateMention({ id: mentionId, is_read: true });
  };

  const handleArchive = (mentionId: string) => {
    updateMention({ id: mentionId, is_archived: true });
    toast({ title: "Mención archivada" });
  };

  const getEntityIcon = (tipo: string) => {
    switch (tipo) {
      case "persona":
        return User;
      case "marca":
        return Briefcase;
      case "institucion":
        return Building2;
      default:
        return Building2;
    }
  };

  if (projectLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-16 p-6">
        <div className="rounded-full bg-muted p-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Sin proyecto seleccionado</h2>
        <p className="mt-2 max-w-md text-center text-muted-foreground">
          Crea o selecciona un proyecto para buscar fuentes
        </p>
        <Button className="mt-4" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Proyecto
        </Button>
      </div>
    );
  }

  const TIME_RANGE_LABELS = {
    hour: "Última hora",
    day: "Últimas 24 horas",
    week: "Última semana",
    month: "Último mes",
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fuentes</h1>
          <p className="text-muted-foreground">
            Búsqueda y monitoreo de menciones — <span className="font-medium">{selectedProject.nombre}</span>
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Database className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total guardadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Eye className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.unread}</p>
                  <p className="text-xs text-muted-foreground">Sin leer</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.last24h}</p>
                  <p className="text-xs text-muted-foreground">Últimas 24h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <History className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.lastWeek}</p>
                  <p className="text-xs text-muted-foreground">Última semana</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="search" className="gap-2">
            <Newspaper className="h-4 w-4" />
            Medios
          </TabsTrigger>
          <TabsTrigger value="google-news" className="gap-2">
            <Globe className="h-4 w-4" />
            Google News
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Redes Sociales
          </TabsTrigger>
          <TabsTrigger value="social-history" className="gap-2">
            <Database className="h-4 w-4" />
            Historial Redes
          </TabsTrigger>
          <TabsTrigger value="comments" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Comentarios
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Historial ({mentions.length})
          </TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Búsqueda de Menciones
              </CardTitle>
              <CardDescription>
                Busca menciones por entidades o con términos personalizados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Mode Tabs */}
              <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as SearchMode)}>
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                  <TabsTrigger value="entities" className="gap-2">
                    <Tag className="h-4 w-4" />
                    Por Entidades
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="gap-2">
                    <Search className="h-4 w-4" />
                    Búsqueda Manual
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Entity Selection */}
              {searchMode === "entities" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Seleccionar Entidades
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllEntities}
                      disabled={entities.length === 0}
                    >
                      {selectedEntityIds.size === entities.length ? "Deseleccionar todas" : "Seleccionar todas"}
                    </Button>
                  </div>
                  
                  {entitiesLoading ? (
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-32" />
                      <Skeleton className="h-8 w-28" />
                    </div>
                  ) : entities.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-primary/30 p-6 text-center bg-primary/5">
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <img src={wizrLogoIcon} alt="Wizr" className="h-8 w-8" />
                          </div>
                          <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-accent" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">¡Configura tu primera entidad!</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Agrega las marcas, personas o instituciones que quieres monitorear
                          </p>
                        </div>
                        <Button onClick={() => setShowEntityForm(true)} className="mt-2">
                          <Plus className="mr-2 h-4 w-4" />
                          Crear Entidad Ahora
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-32">
                      <div className="flex flex-wrap gap-2">
                        {entities.map((entity) => {
                          const Icon = getEntityIcon(entity.tipo);
                          const isSelected = selectedEntityIds.has(entity.id);
                          
                          return (
                            <div
                              key={entity.id}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-primary/10 border-primary"
                                  : "bg-background hover:bg-muted"
                              }`}
                              onClick={() => handleToggleEntity(entity.id)}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleEntity(entity.id)}
                              />
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{entity.nombre}</span>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

              {/* Manual Search Input */}
              {searchMode === "manual" && (
                <Input
                  placeholder="Término de búsqueda..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="bg-background"
                />
              )}

              {/* Time Range & Buttons */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
                    <SelectTrigger className="w-44 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="hour">Última hora</SelectItem>
                      <SelectItem value="day">Últimas 24 horas</SelectItem>
                      <SelectItem value="week">Última semana</SelectItem>
                      <SelectItem value="month">Último mes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleSearch} 
                  disabled={isSearching || (searchMode === "entities" && selectedEntityIds.size === 0)}
                >
                  {isSearching ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Buscar
                    </>
                  )}
                </Button>
                {results.length > 0 && (
                  <Button 
                    variant="secondary" 
                    onClick={handleSaveResults}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Guardar ({results.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Search Results */}
          {isSearching ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-lg">Buscando menciones...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esto puede tomar hasta 30 segundos. Por favor espera.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : results.length > 0 ? (
            <div className="space-y-4">
              {/* Filters Toggle */}
              <Collapsible open={showSearchFilters} onOpenChange={setShowSearchFilters}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {filteredResults.length} de {results.length} menciones ({TIME_RANGE_LABELS[timeRange]})
                  </p>
                  <div className="flex items-center gap-2">
                    {activeSearchFilters > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearSearchFilters} className="h-8 gap-1">
                        <X className="h-3 w-3" />
                        Limpiar filtros ({activeSearchFilters})
                      </Button>
                    )}
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Filtros
                        <ChevronDown className={cn("h-4 w-4 transition-transform", showSearchFilters && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    {totalSearchPages > 1 && (
                      <span className="text-sm text-muted-foreground">
                        Pág. {searchPage}/{totalSearchPages}
                      </span>
                    )}
                  </div>
                </div>
                
                <CollapsibleContent className="mt-3">
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Domain Filter */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            Dominio
                          </Label>
                          <Select value={searchFilterDomain || "__all__"} onValueChange={(v) => setSearchFilterDomain(v === "__all__" ? "" : v)}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Todos los dominios" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">Todos los dominios</SelectItem>
                              {searchDomains.map((domain) => (
                                <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Keyword Filter */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium flex items-center gap-1">
                            <Search className="h-3 w-3" />
                            Palabra clave
                          </Label>
                          <Input
                            placeholder="Buscar en resultados..."
                            value={searchFilterKeyword}
                            onChange={(e) => setSearchFilterKeyword(e.target.value)}
                            className="bg-background"
                          />
                        </div>
                        
                        {/* Date From */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            Desde
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !searchFilterDateFrom && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {searchFilterDateFrom ? format(searchFilterDateFrom, "dd/MM/yyyy") : "Fecha inicio"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={searchFilterDateFrom}
                                onSelect={setSearchFilterDateFrom}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        {/* Date To */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            Hasta
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !searchFilterDateTo && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {searchFilterDateTo ? format(searchFilterDateTo, "dd/MM/yyyy") : "Fecha fin"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={searchFilterDateTo}
                                onSelect={setSearchFilterDateTo}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              {paginatedResults.map((result, index) => (
                <Card key={`${searchPage}-${index}`} className="overflow-hidden transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Newspaper className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-1 font-semibold hover:text-primary"
                        >
                          <span className="line-clamp-1">{result.title || "Sin título"}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                        </a>
                        
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {result.description || "Sin descripción"}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {result.matchedEntityName && (
                            <Badge variant="default" className="gap-1">
                              <Tag className="h-3 w-3" />
                              {result.matchedEntityName}
                            </Badge>
                          )}
                          <Badge variant="outline" className="gap-1">
                            <Globe className="h-3 w-3" />
                            {new URL(result.url).hostname.replace("www.", "")}
                          </Badge>
                          {result.metadata?.publishedDate && (
                            <Badge variant="secondary">
                              {format(new Date(result.metadata.publishedDate), "d MMM yyyy", { locale: es })}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Search Pagination Controls */}
              {totalSearchPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                    disabled={searchPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalSearchPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalSearchPages <= 5) {
                        pageNum = i + 1;
                      } else if (searchPage <= 3) {
                        pageNum = i + 1;
                      } else if (searchPage >= totalSearchPages - 2) {
                        pageNum = totalSearchPages - 4 + i;
                      } else {
                        pageNum = searchPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={searchPage === pageNum ? "default" : "outline"}
                          size="sm"
                          className="w-9"
                          onClick={() => setSearchPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchPage((p) => Math.min(totalSearchPages, p + 1))}
                    disabled={searchPage === totalSearchPages}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          ) : hasSearched ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Database className="h-8 w-8 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Sin resultados</h3>
                <p className="text-sm text-muted-foreground">Intenta con otros términos o un rango más amplio</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="flex items-center gap-4 py-8">
                <div className="rounded-full bg-primary/10 p-3">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Listo para buscar</p>
                  <p className="text-sm text-muted-foreground">
                    Selecciona entidades o ingresa un término para buscar menciones
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Social Media Tab */}
        <TabsContent value="social" className="mt-4">
          <SocialMediaSearch 
            projectId={selectedProject.id} 
            onResultsSaved={() => {
              toast({
                title: "Menciones guardadas",
                description: "Las menciones de redes sociales se agregaron al historial",
              });
            }}
          />
        </TabsContent>

        {/* Social History Tab */}
        <TabsContent value="social-history" className="mt-4">
          <SocialHistoryTab projectId={selectedProject.id} />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-4">
          {mentionsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : mentions.length > 0 ? (
            <div className="space-y-4">
              {/* Filters Toggle */}
              <Collapsible open={showHistoryFilters} onOpenChange={setShowHistoryFilters}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {filteredMentions.length} de {mentions.length} menciones guardadas
                  </p>
                  <div className="flex items-center gap-2">
                    {activeHistoryFilters > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearHistoryFilters} className="h-8 gap-1">
                        <X className="h-3 w-3" />
                        Limpiar ({activeHistoryFilters})
                      </Button>
                    )}
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Filtros
                        <ChevronDown className={cn("h-4 w-4 transition-transform", showHistoryFilters && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    {totalHistoryPages > 1 && (
                      <span className="text-sm text-muted-foreground">
                        Pág. {historyPage}/{totalHistoryPages}
                      </span>
                    )}
                  </div>
                </div>
                
                <CollapsibleContent className="mt-3">
                  <Card className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Domain Filter */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            Dominio
                          </Label>
                          <Select value={historyFilterDomain || "__all__"} onValueChange={(v) => setHistoryFilterDomain(v === "__all__" ? "" : v)}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">Todos los dominios</SelectItem>
                              {historyDomains.map((domain) => (
                                <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Entity Filter */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            Entidad
                          </Label>
                          <Select value={historyFilterEntityId || "__all__"} onValueChange={(v) => setHistoryFilterEntityId(v === "__all__" ? "" : v)}>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">Todas las entidades</SelectItem>
                              {entities.map((entity) => (
                                <SelectItem key={entity.id} value={entity.id}>{entity.nombre}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Keyword Filter */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium flex items-center gap-1">
                            <Search className="h-3 w-3" />
                            Palabra clave
                          </Label>
                          <Input
                            placeholder="Buscar..."
                            value={historyFilterKeyword}
                            onChange={(e) => setHistoryFilterKeyword(e.target.value)}
                            className="bg-background"
                          />
                        </div>
                        
                        {/* Date From */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            Desde
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !historyFilterDateFrom && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {historyFilterDateFrom ? format(historyFilterDateFrom, "dd/MM/yy") : "Inicio"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={historyFilterDateFrom}
                                onSelect={setHistoryFilterDateFrom}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        {/* Date To */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            Hasta
                          </Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !historyFilterDateTo && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {historyFilterDateTo ? format(historyFilterDateTo, "dd/MM/yy") : "Fin"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={historyFilterDateTo}
                                onSelect={setHistoryFilterDateTo}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              {paginatedMentions.map((mention) => (
                <Card 
                  key={mention.id} 
                  className={`overflow-hidden transition-shadow hover:shadow-md ${
                    !mention.is_read ? "border-l-4 border-l-primary" : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Newspaper className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={mention.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-1 font-semibold hover:text-primary"
                            onClick={() => handleMarkAsRead(mention.id)}
                          >
                            <span className="line-clamp-1">{mention.title || "Sin título"}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleArchive(mention.id)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {mention.description || "Sin descripción"}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {mention.entity && (
                            <Badge variant="default" className="gap-1">
                              <Tag className="h-3 w-3" />
                              {mention.entity.nombre}
                            </Badge>
                          )}
                          {mention.source_domain && (
                            <Badge variant="outline" className="gap-1">
                              <Globe className="h-3 w-3" />
                              {mention.source_domain}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {formatDistanceToNow(new Date(mention.created_at), { addSuffix: true, locale: es })}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* History Pagination Controls */}
              {totalHistoryPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalHistoryPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalHistoryPages <= 5) {
                        pageNum = i + 1;
                      } else if (historyPage <= 3) {
                        pageNum = i + 1;
                      } else if (historyPage >= totalHistoryPages - 2) {
                        pageNum = totalHistoryPages - 4 + i;
                      } else {
                        pageNum = historyPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={historyPage === pageNum ? "default" : "outline"}
                          size="sm"
                          className="w-9"
                          onClick={() => setHistoryPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                    disabled={historyPage === totalHistoryPages}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-8 w-8 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Sin menciones guardadas</h3>
                <p className="text-sm text-muted-foreground">
                  Busca y guarda menciones para crear tu historial
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Google News Tab */}
        <TabsContent value="google-news" className="space-y-4 mt-4">
          <GoogleNewsSearch projectId={selectedProject.id} projectName={selectedProject.nombre} />
        </TabsContent>

        {/* Comments Analysis Tab */}
        <TabsContent value="comments" className="space-y-4 mt-4">
          <CommentsAnalysisTab projectId={selectedProject.id} />
        </TabsContent>
      </Tabs>

      {/* Quick Entity Form */}
      <EntityForm
        open={showEntityForm}
        onOpenChange={setShowEntityForm}
        onSubmit={(data) => {
          if (!selectedProject || !data.nombre || !data.tipo) return;
          createEntity({
            project_id: selectedProject.id,
            nombre: data.nombre,
            tipo: data.tipo,
            descripcion: data.descripcion,
            palabras_clave: data.palabras_clave,
            aliases: data.aliases,
          });
          setShowEntityForm(false);
        }}
        isLoading={isCreating}
      />
    </div>
  );
};

export default FuentesPage;
