import type { PerformanceReportContent } from "@/hooks/usePerformanceReport";
import { PerformanceReportView } from "./PerformanceReportView";
import { ShieldCheck } from "lucide-react";
import wizrLogo from "@/assets/wizr-logo-full.png";

interface PerformanceReportPublicViewProps {
  report: PerformanceReportContent;
  clientName: string;
  dateRange: { start: string; end: string; label: string };
}

/**
 * Read-only public view of a Performance Report.
 *
 * Strategy: instead of duplicating layout/chart logic, this component reuses
 * `PerformanceReportView` (the same component used inside the dashboard) so the
 * public link is **visually and analytically identical** to the internal web
 * view the user has approved as the quality reference.
 *
 * It only adds:
 *   - A Wizr-branded outer header (client + report kind + period)
 *   - A discreet footer with brand attribution and generation date
 *   - A neutral page background that frames the report card
 */
export function PerformanceReportPublicView({
  report,
  clientName,
  dateRange,
}: PerformanceReportPublicViewProps) {
  const isBrand = report.reportMode === "brand";
  const generatedOn = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="bg-white">
      {/* ── Outer Wizr brand band (only present in the public link) ── */}
      <div className="bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4338ca] text-white px-6 sm:px-10 py-5 border-b border-white/10">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 px-2 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
              <img src={wizrLogo} alt="Wizr" className="h-7 w-auto block" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.22em] text-white/70 font-semibold">
                Wizr · Inteligencia de medios
              </div>
              <div className="text-sm font-medium text-white/95 truncate">
                {clientName} · {isBrand ? "Reporte de marca" : "Reporte de benchmark"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/80">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Acceso de solo lectura · </span>
            <span>{dateRange.label}</span>
          </div>
        </div>
      </div>

      {/* ── Embedded internal report view (same component as dashboard) ── */}
      <div className="px-4 sm:px-8 lg:px-10 py-8 max-w-[1100px] mx-auto">
        <PerformanceReportView
          report={report}
          editing={false}
          dateLabel={dateRange.label}
        />
      </div>

      {/* ── Public footer ── */}
      <div className="border-t bg-muted/20 px-6 sm:px-10 py-5">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between flex-wrap gap-3 text-xs text-muted-foreground">
          <div>
            Generado el {generatedOn} · {dateRange.start} → {dateRange.end}
          </div>
          <div className="font-medium text-foreground/70">
            Wizr · wizr.mx
          </div>
        </div>
      </div>
    </div>
  );
}
