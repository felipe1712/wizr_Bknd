import { useState, useRef, useCallback, useMemo } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useReportData } from "@/hooks/useReportData";
import { useSemanticAnalysis, SemanticAnalysisResult } from "@/hooks/useSemanticAnalysis";
import { useMentions } from "@/hooks/useMentions";
import { generatePDFReport, ChartImages } from "@/lib/reports/pdfGenerator";
import { generateExcelReport } from "@/lib/reports/excelGenerator";
import { ChartRenderer, ChartRendererHandle } from "@/components/reports/ChartRenderer";
import { DateRangeSelector, DateRangeConfig, calculateDateRange } from "@/components/reports/DateRangeSelector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  TrendingUp,
  Users,
  MessageSquare,
  Brain,
  CheckCircle2,
  AlertCircle,
  BarChart3,
} from "lucide-react";

const ReportesPage = () => {
  const { selectedProject } = useProject();
  const [dateConfig, setDateConfig] = useState<DateRangeConfig>({
    type: "30d",
    cutoffHour: 8,
  });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [semanticResult, setSemanticResult] = useState<SemanticAnalysisResult | null>(null);
  const [showChartRenderer, setShowChartRenderer] = useState(false);

  const chartRendererRef = useRef<ChartRendererHandle>(null);

  const dateRange = useMemo(() => calculateDateRange(dateConfig), [dateConfig]);

  const { mentions } = useMentions(selectedProject?.id, { isArchived: false });
  const { analyze, isAnalyzing, result: latestSemanticResult } = useSemanticAnalysis(selectedProject?.id);
  const { reportData, isLoading, error } = useReportData(
    selectedProject?.id,
    dateRange,
    semanticResult || latestSemanticResult
  );

  // Prepare chart data
  const sentimentData = reportData ? [
    { name: "Positivo", value: reportData.trends.summary.sentimentBreakdown.positivo, color: "#22c55e" },
    { name: "Neutral", value: reportData.trends.summary.sentimentBreakdown.neutral, color: "#6b7280" },
    { name: "Negativo", value: reportData.trends.summary.sentimentBreakdown.negativo, color: "#ef4444" },
  ].filter(d => d.value > 0) : [];

  const trendsData = reportData?.trends.data.slice(-14).map(t => ({
    date: t.date,
    menciones: t.menciones,
    positivo: t.positivo,
    neutral: t.neutral,
    negativo: t.negativo,
  })) || [];

  const sourcesData = reportData?.influencers.slice(0, 8).map(inf => ({
    domain: inf.domain.length > 20 ? inf.domain.substring(0, 20) + "..." : inf.domain,
    mentions: inf.totalMentions,
    sentiment: inf.sentimentScore,
  })) || [];

  const handleGeneratePDF = useCallback(async () => {
    if (!reportData) return;

    setIsGeneratingPDF(true);
    setShowChartRenderer(true);

    // Wait for charts to render
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      let chartImages: ChartImages = {};

      if (chartRendererRef.current) {
        const [sentimentChart, trendsChart, sourcesChart] = await Promise.all([
          chartRendererRef.current.captureSentimentChart(),
          chartRendererRef.current.captureTrendsChart(),
          chartRendererRef.current.captureSourcesChart(),
        ]);

        chartImages = { sentimentChart, trendsChart, sourcesChart };
      }

      await generatePDFReport(reportData, chartImages);
    } catch (err) {
      console.error("Error generating PDF:", err);
    } finally {
      setIsGeneratingPDF(false);
      setShowChartRenderer(false);
    }
  }, [reportData]);

  const handleGenerateExcel = async () => {
    if (!reportData) return;

    setIsGeneratingExcel(true);
    try {
      generateExcelReport(reportData);
    } catch (err) {
      console.error("Error generating Excel:", err);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const handleRunSemanticAnalysis = () => {
    if (mentions.length > 0) {
      analyze(mentions, {
        onSuccess: (result) => setSemanticResult(result),
      });
    }
  };

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <FileBarChart className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Reportes</h2>
        <p className="text-muted-foreground max-w-md">
          Selecciona un proyecto para generar reportes con datos de menciones, tendencias,
          influenciadores y análisis semántico.
        </p>
      </div>
    );
  }

  const hasSemanticData = !!(semanticResult || latestSemanticResult);
  const currentSemanticData = semanticResult || latestSemanticResult;

  return (
    <div className="space-y-6">
      {/* Hidden Chart Renderer for PDF generation */}
      {showChartRenderer && (
        <ChartRenderer
          ref={chartRendererRef}
          sentimentData={sentimentData}
          trendsData={trendsData}
          sourcesData={sourcesData}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">
            Genera y exporta informes completos del proyecto {selectedProject.nombre}
          </p>
        </div>

        <DateRangeSelector value={dateConfig} onChange={setDateConfig} />
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error al cargar los datos: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Report Data Summary */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reportData && (
        <>
          {/* Data Overview Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  Menciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.mentions.length}</div>
                <p className="text-xs text-muted-foreground">
                  {reportData.trends.summary.avgPerDay} promedio/día
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-500" />
                  Fuentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.influencers.length}</div>
                <p className="text-xs text-muted-foreground">
                  dominios únicos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  Tendencia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {reportData.trends.summary.changePercent >= 0 ? "+" : ""}
                  {reportData.trends.summary.changePercent}%
                </div>
                <p className="text-xs text-muted-foreground">
                  vs día anterior
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-500" />
                  Análisis Semántico
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasSemanticData ? (
                  <>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Disponible</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {currentSemanticData?.mentionCount} menciones analizadas
                    </p>
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className="mb-1">No disponible</Badge>
                    <p className="text-xs text-muted-foreground">
                      Ejecuta el análisis para incluirlo
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Semantic Analysis Section */}
          {!hasSemanticData && mentions.length > 0 && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Análisis Semántico
                </CardTitle>
                <CardDescription>
                  Ejecuta un análisis semántico para incluir temas, palabras clave y distribución de
                  sentimientos en tus reportes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleRunSemanticAnalysis}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Ejecutar Análisis ({mentions.length} menciones)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Export Options */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* PDF Export Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-red-500" />
                  Reporte PDF
                </CardTitle>
                <CardDescription>
                  Documento visual formateado con gráficos y tablas para presentaciones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Portada con métricas clave</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Gráficos visuales embebidos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Top fuentes e influenciadores</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Evolución temporal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasSemanticData ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={!hasSemanticData ? "text-muted-foreground" : ""}>
                      Análisis semántico {!hasSemanticData && "(pendiente)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Menciones recientes</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={handleGeneratePDF}
                  disabled={isGeneratingPDF || !reportData}
                >
                  {isGeneratingPDF ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando gráficos...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar PDF con Gráficos
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Excel Export Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  Reporte Excel
                </CardTitle>
                <CardDescription>
                  Datos completos en hojas de cálculo para análisis detallado y auditoría
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Hoja: Resumen del proyecto</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Hoja: Todas las menciones (detalle completo)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Hoja: Influenciadores y fuentes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Hoja: Tendencias diarias</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasSemanticData ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={!hasSemanticData ? "text-muted-foreground" : ""}>
                      Hojas: Temas, palabras clave, sentimientos {!hasSemanticData && "(pendiente)"}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleGenerateExcel}
                  disabled={isGeneratingExcel || !reportData}
                >
                  {isGeneratingExcel ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar Excel
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Data Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Vista Previa de Datos</CardTitle>
              <CardDescription>
                Resumen de lo que se incluirá en los reportes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Distribución de Sentimiento</p>
                  <div className="flex gap-2 text-sm">
                    <Badge variant="default" className="bg-green-600">
                      Positivo: {reportData.trends.summary.sentimentBreakdown.positivo}
                    </Badge>
                    <Badge variant="secondary">
                      Neutral: {reportData.trends.summary.sentimentBreakdown.neutral}
                    </Badge>
                    <Badge variant="destructive">
                      Negativo: {reportData.trends.summary.sentimentBreakdown.negativo}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">Top 3 Fuentes</p>
                  <div className="flex flex-wrap gap-1">
                    {reportData.influencers.slice(0, 3).map((inf) => (
                      <Badge key={inf.domain} variant="outline">
                        {inf.domain} ({inf.totalMentions})
                      </Badge>
                    ))}
                  </div>
                </div>

                {hasSemanticData && currentSemanticData && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Top Temas</p>
                    <div className="flex flex-wrap gap-1">
                      {currentSemanticData.topics.slice(0, 3).map((t) => (
                        <Badge key={t.name} variant="outline">
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ReportesPage;
