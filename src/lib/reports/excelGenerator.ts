import * as XLSX from "xlsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Mention } from "@/hooks/useMentions";
import type { InfluencerMetrics } from "@/hooks/useInfluencersData";
import type { TrendDataPoint, TrendsSummary } from "@/hooks/useTrendsData";
import type { SemanticAnalysisResult } from "@/hooks/useSemanticAnalysis";

interface ProjectInfo {
  nombre: string;
  descripcion?: string | null;
  tipo: string;
  objetivo: string;
}

interface ReportData {
  project: ProjectInfo;
  mentions: Mention[];
  influencers: InfluencerMetrics[];
  trends: {
    data: TrendDataPoint[];
    summary: TrendsSummary;
  };
  semanticAnalysis: SemanticAnalysisResult | null;
  generatedAt: Date;
  timeRange: string;
}

export function generateExcelReport(data: ReportData): void {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ["REPORTE DE MONITOREO"],
    [""],
    ["Proyecto", data.project.nombre],
    ["Descripción", data.project.descripcion || ""],
    ["Tipo", data.project.tipo],
    ["Objetivo", data.project.objetivo],
    [""],
    ["Período", data.timeRange],
    ["Fecha de Generación", format(data.generatedAt, "PPpp", { locale: es })],
    [""],
    ["RESUMEN DE MÉTRICAS"],
    ["Total de Menciones", data.mentions.length],
    ["Fuentes Únicas", data.influencers.length],
    ["Menciones Positivas", data.trends.summary.sentimentBreakdown.positivo],
    ["Menciones Neutrales", data.trends.summary.sentimentBreakdown.neutral],
    ["Menciones Negativas", data.trends.summary.sentimentBreakdown.negativo],
    ["Sin Analizar", data.trends.summary.sentimentBreakdown.sinAnalizar],
    ["Promedio Diario", data.trends.summary.avgPerDay],
    ["Cambio vs Día Anterior", `${data.trends.summary.changePercent}%`],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");

  // Sheet 2: All Mentions
  const mentionsHeaders = [
    "ID",
    "Título",
    "Descripción",
    "URL",
    "Fuente",
    "Entidad",
    "Tipo Entidad",
    "Sentimiento",
    "Relevancia",
    "Keywords",
    "Leído",
    "Archivado",
    "Fecha Creación",
    "Fecha Publicación",
  ];

  const mentionsRows = data.mentions.map((m) => [
    m.id,
    m.title || "",
    m.description || "",
    m.url,
    m.source_domain || "",
    m.entity?.nombre || "",
    m.entity?.tipo || "",
    m.sentiment || "",
    m.relevance_score || 0,
    (m.matched_keywords || []).join(", "),
    m.is_read ? "Sí" : "No",
    m.is_archived ? "Sí" : "No",
    format(new Date(m.created_at), "yyyy-MM-dd HH:mm:ss"),
    m.published_at ? format(new Date(m.published_at), "yyyy-MM-dd HH:mm:ss") : "",
  ]);

  const mentionsSheet = XLSX.utils.aoa_to_sheet([mentionsHeaders, ...mentionsRows]);
  mentionsSheet["!cols"] = [
    { wch: 36 }, // ID
    { wch: 50 }, // Título
    { wch: 60 }, // Descripción
    { wch: 50 }, // URL
    { wch: 25 }, // Fuente
    { wch: 20 }, // Entidad
    { wch: 15 }, // Tipo Entidad
    { wch: 12 }, // Sentimiento
    { wch: 10 }, // Relevancia
    { wch: 30 }, // Keywords
    { wch: 8 }, // Leído
    { wch: 10 }, // Archivado
    { wch: 20 }, // Fecha Creación
    { wch: 20 }, // Fecha Publicación
  ];
  XLSX.utils.book_append_sheet(workbook, mentionsSheet, "Menciones");

  // Sheet 3: Influencers
  const influencersHeaders = [
    "Dominio",
    "Total Menciones",
    "Positivas",
    "Neutrales",
    "Negativas",
    "Score Sentimiento",
    "Menciones Recientes (7d)",
    "Tendencia",
    "Top Keywords",
    "Entidades Mencionadas",
    "Última Mención",
  ];

  const influencersRows = data.influencers.map((inf) => [
    inf.domain,
    inf.totalMentions,
    inf.sentiment.positivo,
    inf.sentiment.neutral,
    inf.sentiment.negativo,
    (inf.sentimentScore * 100).toFixed(1) + "%",
    inf.recentMentions,
    inf.trend === "up" ? "Subiendo" : inf.trend === "down" ? "Bajando" : "Estable",
    inf.topKeywords.join(", "),
    inf.entities.join(", "),
    inf.lastMentionDate ? format(new Date(inf.lastMentionDate), "yyyy-MM-dd HH:mm:ss") : "",
  ]);

  const influencersSheet = XLSX.utils.aoa_to_sheet([influencersHeaders, ...influencersRows]);
  influencersSheet["!cols"] = [
    { wch: 30 }, // Dominio
    { wch: 15 }, // Total
    { wch: 12 }, // Positivas
    { wch: 12 }, // Neutrales
    { wch: 12 }, // Negativas
    { wch: 15 }, // Score
    { wch: 20 }, // Recientes
    { wch: 12 }, // Tendencia
    { wch: 30 }, // Keywords
    { wch: 30 }, // Entidades
    { wch: 20 }, // Última Mención
  ];
  XLSX.utils.book_append_sheet(workbook, influencersSheet, "Influenciadores");

  // Sheet 4: Trends
  const trendsHeaders = [
    "Fecha",
    "Total Menciones",
    "Positivas",
    "Neutrales",
    "Negativas",
    "Sin Analizar",
  ];

  const trendsRows = data.trends.data.map((t) => [
    format(t.fullDate, "yyyy-MM-dd"),
    t.menciones,
    t.positivo,
    t.neutral,
    t.negativo,
    t.sinAnalizar,
  ]);

  const trendsSheet = XLSX.utils.aoa_to_sheet([trendsHeaders, ...trendsRows]);
  trendsSheet["!cols"] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(workbook, trendsSheet, "Tendencias");

  // Sheet 5: Semantic Analysis (if available)
  if (data.semanticAnalysis) {
    // Topics sub-sheet
    const topicsHeaders = ["Tema", "Relevancia", "Menciones"];
    const topicsRows = data.semanticAnalysis.topics.map((t) => [
      t.name,
      `${Math.round(t.relevance * 100)}%`,
      t.mentionCount,
    ]);

    const topicsSheet = XLSX.utils.aoa_to_sheet([topicsHeaders, ...topicsRows]);
    topicsSheet["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, topicsSheet, "Temas");

    // Keywords sub-sheet
    const keywordsHeaders = ["Palabra", "Frecuencia", "Sentimiento"];
    const keywordsRows = data.semanticAnalysis.keywords.map((k) => [
      k.word,
      k.frequency,
      k.sentiment === "positivo" ? "Positivo" : k.sentiment === "negativo" ? "Negativo" : "Neutral",
    ]);

    const keywordsSheet = XLSX.utils.aoa_to_sheet([keywordsHeaders, ...keywordsRows]);
    keywordsSheet["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, keywordsSheet, "Palabras Clave");

    // Sentiment by mention
    const sentimentHeaders = ["ID Mención", "Sentimiento", "Confianza"];
    const sentimentRows = data.semanticAnalysis.mentionSentiments.map((ms) => [
      ms.id,
      ms.sentiment,
      `${ms.confidence}%`,
    ]);

    const sentimentSheet = XLSX.utils.aoa_to_sheet([sentimentHeaders, ...sentimentRows]);
    sentimentSheet["!cols"] = [{ wch: 36 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, sentimentSheet, "Sentimientos");

    // Summary
    const analysisSummary = [
      ["RESUMEN DEL ANÁLISIS SEMÁNTICO"],
      [""],
      ["Fecha de Análisis", format(data.semanticAnalysis.analyzedAt, "PPpp", { locale: es })],
      ["Menciones Analizadas", data.semanticAnalysis.mentionCount],
      [""],
      ["DISTRIBUCIÓN DE SENTIMIENTO"],
      ["Positivo", data.semanticAnalysis.sentimentDistribution.positivo],
      ["Neutral", data.semanticAnalysis.sentimentDistribution.neutral],
      ["Negativo", data.semanticAnalysis.sentimentDistribution.negativo],
      [""],
      ["RESUMEN EJECUTIVO"],
      [data.semanticAnalysis.summary],
    ];

    const analysisSummarySheet = XLSX.utils.aoa_to_sheet(analysisSummary);
    analysisSummarySheet["!cols"] = [{ wch: 30 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, analysisSummarySheet, "Análisis Resumen");
  }

  // Save the workbook
  const fileName = `reporte_${data.project.nombre.replace(/\s+/g, "_")}_${format(data.generatedAt, "yyyyMMdd_HHmm")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
