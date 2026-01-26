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

export async function generatePDFReport(data: ReportData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Helper function to add page if needed
  const checkPageBreak = (requiredSpace: number = 30) => {
    if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Title
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Reporte de Monitoreo", pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  // Project name
  doc.setFontSize(16);
  doc.text(data.project.nombre, pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  // Generation info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(
    `Generado: ${format(data.generatedAt, "PPpp", { locale: es })} | Período: ${data.timeRange}`,
    pageWidth / 2,
    yPos,
    { align: "center" }
  );
  yPos += 15;

  // Separator
  doc.setDrawColor(200);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 10;

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
    ["Promedio Diario", String(data.trends.summary.avgPerDay)],
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
    yPos += summaryLines.length * 5 + 5;

    checkPageBreak(40);

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

    checkPageBreak(40);

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
  doc.text(data.semanticAnalysis ? "3. Principales Fuentes" : "2. Principales Fuentes", 20, yPos);
  yPos += 8;

  const influencerData = data.influencers.slice(0, 15).map((inf) => [
    inf.domain,
    String(inf.totalMentions),
    `${inf.sentiment.positivo}/${inf.sentiment.neutral}/${inf.sentiment.negativo}`,
    `${(inf.sentimentScore * 100).toFixed(0)}%`,
    inf.trend === "up" ? "↑" : inf.trend === "down" ? "↓" : "→",
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
  doc.text(data.semanticAnalysis ? "4. Evolución Temporal" : "3. Evolución Temporal", 20, yPos);
  yPos += 8;

  const trendsData = data.trends.data.slice(-14).map((t) => [
    t.date,
    String(t.menciones),
    String(t.positivo),
    String(t.neutral),
    String(t.negativo),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Fecha", "Total", "Positivo", "Neutral", "Negativo"]],
    body: trendsData,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Section 5: Recent Mentions
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.semanticAnalysis ? "5. Menciones Recientes" : "4. Menciones Recientes", 20, yPos);
  yPos += 8;

  const mentionsData = data.mentions.slice(0, 25).map((m) => [
    m.title?.substring(0, 40) || "Sin título",
    m.source_domain || "Desconocido",
    m.sentiment || "—",
    format(new Date(m.created_at), "dd/MM/yy"),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Título", "Fuente", "Sentimiento", "Fecha"]],
    body: mentionsData,
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
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  const fileName = `reporte_${data.project.nombre.replace(/\s+/g, "_")}_${format(data.generatedAt, "yyyyMMdd_HHmm")}.pdf`;
  doc.save(fileName);
}
