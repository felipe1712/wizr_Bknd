import { Button } from "@/components/ui/button";
import { Printer, FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import type { SmartReportContent } from "@/hooks/useSmartReport";
import { buildReportHTML } from "@/lib/reports/printReportBuilder";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type PDFFormat = "summary" | "full";

interface SmartReportPDFGeneratorProps {
  report: SmartReportContent;
  projectName: string;
  dateRange: { start: string; end: string; label: string };
  pdfFormat?: PDFFormat;
}

function trimReportForSummary(report: SmartReportContent): SmartReportContent {
  return {
    ...report,
    keyFindings: report.keyFindings.slice(0, 3),
    recommendations: report.recommendations.slice(0, 2),
    conclusions: report.conclusions?.slice(0, 2),
    narratives: report.narratives.slice(0, 3),
    influencers: report.influencers.slice(0, 5),
    mediaOutlets: (report.mediaOutlets || []).slice(0, 5),
    sourceBreakdown: report.sourceBreakdown.slice(0, 5),
    entityComparison: undefined,
  };
}

export function SmartReportPDFGenerator({
  report,
  projectName,
  dateRange,
  pdfFormat = "full",
}: SmartReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const isSummary = pdfFormat === "summary";

  /** Web preview via window.open (for quick browser print) */
  const handlePreview = () => {
    const reportData = isSummary ? trimReportForSummary(report) : report;
    const built = buildReportHTML(reportData, projectName, dateRange, isSummary);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(built.html);
    win.document.close();
    win.onload = () => setTimeout(() => win.print(), 300);
  };

  /** Generate PDF via PDFShift edge function */
  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const reportData = isSummary ? trimReportForSummary(report) : report;
      const built = buildReportHTML(reportData, projectName, dateRange, isSummary);
      const filename = `${isSummary ? "resumen" : "reporte_completo"}_${projectName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;

      const { data, error } = await supabase.functions.invoke("generate-pdf-pdfshift", {
        body: { html: built.html, filename, header: built.header, footer: built.footer },
      });

      if (error) throw new Error(error.message);
      if (!data?.pdf) throw new Error(data?.error || "No PDF returned");

      const binary = atob(data.pdf);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "PDF generado", description: filename });
    } catch (err) {
      console.error("PDFShift error:", err);
      toast({
        title: "Error al generar PDF",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const label = isSummary ? "Resumen" : "Completo";

  return (
    <div className="flex gap-2 w-full">
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadPDF}
        disabled={isGenerating}
        className="flex-1 gap-2"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        PDF {label}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePreview}
        className="gap-2"
        title="Vista previa para imprimir"
      >
        <Printer className="h-4 w-4" />
      </Button>
    </div>
  );
}
