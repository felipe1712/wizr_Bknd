import { useState } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useInfluencersData } from "@/hooks/useInfluencersData";
import { useDateRangeFilter } from "@/hooks/useDateRangeFilter";
import { DateRangeSelector } from "@/components/reports/DateRangeSelector";
import { InfluencerCard } from "@/components/influenciadores/InfluencerCard";
import { InfluencerTrendChart } from "@/components/influenciadores/InfluencerTrendChart";
import { InfluencerTable } from "@/components/influenciadores/InfluencerTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Globe, 
  TrendingUp, 
  Filter, 
  LayoutGrid, 
  Table,
  ChevronDown
} from "lucide-react";

type ViewMode = "cards" | "table";
type SourceType = "all" | "social" | "news" | "other";

const SOURCE_TYPE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "social", label: "Redes Sociales" },
  { value: "news", label: "Medios Digitales" },
  { value: "other", label: "Otros (Foros, Blogs)" },
];

const SOCIAL_DOMAINS = [
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "linkedin.com",
  "tiktok.com",
  "youtube.com",
  "threads.net",
];

const NEWS_DOMAINS = [
  "msn.com",
  "elfinanciero.com.mx",
  "eleconomista.com.mx",
  "reforma.com",
  "milenio.com",
  "jornada.com.mx",
  "proceso.com.mx",
  "forbes.com.mx",
  "expansion.mx",
  "bloomberglinea.com",
  "bbc.com",
  "reuters.com",
  "cnn.com",
  "elpais.com",
  "lanacion.com.ar",
  "infobae.com",
];

const InfluenciadoresPage = () => {
  const { selectedProject } = useProject();
  const { dateConfig, setDateConfig, daysRange } = useDateRangeFilter("30d");
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceType>("all");

  const classifyDomain = (domain: string): SourceType => {
    const lowerDomain = domain.toLowerCase();
    if (SOCIAL_DOMAINS.some((sd) => lowerDomain.includes(sd))) return "social";
    if (NEWS_DOMAINS.some((nd) => lowerDomain.includes(nd))) return "news";
    return "other";
  };

  const {
    influencers,
    topDomains,
    topDomainLabels,
    dailyTrends,
    totalMentions,
    uniqueSources,
    entities,
    rawMentions,
    isLoading,
  } = useInfluencersData(selectedProject?.id, daysRange, selectedEntityIds);

  // Filter influencers by source type
  const filteredInfluencers = sourceTypeFilter === "all"
    ? influencers
    : influencers.filter((inf) => classifyDomain(inf.domain) === sourceTypeFilter);

  const handleEntityToggle = (entityId: string) => {
    setSelectedEntityIds((prev) =>
      prev.includes(entityId)
        ? prev.filter((id) => id !== entityId)
        : [...prev, entityId]
    );
  };

  const maxMentions = filteredInfluencers[0]?.totalMentions || 0;
  const topInfluencers = filteredInfluencers.slice(0, 6);

  if (!selectedProject) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Sin proyecto seleccionado</CardTitle>
            <CardDescription>
              Selecciona un proyecto para ver el análisis de influenciadores
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Influenciadores</h1>
          <p className="text-muted-foreground">
            Fuentes con mayor impacto en las menciones de {selectedProject.nombre}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Entity filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Entidades
                {selectedEntityIds.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedEntityIds.length}
                  </Badge>
                )}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 bg-popover" align="end">
              <div className="space-y-2">
                <p className="text-sm font-medium">Filtrar por entidad</p>
                {entities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay entidades</p>
                ) : (
                  entities.map((entity) => (
                    <div key={entity.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={entity.id}
                        checked={selectedEntityIds.includes(entity.id)}
                        onCheckedChange={() => handleEntityToggle(entity.id)}
                      />
                      <label
                        htmlFor={entity.id}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {entity.nombre}
                      </label>
                    </div>
                  ))
                )}
                {selectedEntityIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setSelectedEntityIds([])}
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Source type filter */}
          <div className="flex rounded-lg border bg-muted p-1">
            {SOURCE_TYPE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={sourceTypeFilter === opt.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setSourceTypeFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border bg-muted p-1">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              <Table className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Date Range Selector */}
      <DateRangeSelector value={dateConfig} onChange={setDateConfig} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Menciones</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{totalMentions}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Últimos {daysRange} días
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fuentes Únicas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{uniqueSources}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Dominios identificados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fuente Principal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold truncate">
                {influencers[0]?.domain || "-"}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {influencers[0]?.totalMentions || 0} menciones
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active filters */}
      {selectedEntityIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrando por:</span>
          {selectedEntityIds.map((id) => {
            const entity = entities.find((e) => e.id === id);
            return entity ? (
              <Badge key={id} variant="secondary">
                {entity.nombre}
              </Badge>
            ) : null;
          })}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredInfluencers.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin datos de fuentes</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {sourceTypeFilter !== "all" 
                ? `No se encontraron fuentes de tipo "${SOURCE_TYPE_OPTIONS.find(o => o.value === sourceTypeFilter)?.label}" en el período seleccionado.`
                : "No se encontraron menciones con fuentes identificadas en el período seleccionado. Ejecuta el monitoreo para recopilar menciones."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Trend chart */}
          <InfluencerTrendChart data={dailyTrends} domains={topDomains} labels={topDomainLabels} />

          {/* Influencers display */}
          {viewMode === "cards" ? (
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Top Fuentes 
                {sourceTypeFilter !== "all" && (
                  <span className="text-muted-foreground font-normal ml-2">
                    ({SOURCE_TYPE_OPTIONS.find(o => o.value === sourceTypeFilter)?.label})
                  </span>
                )}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {topInfluencers.map((influencer, index) => (
                  <InfluencerCard
                    key={influencer.domain}
                    influencer={influencer}
                    rank={index + 1}
                    maxMentions={maxMentions}
                  />
                ))}
              </div>
              {filteredInfluencers.length > 6 && (
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={() => setViewMode("table")}>
                    Ver todas las fuentes ({filteredInfluencers.length})
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <InfluencerTable influencers={filteredInfluencers} maxMentions={maxMentions} mentions={rawMentions} />
          )}
        </>
      )}
    </div>
  );
};

export default InfluenciadoresPage;
