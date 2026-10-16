import { forwardRef, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type {
  SmartReportContent,
  InfluencerInfo,
  SourceBreakdown,
  NarrativeInfo,
  TimelinePoint,
  ReportType,
} from "@/hooks/useSmartReport";
import { LOGO_WHITE_B64 } from "@/lib/reports/logoBase64";

/* ─── constants ─── */
const HEADER_BG = "#1e1b4b";
const ACCENT = "#6366f1";
const DARK = "#0f172a";
const FONT = "'Inter', sans-serif";

/* ─── helpers ─── */

function safeDate(iso: string) {
  try { return format(new Date(iso), "d MMM yyyy", { locale: es }); }
  catch { return iso.split("T")[0]; }
}

function fmt(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function platformLabel(d: string) {
  const m: Record<string, string> = {
    "twitter.com": "X/Twitter", "x.com": "X/Twitter", twitter: "X/Twitter",
    "facebook.com": "Facebook", facebook: "Facebook",
    "instagram.com": "Instagram", instagram: "Instagram",
    "tiktok.com": "TikTok", tiktok: "TikTok",
    "youtube.com": "YouTube", youtube: "YouTube",
    "reddit.com": "Reddit", reddit: "Reddit",
    "linkedin.com": "LinkedIn", linkedin: "LinkedIn",
  };
  return m[d] || d.replace(/^www\./, "");
}

function sentColor(s: string) {
  if (s === "negativo") return "#ef4444";
  if (s === "positivo") return "#22c55e";
  return "#94a3b8";
}

function sentLabel(s: string) {
  if (s === "negativo") return "Negativo";
  if (s === "positivo") return "Positivo";
  return "Mixto";
}

const reportTypeBadge: Record<string, { bg: string; label: string }> = {
  crisis: { bg: "#ef4444", label: "CRISIS" },
  brief: { bg: "#3b82f6", label: "BRIEF" },
  thematic: { bg: "#8b5cf6", label: "TEMÁTICO" },
  comparative: { bg: "#0891b2", label: "COMPARATIVO" },
};

/* ─── logo (embedded base64 for reliable rendering) ─── */

/* ─── Inline markdown parser ─── */

function InlineBold({ text }: { text: string }) {
  const parts = text.split(/\*\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
      )}
    </>
  );
}

/** Splits a paragraph into sentence-level fragments, merging tiny tails. */
function splitToBullets(text: string): string[] {
  if (!text) return [];
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const parts = raw.split(/(?<=[\.\?!])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“"\d*])/);
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    if (out.length && t.length < 40) out[out.length - 1] += " " + t;
    else out.push(t);
  }
  return out;
}

function BulletList({ text, fontSize = "12.5px", color = "#0f172a" }: { text: string; fontSize?: string; color?: string }) {
  const items = splitToBullets(text);
  if (items.length < 2) {
    return <p style={{ fontSize, lineHeight: 1.65, color, margin: 0 }}><InlineBold text={text} /></p>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", pageBreakInside: "avoid", breakInside: "avoid" }}>
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: ACCENT, flexShrink: 0, marginTop: "8px" }} />
          <span style={{ fontSize, lineHeight: 1.65, color }}><InlineBold text={it} /></span>
        </li>
      ))}
    </ul>
  );
}

