import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X, Download, Loader2,
} from "lucide-react";
import type { PerformanceReportContent } from "@/hooks/usePerformanceReport";
import { buildPerformanceSlidesReport } from "@/lib/reports/performanceSlidesBuilder";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  report: PerformanceReportContent;
  clientName: string;
  dateRange: { start: string; end: string; label: string };
}

const SLIDE_W = 1920;
const SLIDE_H = 1080;

export function PerformanceSlidesViewer({ open, onOpenChange, report, clientName, dateRange }: Props) {
  const { toast } = useToast();
  const [current, setCurrent] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const built = useMemo(
    () => buildPerformanceSlidesReport(report, clientName, dateRange),
    [report, clientName, dateRange],
  );

  useEffect(() => {
    if (open) setCurrent(0);
  }, [open]);

  const fitScale = useCallback(() => {
    const el = containerRef.current;
    const stage = stageRef.current;
    if (!el || !stage) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const scale = Math.min(cw / SLIDE_W, ch / SLIDE_H);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }, []);

  useEffect(() => {
    if (!open) return;
    fitScale();
    window.addEventListener("resize", fitScale);
    const ro = new ResizeObserver(fitScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", fitScale);
      ro.disconnect();
    };
  }, [open, fitScale, current]);

  const toggleFs = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrent((c) => Math.min(c + 1, built.count - 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrent((c) => Math.max(c - 1, 0));
      } else if (e.key === "f" || e.key === "F") {
        toggleFs();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, built.count, toggleFs]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const modeSlug = report.reportMode === "brand" ? "marca" : "benchmark";
      const filename = `performance_visual_${modeSlug}_${clientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
      const { data, error } = await supabase.functions.invoke("generate-pdf-pdfshift", {
        body: { html: built.fullHtml, filename, landscape: true, format: "1920x1080px" },
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
      toast({ title: "PDF Visual generado", description: filename });
    } catch (err) {
      toast({
        title: "Error al generar PDF",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const modeLabel = report.reportMode === "brand" ? "Marca" : "Benchmark";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[98vw] w-[98vw] h-[95vh] p-0 gap-0 bg-slate-900 border-slate-800"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800 text-white">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">Presentación · Performance {modeLabel}</span>
            <span className="text-xs text-slate-400">{clientName} · {dateRange.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 px-2">{current + 1} / {built.count}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownload}
              disabled={downloading}
              className="text-white hover:bg-slate-800 gap-2"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF Visual
            </Button>
            <Button size="sm" variant="ghost" onClick={toggleFs} className="text-white hover:bg-slate-800">
              {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} className="text-white hover:bg-slate-800">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div ref={containerRef} className="relative flex-1 bg-slate-900 overflow-hidden" style={{ minHeight: 0 }}>
          <div
            ref={stageRef}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: SLIDE_W,
              height: SLIDE_H,
              transformOrigin: "center center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
            dangerouslySetInnerHTML={{ __html: built.slides[current] || "" }}
          />

          <button
            onClick={() => setCurrent((c) => Math.max(c - 1, 0))}
            disabled={current === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed z-10"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={() => setCurrent((c) => Math.min(c + 1, built.count - 1))}
            disabled={current === built.count - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed z-10"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        <div className="flex gap-2 px-4 py-2 bg-slate-950 border-t border-slate-800 overflow-x-auto">
          {built.slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-shrink-0 w-12 h-7 rounded text-[10px] font-semibold transition ${
                i === current ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
