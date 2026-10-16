import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, FileX } from "lucide-react";
import { fetchPublicReport, type SharedReport } from "@/hooks/useSharedReports";
import { SmartReportPDFPreview } from "@/components/reports/SmartReportPDFPreview";
import { PerformanceReportPublicView } from "@/components/reports/PerformanceReportPublicView";

export default function PublicReportPage() {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Token no válido");
      setLoading(false);
      return;
    }

    fetchPublicReport(token)
      .then((r) => {
        if (!r) {
          setError("Este reporte no existe, fue revocado o expiró.");
        } else {
          setReport(r);
          document.title = `${r.title} · Wizr`;
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Error al cargar el reporte");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <FileX className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Reporte no disponible</h1>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground pt-4">
            Si esperabas ver un reporte aquí, contacta a la persona que te compartió este link.
          </p>
        </div>
      </div>
    );
  }

  const isPerformance =
    report.report_kind === "performance_brand" ||
    report.report_kind === "performance_benchmark";

  // Performance reports use the wider layout (1100px) and bring their own
  // Wizr-branded header/footer. Smart Reports keep the legacy 920px card.
  const wrapperMaxWidth = isPerformance ? "max-w-[1180px]" : "max-w-[920px]";

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-3 sm:px-4">
      {/* Mini banner */}
      <div className={`${wrapperMaxWidth} mx-auto mb-3 flex items-center justify-between text-xs text-muted-foreground`}>
        <span className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" />
          Reporte compartido vía Wizr
        </span>
        <span>
          {report.view_count} {report.view_count === 1 ? "vista" : "vistas"}
        </span>
      </div>

      {/* Reporte */}
      <div className={`${wrapperMaxWidth} mx-auto bg-white shadow-lg rounded-lg overflow-hidden border`}>
        {isPerformance ? (
          <PerformanceReportPublicView
            report={report.content}
            clientName={report.project_name}
            dateRange={report.date_range}
          />
        ) : (
          <SmartReportPDFPreview
            report={report.content}
            projectName={report.project_name}
            dateRange={report.date_range}
            editedTemplate=""
          />
        )}
      </div>
    </div>
  );
}
