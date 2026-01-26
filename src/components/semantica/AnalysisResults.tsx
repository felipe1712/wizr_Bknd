import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Save, TrendingUp, Hash, PieChart, FileText } from "lucide-react";
import { TopicsCloud } from "./TopicsCloud";
import { KeywordsChart } from "./KeywordsChart";
import { SentimentPieChart } from "./SentimentPieChart";
import type { SemanticAnalysisResult } from "@/hooks/useSemanticAnalysis";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface AnalysisResultsProps {
  result: SemanticAnalysisResult;
  onSaveSentiments: () => void;
  isSaving: boolean;
  onReanalyze: () => void;
  isAnalyzing: boolean;
}

export function AnalysisResults({
  result,
  onSaveSentiments,
  isSaving,
  onReanalyze,
  isAnalyzing,
}: AnalysisResultsProps) {
  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Analizado: {format(result.analyzedAt, "PPp", { locale: es })} •{" "}
            {result.mentionCount} menciones
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveSentiments}
            disabled={isSaving || result.mentionSentiments.length === 0}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Guardando..." : "Guardar sentimientos"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReanalyze}
            disabled={isAnalyzing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isAnalyzing ? "animate-spin" : ""}`} />
            Re-analizar
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Resumen Ejecutivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">{result.summary}</p>
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Topics Cloud */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Temas Principales
            </CardTitle>
            <CardDescription>
              Los temas más relevantes detectados en las menciones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopicsCloud topics={result.topics} />
          </CardContent>
        </Card>

        {/* Sentiment Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChart className="h-5 w-5" />
              Distribución de Sentimiento
            </CardTitle>
            <CardDescription>
              Proporción de menciones por tipo de sentimiento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SentimentPieChart distribution={result.sentimentDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Keywords Chart - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Hash className="h-5 w-5" />
            Palabras Clave
          </CardTitle>
          <CardDescription>
            Términos más frecuentes coloreados por sentimiento asociado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KeywordsChart keywords={result.keywords} />
          <Separator className="my-4" />
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-green-600" />
              <span>Positivo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-blue-600" />
              <span>Neutral</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span>Negativo</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Sentiments Preview */}
      {result.mentionSentiments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sentimientos Individuales</CardTitle>
            <CardDescription>
              Análisis de sentimiento por mención (primeras 10)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {result.mentionSentiments.slice(0, 10).map((ms, i) => (
                <Badge
                  key={ms.id}
                  variant={
                    ms.sentiment === "positivo"
                      ? "default"
                      : ms.sentiment === "negativo"
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-xs"
                >
                  #{i + 1}: {ms.sentiment} ({ms.confidence}%)
                </Badge>
              ))}
              {result.mentionSentiments.length > 10 && (
                <Badge variant="outline">
                  +{result.mentionSentiments.length - 10} más
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
