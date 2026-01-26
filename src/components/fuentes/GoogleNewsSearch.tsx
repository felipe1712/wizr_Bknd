import React, { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useMentions } from "@/hooks/useMentions";
import { firecrawlApi, SearchResult } from "@/lib/api/firecrawl";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Search,
  Newspaper,
  Clock,
  ExternalLink,
  Save,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Globe,
  Sparkles,
} from "lucide-react";

interface GoogleNewsSearchProps {
  projectId: string;
  projectName: string;
}

const ITEMS_PER_PAGE = 10;

const TIME_RANGE_OPTIONS = [
  { value: "hour", label: "Última hora" },
  { value: "day", label: "Últimas 24 horas" },
  { value: "week", label: "Última semana" },
  { value: "month", label: "Último mes" },
];

export function GoogleNewsSearch({ projectId, projectName }: GoogleNewsSearchProps) {
  const { toast } = useToast();
  const { saveManyMentions, searchResultsToMentions, isSaving } = useMentions(projectId);

  const [searchQuery, setSearchQuery] = useState(projectName || "");
  const [timeRange, setTimeRange] = useState<"hour" | "day" | "week" | "month">("day");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = results.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
    setCurrentPage(1);

    try {
      const response = await firecrawlApi.searchGoogleNews(searchQuery, timeRange, 25);

      if (response.success && response.data) {
        setResults(response.data);
        toast({
          title: "Búsqueda completada",
          description: `Se encontraron ${response.data.length} noticias en Google News`,
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
      console.error("Google News search error:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al buscar en Google News",
        variant: "destructive",
      });
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, timeRange, toast]);

  const handleSaveResults = () => {
    if (results.length === 0) return;

    const mentionData = searchResultsToMentions(results, projectId);
    saveManyMentions(mentionData);
    toast({
      title: "Guardando noticias",
      description: `Guardando ${results.length} noticias de Google News`,
    });
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "Fuente desconocida";
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            Búsqueda en Google News
          </CardTitle>
          <CardDescription>
            Busca noticias recientes directamente desde Google News para monitorear menciones en medios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en Google News..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
              <SelectTrigger className="w-[180px]">
                <Clock className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>Los resultados provienen directamente de Google News para mayor precisión en noticias</span>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isSearching ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : hasSearched && results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium">Sin resultados</p>
            <p className="text-sm text-muted-foreground">
              No se encontraron noticias para "{searchQuery}" en el período seleccionado
            </p>
          </CardContent>
        </Card>
      ) : results.length > 0 ? (
        <>
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                {results.length} noticias encontradas
              </Badge>
              <Badge variant="outline" className="font-normal">
                Google News
              </Badge>
            </div>
            <Button onClick={handleSaveResults} disabled={isSaving} variant="secondary">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Guardando..." : "Guardar todas"}
            </Button>
          </div>

          {/* Results List */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-3 pr-4">
              {paginatedResults.map((result, index) => (
                <Card key={`${result.url}-${index}`} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-1">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${getDomain(result.url)}&sz=32`}
                          alt=""
                          className="h-6 w-6 rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground hover:text-primary line-clamp-2 flex items-start gap-1"
                        >
                          {result.title}
                          <ExternalLink className="h-3 w-3 shrink-0 mt-1" />
                        </a>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {result.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            <span>{getDomain(result.url)}</span>
                          </div>
                          {result.metadata?.publishedDate && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {formatDistanceToNow(new Date(result.metadata.publishedDate), {
                                  addSuffix: true,
                                  locale: es,
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
