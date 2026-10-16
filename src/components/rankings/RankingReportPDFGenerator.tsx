import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { RankingReportContent } from "@/hooks/useRankingReport";
import type { FKProfile, FKProfileKPI } from "@/hooks/useFanpageKarma";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  PDF_COLORS, loadLogo, drawHeader, drawFooters,
  drawMetricsRow, drawSectionTitle, drawParagraph,
  drawNumberedItem, needPage, normalizePlatform,
} from "@/lib/reports/pdfHelpers";

interface RankingReportPDFGeneratorProps {
  report: RankingReportContent;
  rankingName: string;
  dateRange: { start: string; end: string; label: string };
  selectedTemplate: "executive" | "technical" | "public";
  editedTemplate: string;
  profiles?: FKProfile[];
  kpis?: FKProfileKPI[];
}

interface ChartData {
  name: string;
  value: number;
}

export function RankingReportPDFGenerator({
  report, rankingName, dateRange, selectedTemplate, editedTemplate,
  profiles = [], kpis = [],
}: RankingReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const prepareEngagementData = (): ChartData[] => {
    return profiles
      .map((p) => {
        const kpi = kpis.find((k) => k.fk_profile_id === p.id);
        return { name: (p.display_name || p.profile_id).substring(0, 15), value: kpi?.engagement_rate || 0 };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };

  const prepareGrowthData = (): ChartData[] => {
    return profiles
      .map((p) => {
        const kpi = kpis.find((k) => k.fk_profile_id === p.id);
        return { name: (p.display_name || p.profile_id).substring(0, 15), value: kpi?.follower_growth_percent || 0 };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };

  const drawBarChart = (
    doc: jsPDF, data: ChartData[], title: string,
    xPos: number, yPos: number, chartWidth: number, chartHeight: number, unit = "%",
  ) => {
    if (data.length === 0) return yPos;
    const labelWidth = 45;
    const barAreaWidth = chartWidth - labelWidth - 10;
    const barHeight = Math.min(12, (chartHeight - 25) / data.length);
    const maxValue = Math.max(...data.map((d) => Math.abs(d.value)), 0.1);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.textDark);
    doc.text(title, xPos + chartWidth / 2, yPos, { align: "center" });
    yPos += 8;

    data.forEach((item, index) => {
      const barY = yPos + index * (barHeight + 3);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_COLORS.textGray);
      doc.text(item.name, xPos + 5, barY + barHeight / 2 + 2);

      const barWidth = (Math.abs(item.value) / maxValue) * barAreaWidth;
      const barX = xPos + labelWidth + 5;

      const barColor = item.value >= 0 ? PDF_COLORS.positive : PDF_COLORS.negative;
      doc.setFillColor(barColor[0], barColor[1], barColor[2]);
      doc.roundedRect(barX, barY, Math.max(barWidth, 2), barHeight - 1, 1, 1, "F");

      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...PDF_COLORS.textDark);
      doc.text(`${item.value.toFixed(1)}${unit}`, barX + barWidth + 3, barY + barHeight / 2 + 2);
    });

    return yPos + data.length * (barHeight + 3) + 10;
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const logoBase64 = await loadLogo();
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const m = 16;
      const cw = pw - m * 2;
      const generatedDate = format(new Date(), "d MMM yyyy, HH:mm", { locale: es });

      // ── HEADER ──
      let y = drawHeader(doc, logoBase64, report.title, `Ranking: ${rankingName}  ·  ${dateRange.label}  ·  ${generatedDate}`, pw, m);

      // ── METRICS ROW ──
      y = drawMetricsRow(doc, [
        { value: report.metrics.totalProfiles.toString(), label: "Perfiles Analizados" },
        { value: report.metrics.networks.length.toString(), label: "Redes Sociales" },
        { value: `${report.metrics.avgEngagement}%`, label: "Engagement Promedio" },
        { value: `${report.metrics.avgGrowth}%`, label: "Crecimiento Promedio" },
      ], m, y, cw);
      y += 2;

      // ── RESUMEN EJECUTIVO ──
      y = drawSectionTitle(doc, "Resumen Ejecutivo", m, y, cw);
      y = drawParagraph(doc, report.summary, m, y, cw, ph, logoBase64, rankingName);
      y += 2;

      // ── HALLAZGOS CLAVE ──
      y = needPage(doc, y, 30, ph, logoBase64, rankingName, m);
      y = drawSectionTitle(doc, "Hallazgos Clave", m, y, cw);
      report.keyFindings.forEach((finding, i) => {
        y = drawNumberedItem(doc, finding, i + 1, m, y, cw, ph, logoBase64, rankingName);
      });
      y += 2;

      // ── RECOMENDACIONES ──
      y = needPage(doc, y, 30, ph, logoBase64, rankingName, m);
      y = drawSectionTitle(doc, "Recomendaciones", m, y, cw);
      report.recommendations.forEach((rec, i) => {
        y = drawNumberedItem(doc, rec, i + 1, m, y, cw, ph, logoBase64, rankingName);
      });
      y += 2;

      // ── MÉTRICAS TABLE ──
      y = needPage(doc, y, 30, ph, logoBase64, rankingName, m);
      y = drawSectionTitle(doc, "Metricas del Ranking", m, y, cw);

      autoTable(doc, {
        startY: y,
        head: [["Metrica", "Valor"]],
        body: [
          ["Perfiles analizados", report.metrics.totalProfiles.toString()],
          ["Redes sociales", report.metrics.networks.join(", ")],
          ["Engagement promedio", `${report.metrics.avgEngagement}%`],
          ["Crecimiento promedio", `${report.metrics.avgGrowth}%`],
          ...(report.metrics.topPerformer ? [["Top performer", report.metrics.topPerformer]] : []),
        ],
        theme: "plain",
        headStyles: {
          fillColor: [...PDF_COLORS.dark],
          textColor: [...PDF_COLORS.white],
          fontStyle: "bold",
          fontSize: 8,
          cellPadding: 2.5,
        },
        bodyStyles: { fontSize: 8, textColor: [...PDF_COLORS.textDark], cellPadding: 2 },
        alternateRowStyles: { fillColor: [...PDF_COLORS.cardBg] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 50 },
          1: { cellWidth: "auto" },
        },
        margin: { left: m, right: m },
      });
      y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;

      // ── CHARTS ──
      if (profiles.length > 0 && kpis.length > 0) {
        y = needPage(doc, y, 110, ph, logoBase64, rankingName, m);
        y = drawSectionTitle(doc, "Visualizacion de Metricas", m, y, cw);
        y += 2;

        const engagementData = prepareEngagementData();
        const growthData = prepareGrowthData();
        const chartWidth = (cw - 10) / 2;
        const chartHeight = 90;

        if (engagementData.length > 0) {
          drawBarChart(doc, engagementData, "Engagement por Perfil", m, y, chartWidth, chartHeight);
        }
        if (growthData.length > 0) {
          drawBarChart(doc, growthData, "Crecimiento Seguidores", m + chartWidth + 10, y, chartWidth, chartHeight);
        }
        y += chartHeight + 6;
      }

      // ── FOOTERS ──
      drawFooters(doc, logoBase64, rankingName, pw, ph, m);

      const fileName = `${rankingName.replace(/\s+/g, "_")}_report_${format(new Date(), "yyyyMMdd")}.pdf`;
      doc.save(fileName);

      toast({ title: "PDF generado", description: `${fileName} descargado exitosamente` });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error", description: "No se pudo generar el PDF", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={generatePDF} disabled={isGenerating}>
      {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
      PDF
    </Button>
  );
}