function FormattedText({ text, fontSize = "12.5px" }: { text: string; fontSize?: string }) {
  // If the text has no explicit list/bullet/numbered structure, render as auto-bullets.
  const hasExplicitStructure = /(^|\n)\s*(\d+[.)]\s|[-•*]\s)/.test(text);
  if (!hasExplicitStructure) {
    return <BulletList text={text} fontSize={fontSize} />;
  }
  const paragraphs = text.split(/\n\s*\n/);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {paragraphs.map((para, pi) => {
        const lines = para.split(/\n/).filter(Boolean);
        return (
          <div key={pi} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {lines.map((line, li) => {
              const trimmed = line.trim();
              const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
              if (numMatch) {
                return (
                  <div key={li} style={{ display: "flex", alignItems: "flex-start", gap: "8px", paddingLeft: "4px", fontSize, lineHeight: "1.75" }}>
                    <span style={{ fontWeight: 700, color: ACCENT, minWidth: "18px" }}>{numMatch[1]}.</span>
                    <span><InlineBold text={numMatch[2]} /></span>
                  </div>
                );
              }
              const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
              if (bulletMatch) {
                return (
                  <div key={li} style={{ display: "flex", alignItems: "flex-start", gap: "8px", paddingLeft: "8px", fontSize, lineHeight: "1.75" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: ACCENT, flexShrink: 0, marginTop: "7px" }} />
                    <span><InlineBold text={bulletMatch[1]} /></span>
                  </div>
                );
              }
              const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
              if (boldMatch) {
                return <p key={li} style={{ fontWeight: 700, fontSize, lineHeight: "1.75" }}>{boldMatch[1]}</p>;
              }
              return <p key={li} style={{ fontSize, lineHeight: "1.75" }}><InlineBold text={trimmed} /></p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Chart components (pure HTML/CSS) ─── */

/* FIX 3 — wider labels */
const LABEL_STYLE: React.CSSProperties = {
  minWidth: "140px",
  width: "140px",
  fontSize: "10px",
  color: "#475569",
  textAlign: "right",
  flexShrink: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function HorizontalBarChart({ data, colorFn, maxVal }: {
  data: { label: string; value: number }[];
  colorFn?: (item: { label: string; value: number }, idx: number) => string;
  maxVal?: number;
}) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {data.map((d, i) => {
        const pct = Math.max((d.value / max) * 100, 2);
        const color = colorFn ? colorFn(d, i) : (i < 3 ? ACCENT : "#94a3b8");
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={LABEL_STYLE}>{d.label}</span>
            <div style={{ flex: 1, height: "14px", backgroundColor: "#f1f5f9", borderRadius: "3px", position: "relative", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "4px" }}>
                {pct > 20 && <span style={{ fontSize: "9px", color: "#fff", fontWeight: 600 }}>{d.value}</span>}
              </div>
            </div>
            {pct <= 20 && <span style={{ fontSize: "9px", color: "#64748b", minWidth: "24px" }}>{d.value}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* Stacked horizontal bar chart for sentiment by platform */
function StackedSentimentChart({ data }: {
  data: { label: string; pos: number; neu: number; neg: number; total: number }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {data.map((d, i) => {
        const posPct = d.total > 0 ? (d.pos / d.total) * 100 : 0;
        const neuPct = d.total > 0 ? (d.neu / d.total) * 100 : 0;
        const negPct = d.total > 0 ? (d.neg / d.total) * 100 : 0;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={LABEL_STYLE}>{d.label}</span>
            <div style={{ flex: 1, height: "14px", backgroundColor: "#f1f5f9", borderRadius: "3px", display: "flex", overflow: "hidden" }}>
              {posPct > 0 && <div style={{ width: `${posPct}%`, height: "100%", backgroundColor: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {posPct > 12 && <span style={{ fontSize: "8px", color: "#fff", fontWeight: 600 }}>{Math.round(posPct)}%</span>}
              </div>}
              {neuPct > 0 && <div style={{ width: `${neuPct}%`, height: "100%", backgroundColor: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {neuPct > 12 && <span style={{ fontSize: "8px", color: "#fff", fontWeight: 600 }}>{Math.round(neuPct)}%</span>}
              </div>}
              {negPct > 0 && <div style={{ width: `${negPct}%`, height: "100%", backgroundColor: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {negPct > 12 && <span style={{ fontSize: "8px", color: "#fff", fontWeight: 600 }}>{Math.round(negPct)}%</span>}
              </div>}
            </div>
          </div>
        );
      })}
      {/* legend */}
      <div style={{ display: "flex", gap: "14px", marginTop: "4px", paddingLeft: "148px", fontSize: "9px", color: "#64748b" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22c55e", display: "inline-block" }} />Positivo</span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />Neutral</span>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />Negativo</span>
      </div>
    </div>
  );
}

function VerticalBarChart({ data, highlightMax }: {
  data: { label: string; value: number }[];
  highlightMax?: boolean;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  const maxIdx = data.findIndex(d => d.value === max);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "100px" }}>
        {data.map((d, i) => {
          const h = Math.max((d.value / max) * 90, 4);
          const isMax = highlightMax && i === maxIdx;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
              <span style={{ fontSize: "8px", color: "#475569", fontWeight: 600, marginBottom: "2px" }}>{d.value}</span>
              <div style={{ width: "100%", height: `${h}px`, backgroundColor: isMax ? "#ef4444" : ACCENT, borderRadius: "2px 2px 0 0" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "3px" }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "7px", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}

/* ─── Section wrappers ─── */

const SECTION_STYLE: React.CSSProperties = {
  pageBreakInside: "avoid",
  breakInside: "avoid",
};

/* FIX 8 — crisis-aware SectionHeader */
function SectionHeader({ title, dark, isCrisis }: { title: string; dark?: boolean; isCrisis?: boolean }) {
  const bg = isCrisis ? "#991b1b" : dark ? DARK : ACCENT;
  return (
    <div style={{
      backgroundColor: bg,
      color: "#fff",
      fontSize: "10px",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      padding: "6px 12px",
      borderRadius: "4px 4px 0 0",
    }}>
      {title}
    </div>
  );
}

function SectionBody({ children, bg }: { children: React.ReactNode; bg?: string }) {
  return (
    <div style={{
      border: `0.5px solid ${ACCENT}`,
      borderTop: "none",
      borderRadius: "0 0 4px 4px",
      padding: "14px",
      backgroundColor: bg || "#fff",
    }}>
      {children}
    </div>
  );
}

/* ─── Props ─── */

interface Props {
  report: SmartReportContent;
  projectName: string;
  dateRange: { start: string; end: string; label: string };
  editedTemplate: string;
  reportType?: ReportType;
  pageIndex?: number;
  totalPages?: number;
}

/* ─── Main component ─── */

// eslint-disable-next-line react/display-name
export const SmartReportPDFPreview = forwardRef<HTMLDivElement, Props>(
  ({ report, projectName, dateRange, reportType = "brief" }, ref) => {
    const logoBase64 = LOGO_WHITE_B64;
    const total = report.metrics.totalMentions || 1;
    const posPct = Math.round((report.metrics.positiveCount / total) * 100);
    const neuPct = Math.round((report.metrics.neutralCount / total) * 100);
    const negPct = Math.round((report.metrics.negativeCount / total) * 100);

    const isCrisis = reportType === "crisis";

    const period = `${safeDate(dateRange.start)} — ${safeDate(dateRange.end)}`;
    const generated = format(new Date(), "d MMM yyyy, HH:mm", { locale: es });
    const badge = reportTypeBadge[reportType] || reportTypeBadge.brief;

    // Chart data derived from report
    const mentionsByPlatform = useMemo(() =>
      report.sourceBreakdown.slice(0, 8).map(s => ({ label: platformLabel(s.source), value: s.count })),
      [report.sourceBreakdown]
    );

    /* FIX 4 — limit timeline X-axis to 7 points */
    const dailyMentions = useMemo(() => {
      const points = report.timeline.slice(-14);
      const step = points.length > 7 ? Math.ceil(points.length / 7) : 1;
      return points
        .filter((_, i) => i % step === 0)
        .map((t: TimelinePoint) => ({
          label: (() => { try { return format(new Date(t.date), "dd/MM"); } catch { return t.date; } })(),
          value: t.count,
        }));
    }, [report.timeline]);

    const sentimentByPlatform = useMemo(() =>
      report.sourceBreakdown
        .filter(s => s.count > 0)
        .map(s => ({
          label: platformLabel(s.source),
          pos: s.positive || 0,
          neu: s.neutral || 0,
          neg: s.negative || 0,
          total: s.count,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
      [report.sourceBreakdown]
    );

    const topInfluencersByInteractions = useMemo(() =>
      report.influencers.slice(0, 8).map((inf: InfluencerInfo) => ({
        label: inf.username ? `@${inf.username}` : inf.name,
        value: parseInt(String(inf.reach).replace(/[^\d]/g, "")) || 0,
        sentiment: inf.sentiment,
      })),
      [report.influencers]
    );

    /* FIX 7 — Conclusions: dedicated field or synthesis, NOT keyFindings copy */
    const conclusionBullets = useMemo(() => {
      if ((report as any).conclusions && Array.isArray((report as any).conclusions) && (report as any).conclusions.length > 0) {
        return (report as any).conclusions as string[];
      }
      const t = report.metrics.totalMentions;
      const nPct = Math.round((report.metrics.negativeCount / (t || 1)) * 100);
      const pPct = Math.round((report.metrics.positiveCount / (t || 1)) * 100);
      const topSource = report.sourceBreakdown[0]?.source || "";
      const synthesis: string[] = [];
      if (t > 0) synthesis.push(`El análisis de ${t} menciones revela un entorno digital con ${nPct}% de sentimiento negativo y ${pPct}% positivo en el período evaluado.`);
      if (topSource) synthesis.push(`La plataforma con mayor volumen de conversación fue ${platformLabel(topSource)}, que requiere atención prioritaria en la estrategia de respuesta.`);
      if (report.narratives && report.narratives.length > 0) synthesis.push(`Las narrativas identificadas presentan tendencia ${report.narratives[0].trend}, lo que exige seguimiento continuo en las próximas 72 horas.`);
      synthesis.push(`Se recomienda implementar las acciones estratégicas señaladas en este reporte como respuesta inmediata para gestionar el impacto reputacional detectado.`);
      return synthesis;
    }, [report]);

    const conclusionIntro = "Con base en el análisis integral de las menciones recopiladas, se presentan las siguientes conclusiones estratégicas:";

    // Daily change %
    const dailyChange = useMemo(() => {
      if (report.timeline.length < 2) return null;
      const last = report.timeline[report.timeline.length - 1]?.count || 0;
      const prev = report.timeline[report.timeline.length - 2]?.count || 1;
      return Math.round(((last - prev) / prev) * 100);
    }, [report.timeline]);

    return (
      <div
        ref={ref}
        style={{ width: 794, fontFamily: FONT, backgroundColor: "#fff", color: "#111827", fontSize: "12.5px", lineHeight: 1.6 }}
      >
        {/* Google Fonts link for html2canvas */}
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>

        {/* ═══ 1. HEADER ═══ */}
        <div style={{ backgroundColor: HEADER_BG, padding: "28px 32px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px" }}>
          {/* Logo left */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            {logoBase64 ? (
              <img src={logoBase64} alt="Wizr" style={{ height: "44px", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: "16px", color: "#e2e8f0", letterSpacing: "0.08em", fontWeight: 700 }}>WIZR</span>
            )}
          </div>

          {/* Right */}
          <div style={{ textAlign: "right", flexShrink: 1, minWidth: 0 }}>
            <span style={{
              display: "inline-block", whiteSpace: "nowrap",
              backgroundColor: badge.bg, color: "#fff",
              fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
              padding: "3px 10px", borderRadius: "4px", letterSpacing: "0.06em", lineHeight: "1.4",
            }}>
              {badge.label}
            </span>
            <h1 style={{ color: "#f8fafc", fontSize: "15px", fontWeight: 700, marginTop: "6px", lineHeight: 1.35 }}>
              {report.title}
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "11px", marginTop: "4px" }}>{period} · Generado: {generated}</p>
          </div>
        </div>

        {/* ═══ 2. METRICS ROW ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", borderBottom: "1px solid #e2e8f0" }}>
          {[
            { v: fmt(report.metrics.estimatedImpressions || 0), l: "Impresiones Est.", c: ACCENT },
            { v: report.metrics.totalMentions.toString(), l: "Total Menciones", c: ACCENT },
            { v: fmt(report.metrics.estimatedReach || 0), l: "Alcance Est.", c: ACCENT },
            { v: `${negPct}%`, l: "% Negativo", c: "#ef4444" },
            { v: `${posPct}%`, l: "% Positivo", c: "#22c55e" },
          ].map((m, i) => (
            <div key={i} style={{
              padding: "16px 12px",
              textAlign: "center",
              backgroundColor: "#fff",
              borderRight: i < 4 ? "1px solid #e2e8f0" : "none",
            }}>
              <p style={{ fontSize: "22px", fontWeight: 500, color: m.c, margin: 0 }}>{m.v}</p>
              <p style={{ fontSize: "11px", color: "#94a3b8", margin: "4px 0 0" }}>{m.l}</p>
            </div>
          ))}
        </div>

        {/* ═══ 3. SENTIMENT BAR ═══ */}
        <div style={{ padding: "16px 24px" }}>
          <div style={{ display: "flex", height: "28px", borderRadius: "6px", overflow: "hidden" }}>
            {posPct > 0 && (
              <div style={{ width: `${posPct}%`, backgroundColor: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: 700 }}>
                {posPct > 5 && `${posPct}%`}
              </div>
            )}
            {neuPct > 0 && (
              <div style={{ width: `${neuPct}%`, backgroundColor: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: 700 }}>
                {neuPct > 5 && `${neuPct}%`}
              </div>
            )}
            {negPct > 0 && (
              <div style={{ width: `${negPct}%`, backgroundColor: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: 700 }}>
                {negPct > 5 && `${negPct}%`}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "20px", marginTop: "8px", fontSize: "10px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#22c55e", display: "inline-block" }} />Positivo {posPct}%</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />Neutral {neuPct}%</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />Negativo {negPct}%</span>
          </div>
        </div>

        {/* FIX 8 — Crisis alert banner */}
        {isCrisis && (
          <div style={{ margin: "0 24px 8px", padding: "12px 16px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span style={{ fontSize: "18px", flexShrink: 0 }}>🔴</span>
            <div>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#991b1b", margin: 0 }}>Modo Crisis Activado</p>
              <p style={{ fontSize: "11px", color: "#b91c1c", margin: "2px 0 0", lineHeight: 1.5 }}>Este reporte requiere atención inmediata. Las recomendaciones estratégicas deben implementarse en las próximas 24–72 horas.</p>
            </div>
          </div>
        )}

        {/* ═══ 4. BODY ═══ */}
        {/* FIX 5 — paddingTop added */}
        <div style={{ padding: "8px 24px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* — Resumen Ejecutivo — */}
          <div data-pdf-section style={SECTION_STYLE}>
            <SectionHeader title="Resumen Ejecutivo" isCrisis={isCrisis} />
            <SectionBody>
              <FormattedText text={report.summary} />
            </SectionBody>
          </div>

          {/* — Visualización de Datos — */}
          <div data-pdf-section style={SECTION_STYLE}>
            <SectionHeader title="Visualización de Datos" isCrisis={isCrisis} />
            <SectionBody>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {/* Chart 1: Menciones por plataforma */}
                <div style={{ border: "0.5px solid #e2e8f0", borderRadius: "6px", padding: "14px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                  <p style={{ fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.06em", marginBottom: "10px", fontWeight: 600 }}>Menciones por plataforma</p>
                  {mentionsByPlatform.length > 0 ? (
                    <HorizontalBarChart data={mentionsByPlatform} />
                  ) : (
                    <p style={{ fontSize: "10px", color: "#cbd5e1" }}>Sin datos</p>
                  )}
                </div>

                {/* Chart 2: Evolución diaria */}
                <div style={{ border: "0.5px solid #e2e8f0", borderRadius: "6px", padding: "14px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                  <p style={{ fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.06em", marginBottom: "10px", fontWeight: 600 }}>Evolución diaria de menciones</p>
                  {dailyMentions.length > 0 ? (
                    <>
                      <VerticalBarChart data={dailyMentions} highlightMax />
                      {dailyChange !== null && (
                        <p style={{ fontSize: "9px", color: "#64748b", marginTop: "6px", textAlign: "right" }}>
                          {dailyChange >= 0 ? "+" : ""}{dailyChange}% vs día anterior
                        </p>
                      )}
                    </>
                  ) : (
                    <p style={{ fontSize: "10px", color: "#cbd5e1" }}>Sin datos</p>
                  )}
                </div>

                {/* Chart 3: % de sentimiento por plataforma (stacked) */}
                <div style={{ border: "0.5px solid #e2e8f0", borderRadius: "6px", padding: "14px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                  <p style={{ fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.06em", marginBottom: "10px", fontWeight: 600 }}>% de sentimiento por plataforma</p>
                  {sentimentByPlatform.length > 0 ? (
                    <StackedSentimentChart data={sentimentByPlatform} />
                  ) : (
                    <p style={{ fontSize: "10px", color: "#cbd5e1" }}>Sin datos</p>
                  )}
                </div>

                {/* Chart 4: Top influenciadores por interacciones */}
                <div style={{ border: "0.5px solid #e2e8f0", borderRadius: "6px", padding: "14px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                  <p style={{ fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.06em", marginBottom: "10px", fontWeight: 600 }}>Top influenciadores por interacciones</p>
                  {topInfluencersByInteractions.length > 0 ? (
                    <HorizontalBarChart
                      data={topInfluencersByInteractions}
                      colorFn={(d) => {
                        const inf = topInfluencersByInteractions.find(x => x.label === d.label);
                        return sentColor(inf?.sentiment || "mixto");
                      }}
                    />
                  ) : (
                    <p style={{ fontSize: "10px", color: "#cbd5e1" }}>Sin datos</p>
                  )}
                </div>
              </div>
            </SectionBody>
          </div>

          {/* — Hallazgos Clave — */}
          <div data-pdf-section style={SECTION_STYLE}>
            <SectionHeader title="Hallazgos Clave" isCrisis={isCrisis} />
            <SectionBody>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {report.keyFindings.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                    {/* FIX 1 — stable numbered circle with line-height fix */}
                    <span style={{
                      flexShrink: 0, width: "22px", height: "22px", borderRadius: "50%",
                      backgroundColor: ACCENT, color: "#fff", fontSize: "11px", fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px",
                      lineHeight: "22px",
                    }}>{i + 1}</span>
                    <span style={{ fontSize: "12.5px", lineHeight: "1.65" }}><InlineBold text={f} /></span>
                  </div>
                ))}
              </div>
            </SectionBody>
          </div>

          {/* — Influenciadores — */}
          {report.influencers.length > 0 && (
            <div data-pdf-section style={SECTION_STYLE}>
              <SectionHeader title="Influenciadores de la Conversación" isCrisis={isCrisis} />
              <SectionBody>
                <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: DARK }}>
                      {["#", "Perfil", "Red", "Menciones", "Sentimiento", "Interacciones"].map((h, i) => (
                        <th key={i} style={{ padding: "6px 8px", color: "#e2e8f0", fontWeight: 700, textAlign: i === 0 || i >= 3 ? "center" : "left", fontSize: "10px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.influencers.map((inf: InfluencerInfo, i: number) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", pageBreakInside: "avoid", breakInside: "avoid" }}>
                        <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 500 }}>{i + 1}</td>
                        <td style={{ padding: "5px 8px", fontWeight: 500 }}>{inf.username ? `@${inf.username}` : inf.name}</td>
                        <td style={{ padding: "5px 8px", fontWeight: 500 }}>{platformLabel(inf.platform)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 500 }}>{inf.mentions}</td>
                        <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 600, color: sentColor(inf.sentiment) }}>{sentLabel(inf.sentiment)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 500 }}>{inf.reach}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionBody>
            </div>
          )}

          {/* — Principales Narrativas — */}
          {report.narratives && report.narratives.length > 0 && (
            <div data-pdf-section style={SECTION_STYLE}>
              <SectionHeader title="Principales Narrativas" isCrisis={isCrisis} />
              <SectionBody>
                {/* Volume bar chart by sentiment (inline SVG) */}
                {(() => {
                  const totalNarr = report.narratives.reduce((s, n) => s + (Number.isFinite(n.mentions) && n.mentions > 0 ? n.mentions : 0), 0) || 1;
                  const maxV = Math.max(...report.narratives.map(n => Number.isFinite(n.mentions) && n.mentions > 0 ? n.mentions : 0), 1);
                  const W = 720;
                  const H = 220;
                  const padL = 36, padR = 16, padT = 30, padB = 48;
                  const innerW = W - padL - padR;
                  const innerH = H - padT - padB;
                  const n = report.narratives.length;
                  const slot = innerW / n;
                  const barW = Math.min(64, slot * 0.62);
                  const SENT: Record<string, string> = {
                    positivo: "#22C55E", negativo: "#EF4444", mixto: "#F59E0B", neutral: "#9CA3AF",
                  };
                  return (
                    <div style={{ marginBottom: "12px", border: "0.5px solid #e2e8f0", borderRadius: "6px", padding: "10px 12px", background: "#fafafc" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Volumen por narrativa · {totalNarr} menciones temáticas
                      </div>
                      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
                        {[0.25, 0.5, 0.75, 1].map(t => {
                          const y = padT + innerH - innerH * t;
                          return (
                            <g key={t}>
                              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="3 4" />
                              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(maxV * t)}</text>
                            </g>
                          );
                        })}
                        {report.narratives.map((nar, i) => {
                          const v = Number.isFinite(nar.mentions) && nar.mentions > 0 ? nar.mentions : 0;
                          const h = (v / maxV) * innerH;
                          const x = padL + i * slot + (slot - barW) / 2;
                          const y = padT + innerH - h;
                          const c = SENT[nar.sentiment] || SENT.neutral;
                          const pct = Math.round((v / totalNarr) * 100);
                          return (
                            <g key={i}>
                              <rect x={x} y={y} width={barW} height={h} rx="3" fill={c} />
                              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a">{v} · {pct}%</text>
                              <text x={x + barW / 2} y={padT + innerH + 14} textAnchor="middle" fontSize="10" fontWeight="700" fill="#475569">N{i + 1}</text>
                              <text x={x + barW / 2} y={padT + innerH + 28} textAnchor="middle" fontSize="8" fill="#94a3b8">{(nar.sentiment || "").slice(0, 8)}</text>
                            </g>
                          );
                        })}
                      </svg>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "4px", fontSize: "9px", color: "#475569" }}>
                        {[
                          { l: "Positivo", c: SENT.positivo },
                          { l: "Negativo", c: SENT.negativo },
                          { l: "Mixto", c: SENT.mixto },
                          { l: "Neutral", c: SENT.neutral },
                        ].map(s => (
                          <span key={s.l} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: s.c, display: "inline-block" }} />
                            {s.l}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {report.narratives.map((n: NarrativeInfo, i: number) => {
                    const sentBadge = n.sentiment === "negativo"
                      ? { bg: "#fef2f2", color: "#b91c1c" }
                      : n.sentiment === "positivo"
                        ? { bg: "#f0fdf4", color: "#166534" }
                        : { bg: "#f1f5f9", color: "#475569" };
                    const trendIcon = n.trend === "creciente" ? "↑" : n.trend === "decreciente" ? "↓" : "→";
                    return (
                      <div key={i} style={{ border: "0.5px solid #e2e8f0", borderRadius: "6px", padding: "10px 12px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#3D1FD8", padding: "1px 6px", border: "1px solid #3D1FD8", borderRadius: "3px" }}>N{i + 1}</span>
                          <span style={{ fontSize: "12.5px", fontWeight: 500 }}>{n.narrative}</span>
                          <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "3px", backgroundColor: sentBadge.bg, color: sentBadge.color, fontWeight: 600 }}>
                            {sentLabel(n.sentiment)}
                          </span>
                          <span style={{ fontSize: "10px", color: "#94a3b8" }}>{n.mentions} menciones</span>
                          <span style={{ fontSize: "10px", color: "#94a3b8" }}>{trendIcon} {n.trend}</span>
                        </div>
                        <div style={{ marginTop: "4px" }}><BulletList text={n.description} fontSize="12px" color="#64748b" /></div>
                      </div>
                    );
                  })}
                </div>
              </SectionBody>
            </div>
          )}

          {/* — Términos Destacados (Keyword Cloud) — */}
          {(report as { keywords?: { term: string; count: number; sentiment: string }[] }).keywords && (report as { keywords?: { term: string; count: number; sentiment: string }[] }).keywords!.length > 0 && (
            <div data-pdf-section style={SECTION_STYLE}>
              <SectionHeader title="Términos Destacados" isCrisis={isCrisis} />
              <SectionBody>
                {(() => {
                  const kws = (report as { keywords: { term: string; count: number; sentiment: string }[] }).keywords;
                  const maxC = Math.max(...kws.map(k => k.count), 1);
                  const minC = Math.min(...kws.map(k => k.count), 1);
                  const range = Math.max(1, maxC - minC);
                  const KW_SENT: Record<string, { bg: string; text: string; border: string }> = {
                    positivo: { bg: "#ecfdf5", text: "#166534", border: "#bbf7d0" },
                    negativo: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
                    mixto: { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
                    neutral: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" },
                  };
                  const insight = (report as { keywordsInsight?: string }).keywordsInsight;
                  return (
                    <>
                      <p style={{ fontSize: "10px", color: "#64748b", marginBottom: "10px", lineHeight: 1.5 }}>
                        Conceptos más recurrentes en la conversación, dimensionados por frecuencia y coloreados por sentimiento.
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", padding: "8px 4px" }}>
                        {kws.map((k, i) => {
                          const norm = (k.count - minC) / range;
                          const fontSize = 10 + Math.round(norm * 9); // 10..19px
                          const opacity = 0.75 + norm * 0.25;
                          const s = KW_SENT[k.sentiment] || KW_SENT.mixto;
                          return (
                            <span key={i} style={{
                              display: "inline-flex", alignItems: "baseline", gap: "4px",
                              borderRadius: "999px", padding: "3px 10px",
                              backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}`,
                              fontSize: `${fontSize}px`, fontWeight: 700, lineHeight: 1.25, opacity,
                            }}>
                              {k.term}
                              <span style={{ fontSize: "8px", fontWeight: 500, opacity: 0.7 }}>{k.count}</span>
                            </span>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "10px", fontSize: "9px", color: "#475569", justifyContent: "center" }}>
                        {(["positivo","negativo","mixto","neutral"] as const).map(sk => (
                          <span key={sk} style={{ display: "inline-flex", alignItems: "center", gap: "4px", textTransform: "capitalize" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: KW_SENT[sk].text, display: "inline-block" }} />
                            {sk}
                          </span>
                        ))}
                      </div>
                      {insight && (
                        <p style={{ fontSize: "10px", color: "#475569", marginTop: "10px", lineHeight: 1.6, fontStyle: "italic", borderLeft: `2px solid ${ACCENT}`, paddingLeft: "10px" }}>
                          {insight}
                        </p>
                      )}
                    </>
                  );
                })()}
              </SectionBody>
            </div>
          )}

          <div data-pdf-section style={SECTION_STYLE}>
            <SectionHeader title="Recomendaciones Estratégicas" isCrisis={isCrisis} />
            <SectionBody>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {report.recommendations.map((rec, i) => {
                  const urgencyMatch = rec.match(/\((\d+\s*hrs?)\)/i);
                  const urgency = urgencyMatch ? urgencyMatch[1] : null;
                  const cleanRec = urgency ? rec.replace(urgencyMatch![0], "").trim() : rec;
                  const dotIdx = cleanRec.indexOf(".");
                  const title = dotIdx > 0 ? cleanRec.slice(0, dotIdx + 1) : cleanRec;
                  const desc = dotIdx > 0 ? cleanRec.slice(dotIdx + 1).trim() : "";

                  return (
                    <div key={i} style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 0" }}>
                        {/* FIX 1 — stable numbered circle with line-height fix */}
                        <span style={{
                          flexShrink: 0, width: "22px", height: "22px", borderRadius: "50%",
                          backgroundColor: DARK, color: "#fff", fontSize: "11px", fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px",
                          lineHeight: "22px",
                        }}>{i + 1}</span>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "12.5px", fontWeight: 500 }}><InlineBold text={title} /></span>
                            {urgency && (
                              <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "3px", backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 600 }}>
                                {urgency}
                              </span>
                            )}
                          </div>
                          {/* FIX 6 — darker description color */}
                          {desc && <p style={{ fontSize: "12px", color: "#475569", lineHeight: 1.6, marginTop: "2px" }}><InlineBold text={desc} /></p>}
                        </div>
                      </div>
                      {i < report.recommendations.length - 1 && (
                        <div style={{ height: "0.5px", backgroundColor: "#e2e8f0" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionBody>
          </div>

          {/* — Conclusiones — */}
          <div data-pdf-section style={SECTION_STYLE}>
            <SectionHeader title="Conclusiones" dark isCrisis={isCrisis} />
            <SectionBody bg="#f8fafc">
              <div style={{ marginBottom: "10px" }}><BulletList text={conclusionIntro} fontSize="12.5px" /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {conclusionBullets.map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: ACCENT, flexShrink: 0, marginTop: "7px" }} />
                    <span style={{ fontSize: "12.5px", lineHeight: 1.65 }}><InlineBold text={b} /></span>
                  </div>
                ))}
              </div>
            </SectionBody>
          </div>
        </div>

        {/* ═══ 5. FOOTER ═══ */}
        <div style={{ backgroundColor: HEADER_BG, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {logoBase64 ? (
              <img src={logoBase64} alt="Wizr" style={{ height: "22px", objectFit: "contain" }} />
            ) : (
              <>
                <div style={{ width: "20px", height: "20px", backgroundColor: ACCENT, borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                </div>
                <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>Wizr</span>
              </>
            )}
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Generado con Wizr</span>
        </div>
      </div>
    );
  }
);
