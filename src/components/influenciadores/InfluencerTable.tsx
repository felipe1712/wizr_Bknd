import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { InfluencerMetrics } from "@/hooks/useInfluencersData";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface InfluencerTableProps {
  influencers: InfluencerMetrics[];
  maxMentions: number;
}

export function InfluencerTable({ influencers, maxMentions }: InfluencerTableProps) {
  if (influencers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Fuentes</CardTitle>
          <CardDescription>Tabla detallada de todas las fuentes</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground">No hay datos de fuentes disponibles</p>
        </CardContent>
      </Card>
    );
  }

  const getSentimentColor = (score: number) => {
    if (score > 0.2) return "text-green-500";
    if (score < -0.2) return "text-red-500";
    return "text-yellow-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking de Fuentes</CardTitle>
        <CardDescription>
          {influencers.length} fuentes identificadas ordenadas por impacto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Fuente</TableHead>
              <TableHead className="text-center">Menciones</TableHead>
              <TableHead className="text-center">Sentimiento</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead className="text-center">Tendencia</TableHead>
              <TableHead>Última Mención</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {influencers.map((influencer, index) => {
              const TrendIcon = influencer.trend === "up"
                ? TrendingUp
                : influencer.trend === "down"
                ? TrendingDown
                : Minus;

              const trendColor = influencer.trend === "up"
                ? "text-green-500"
                : influencer.trend === "down"
                ? "text-red-500"
                : "text-muted-foreground";

              const mentionPercentage = maxMentions > 0
                ? (influencer.totalMentions / maxMentions) * 100
                : 0;

              return (
                <TableRow key={influencer.domain}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{influencer.domain}</div>
                    {influencer.entities.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {influencer.entities.slice(0, 2).map((e) => (
                          <Badge key={e} variant="outline" className="text-xs">
                            {e}
                          </Badge>
                        ))}
                        {influencer.entities.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{influencer.entities.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{influencer.totalMentions}</span>
                        <span className="text-muted-foreground text-xs">
                          ({influencer.recentMentions} recientes)
                        </span>
                      </div>
                      <Progress value={mentionPercentage} className="h-1.5" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-2 text-xs">
                      <span className="text-green-500">{influencer.sentiment.positivo}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-gray-500">{influencer.sentiment.neutral}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-500">{influencer.sentiment.negativo}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-semibold ${getSentimentColor(influencer.sentimentScore)}`}>
                      {influencer.sentimentScore > 0 ? "+" : ""}
                      {(influencer.sentimentScore * 100).toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                      <span className="text-xs capitalize">{
                        influencer.trend === "up" ? "Alza" : 
                        influencer.trend === "down" ? "Baja" : 
                        "Estable"
                      }</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {influencer.lastMentionDate
                      ? formatDistanceToNow(new Date(influencer.lastMentionDate), {
                          addSuffix: true,
                          locale: es,
                        })
                      : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
