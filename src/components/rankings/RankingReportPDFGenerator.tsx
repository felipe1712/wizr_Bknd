import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { RankingReportContent } from "@/hooks/useRankingReport";
import type { FKProfile, FKProfileKPI } from "@/hooks/useFanpageKarma";
import jsPDF from "jspdf";

interface RankingReportPDFGeneratorProps {
  report: RankingReportContent;
  rankingName: string;
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
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
  report,
  rankingName,
  dateRange,
  selectedTemplate,
  editedTemplate,
  profiles = [],
  kpis = [],
}: RankingReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Prepare chart data
  const prepareEngagementData = (): ChartData[] => {
    return profiles
      .map((profile) => {
        const kpi = kpis.find((k) => k.fk_profile_id === profile.id);
        return {
          name: (profile.display_name || profile.profile_id).substring(0, 15),
          value: kpi?.engagement_rate || 0,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };

  const prepareGrowthData = (): ChartData[] => {
    return profiles
      .map((profile) => {
        const kpi = kpis.find((k) => k.fk_profile_id === profile.id);
        return {
          name: (profile.display_name || profile.profile_id).substring(0, 15),
          value: kpi?.follower_growth_percent || 0,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };

  const drawBarChart = (
    doc: jsPDF,
    data: ChartData[],
    title: string,
    xPos: number,
    yPos: number,
    chartWidth: number,
    chartHeight: number,
    unit: string = "%"
  ) => {
    if (data.length === 0) return yPos;

    const margin = 5;
    const labelWidth = 45;
    const barAreaWidth = chartWidth - labelWidth - margin * 2;
    const barHeight = Math.min(12, (chartHeight - 25) / data.length);
    const maxValue = Math.max(...data.map((d) => Math.abs(d.value)), 0.1);

    // Title
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(title, xPos + chartWidth / 2, yPos, { align: "center" });
    yPos += 8;

    // Draw bars
    data.forEach((item, index) => {
      const barY = yPos + index * (barHeight + 3);
      
      // Label
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(item.name, xPos + margin, barY + barHeight / 2 + 2);

      // Bar
      const barWidth = (Math.abs(item.value) / maxValue) * barAreaWidth;
      const barX = xPos + labelWidth + margin;

      // Color based on value
      if (item.value >= 0) {
        doc.setFillColor(34, 197, 94); // green
      } else {
        doc.setFillColor(239, 68, 68); // red
      }
      doc.roundedRect(barX, barY, Math.max(barWidth, 2), barHeight - 1, 1, 1, "F");

      // Value label
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(
        `${item.value.toFixed(1)}${unit}`,
        barX + barWidth + 3,
        barY + barHeight / 2 + 2
      );
    });

    return yPos + data.length * (barHeight + 3) + 10;
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let yPos = margin;

      // Helper function
      const addText = (text: string, fontSize: number, isBold = false, color: [number, number, number] = [0, 0, 0]) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, contentWidth);
        doc.text(lines, margin, yPos);
        yPos += lines.length * fontSize * 0.4 + 4;
        return lines.length;
      };

      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }
      };

      // Header
      doc.setFillColor(245, 158, 11); // Amber
      doc.rect(0, 0, pageWidth, 35, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(report.title, margin, 15);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Ranking: ${rankingName} | Periodo: ${dateRange.label}`, margin, 25);
      
      yPos = 50;

      // Summary
      addText("RESUMEN EJECUTIVO", 12, true, [245, 158, 11]);
      addText(report.summary, 10, false);
      yPos += 5;

      // Key Findings
      checkPageBreak(40);
      addText("HALLAZGOS CLAVE", 12, true, [245, 158, 11]);
      report.keyFindings.forEach((finding, i) => {
        checkPageBreak(15);
        addText(`${i + 1}. ${finding}`, 10, false);
      });
      yPos += 5;

      // Recommendations
      checkPageBreak(40);
      addText("RECOMENDACIONES", 12, true, [245, 158, 11]);
      report.recommendations.forEach((rec, i) => {
        checkPageBreak(15);
        addText(`${i + 1}. ${rec}`, 10, false);
      });
      yPos += 5;

      // Metrics
      checkPageBreak(40);
      addText("MÉTRICAS DEL RANKING", 12, true, [245, 158, 11]);
      addText(`• Perfiles analizados: ${report.metrics.totalProfiles}`, 10, false);
      addText(`• Redes sociales: ${report.metrics.networks.join(', ')}`, 10, false);
      addText(`• Engagement promedio: ${report.metrics.avgEngagement}%`, 10, false);
      addText(`• Crecimiento promedio: ${report.metrics.avgGrowth}%`, 10, false);
      if (report.metrics.topPerformer) {
        addText(`• Top performer: ${report.metrics.topPerformer}`, 10, false);
      }
      yPos += 10;

      // Charts Section
      if (profiles.length > 0 && kpis.length > 0) {
        checkPageBreak(120);
        
        addText("VISUALIZACIÓN DE MÉTRICAS", 12, true, [245, 158, 11]);
        yPos += 5;

        const engagementData = prepareEngagementData();
        const growthData = prepareGrowthData();
        
        const chartWidth = (contentWidth - 10) / 2;
        const chartHeight = 100;
        
        // Draw engagement chart
        if (engagementData.length > 0) {
          drawBarChart(
            doc,
            engagementData,
            "Engagement por Perfil",
            margin,
            yPos,
            chartWidth,
            chartHeight
          );
        }

        // Draw growth chart
        if (growthData.length > 0) {
          drawBarChart(
            doc,
            growthData,
            "Crecimiento de Seguidores",
            margin + chartWidth + 10,
            yPos,
            chartWidth,
            chartHeight
          );
        }

        yPos += chartHeight + 10;
      }

      // Selected Template Content
      checkPageBreak(60);
      const templateLabels = {
        executive: "VERSIÓN EJECUTIVA",
        technical: "VERSIÓN TÉCNICA", 
        public: "VERSIÓN WHATSAPP",
      };
      addText(templateLabels[selectedTemplate], 12, true, [245, 158, 11]);
      addText(editedTemplate, 10, false);

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Generado por Wizr | Página ${i} de ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      // Save
      const fileName = `${rankingName.replace(/\s+/g, '_')}_report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF generado",
        description: `${fileName} descargado exitosamente`,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={generatePDF} disabled={isGenerating}>
      {isGenerating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="mr-2 h-4 w-4" />
      )}
      PDF
    </Button>
  );
}
