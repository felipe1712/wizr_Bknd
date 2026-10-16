import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ThumbsUp,
  ThumbsDown,
  Clock,
  Eye,
  Heart,
  MessageSquare,
  Share2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { InfluencerMetrics } from "@/hooks/useInfluencersData";

interface InfluencerCardProps {
  influencer: InfluencerMetrics;
  rank: number;
  maxMentions: number;
}

export function InfluencerCard({ influencer, rank, maxMentions }: InfluencerCardProps) {
  const {
    authorName,
    authorUsername,
    authorUrl,
    authorAvatarUrl,
    platform,
    totalMentions,
    sentiment,
    sentimentScore,
    recentMentions,
    trend,
    topKeywords,
    entities,
    lastMentionDate,
    totalEngagement,
    totalViews,
  } = influencer;

  const mentionPercentage = maxMentions > 0 
    ? (totalMentions / maxMentions) * 100 
    : 0;

  const TrendIcon = trend === "up" 
    ? TrendingUp 
    : trend === "down" 
    ? TrendingDown 
    : Minus;

  const trendColor = trend === "up" 
    ? "text-green-500" 
    : trend === "down" 
    ? "text-red-500" 
    : "text-muted-foreground";

  const getSentimentColor = (score: number) => {
    if (score > 0.2) return "text-green-500";
    if (score < -0.2) return "text-red-500";
    return "text-yellow-500";
  };

  const hasSentimentData = sentiment.positivo > 0 || sentiment.neutral > 0 || sentiment.negativo > 0;

  const initials = authorName.slice(0, 2).toUpperCase();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {authorAvatarUrl && <AvatarImage src={authorAvatarUrl} alt={authorName} />}
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                {authorUrl ? (
                  <a href={authorUrl} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-primary transition-colors">
                    {authorName}
                  </a>
                ) : (
                  <span className="font-semibold">{authorName}</span>
                )}
                <Badge variant="outline" className="text-xs">#{rank}</Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {authorUsername && (
                  <span className="text-xs text-muted-foreground">@{authorUsername}</span>
                )}
                <Badge variant="secondary" className="text-xs">{platform}</Badge>
              </div>
              {lastMentionDate && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(lastMentionDate), { addSuffix: true, locale: es })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendIcon className={`h-5 w-5 ${trendColor}`} />
            <Badge variant={trend === "up" ? "default" : trend === "down" ? "destructive" : "secondary"}>
              {trend === "up" ? "En alza" : trend === "down" ? "En baja" : "Estable"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mentions + Engagement */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Publicaciones</span>
            <span className="font-semibold">{totalMentions}</span>
          </div>
          <Progress value={mentionPercentage} className="h-2" />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-muted-foreground">
              {recentMentions} en los últimos 7 días
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {totalEngagement > 0 && (
                <span className="flex items-center gap-0.5">
                  <Heart className="h-3 w-3" /> {totalEngagement.toLocaleString()}
                </span>
              )}
              {totalViews > 0 && (
                <span className="flex items-center gap-0.5">
                  <Eye className="h-3 w-3" /> {totalViews.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sentiment */}
        {hasSentimentData ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-2">
                <ThumbsUp className="h-4 w-4 mx-auto text-green-500 mb-1" />
                <p className="text-lg font-bold text-green-600">{sentiment.positivo}</p>
                <p className="text-xs text-muted-foreground">Positivo</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/30 p-2">
                <Minus className="h-4 w-4 mx-auto text-gray-500 mb-1" />
                <p className="text-lg font-bold text-gray-600">{sentiment.neutral}</p>
                <p className="text-xs text-muted-foreground">Neutral</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-2">
                <ThumbsDown className="h-4 w-4 mx-auto text-red-500 mb-1" />
                <p className="text-lg font-bold text-red-600">{sentiment.negativo}</p>
                <p className="text-xs text-muted-foreground">Negativo</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Score de sentimiento</span>
              <span className={`font-semibold ${getSentimentColor(sentimentScore)}`}>
                {sentimentScore > 0 ? "+" : ""}{(sentimentScore * 100).toFixed(0)}%
              </span>
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-sm text-muted-foreground">Sentimiento pendiente de análisis</p>
          </div>
        )}

        {/* Entities */}
        {entities.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Entidades mencionadas</p>
            <div className="flex flex-wrap gap-1">
              {entities.slice(0, 3).map((entity) => (
                <Badge key={entity} variant="outline" className="text-xs">{entity}</Badge>
              ))}
              {entities.length > 3 && (
                <Badge variant="outline" className="text-xs">+{entities.length - 3}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Keywords */}
        {topKeywords.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Palabras clave</p>
            <div className="flex flex-wrap gap-1">
              {topKeywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="text-xs">{keyword}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}