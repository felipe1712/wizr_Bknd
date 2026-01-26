import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/contexts/ProjectContext";
import { useNavigate } from "react-router-dom";
import { useDateRangeFilter } from "@/hooks/useDateRangeFilter";
import { DateRangeSelector } from "@/components/reports/DateRangeSelector";
import { useMentions } from "@/hooks/useMentions";
import { useSemanticAnalysis } from "@/hooks/useSemanticAnalysis";
import { AnalysisResults } from "@/components/semantica/AnalysisResults";
import {
  MessageSquareText,
  AlertCircle,
  Plus,
  Brain,
  FileSearch,
  Sparkles,
} from "lucide-react";

const SemanticaPage = () => {
  const { selectedProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const { dateConfig, setDateConfig, startDate, endDate } = useDateRangeFilter("30d");

  const { mentions, isLoading: mentionsLoading } = useMentions(
    selectedProject?.id,
    { isArchived: false, startDate, endDate }
  );

  const {
    analyze,
    isAnalyzing,
    result,
    updateMentionsSentiment,
    isUpdatingSentiments,
  } = useSemanticAnalysis(selectedProject?.id);

  const handleAnalyze = () => {
    if (mentions.length > 0) {
      analyze(mentions);
    }
  };

  const handleSaveSentiments = () => {
    if (result?.mentionSentiments) {
      updateMentionsSentiment(result.mentionSentiments);
    }
  };

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
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
          Crea o selecciona un proyecto para ver el análisis semántico
        </p>
        <Button className="mt-4" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Proyecto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquareText className="h-7 w-7" />
          Semántica
        </h1>
        <p className="text-muted-foreground">
          Análisis de sentimiento, temas y contexto —{" "}
          <span className="font-medium">{selectedProject.nombre}</span>
        </p>
      </div>

      {/* Date Range Selector */}
      <DateRangeSelector value={dateConfig} onChange={setDateConfig} />

      {/* Stats Bar */}
      <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Menciones disponibles:</span>
          <Badge variant="secondary">{mentions.length}</Badge>
        </div>
        {result && (
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Último análisis:</span>
            <Badge variant="outline">{result.mentionCount} menciones</Badge>
          </div>
        )}
      </div>

      {/* Main Content */}
      {mentionsLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : mentions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-4">
              <FileSearch className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Sin menciones guardadas</h3>
            <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
              Para realizar un análisis semántico, primero necesitas buscar y guardar
              menciones desde la sección de Fuentes.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => navigate("/fuentes")}
            >
              Ir a Fuentes
            </Button>
          </CardContent>
        </Card>
      ) : !result ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Iniciar Análisis Semántico
            </CardTitle>
            <CardDescription>
              Utiliza IA para extraer temas principales, palabras clave y sentimiento
              de {mentions.length} menciones guardadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="font-medium mb-2">El análisis incluye:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Identificación de hasta 8 temas principales</li>
                <li>• Extracción de palabras clave con frecuencia</li>
                <li>• Clasificación de sentimiento (positivo, neutral, negativo)</li>
                <li>• Resumen ejecutivo automático</li>
                <li>• Análisis individual por mención</li>
              </ul>
            </div>
            <Button
              size="lg"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Brain className="mr-2 h-5 w-5 animate-pulse" />
                  Analizando con IA...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Analizar {mentions.length} menciones
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AnalysisResults
          result={result}
          mentions={mentions}
          onSaveSentiments={handleSaveSentiments}
          isSaving={isUpdatingSentiments}
          onReanalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
        />
      )}
    </div>
  );
};

export default SemanticaPage;
