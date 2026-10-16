import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { PerformanceReportContent } from "@/hooks/usePerformanceReport";
import { useToast } from "@/hooks/use-toast";
import { PerformanceReportView } from "./PerformanceReportView";
import wizrLogo from "@/assets/wizr-logo-full.png";

interface PerformanceReportPDFGeneratorProps {
  report: PerformanceReportContent;
  clientName: string;
  dateRange: { start: string; end: string; label: string };
}

/**
 * Section-based PDF generator.
 *
 * Renders the live `PerformanceReportView` into an off-screen container, then
 * captures EACH top-level Card/section as its own canvas. Sections are placed
 * into A4 pages with a real jsPDF header + footer drawn on every page (not
 * baked into the canvas). This eliminates:
 *   - missing headers/footers on pages 2+
 *   - mid-section page cuts
 *   - clipped donut labels (each chart card is captured with internal padding)
 *   - large empty whitespace at the bottom of pages
 */
export function PerformanceReportPDFGenerator({
  report, clientName, dateRange,
}: PerformanceReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const hiddenContainerRef = useRef<HTMLDivElement | null>(null);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);

    // ── Off-screen render host ──────────────────────────────────────────
    const RENDER_WIDTH_PX = 1180;
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.left = "-99999px";
    host.style.width = `${RENDER_WIDTH_PX}px`;
    host.style.background = "#ffffff";
    host.style.zIndex = "-1";
    host.setAttribute("data-pdf-host", "true");
    document.body.appendChild(host);
    hiddenContainerRef.current = host;

    // Tailwind 4 + html2canvas can choke on oklch() and CSS variables; force
    // the host to use safe sRGB fallbacks for elements that html2canvas
    // typically misses (icons, borders).
    const safetyStyle = document.createElement("style");
    safetyStyle.textContent = `
      [data-pdf-host] * {
        animation: none !important;
        transition: none !important;
      }
      [data-pdf-host] svg { overflow: visible; }
      [data-pdf-host] .recharts-wrapper,
      [data-pdf-host] .recharts-surface { overflow: visible !important; }

      /* Network badges: html2canvas mis-aligns inline-flex + lucide SVGs.
         Force a roomy text-only chip with safe sRGB colors and explicit
         line-height. Force inner children to inline so the text label
         actually renders inside the pill. */
      [data-pdf-host] [data-network-badge] {
        display: inline-block !important;
        padding: 3px 10px !important;
        border-radius: 9999px !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        line-height: 12px !important;
        border: 1px solid #cbd5e1 !important;
        background: #f1f5f9 !important;
        color: #0f172a !important;
        vertical-align: middle !important;
        white-space: nowrap !important;
        overflow: visible !important;
      }
      [data-pdf-host] [data-network-badge] > * {
        display: inline !important;
        vertical-align: baseline !important;
      }
      [data-pdf-host] [data-network-badge] svg { display: none !important; }
      [data-pdf-host] [data-report-network-pill] {
        min-width: 58px !important;
        text-align: center !important;
      }
      [data-pdf-host] [data-network-badge="facebook"] { background:#dbeafe !important; color:#1e3a8a !important; border-color:#bfdbfe !important; }
      [data-pdf-host] [data-network-badge="instagram"] { background:#fce7f3 !important; color:#9d174d !important; border-color:#fbcfe8 !important; }
      [data-pdf-host] [data-network-badge="twitter"],
      [data-pdf-host] [data-network-badge="x"] { background:#e2e8f0 !important; color:#1e293b !important; border-color:#cbd5e1 !important; }
      [data-pdf-host] [data-network-badge="youtube"] { background:#fee2e2 !important; color:#991b1b !important; border-color:#fecaca !important; }
      [data-pdf-host] [data-network-badge="tiktok"] { background:#e4e4e7 !important; color:#18181b !important; border-color:#d4d4d8 !important; }
      [data-pdf-host] [data-network-badge="linkedin"] { background:#e0f2fe !important; color:#075985 !important; border-color:#bae6fd !important; }

      /* Numbered circles in Top Content cards: html2canvas drops the digit
         to the bottom because of flex baseline. Switch to block + line-height. */
      [data-pdf-host] [data-numbered-bullet] {
        display: inline-block !important;
        width: 18px !important;
        height: 18px !important;
        line-height: 18px !important;
        text-align: center !important;
        border-radius: 9999px !important;
        background: #4338ca !important;
        color: #ffffff !important;
        font-weight: 700 !important;
        font-size: 10px !important;
        vertical-align: middle !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }

      /* Top Content header row: switch flex to inline-baseline so the
         numbered bullet, brand name and network chip share a baseline
         and don't drop below their pills. */
      [data-pdf-host] [data-top-content-header] {
        display: block !important;
      }
      [data-pdf-host] [data-top-content-header] > * {
        display: inline-block !important;
        vertical-align: middle !important;
        margin-right: 6px !important;
      }
      [data-pdf-host] [data-pdf-capture-grid="top-posts"] {
        grid-template-columns: 1fr !important;
      }
      [data-pdf-host] [data-top-content-body] {
        display: block !important;
        overflow: visible !important;
        white-space: pre-wrap !important;
        word-break: break-word !important;
      }

      /* Don't truncate post bodies in PDF — let them flow */
      [data-pdf-host] .line-clamp-3,
      [data-pdf-host] .line-clamp-2 {
        -webkit-line-clamp: unset !important;
        display: block !important;
        overflow: visible !important;
      }
    `;
    host.appendChild(safetyStyle);

    const root = createRoot(host);

    try {
      // 1) Render the live view
      await new Promise<void>((resolve) => {
        root.render(
          <div style={{ padding: "24px 28px", background: "#ffffff" }}>
            <PerformanceReportView
              report={report}
              editing={false}
              dateLabel={dateRange.label}
            />
          </div>
        );
        // Wait for Recharts ResponsiveContainer to layout + fonts.
        // 600ms is enough on modern hardware; the previous 1400ms was just
        // padding and added measurable latency before captures started.
        setTimeout(resolve, 600);
      });

      // 2) Locate sections (top-level children of the report's `.space-y-8`).
      // If a section has explicit `data-pdf-capture-item` children, capture
      // those instead so long lists (e.g. "Mejores contenidos") can break
      // across pages cleanly. Otherwise capture the whole section.
      const reportRoot = host.querySelector<HTMLElement>(".space-y-8");
      if (!reportRoot) throw new Error("Report root not found");
      const sections = (Array.from(reportRoot.children) as HTMLElement[]).flatMap((section) => {
        // Only split if the section is genuinely tall (otherwise the extra
        // captures cost more than they save).
        if (section.scrollHeight < 900) return [section];
        const splitItems = Array.from(section.querySelectorAll<HTMLElement>("[data-pdf-capture-item]"));
        return splitItems.length > 1 ? splitItems : [section];
      });
      if (sections.length === 0) throw new Error("No sections to render");

      // 3) PDF setup ───────────────────────────────────────────────────
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const PAGE_W = pdf.internal.pageSize.getWidth();   // 210
      const PAGE_H = pdf.internal.pageSize.getHeight();  // 297
      const MARGIN_X = 12;
      const HEADER_H = 18;
      const FOOTER_H = 12;
      const CONTENT_TOP = HEADER_H + 4;
      const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 4;
      const CONTENT_W = PAGE_W - MARGIN_X * 2;
      const CONTENT_H = CONTENT_BOTTOM - CONTENT_TOP;
      const SECTION_GAP_MM = 4;

      // Pre-load the Wizr logo as a data URL AND measure its natural aspect
      // ratio so we can place it without distortion.
      const { dataUrl: logoDataUrl, aspect: logoAspect } = await fetch(wizrLogo)
        .then((r) => r.blob())
        .then(
          (b) =>
            new Promise<{ dataUrl: string; aspect: number }>((res) => {
              const fr = new FileReader();
              fr.onload = () => {
                const dataUrl = fr.result as string;
                const probe = new Image();
                probe.onload = () => res({ dataUrl, aspect: probe.naturalWidth / probe.naturalHeight });
                probe.onerror = () => res({ dataUrl, aspect: 3 });
                probe.src = dataUrl;
              };
              fr.readAsDataURL(b);
            })
        )
        .catch(() => ({ dataUrl: "", aspect: 3 }));

      const reportLabel = report.reportMode === "brand"
        ? `${clientName} · Reporte de marca`
        : `${clientName} · Reporte de benchmark`;

      const drawHeader = (pageNum: number) => {
        // Indigo header band
        pdf.setFillColor(30, 27, 75);   // #1e1b4b
        pdf.rect(0, 0, PAGE_W, HEADER_H, "F");

        if (logoDataUrl) {
          // White rounded badge for the logo. Compute logo size preserving
          // its natural aspect ratio so it never looks stretched.
          const badgeH = 12;
          const badgeY = (HEADER_H - badgeH) / 2;
          const logoMaxH = badgeH - 3;          // padding inside the badge
          const logoMaxW = 26;                  // visual cap
          let logoH = logoMaxH;
          let logoW = logoH * logoAspect;
          if (logoW > logoMaxW) {
            logoW = logoMaxW;
            logoH = logoW / logoAspect;
          }
          const badgeW = logoW + 6;
          pdf.setFillColor(255, 255, 255);
          pdf.roundedRect(MARGIN_X, badgeY, badgeW, badgeH, 1.8, 1.8, "F");
          try {
            pdf.addImage(
              logoDataUrl, "PNG",
              MARGIN_X + 3, badgeY + (badgeH - logoH) / 2,
              logoW, logoH,
              undefined, "FAST",
            );
          } catch { /* noop */ }
        }
        pdf.setTextColor(199, 210, 254);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.text("INTELIGENCIA DE MEDIOS", MARGIN_X + 26, 8);
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(9);
        pdf.text(reportLabel, MARGIN_X + 26, 13);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(226, 232, 240);
        const dateText = dateRange.label;
        const dateW = pdf.getTextWidth(dateText);
        pdf.text(dateText, PAGE_W - MARGIN_X - dateW, 13);

        // page badge
        pdf.setFontSize(7);
        const pageText = `pág. ${pageNum}`;
        const pw = pdf.getTextWidth(pageText);
        pdf.text(pageText, PAGE_W - MARGIN_X - pw, 7);
      };

      const drawFooter = () => {
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.2);
        pdf.line(MARGIN_X, PAGE_H - FOOTER_H, PAGE_W - MARGIN_X, PAGE_H - FOOTER_H);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(107, 114, 128);
        pdf.text(
          `Generado el ${format(new Date(), "d 'de' MMMM yyyy")}  ·  ${dateRange.start}  -  ${dateRange.end}`,
          MARGIN_X,
          PAGE_H - 5
        );
        pdf.setTextColor(55, 65, 81);
        pdf.setFont("helvetica", "bold");
        const right = "Wizr · wizr.mx";
        const rw = pdf.getTextWidth(right);
        pdf.text(right, PAGE_W - MARGIN_X - rw, PAGE_H - 5);
      };

      // 4) Capture each section as its own canvas ────────────────────
      const sectionImages: { dataUrl: string; heightMm: number }[] = [];
      for (const section of sections) {
        // Skip empty/hidden sections
        const rect = section.getBoundingClientRect();
        if (rect.height < 4) continue;

        // scale: 1.5 keeps text crisp at A4 (~150 DPI effective) while cutting
        // canvas pixel area by ~44% versus scale: 2 → much faster captures.
        const canvas = await html2canvas(section, {
          scale: 1.5,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          windowWidth: RENDER_WIDTH_PX,
          // Add a bit of breathing room so Recharts external labels don't get
          // clipped on the right/bottom edges.
          width: section.scrollWidth + 8,
          height: section.scrollHeight + 8,
          // Skip the extra DOM clone pass for elements we don't need to mutate.
          removeContainer: true,
        });

        const imgWidthMm = CONTENT_W;
        const ratio = canvas.height / canvas.width;
        const imgHeightMm = imgWidthMm * ratio;

        sectionImages.push({
          dataUrl: canvas.toDataURL("image/jpeg", 0.85),
          heightMm: imgHeightMm,
        });
      }

      // 5) Lay sections into pages ───────────────────────────────────
      let pageNum = 1;
      let cursorY = CONTENT_TOP;
      drawHeader(pageNum);
      drawFooter();

      const newPage = () => {
        pdf.addPage();
        pageNum += 1;
        cursorY = CONTENT_TOP;
        drawHeader(pageNum);
        drawFooter();
      };

      for (const sec of sectionImages) {
        let { dataUrl, heightMm } = sec;
        const remaining = CONTENT_BOTTOM - cursorY;

        // Section taller than a full page → must be sliced across pages
        if (heightMm > CONTENT_H) {
          // Place from current cursor first
          let placedMm = 0;
          // Helper to draw a vertical slice of the source image
          const placeSlice = (yFromMm: number, sliceHeightMm: number) => {
            // jsPDF will render the full image and we control the visible
            // portion via clipping — easier route: re-render slice from canvas
            // by using a tmp canvas. But we already have only the data URL.
            // Use jsPDF's native image clip: addImage of the FULL image with a
            // negative Y so the desired band lands at yFromMm. We then mask
            // the rest with white rectangles top + bottom.
            const negY = yFromMm - placedMm * (heightMm / heightMm); // identity
            void negY;
            // Simpler path: draw image at (cursorY - placedMm) so the unread
            // portion shows in the writable band, then white-cover above and
            // below the band.
            pdf.addImage(
              dataUrl, "JPEG",
              MARGIN_X,
              yFromMm - placedMm,
              CONTENT_W, heightMm,
              undefined, "FAST",
            );
            // Cover anything above the band
            pdf.setFillColor(255, 255, 255);
            if (yFromMm > 0) pdf.rect(0, 0, PAGE_W, yFromMm, "F");
            // Cover anything below the band
            const bandBottom = yFromMm + sliceHeightMm;
            if (bandBottom < PAGE_H) pdf.rect(0, bandBottom, PAGE_W, PAGE_H - bandBottom, "F");
            // Re-draw header & footer on top of the cover rects
            drawHeader(pageNum);
            drawFooter();
          };

          // First slice on current page
          const firstSliceMm = Math.min(remaining, heightMm);
          placeSlice(cursorY, firstSliceMm);
          placedMm += firstSliceMm;

          // Subsequent slices — full pages until done
          while (placedMm < heightMm - 0.5) {
            newPage();
            const sliceMm = Math.min(CONTENT_H, heightMm - placedMm);
            placeSlice(CONTENT_TOP, sliceMm);
            placedMm += sliceMm;
          }
          cursorY = CONTENT_TOP + (heightMm - (Math.ceil(heightMm / CONTENT_H) - 1) * CONTENT_H) + SECTION_GAP_MM;
          if (cursorY > CONTENT_BOTTOM) {
            newPage();
          }
          continue;
        }

        // Fits on current page?
        if (heightMm > remaining + 0.5) {
          newPage();
        }

        pdf.addImage(
          dataUrl, "JPEG",
          MARGIN_X, cursorY,
          CONTENT_W, heightMm,
          undefined, "FAST",
        );
        cursorY += heightMm + SECTION_GAP_MM;

        // If we're already too close to the bottom, prep next page lazily on
        // the next iteration (handled by the `heightMm > remaining` check).
      }

      const modeSlug = report.reportMode === "brand" ? "marca" : "benchmark";
      const filename = `performance_${modeSlug}_${clientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
      pdf.save(filename);

      toast({ title: "PDF generado", description: filename });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast({
        title: "Error al generar PDF",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      try { root.unmount(); } catch { /* noop */ }
      if (hiddenContainerRef.current?.parentNode) {
        hiddenContainerRef.current.parentNode.removeChild(hiddenContainerRef.current);
      }
      hiddenContainerRef.current = null;
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownloadPDF}
      disabled={isGenerating}
      className="gap-2"
    >
      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      Descargar PDF
    </Button>
  );
}
