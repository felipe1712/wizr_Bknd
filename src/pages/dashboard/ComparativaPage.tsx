import { useState } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useNavigate } from "react-router-dom";
import { useComparativeData } from "@/hooks/useComparativeData";
import { ShareOfVoiceChart } from "@/components/comparativa/ShareOfVoiceChart";
import { SentimentComparisonChart } from "@/components/comparativa/SentimentComparisonChart";
import { TrendComparisonChart } from "@/components/comparativa/TrendComparisonChart";
import { EntityMetricsTable } from "@/components/comparativa/EntityMetricsTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  GitCompare,
  Plus,
  Users,
  Building2,
  Briefcase,
  ChevronDown,
  BarChart3,
  AlertCircle,
} from "lucide-react";

const typeIcons: Record<string, React.ElementType> = {
  persona: Users,
  marca: Briefcase,
  institucion: Building2,
};

const timeRangeOptions = [
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
];

const ComparativaPage = () => {
  const { selectedProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [daysRange, setDaysRange] = useState(30);

  const { entities, comparativeData, isLoading } = useComparativeData(
    selectedProject?.id,
    selectedEntityIds,
    daysRange
  );

  const loading = projectLoading || isLoading;

  const handleEntityToggle = (entityId: string, checked: boolean) => {
    if (checked) {
      setSelectedEntityIds((prev) => [...prev, entityId]);
    } else {
      setSelectedEntityIds((prev) => prev.filter((id) => id !== entityId));
    }
  };

  const handleSelectAll = () => {
    if (selectedEntityIds.length === entities.length) {
      setSelectedEntityIds([]);
    } else {
      setSelectedEntityIds(entities.map((e) => e.id));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
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
          Crea o selecciona un proyecto para ver la comparativa de entidades
        </p>
        <Button className="mt-4" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Proyecto
        </Button>
      </div>
    );
  }

  // Show message when only 1 entity
  if (entities.length === 1) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitCompare className="h-7 w-7" />
            Comparativa
          </h1>
          <p className="text-muted-foreground">
            Benchmark y share of voice —{" "}
            <span className="font-medium">{selectedProject.nombre}</span>
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4">
              <BarChart3 className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Una sola entidad</h3>
            <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
              La comparativa requiere al menos dos entidades para visualizar el
              benchmark y share of voice. Actualmente solo tienes: <strong>{entities[0].nombre}</strong>
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate("/dashboard/fuentes")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar más entidades
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitCompare className="h-7 w-7" />
            Comparativa
          </h1>
          <p className="text-muted-foreground">
            Benchmark y share of voice —{" "}
            <span className="font-medium">{selectedProject.nombre}</span>
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4">
              <BarChart3 className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Sin entidades</h3>
            <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
              Agrega entidades al proyecto para comparar su rendimiento, share
              of voice y tendencias.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate("/dashboard/fuentes")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar Entidades
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedEntities = entities.filter((e) =>
    selectedEntityIds.includes(e.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitCompare className="h-7 w-7" />
            Comparativa
          </h1>
          <p className="text-muted-foreground">
            Benchmark y share of voice —{" "}
            <span className="font-medium">{selectedProject.nombre}</span>
          </p>
        </div>

        <div className="flex gap-2">
          {/* Entity Selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[200px] justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {selectedEntityIds.length === 0
                    ? "Todas las entidades"
                    : `${selectedEntityIds.length} seleccionadas`}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0 bg-popover" align="end">
              <div className="p-3 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={handleSelectAll}
                >
                  {selectedEntityIds.length === entities.length
                    ? "Deseleccionar todas"
                    : "Seleccionar todas"}
                </Button>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-2">
                {entities.map((entity) => {
                  const Icon = typeIcons[entity.tipo] || Users;
                  return (
                    <label
                      key={entity.id}
                      className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedEntityIds.includes(entity.id)}
                        onCheckedChange={(checked) =>
                          handleEntityToggle(entity.id, checked as boolean)
                        }
                      />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm">
                        {entity.nombre}
                      </span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Time Range */}
          <Select
            value={String(daysRange)}
            onValueChange={(v) => setDaysRange(Number(v))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {timeRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selected Entities Pills */}
      {selectedEntities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedEntities.map((entity) => {
            const Icon = typeIcons[entity.tipo] || Users;
            return (
              <Badge
                key={entity.id}
                variant="secondary"
                className="flex items-center gap-1 py-1"
              >
                <Icon className="h-3 w-3" />
                {entity.nombre}
                <button
                  onClick={() => handleEntityToggle(entity.id, false)}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Charts Grid */}
      {comparativeData && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Share of Voice */}
          <ShareOfVoiceChart data={comparativeData.shareOfVoice} />

          {/* Sentiment Comparison */}
          <SentimentComparisonChart data={comparativeData.sentimentComparison} />

          {/* Trend Comparison */}
          <TrendComparisonChart
            data={comparativeData.trendComparison}
            entityNames={comparativeData.entities.map((e) => e.entityName)}
          />

          {/* Metrics Table */}
          <div className="col-span-full">
            <EntityMetricsTable entities={comparativeData.entities} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparativaPage;
