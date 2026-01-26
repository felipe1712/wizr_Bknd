import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface EntityMetrics {
  entityId: string;
  entityName: string;
  entityType: string;
  totalMentions: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  sources: { domain: string; count: number }[];
}

interface EntityMetricsTableProps {
  entities: EntityMetrics[];
}

const typeLabels: Record<string, string> = {
  persona: "Persona",
  marca: "Marca",
  institucion: "Institución",
};

export function EntityMetricsTable({ entities }: EntityMetricsTableProps) {
  if (entities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Métricas por Entidad</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Selecciona entidades para comparar
          </p>
        </CardContent>
      </Card>
    );
  }

  const getSentimentIcon = (entity: EntityMetrics) => {
    const { positive, negative } = entity.sentimentBreakdown;
    if (positive > negative) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (negative > positive) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getSentimentScore = (entity: EntityMetrics) => {
    const total =
      entity.sentimentBreakdown.positive +
      entity.sentimentBreakdown.neutral +
      entity.sentimentBreakdown.negative;
    if (total === 0) return 0;
    return Math.round(
      ((entity.sentimentBreakdown.positive - entity.sentimentBreakdown.negative) /
        total) *
        100
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Métricas por Entidad</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entidad</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-center">Menciones</TableHead>
              <TableHead className="text-center">Sentimiento</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead>Top Fuentes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entities.map((entity) => (
              <TableRow key={entity.entityId}>
                <TableCell className="font-medium">
                  {entity.entityName}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {typeLabels[entity.entityType] || entity.entityType}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-semibold">
                  {entity.totalMentions}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center gap-2 text-xs">
                    <span className="text-green-600">
                      +{entity.sentimentBreakdown.positive}
                    </span>
                    <span className="text-muted-foreground">
                      {entity.sentimentBreakdown.neutral}
                    </span>
                    <span className="text-red-600">
                      -{entity.sentimentBreakdown.negative}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    {getSentimentIcon(entity)}
                    <span
                      className={`text-sm font-medium ${
                        getSentimentScore(entity) > 0
                          ? "text-green-600"
                          : getSentimentScore(entity) < 0
                          ? "text-red-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {getSentimentScore(entity)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {entity.sources.slice(0, 3).map((source) => (
                      <Badge
                        key={source.domain}
                        variant="secondary"
                        className="text-xs"
                      >
                        {source.domain} ({source.count})
                      </Badge>
                    ))}
                    {entity.sources.length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
