import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type {
  ThematicCard,
  ConversationAnalysisContent,
  InformativeContent,
} from "@/hooks/useThematicCards";

// Wizr brand colors in RGB (for jsPDF which uses RGB)
const WIZR_COLORS = {
  violet: { r: 90, g: 47, b: 186 },      // hsl(260, 60%, 45%) → #5A2FBA
  violetLight: { r: 120, g: 80, b: 200 },
  orange: { r: 255, g: 107, b: 53 },     // hsl(16, 100%, 60%) → #FF6B35
  dark: { r: 35, g: 30, b: 50 },
  gray: { r: 107, g: 114, b: 128 },
  lightGray: { r: 248, g: 250, b: 252 },
  white: { r: 255, g: 255, b: 255 },
  green: { r: 34, g: 197, b: 94 },
  red: { r: 239, g: 68, b: 68 },
  blue: { r: 59, g: 130, b: 246 },
};

export async function generateThematicCardPDF(card: ThematicCard): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  const isConversation = card.card_type === "conversation_analysis";
  const content = card.content;

  // Helper functions
  const checkPageBreak = (requiredSpace: number = 30) => {
    if (yPos + requiredSpace > pageHeight - 30) {
      doc.addPage();
      yPos = margin;
      addHeader();
    }
  };

  const setColor = (color: { r: number; g: number; b: number }) => {
    doc.setTextColor(color.r, color.g, color.b);
  };

  const setFillColor = (color: { r: number; g: number; b: number }) => {
    doc.setFillColor(color.r, color.g, color.b);
  };

  // Add header with Wizr branding
  const addHeader = () => {
    // Top accent bar
    setFillColor(WIZR_COLORS.violet);
    doc.rect(0, 0, pageWidth, 8, "F");
    
    // Orange accent line
    setFillColor(WIZR_COLORS.orange);
    doc.rect(0, 8, pageWidth, 2, "F");
  };

  // Add footer
  const addFooter = (pageNum: number, totalPages: number) => {
    // Footer line
    setFillColor(WIZR_COLORS.violet);
    doc.rect(0, pageHeight - 12, pageWidth, 1, "F");
    
    doc.setFontSize(8);
    setColor(WIZR_COLORS.gray);
    doc.text(
      `Wizr Intelligence | Página ${pageNum} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  };

  // ===== COVER PAGE =====
  addHeader();
  yPos = 30;

  // Document type badge
  setFillColor(WIZR_COLORS.violet);
  const badgeText = isConversation ? "ANÁLISIS DE CONVERSACIÓN DIGITAL" : "FICHA INFORMATIVA";
  const badgeWidth = doc.getTextWidth(badgeText) * 0.35 + 16;
  doc.roundedRect((pageWidth - badgeWidth) / 2, yPos, badgeWidth, 10, 2, 2, "F");
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(WIZR_COLORS.white);
  doc.text(badgeText, pageWidth / 2, yPos + 7, { align: "center" });
  yPos += 25;

  // Title
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  setColor(WIZR_COLORS.dark);
  const titleLines = doc.splitTextToSize(card.title, pageWidth - 40);
  doc.text(titleLines, pageWidth / 2, yPos, { align: "center" });
  yPos += titleLines.length * 12 + 15;

  // Period info box
  setFillColor(WIZR_COLORS.lightGray);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 25, 3, 3, "F");
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  setColor(WIZR_COLORS.gray);
  
  const periodText = card.period_start && card.period_end
    ? `Período: ${format(new Date(card.period_start), "d MMMM", { locale: es })} - ${format(new Date(card.period_end), "d MMMM yyyy", { locale: es })}`
    : `Fecha: ${format(new Date(card.created_at), "d MMMM yyyy", { locale: es })}`;
  
  doc.text(periodText, pageWidth / 2, yPos + 10, { align: "center" });
  doc.text(`${card.mention_ids.length} menciones analizadas`, pageWidth / 2, yPos + 18, { align: "center" });
  yPos += 40;

  // Executive Summary
  if ("executiveSummary" in content) {
    setFillColor(WIZR_COLORS.violet);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 5, 0, 0, "F");
    yPos += 8;
    
    setFillColor({ r: 245, g: 243, b: 255 }); // Light violet background
    const summaryLines = doc.splitTextToSize(content.executiveSummary, pageWidth - margin * 2 - 10);
    const boxHeight = summaryLines.length * 5 + 16;
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, boxHeight, 0, 3, "F");
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(WIZR_COLORS.violet);
    doc.text("Resumen Ejecutivo", margin + 8, yPos + 10);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    setColor(WIZR_COLORS.dark);
    doc.text(summaryLines, margin + 8, yPos + 20);
    yPos += boxHeight + 15;
  }

  // ===== CONTENT PAGES =====
  if (isConversation && "volumeByChannel" in content) {
    renderConversationAnalysis(doc, content as ConversationAnalysisContent, pageWidth, margin, yPos, checkPageBreak, setColor, setFillColor, addHeader);
  } else if (!isConversation && "whatIsHappening" in content) {
    renderInformativeContent(doc, content as InformativeContent, pageWidth, margin, yPos, checkPageBreak, setColor, setFillColor, addHeader);
  }

  // Add footers to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(i, pageCount);
  }

  // Save
  const fileName = `ficha_${card.title.replace(/\s+/g, "_").substring(0, 30)}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}

function renderConversationAnalysis(
  doc: jsPDF,
  content: ConversationAnalysisContent,
  pageWidth: number,
  margin: number,
  startY: number,
  checkPageBreak: (space: number) => void,
  setColor: (c: { r: number; g: number; b: number }) => void,
  setFillColor: (c: { r: number; g: number; b: number }) => void,
  addHeader: () => void
) {
  let yPos = startY;

  // --- Volume & Sentiment Section ---
  checkPageBreak(80);
  
  // Section header
  yPos = addSectionHeader(doc, "Volumen y Alcance", yPos, pageWidth, margin, setColor, setFillColor);

  // Volume by channel table
  const channels = Object.entries(content.volumeByChannel).filter(([_, v]) => v > 0);
  const channelLabels: Record<string, string> = {
    mediosDigitales: "Medios Digitales",
    facebook: "Facebook",
    twitter: "Twitter/X",
    instagram: "Instagram",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
    otros: "Otros",
  };

  const channelData = channels.map(([key, value]) => [
    channelLabels[key] || key,
    String(value),
    `${Math.round((value / content.totalMentions) * 100)}%`,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Canal", "Menciones", "% del Total"]],
    body: channelData,
    theme: "striped",
    headStyles: { 
      fillColor: [WIZR_COLORS.violet.r, WIZR_COLORS.violet.g, WIZR_COLORS.violet.b],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Metrics row
  doc.setFontSize(10);
  setColor(WIZR_COLORS.gray);
  doc.text(`Total de menciones: ${content.totalMentions} | Alcance estimado: ${content.estimatedReach}`, margin, yPos);
  yPos += 15;

  // --- Sentiment Distribution ---
  checkPageBreak(60);
  yPos = addSectionHeader(doc, "Distribución de Sentimiento", yPos, pageWidth, margin, setColor, setFillColor);

  const sentimentData = [
    ["Positivo", `${content.sentimentDistribution.positivo}%`, "●"],
    ["Neutral", `${content.sentimentDistribution.neutral}%`, "●"],
    ["Negativo", `${content.sentimentDistribution.negativo}%`, "●"],
  ];

  autoTable(doc, {
    startY: yPos,
    body: sentimentData,
    theme: "plain",
    margin: { left: margin, right: margin },
    styles: { fontSize: 11 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 40, fontStyle: "bold" },
      2: { cellWidth: 20 },
    },
    didDrawCell: (data) => {
      if (data.column.index === 2 && data.section === "body") {
        const colors = [WIZR_COLORS.green, WIZR_COLORS.blue, WIZR_COLORS.red];
        const color = colors[data.row.index];
        doc.setFillColor(color.r, color.g, color.b);
        doc.circle(data.cell.x + 5, data.cell.y + data.cell.height / 2, 4, "F");
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // --- Main Narratives ---
  checkPageBreak(80);
  yPos = addSectionHeader(doc, "Narrativas Principales", yPos, pageWidth, margin, setColor, setFillColor);

  content.mainNarratives.forEach((narrative, i) => {
    checkPageBreak(25);
    
    // Badge with percentage
    setFillColor(WIZR_COLORS.orange);
    doc.roundedRect(margin, yPos, 18, 8, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    setColor(WIZR_COLORS.white);
    doc.text(`${narrative.percentage}%`, margin + 9, yPos + 6, { align: "center" });
    
    // Narrative text
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    setColor(WIZR_COLORS.dark);
    const narrativeLines = doc.splitTextToSize(narrative.narrative, pageWidth - margin * 2 - 25);
    doc.text(narrativeLines, margin + 22, yPos + 6);
    
    doc.setFontSize(8);
    setColor(WIZR_COLORS.gray);
    doc.text(`~${narrative.volume} menciones`, margin + 22, yPos + 6 + narrativeLines.length * 4 + 2);
    
    yPos += Math.max(15, narrativeLines.length * 5 + 12);
  });

  yPos += 10;

  // --- Relevant Actors ---
  checkPageBreak(80);
  yPos = addSectionHeader(doc, "Actores Relevantes", yPos, pageWidth, margin, setColor, setFillColor);

  const actorsData = content.relevantActors.map((actor) => [
    actor.name,
    actor.type,
    String(actor.mentions),
    actor.description.substring(0, 60) + (actor.description.length > 60 ? "..." : ""),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Nombre", "Tipo", "Menciones", "Descripción"]],
    body: actorsData,
    theme: "striped",
    headStyles: { 
      fillColor: [WIZR_COLORS.violet.r, WIZR_COLORS.violet.g, WIZR_COLORS.violet.b],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 35 },
      1: { cellWidth: 25 },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 90 },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // --- Risks ---
  if (content.risks.length > 0) {
    checkPageBreak(60);
    yPos = addSectionHeader(doc, "⚠️ Riesgos Identificados", yPos, pageWidth, margin, setColor, setFillColor, WIZR_COLORS.orange);

    content.risks.forEach((risk) => {
      checkPageBreak(15);
      doc.setFontSize(10);
      setColor(WIZR_COLORS.orange);
      doc.text("•", margin + 2, yPos);
      setColor(WIZR_COLORS.dark);
      const riskLines = doc.splitTextToSize(risk, pageWidth - margin * 2 - 10);
      doc.text(riskLines, margin + 8, yPos);
      yPos += riskLines.length * 5 + 5;
    });
    yPos += 10;
  }

  // --- Recommendations ---
  checkPageBreak(60);
  yPos = addSectionHeader(doc, "✓ Recomendaciones", yPos, pageWidth, margin, setColor, setFillColor, WIZR_COLORS.green);

  content.recommendations.forEach((rec) => {
    checkPageBreak(15);
    doc.setFontSize(10);
    setColor(WIZR_COLORS.green);
    doc.text("✓", margin + 2, yPos);
    setColor(WIZR_COLORS.dark);
    const recLines = doc.splitTextToSize(rec, pageWidth - margin * 2 - 10);
    doc.text(recLines, margin + 8, yPos);
    yPos += recLines.length * 5 + 5;
  });
}

function renderInformativeContent(
  doc: jsPDF,
  content: InformativeContent,
  pageWidth: number,
  margin: number,
  startY: number,
  checkPageBreak: (space: number) => void,
  setColor: (c: { r: number; g: number; b: number }) => void,
  setFillColor: (c: { r: number; g: number; b: number }) => void,
  addHeader: () => void
) {
  let yPos = startY;

  // --- Context ---
  if (content.context) {
    checkPageBreak(50);
    yPos = addSectionHeader(doc, "Contexto", yPos, pageWidth, margin, setColor, setFillColor);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    setColor(WIZR_COLORS.dark);
    const contextLines = doc.splitTextToSize(content.context, pageWidth - margin * 2);
    doc.text(contextLines, margin, yPos);
    yPos += contextLines.length * 5 + 15;
  }

  // --- What is Happening ---
  checkPageBreak(80);
  yPos = addSectionHeader(doc, "¿Qué está pasando?", yPos, pageWidth, margin, setColor, setFillColor);

  content.whatIsHappening.forEach((item, i) => {
    checkPageBreak(40);
    
    // Card-like box
    setFillColor(WIZR_COLORS.lightGray);
    const descLines = doc.splitTextToSize(item.description, pageWidth - margin * 2 - 16);
    const boxHeight = descLines.length * 5 + 20;
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, boxHeight, 3, 3, "F");
    
    // Left accent
    setFillColor(WIZR_COLORS.violet);
    doc.rect(margin, yPos, 4, boxHeight, "F");
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(WIZR_COLORS.dark);
    doc.text(item.title, margin + 12, yPos + 12);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    setColor(WIZR_COLORS.gray);
    doc.text(descLines, margin + 12, yPos + 20);
    
    yPos += boxHeight + 8;
  });

  yPos += 10;

  // --- Local Implications ---
  checkPageBreak(80);
  yPos = addSectionHeader(doc, "Implicaciones", yPos, pageWidth, margin, setColor, setFillColor, WIZR_COLORS.orange);

  content.localImplications.forEach((item) => {
    checkPageBreak(40);
    
    // Card with orange accent
    setFillColor({ r: 255, g: 247, b: 237 }); // Light orange
    const descLines = doc.splitTextToSize(item.description, pageWidth - margin * 2 - 16);
    const boxHeight = descLines.length * 5 + 20;
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, boxHeight, 3, 3, "F");
    
    // Left accent
    setFillColor(WIZR_COLORS.orange);
    doc.rect(margin, yPos, 4, boxHeight, "F");
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    setColor(WIZR_COLORS.dark);
    doc.text(item.title, margin + 12, yPos + 12);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    setColor(WIZR_COLORS.gray);
    doc.text(descLines, margin + 12, yPos + 20);
    
    yPos += boxHeight + 8;
  });

  yPos += 10;

  // --- Sources ---
  checkPageBreak(60);
  yPos = addSectionHeader(doc, "Fuentes Consultadas", yPos, pageWidth, margin, setColor, setFillColor);

  const sourcesData = content.sources.map((source) => [
    source.name,
    source.date || "—",
    source.url ? "Ver enlace" : "—",
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Fuente", "Fecha", "Enlace"]],
    body: sourcesData,
    theme: "striped",
    headStyles: { 
      fillColor: [WIZR_COLORS.violet.r, WIZR_COLORS.violet.g, WIZR_COLORS.violet.b],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { fontStyle: "bold" },
      2: { textColor: [WIZR_COLORS.violet.r, WIZR_COLORS.violet.g, WIZR_COLORS.violet.b] },
    },
  });
}

function addSectionHeader(
  doc: jsPDF,
  title: string,
  yPos: number,
  pageWidth: number,
  margin: number,
  setColor: (c: { r: number; g: number; b: number }) => void,
  setFillColor: (c: { r: number; g: number; b: number }) => void,
  accentColor: { r: number; g: number; b: number } = WIZR_COLORS.violet
): number {
  // Accent line
  setFillColor(accentColor);
  doc.rect(margin, yPos, 30, 2, "F");
  yPos += 8;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  setColor(WIZR_COLORS.dark);
  doc.text(title, margin, yPos);
  
  return yPos + 10;
}
