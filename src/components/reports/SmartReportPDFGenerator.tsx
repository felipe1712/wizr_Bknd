import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SmartReportContent } from "@/hooks/useSmartReport";

interface SmartReportPDFGeneratorProps {
  report: SmartReportContent;
  projectName: string;
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
  selectedTemplate: "executive" | "technical" | "public";
  editedTemplate: string;
}

export function SmartReportPDFGenerator({
  report,
  projectName,
  dateRange,
  selectedTemplate,
  editedTemplate,
}: SmartReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      const checkPageBreak = (required: number = 30) => {
        if (yPos + required > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
      };

      // Title
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(90, 47, 186); // Wizr violet
      doc.text(report.title, pageWidth / 2, yPos, { align: "center" });
      yPos += 12;

      // Project & Date
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(projectName, pageWidth / 2, yPos, { align: "center" });
      yPos += 6;
      doc.setFontSize(10);
      doc.text(`${dateRange.label} • Generado: ${format(new Date(), "PPp", { locale: es })}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      // Summary
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(31, 41, 55);
      const summaryLines = doc.splitTextToSize(report.summary, pageWidth - 40);
      doc.text(summaryLines, 20, yPos);
      yPos += summaryLines.length * 5 + 10;

      // Metrics Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(20, yPos, pageWidth - 40, 25, 3, 3, "F");
      
      doc.setFontSize(10);
      const metricsText = [
        `Total: ${report.metrics.totalMentions}`,
        `Positivas: ${report.metrics.positiveCount}`,
        `Neutrales: ${report.metrics.neutralCount}`,
        `Negativas: ${report.metrics.negativeCount}`,
      ];
      
      const metricSpacing = (pageWidth - 40) / 4;
      metricsText.forEach((text, i) => {
        doc.text(text, 30 + i * metricSpacing, yPos + 15);
      });
      yPos += 35;

      // Key Findings
      checkPageBreak(50);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text("Hallazgos Clave", 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      report.keyFindings.forEach((finding) => {
        checkPageBreak(15);
        const lines = doc.splitTextToSize(`• ${finding}`, pageWidth - 50);
        doc.text(lines, 25, yPos);
        yPos += lines.length * 5 + 3;
      });
      yPos += 5;

      // Recommendations
      checkPageBreak(50);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Recomendaciones", 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      report.recommendations.forEach((rec, i) => {
        checkPageBreak(15);
        const lines = doc.splitTextToSize(`${i + 1}. ${rec}`, pageWidth - 50);
        doc.text(lines, 25, yPos);
        yPos += lines.length * 5 + 3;
      });
      yPos += 10;

      // Selected Template Content
      checkPageBreak(60);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      const templateLabels = {
        executive: "Mensaje Ejecutivo",
        technical: "Mensaje Técnico",
        public: "Mensaje Público",
      };
      doc.text(templateLabels[selectedTemplate], 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const templateLines = doc.splitTextToSize(editedTemplate, pageWidth - 40);
      
      templateLines.forEach((line: string) => {
        checkPageBreak(8);
        doc.text(line, 20, yPos);
        yPos += 5;
      });

      // Top Sources
      if (report.metrics.topSources.length > 0) {
        checkPageBreak(40);
        yPos += 10;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Fuentes Principales", 20, yPos);
        yPos += 8;

        autoTable(doc, {
          startY: yPos,
          head: [["Fuente"]],
          body: report.metrics.topSources.map(s => [s]),
          theme: "striped",
          headStyles: { fillColor: [90, 47, 186] },
          margin: { left: 20, right: 20 },
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Página ${i} de ${pageCount} | ${projectName} | Generado con Wizr`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      // Save
      const fileName = `reporte_inteligente_${projectName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={generatePDF} disabled={isGenerating}>
      {isGenerating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      PDF
    </Button>
  );
}
