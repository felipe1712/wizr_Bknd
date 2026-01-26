import { useState, useEffect, useCallback } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { firecrawlApi, SearchResult } from "@/lib/api/firecrawl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const FuentesPage = () => {
  const { selectedProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<"hour" | "day" | "week" | "month">("day");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Auto-search when project changes
  useEffect(() => {
    if (selectedProject && !hasSearched) {
      // Create initial search query from project name
      setSearchQuery(selectedProject.nombre);
    }
  }, [selectedProject, hasSearched]);

  const handleSearch = useCallback(async () => {
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

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Fuentes</h1>
        <p className="text-muted-foreground">
          Búsqueda de medios digitales y noticias — <span className="font-medium">{selectedProject.nombre}</span>
        </p>
      </div>

      {/* Search Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Búsqueda de Noticias
          </CardTitle>
          <CardDescription>
            Busca menciones en medios digitales y noticias usando Firecrawl
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Término de búsqueda..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="bg-background"
              />
            </div>
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
            <Button onClick={handleSearch} disabled={isSearching}>
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
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isSearching ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {results.length} resultados para "{searchQuery}" ({TIME_RANGE_LABELS[timeRange]})
            </p>
          </div>

          {results.map((result, index) => (
            <Card key={index} className="overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Newspaper className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-1 font-semibold text-foreground hover:text-primary"
                      >
                        <span className="line-clamp-1">{result.title || "Sin título"}</span>
                        <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                    </div>
                    
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {result.description || result.metadata?.description || "Sin descripción disponible"}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
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
            <div className="rounded-full bg-muted p-4">
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Sin resultados</h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              No se encontraron noticias para "{searchQuery}". Intenta con otros términos.
            </p>
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
                Ingresa un término de búsqueda y selecciona un rango de tiempo para encontrar noticias relevantes
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FuentesPage;
