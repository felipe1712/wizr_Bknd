import { useState, useEffect, useCallback } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useEntities } from "@/hooks/useEntities";
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
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type SearchMode = "manual" | "entities";
type ViewMode = "search" | "history";

const FuentesPage = () => {
  const { selectedProject, loading: projectLoading } = useProject();
  const { entities, isLoading: entitiesLoading } = useEntities(selectedProject?.id);
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
  }, [selectedProject]);

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
        5
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
        <TabsList>
          <TabsTrigger value="search" className="gap-2">
            <Search className="h-4 w-4" />
            Buscar
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
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        No hay entidades configuradas.{" "}
                        <Button
                          variant="link"
                          className="h-auto p-0"
                          onClick={() => navigate("/dashboard/configuracion")}
                        >
                          Añadir entidades
                        </Button>
                      </p>
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
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {results.length} menciones encontradas ({TIME_RANGE_LABELS[timeRange]})
              </p>

              {results.map((result, index) => (
                <Card key={index} className="overflow-hidden transition-shadow hover:shadow-md">
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
              {mentions.map((mention) => (
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
      </Tabs>
    </div>
  );
};

export default FuentesPage;
