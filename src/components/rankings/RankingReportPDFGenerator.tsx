import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { RankingReportContent } from "@/hooks/useRankingReport";
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
}

export function RankingReportPDFGenerator({
  report,
  rankingName,
  dateRange,
  selectedTemplate,
  editedTemplate,
}: RankingReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
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
        if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - margin) {
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
      yPos += 5;

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
          doc.internal.pageSize.getHeight() - 10,
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
