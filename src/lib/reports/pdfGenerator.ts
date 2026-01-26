import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

export interface ChartImages {
  sentimentChart?: string | null;
  trendsChart?: string | null;
  sourcesChart?: string | null;
}

export async function generatePDFReport(
  data: ReportData,
  chartImages?: ChartImages
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Helper function to add page if needed
  const checkPageBreak = (requiredSpace: number = 30) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Helper function to add image with proper sizing
  const addChartImage = (imageData: string, width: number, height: number) => {
    checkPageBreak(height + 10);
    const xPos = (pageWidth - width) / 2;
    doc.addImage(imageData, "PNG", xPos, yPos, width, height);
    yPos += height + 10;
  };

  // ===== TITLE PAGE =====
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(59, 130, 246);
  doc.text("Reporte de Monitoreo", pageWidth / 2, 60, { align: "center" });

  doc.setFontSize(20);
  doc.setTextColor(31, 41, 55);
  doc.text(data.project.nombre, pageWidth / 2, 80, { align: "center" });

  // Project description
  if (data.project.descripcion) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    const descLines = doc.splitTextToSize(data.project.descripcion, pageWidth - 60);
    doc.text(descLines, pageWidth / 2, 95, { align: "center" });
  }

  // Metadata box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(40, 120, pageWidth - 80, 40, 3, 3, "F");

  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text(`Período: ${data.timeRange}`, pageWidth / 2, 135, { align: "center" });
  doc.text(
    `Generado: ${format(data.generatedAt, "PPPp", { locale: es })}`,
    pageWidth / 2,
    148,
    { align: "center" }
  );

  // Key metrics on title page
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55);
  doc.text("Métricas Clave", pageWidth / 2, 180, { align: "center" });

  const metricsY = 195;
  const metricsSpacing = 45;
  const metrics = [
    { label: "Menciones", value: String(data.mentions.length) },
    { label: "Fuentes", value: String(data.influencers.length) },
    { label: "Positivas", value: String(data.trends.summary.sentimentBreakdown.positivo) },
    { label: "Negativas", value: String(data.trends.summary.sentimentBreakdown.negativo) },
  ];

  const startX = (pageWidth - (metrics.length - 1) * metricsSpacing) / 2;

  metrics.forEach((m, i) => {
    const x = startX + i * metricsSpacing;
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(59, 130, 246);
    doc.text(m.value, x, metricsY, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(m.label, x, metricsY + 8, { align: "center" });
  });

  // ===== VISUALIZATIONS PAGE =====
  doc.addPage();
  yPos = 20;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55);
  doc.text("Visualizaciones", 20, yPos);
  yPos += 15;

  // Sentiment Chart
  if (chartImages?.sentimentChart) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Distribución de Sentimiento", 20, yPos);
    yPos += 5;
    addChartImage(chartImages.sentimentChart, 100, 75);
  }

  // Trends Chart
  if (chartImages?.trendsChart) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Evolución Temporal", 20, yPos);
    yPos += 5;
    addChartImage(chartImages.trendsChart, 170, 80);
  }

  // Sources Chart
  if (chartImages?.sourcesChart) {
    checkPageBreak(100);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Top Fuentes", 20, yPos);
    yPos += 5;
    addChartImage(chartImages.sourcesChart, 150, 85);
  }

  // ===== DATA TABLES PAGE =====
  doc.addPage();
  yPos = 20;

  // Reset text color
  doc.setTextColor(0);

  // Section 1: Executive Summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("1. Resumen Ejecutivo", 20, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const summaryData = [
    ["Total de Menciones", String(data.mentions.length)],
    ["Fuentes Únicas", String(data.influencers.length)],
    ["Menciones Positivas", String(data.trends.summary.sentimentBreakdown.positivo)],
    ["Menciones Neutrales", String(data.trends.summary.sentimentBreakdown.neutral)],
    ["Menciones Negativas", String(data.trends.summary.sentimentBreakdown.negativo)],
    ["Sin Analizar", String(data.trends.summary.sentimentBreakdown.sinAnalizar)],
    ["Promedio Diario", String(data.trends.summary.avgPerDay)],
    ["Cambio vs Anterior", `${data.trends.summary.changePercent >= 0 ? "+" : ""}${data.trends.summary.changePercent}%`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [["Métrica", "Valor"]],
    body: summaryData,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Section 2: Semantic Analysis (if available)
  if (data.semanticAnalysis) {
    checkPageBreak(60);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("2. Análisis Semántico", 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Summary
    const summaryLines = doc.splitTextToSize(data.semanticAnalysis.summary, pageWidth - 40);
    doc.text(summaryLines, 20, yPos);
    yPos += summaryLines.length * 5 + 8;

    checkPageBreak(50);

    // Topics
    doc.setFont("helvetica", "bold");
    doc.text("Temas Principales:", 20, yPos);
    yPos += 6;

    const topicsData = data.semanticAnalysis.topics.slice(0, 10).map((t) => [
      t.name,
      `${Math.round(t.relevance * 100)}%`,
      String(t.mentionCount),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Tema", "Relevancia", "Menciones"]],
      body: topicsData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    checkPageBreak(50);

    // Keywords
    doc.setFont("helvetica", "bold");
    doc.text("Palabras Clave:", 20, yPos);
    yPos += 6;

    const keywordsData = data.semanticAnalysis.keywords.slice(0, 15).map((k) => [
      k.word,
      String(k.frequency),
      k.sentiment === "positivo" ? "Positivo" : k.sentiment === "negativo" ? "Negativo" : "Neutral",
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Palabra", "Frecuencia", "Sentimiento"]],
      body: keywordsData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 20, right: 20 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Section 3: Top Influencers
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const sectionNum = data.semanticAnalysis ? 3 : 2;
  doc.text(`${sectionNum}. Principales Fuentes`, 20, yPos);
  yPos += 8;

  const influencerData = data.influencers.slice(0, 15).map((inf) => [
    inf.domain,
    String(inf.totalMentions),
    `${inf.sentiment.positivo}/${inf.sentiment.neutral}/${inf.sentiment.negativo}`,
    `${(inf.sentimentScore * 100).toFixed(0)}%`,
    inf.trend === "up" ? "↑ Subiendo" : inf.trend === "down" ? "↓ Bajando" : "→ Estable",
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Fuente", "Menciones", "Pos/Neu/Neg", "Score", "Tendencia"]],
    body: influencerData,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Section 4: Trends Summary
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`${sectionNum + 1}. Evolución Temporal (Datos)`, 20, yPos);
  yPos += 8;

  const trendsTableData = data.trends.data.slice(-14).map((t) => [
    t.date,
    String(t.menciones),
    String(t.positivo),
    String(t.neutral),
    String(t.negativo),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Fecha", "Total", "Positivo", "Neutral", "Negativo"]],
    body: trendsTableData,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Section 5: Recent Mentions
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`${sectionNum + 2}. Menciones Recientes`, 20, yPos);
  yPos += 8;

  const mentionsTableData = data.mentions.slice(0, 25).map((m) => [
    m.title?.substring(0, 40) || "Sin título",
    m.source_domain || "Desconocido",
    m.sentiment || "—",
    format(new Date(m.created_at), "dd/MM/yy"),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Título", "Fuente", "Sentimiento", "Fecha"]],
    body: mentionsTableData,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 },
    columnStyles: {
      0: { cellWidth: 80 },
    },
  });

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} | ${data.project.nombre} | Generado con Wizr`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  const fileName = `reporte_${data.project.nombre.replace(/\s+/g, "_")}_${format(data.generatedAt, "yyyyMMdd_HHmm")}.pdf`;
  doc.save(fileName);
}
