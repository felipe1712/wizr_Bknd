import type {
  SmartReportContent,
  InfluencerInfo,
  TimelinePoint,
  MediaOutletInfo,
  NarrativeInfo,
} from "@/hooks/useSmartReport";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { WIZR_LOGO_COLOR_B64 } from "./wizrLogoColor";

interface DateRange {
  start: string;
  end: string;
  label: string;
}

// Wizr palette — refined for editorial slide deck
const C = {
  // Dark (cover/closing)
  ink: "#0B0A1F",
  inkSoft: "#1A1638",
  // Light (content)
  paper: "#FAFAFC",
  paperAlt: "#F2F1F8",
  border: "#E5E3EE",
  // Brand
  violet: "#3D1FD8",
  violetSoft: "#EBE8FB",
  violetGlow: "#6B4FF5",
  orange: "#FF6B2C",
  orangeSoft: "#FFE9DD",
  // Text
  text: "#0B0A1F",
  textMid: "#4A4760",
  textMuted: "#8E8BA3",
  // Sentiment
  positive: "#22C55E",
  negative: "#EF4444",
  neutral: "#9CA3AF",
  warning: "#F59E0B",
};

function esc(t: string | undefined | null): string {
  if (!t) return "";
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Escapes HTML and converts **bold** markdown to <strong>. Strips unpaired ** left by truncation. */
function escMd(t: string | undefined | null): string {
  if (!t) return "";
  const escaped = esc(t);
  // Convert paired **...** to <strong>
  const withBold = escaped.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  // Strip any remaining stray ** (from truncated text)
  return withBold.replace(/\*\*/g, "");
}

function fmtNum(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("es-MX");
}

function sentColor(s: string): string {
  if (s === "positivo") return C.positive;
  if (s === "negativo") return C.negative;
  if (s === "mixto") return C.warning;
  return C.neutral;
}

function sentLabel(s: string): string {
  if (s === "positivo") return "Positivo";
  if (s === "negativo") return "Negativo";
  if (s === "mixto") return "Mixto";
  return "Neutral";
}

function trendIcon(t: string): string {
  if (t === "creciente") return "▲";
  if (t === "decreciente") return "▼";
  return "■";
}

function truncate(t: string, n: number): string {
  const s = (t || "").replace(/\s+/g, " ").trim();
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

// Wizr sparkles — vector accent reused across slides
function sparkles(color = C.orange, opacity = 1): string {
  return `<svg width="180" height="180" viewBox="0 0 180 180" style="opacity:${opacity};">
    <path d="M90 20 L96 50 L126 56 L96 62 L90 92 L84 62 L54 56 L84 50 Z" fill="${color}"/>
    <path d="M150 90 L154 110 L174 114 L154 118 L150 138 L146 118 L126 114 L146 110 Z" fill="${color}"/>
    <path d="M40 110 L43 124 L57 127 L43 130 L40 144 L37 130 L23 127 L37 124 Z" fill="${color}"/>
  </svg>`;
}

/** Slide chrome — 1920x1080 base canvas */
function slideShell(opts: {
  bg: "dark" | "light" | "accent";
  pageNumber: number;
  total: number;
  projectName: string;
  body: string;
  showHeader?: boolean;
  sectionLabel?: string;
}): string {
  const isDark = opts.bg === "dark";
  const isAccent = opts.bg === "accent";
  let bg: string;
  let fg: string;
  let subtle: string;
  if (isDark) {
    bg = `background: radial-gradient(ellipse at top right, ${C.inkSoft} 0%, ${C.ink} 60%);`;
    fg = "#FFFFFF";
    subtle = "rgba(255,255,255,0.5)";
  } else if (isAccent) {
    bg = `background: linear-gradient(135deg, ${C.violetSoft} 0%, ${C.paper} 100%);`;
    fg = C.text;
    subtle = C.textMuted;
  } else {
    bg = `background: ${C.paper};`;
    fg = C.text;
    subtle = C.textMuted;
  }

  const header = opts.showHeader === false ? "" : `
    <header style="position:absolute;top:44px;left:80px;right:80px;display:flex;justify-content:space-between;align-items:center;z-index:5;">
      <div style="display:flex;align-items:center;gap:14px;">
        <img src="${WIZR_LOGO_COLOR_B64}" alt="Wizr" style="height:54px;${isDark ? "filter:brightness(0) invert(1);" : ""}"/>
      </div>
      ${opts.sectionLabel ? `<div style="font-size:13px;letter-spacing:0.25em;color:${isDark ? "rgba(255,255,255,0.6)" : C.textMuted};font-weight:700;text-transform:uppercase;">${esc(opts.sectionLabel)}</div>` : ""}
    </header>`;

  return `<section class="slide" style="position:relative;width:1920px;height:1080px;${bg}color:${fg};font-family:'Inter','Segoe UI',sans-serif;overflow:hidden;page-break-after:always;break-after:page;">
    ${header}
    ${opts.body}
    <footer style="position:absolute;left:80px;right:80px;bottom:36px;display:flex;justify-content:space-between;align-items:center;font-size:14px;color:${subtle};letter-spacing:0.08em;z-index:5;">
      <span style="font-weight:600;text-transform:uppercase;">${esc(opts.projectName)}</span>
      <span style="font-variant-numeric:tabular-nums;">${String(opts.pageNumber).padStart(2, "0")} / ${String(opts.total).padStart(2, "0")}</span>
    </footer>
  </section>`;
}

// ---------- SVG charts ----------

function svgDonut(pos: number, neu: number, neg: number, size = 380): string {
  const total = Math.max(pos + neu + neg, 1);
  const r = size / 2 - 36;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const segs = [
    { val: pos, color: C.positive },
    { val: neu, color: C.neutral },
    { val: neg, color: C.negative },
  ];
  let offset = 0;
  const arcs = segs
    .map((s) => {
      const len = (s.val / total) * circ;
      const dash = `${len} ${circ - len}`;
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="56" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
      offset += len;
      return el;
    })
    .join("");
  const dom = pos >= neg && pos >= neu ? "Positivo" : neg >= neu ? "Negativo" : "Neutral";
  const domColor = dom === "Positivo" ? C.positive : dom === "Negativo" ? C.negative : C.neutral;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${arcs}
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="72" font-weight="800" fill="${C.text}" font-family="'Inter',sans-serif">${total}</text>
    <text x="${cx}" y="${cy + 28}" text-anchor="middle" font-size="18" fill="${C.textMuted}" letter-spacing="2">MENCIONES</text>
    <text x="${cx}" y="${cy + 64}" text-anchor="middle" font-size="20" font-weight="700" fill="${domColor}">${dom.toUpperCase()}</text>
  </svg>`;
}

function svgAreaTimeline(timeline: TimelinePoint[], width = 1620, height = 420): string {
  if (!timeline.length) return "";
  const data = timeline;
  const maxV = Math.max(...data.map((d) => d.count), 1);
  const padX = 60;
  const padY = 60;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padY + innerH - (d.count / maxV) * innerH;
    return `${x},${y}`;
  });
  const path = `M${padX},${padY + innerH} L${points.join(" L")} L${padX + (data.length - 1) * stepX},${padY + innerH} Z`;
  const linePath = `M${points.join(" L")}`;

  const peakIdx = data.indexOf(data.reduce((a, b) => (a.count > b.count ? a : b)));
  const peak = data[peakIdx];
  const peakX = padX + peakIdx * stepX;
  const peakY = padY + innerH - (peak.count / maxV) * innerH;

  // Y grid lines (4)
  const grid = [0.25, 0.5, 0.75, 1].map((t) => {
    const y = padY + innerH - innerH * t;
    const v = Math.round(maxV * t);
    return `<line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="${C.border}" stroke-width="1" stroke-dasharray="4 6"/>
      <text x="${padX - 12}" y="${y + 5}" text-anchor="end" font-size="14" fill="${C.textMuted}">${v}</text>`;
  }).join("");

  const labelEvery = Math.max(1, Math.floor(data.length / 8));
  const xLabels = data
    .map((d, i) => {
      if (i % labelEvery !== 0 && i !== data.length - 1) return "";
      const x = padX + i * stepX;
      const lbl = d.date.slice(5);
      return `<text x="${x}" y="${height - 14}" text-anchor="middle" font-size="14" fill="${C.textMuted}">${lbl}</text>`;
    })
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${C.violet}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${C.violet}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    ${grid}
    <path d="${path}" fill="url(#areaGrad)"/>
    <path d="${linePath}" fill="none" stroke="${C.violet}" stroke-width="3.5" stroke-linejoin="round"/>
    <line x1="${peakX}" y1="${padY}" x2="${peakX}" y2="${padY + innerH}" stroke="${C.orange}" stroke-width="1.5" stroke-dasharray="4 4"/>
    <circle cx="${peakX}" cy="${peakY}" r="11" fill="${C.orange}" stroke="#fff" stroke-width="3"/>
    <g transform="translate(${peakX}, ${peakY - 28})">
      <rect x="-50" y="-26" width="100" height="26" rx="13" fill="${C.orange}"/>
      <text x="0" y="-7" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">PICO · ${peak.count}</text>
    </g>
    ${xLabels}
  </svg>`;
}

function svgHorizontalBars(
  data: { label: string; value: number; color?: string }[],
  width = 1700,
  rowH = 56,
): string {
  if (!data.length) return "";
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const labelW = 320;
  const valueW = 180;
  const barW = width - labelW - valueW - 60;
  const height = data.length * rowH + 20;
  const rows = data
    .map((d, i) => {
      const y = i * rowH + 10;
      const w = (d.value / max) * barW;
      const color = d.color || C.violet;
      const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
      return `
        <text x="${labelW - 20}" y="${y + rowH / 2 + 7}" text-anchor="end" font-size="20" font-weight="600" fill="${C.text}">${esc(truncate(d.label, 28))}</text>
        <rect x="${labelW}" y="${y + 14}" width="${barW}" height="${rowH - 28}" rx="4" fill="${C.paperAlt}"/>
        <rect x="${labelW}" y="${y + 14}" width="${w}" height="${rowH - 28}" rx="4" fill="${color}"/>
        <text x="${labelW + barW + 20}" y="${y + rowH / 2 + 7}" font-size="20" font-weight="700" fill="${C.text}">${fmtNum(d.value)} <tspan font-size="14" font-weight="500" fill="${C.textMuted}">· ${pct}%</tspan></text>
      `;
    })
    .join("");
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rows}</svg>`;
}

function svgVerticalBarsNarratives(
  data: { label: string; value: number; pct: number; color: string }[],
  width = 1700,
  height = 360,
): string {
  if (!data.length) return "";
  const max = Math.max(...data.map((d) => d.value), 1);
  const padL = 70;
  const padR = 30;
  const padT = 60;
  const padB = 50;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const slot = innerW / data.length;
  const barW = Math.min(180, slot * 0.6);

  const grid = [0.25, 0.5, 0.75, 1].map((t) => {
    const y = padT + innerH - innerH * t;
    const v = Math.round(max * t);
    return `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="${C.border}" stroke-width="1" stroke-dasharray="4 6"/>
      <text x="${padL - 14}" y="${y + 6}" text-anchor="end" font-size="16" fill="${C.textMuted}">${v}</text>`;
  }).join("");

  const bars = data
    .map((d, i) => {
      const h = (d.value / max) * innerH;
      const x = padL + i * slot + (slot - barW) / 2;
      const y = padT + innerH - h;
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="6" fill="${d.color}"/>
        <text x="${x + barW / 2}" y="${y - 14}" text-anchor="middle" font-size="22" font-weight="800" fill="${C.text}">${d.value}</text>
        <text x="${x + barW / 2}" y="${y - 38}" text-anchor="middle" font-size="14" font-weight="600" fill="${C.textMid}">${d.pct}%</text>
        <text x="${x + barW / 2}" y="${padT + innerH + 32}" text-anchor="middle" font-size="22" font-weight="800" fill="${C.text}" letter-spacing="1">N${String(i + 1).padStart(2, "0")}</text>
      `;
    })
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${grid}${bars}</svg>`;
}

// ---------- Slides ----------

function slideCover(report: SmartReportContent, projectName: string, dateRange: DateRange, total: number): string {
  const dateLabel = `${format(new Date(dateRange.start), "d MMM", { locale: es })} — ${format(new Date(dateRange.end), "d MMM yyyy", { locale: es })}`;

  const body = `
    <!-- Two-column layout: dark left (editorial), white right (logo) -->
    <div style="position:absolute;inset:0;display:grid;grid-template-columns:1.35fr 1fr;">
      <!-- LEFT: Dark editorial panel -->
      <div style="position:relative;overflow:hidden;padding:96px 88px;display:flex;flex-direction:column;justify-content:space-between;">
        <!-- Violet glow bottom-left -->
        <div style="position:absolute;bottom:-260px;left:-260px;width:780px;height:780px;border-radius:50%;background:radial-gradient(circle, ${C.violetGlow} 0%, transparent 70%);opacity:0.45;pointer-events:none;"></div>
        <!-- Orange glow top-right -->
        <div style="position:absolute;top:-180px;right:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle, rgba(255,107,44,0.18) 0%, transparent 70%);pointer-events:none;"></div>
        <!-- Orange sparkle accent -->
        <div style="position:absolute;top:60px;right:40px;transform:scale(1.6);opacity:0.85;pointer-events:none;">
          ${sparkles(C.orange, 0.9)}
        </div>

        <!-- Top: section eyebrow -->
        <div style="position:relative;z-index:5;">
          <div style="display:inline-flex;align-items:center;gap:12px;padding:11px 24px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:100px;backdrop-filter:blur(8px);">
            <span style="width:8px;height:8px;border-radius:50%;background:${C.orange};box-shadow:0 0 0 6px rgba(255,107,44,0.18);"></span>
            <span style="font-size:13px;letter-spacing:0.28em;color:#fff;font-weight:700;text-transform:uppercase;">Reporte Visual · Inteligencia de Medios</span>
          </div>
        </div>

        <!-- Center: editorial title block -->
        <div style="position:relative;z-index:5;display:flex;flex-direction:column;gap:36px;">
          <div style="display:flex;align-items:center;gap:20px;">
            <span style="width:64px;height:3px;background:${C.orange};"></span>
            <span style="font-size:14px;letter-spacing:0.32em;color:rgba(255,255,255,0.55);font-weight:700;text-transform:uppercase;">Periodo</span>
            <span style="font-size:18px;color:rgba(255,255,255,0.85);font-weight:500;letter-spacing:0.01em;">${dateLabel}</span>
          </div>
          <h1 style="font-size:148px;font-weight:800;line-height:0.92;margin:0;letter-spacing:-0.045em;color:#fff;">${esc(projectName)}</h1>
          <p style="font-size:24px;line-height:1.45;color:rgba(255,255,255,0.7);font-weight:400;max-width:780px;margin:0;">
            Síntesis estratégica de la conversación pública: narrativas, sentimiento, voces clave y ventanas de incidencia para la toma de decisiones.
          </p>
        </div>

        <!-- Bottom: minimal author/footer line -->
        <div style="position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.12);padding-top:28px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <span style="font-size:11px;letter-spacing:0.32em;color:rgba(255,255,255,0.45);font-weight:700;text-transform:uppercase;">Elaborado por</span>
            <span style="font-size:14px;color:rgba(255,255,255,0.85);font-weight:600;letter-spacing:0.04em;">Wizr · Análisis Estratégico</span>
          </div>
          <div style="font-size:11px;letter-spacing:0.32em;color:rgba(255,255,255,0.45);font-weight:700;text-transform:uppercase;">Confidencial</div>
        </div>
      </div>

      <!-- RIGHT: White panel with large Wizr logo -->
      <div style="position:relative;background:#FFFFFF;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;">
        <!-- Subtle violet accent shapes -->
        <div style="position:absolute;top:-120px;right:-120px;width:360px;height:360px;border-radius:50%;background:${C.violetSoft};opacity:0.6;"></div>
        <div style="position:absolute;bottom:-160px;left:-160px;width:420px;height:420px;border-radius:50%;background:${C.violetSoft};opacity:0.45;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:${C.orange};box-shadow:0 0 0 14px rgba(255,107,44,0.12);"></div>

        <!-- Logo big -->
        <div style="position:relative;z-index:5;display:flex;flex-direction:column;align-items:center;gap:48px;padding:40px;">
          <img src="${WIZR_LOGO_COLOR_B64}" alt="Wizr" style="width:78%;max-width:520px;height:auto;display:block;"/>
          <div style="display:flex;align-items:center;gap:14px;">
            <span style="width:36px;height:2px;background:${C.violet};"></span>
            <span style="font-size:13px;letter-spacing:0.32em;color:${C.violet};font-weight:800;text-transform:uppercase;">Media Intelligence</span>
            <span style="width:36px;height:2px;background:${C.violet};"></span>
          </div>
        </div>

        <!-- Footer tag -->
        <div style="position:absolute;bottom:48px;left:0;right:0;text-align:center;font-size:12px;letter-spacing:0.28em;color:${C.textMid};text-transform:uppercase;font-weight:700;z-index:5;">
          wizr.mx
        </div>
      </div>
    </div>
  `;
  return slideShell({ bg: "dark", pageNumber: 1, total, projectName, body, showHeader: false });
}

function slideSummary(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const m = report.metrics;
  const tot = m.totalMentions || 1;
  const negPct = Math.round((m.negativeCount / tot) * 100);
  const posPct = Math.round((m.positiveCount / tot) * 100);
  const summary = report.summary || "";
  const body = `
    <div style="padding:160px 80px 100px 80px;height:100%;display:grid;grid-template-columns:1.55fr 1fr;gap:64px;">
      <div style="display:flex;flex-direction:column;min-width:0;">
        <div style="font-size:12px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:18px;">01 · Brief Ejecutivo</div>
        <h2 style="font-size:48px;font-weight:800;margin:0 0 24px 0;line-height:1.08;color:${C.text};letter-spacing:-0.02em;">${esc(report.title || "Resumen del período")}</h2>
        <div style="width:80px;height:4px;background:${C.orange};margin-bottom:28px;flex-shrink:0;"></div>
        <p style="font-size:20px;line-height:1.5;color:${C.textMid};margin:0;font-weight:400;">${escMd(truncate(summary, 1600))}</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;justify-content:center;">
        ${[
          { label: "Menciones", val: fmtNum(m.totalMentions), color: C.violet, bg: C.violetSoft },
          { label: "Positivo", val: posPct + "%", color: C.positive, bg: "#DCFCE7" },
          { label: "Negativo", val: negPct + "%", color: C.negative, bg: "#FEE2E2" },
          { label: "Alcance", val: fmtNum(m.estimatedReach), color: C.text, bg: C.paperAlt },
        ].map((k) => `
          <div style="background:${k.bg};border-radius:18px;padding:26px 30px;display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:16px;color:${C.textMid};text-transform:uppercase;letter-spacing:0.12em;font-weight:700;">${k.label}</div>
            <div style="font-size:50px;font-weight:800;color:${k.color};line-height:1;letter-spacing:-0.02em;">${k.val}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body, sectionLabel: "Brief" });
}

function slideSentiment(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const m = report.metrics;
  const interp = report.sentimentAnalysis || "El análisis muestra el balance del sentimiento del periodo.";
  const body = `
    <div style="padding:160px 80px 100px 80px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:12px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:18px;">02 · Pulso de Sentimiento</div>
      <h2 style="font-size:48px;font-weight:800;margin:0 0 36px 0;color:${C.text};line-height:1.05;letter-spacing:-0.02em;">¿Cómo se siente la conversación?</h2>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:64px;align-items:start;flex:1;">
        <div style="flex-shrink:0;background:${C.paperAlt};border-radius:24px;padding:40px;">${svgDonut(m.positiveCount, m.neutralCount, m.negativeCount, 400)}</div>
        <div style="display:flex;flex-direction:column;gap:20px;min-width:0;">
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${[
              { color: C.positive, label: "Positivo", val: m.positiveCount },
              { color: C.neutral, label: "Neutral", val: m.neutralCount },
              { color: C.negative, label: "Negativo", val: m.negativeCount },
            ].map((s) => `
              <div style="display:flex;align-items:center;gap:18px;padding:14px 20px;background:${C.paper};border:1px solid ${C.border};border-radius:12px;">
                <span style="width:14px;height:36px;border-radius:4px;background:${s.color};"></span>
                <span style="font-size:22px;color:${C.text};font-weight:600;flex:1;">${s.label}</span>
                <span style="font-size:32px;font-weight:800;color:${s.color};letter-spacing:-0.02em;">${s.val}</span>
              </div>
            `).join("")}
          </div>
          <div style="background:${C.violetSoft};border-radius:16px;padding:24px 28px;font-size:17px;line-height:1.5;color:${C.text};">
            <div style="font-size:11px;letter-spacing:0.25em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:10px;">Lectura estratégica</div>
            ${escMd(truncate(interp, 1100))}
          </div>
        </div>
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body, sectionLabel: "Sentimiento" });
}

function slideTimeline(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const peak = report.timeline.length ? report.timeline.reduce((a, b) => (a.count > b.count ? a : b)) : null;
  const totalMentions = report.timeline.reduce((s, t) => s + t.count, 0);
  const avg = report.timeline.length ? Math.round(totalMentions / report.timeline.length) : 0;
  const insight = report.timelineInsight || (peak
    ? `El día con mayor actividad fue ${peak.date.slice(5)} con ${peak.count} menciones, frente a un promedio de ${avg}/día. Conviene revisar qué dispara el pico para anticipar futuras ventanas de exposición.`
    : "Volumen distribuido sin picos extraordinarios en el periodo analizado.");
  const body = `
    <div style="padding:160px 80px 100px 80px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:12px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:18px;">03 · Volumen en el Tiempo</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;">
        <h2 style="font-size:48px;font-weight:800;margin:0;color:${C.text};line-height:1.05;letter-spacing:-0.02em;">Evolución diaria</h2>
        <div style="display:flex;gap:32px;">
          <div><div style="font-size:11px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.18em;font-weight:700;">Promedio/día</div><div style="font-size:36px;font-weight:800;color:${C.text};line-height:1.1;">${avg}</div></div>
          ${peak ? `<div><div style="font-size:11px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.18em;font-weight:700;">Pico</div><div style="font-size:36px;font-weight:800;color:${C.orange};line-height:1.1;">${peak.count}</div></div>` : ""}
        </div>
      </div>
      <div style="background:${C.paperAlt};border-radius:20px;padding:28px 32px;flex:1;display:flex;align-items:center;justify-content:center;min-height:0;">
        ${svgAreaTimeline(report.timeline, 1680, 440)}
      </div>
      <div style="margin-top:18px;background:${C.violetSoft};border-left:4px solid ${C.violet};border-radius:12px;padding:18px 24px;font-size:16px;line-height:1.5;color:${C.text};">
        <span style="font-size:10px;letter-spacing:0.25em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-right:10px;">Lectura</span>${escMd(truncate(insight, 800))}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body, sectionLabel: "Timeline" });
}

function slideNarratives(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const narr = report.narratives.slice(0, 5);
  const totalNarrMentions = narr.reduce((s, n) => s + (Number.isFinite(n.mentions) && n.mentions > 0 ? n.mentions : 0), 0) || 1;
  const cols = narr.length <= 2 ? narr.length : narr.length <= 4 ? 2 : 3;
  const insight = report.narrativesInsight || "Las narrativas anteriores configuran el encuadre dominante de la conversación pública del periodo.";

  // Chart data: bars colored by sentiment of each narrative
  const chartData = narr.map((n) => {
    const v = Number.isFinite(n.mentions) && n.mentions > 0 ? n.mentions : 0;
    return {
      label: (n.narrative || "").split(/\s+/).slice(0, 2).join(" "),
      value: v,
      pct: Math.round((v / totalNarrMentions) * 100),
      color: sentColor(n.sentiment),
    };
  });

  const cards = narr
    .map((n: NarrativeInfo, i: number) => {
      const safeMentions = Number.isFinite(n.mentions) && n.mentions > 0 ? n.mentions : 0;
      const pct = safeMentions > 0 ? Math.round((safeMentions / totalNarrMentions) * 100) : 0;
      const sc = sentColor(n.sentiment);
      return `<div style="background:${C.paper};border:1px solid ${C.border};border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;width:5px;height:100%;background:${sc};"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding-left:8px;">
          <div style="display:flex;gap:10px;align-items:center;">
            <div style="font-size:11px;font-weight:800;color:${C.violet};letter-spacing:0.18em;">N${String(i + 1).padStart(2, "0")}</div>
            <span style="background:${sc}15;color:${sc};padding:3px 8px;border-radius:5px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;">${sentLabel(n.sentiment)}</span>
            <span style="font-size:13px;color:${sc};">${trendIcon(n.trend)}</span>
          </div>
          <span style="font-size:20px;font-weight:800;color:${C.text};letter-spacing:-0.02em;">${safeMentions}<span style="font-size:11px;color:${C.textMuted};font-weight:600;"> · ${pct}%</span></span>
        </div>
        <div style="font-size:15px;font-weight:700;color:${C.text};line-height:1.25;padding-left:8px;letter-spacing:-0.01em;">${escMd(truncate(n.narrative, 110))}</div>
        <div style="font-size:12px;color:${C.textMid};line-height:1.45;padding-left:8px;flex:1;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:8;">${escMd(truncate(n.description, 520))}</div>
      </div>`;
    })
    .join("");
  const body = `
    <div style="padding:150px 80px 90px 80px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:12px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:14px;">04 · Narrativas Dominantes</div>
      <h2 style="font-size:42px;font-weight:800;margin:0 0 18px 0;color:${C.text};line-height:1.05;letter-spacing:-0.02em;">Las ${narr.length} ideas que circularon</h2>
      <!-- Volume chart -->
      <div style="background:${C.paperAlt};border-radius:18px;padding:18px 24px;margin-bottom:18px;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-size:12px;font-weight:800;color:${C.textMid};letter-spacing:0.18em;text-transform:uppercase;">Volumen por narrativa</div>
          <div style="display:flex;gap:14px;font-size:11px;color:${C.textMid};">
            <span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:${C.positive};"></span>Positivo</span>
            <span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:${C.negative};"></span>Negativo</span>
            <span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:${C.warning};"></span>Mixto</span>
            <span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:2px;background:${C.neutral};"></span>Neutral</span>
          </div>
        </div>
        ${svgVerticalBarsNarratives(chartData, 1700, 240)}
      </div>
      <!-- Cards grid -->
      <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:14px;flex:1;min-height:0;">${cards}</div>
      <div style="margin-top:14px;background:${C.violetSoft};border-left:4px solid ${C.violet};border-radius:12px;padding:14px 22px;font-size:14px;line-height:1.5;color:${C.text};">
        <span style="font-size:10px;letter-spacing:0.25em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-right:10px;">Lectura</span>${escMd(truncate(insight, 600))}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body, sectionLabel: "Narrativas" });
}

function slideKeywordsCloud(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const kws = (report as { keywords?: { term: string; count: number; sentiment: string }[] }).keywords || [];
  const insight = (report as { keywordsInsight?: string }).keywordsInsight || "Los términos anteriores configuran el vocabulario dominante del periodo y orientan dónde la conversación pone su foco.";
  const maxC = Math.max(...kws.map((k) => k.count), 1);
  const minC = Math.min(...kws.map((k) => k.count), 1);
  const range = Math.max(1, maxC - minC);
  const KW_SENT: Record<string, { bg: string; text: string; border: string }> = {
    positivo: { bg: "#ECFDF5", text: "#166534", border: "#BBF7D0" },
    negativo: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
    mixto: { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
    neutral: { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
  };
  const chips = kws
    .map((k) => {
      const norm = (k.count - minC) / range;
      const fontSize = 22 + Math.round(norm * 36); // 22..58 px
      const opacity = 0.78 + norm * 0.22;
      const s = KW_SENT[k.sentiment] || KW_SENT.mixto;
      return `<span style="display:inline-flex;align-items:baseline;gap:10px;border-radius:999px;padding:10px 26px;background:${s.bg};color:${s.text};border:2px solid ${s.border};font-size:${fontSize}px;font-weight:800;line-height:1.15;letter-spacing:-0.01em;opacity:${opacity};">
        ${esc(k.term)}<span style="font-size:${Math.max(14, Math.round(fontSize * 0.5))}px;font-weight:600;opacity:0.65;">${k.count}</span>
      </span>`;
    })
    .join("");
  const body = `
    <div style="padding:150px 80px 90px 80px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:12px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:14px;">05 · Términos Destacados</div>
      <h2 style="font-size:46px;font-weight:800;margin:0 0 8px 0;color:${C.text};line-height:1.05;letter-spacing:-0.02em;">El vocabulario de la conversación</h2>
      <div style="font-size:18px;color:${C.textMid};margin-bottom:24px;">Conceptos más recurrentes, dimensionados por frecuencia y coloreados por sentimiento dominante.</div>
      <div style="background:${C.paperAlt};border-radius:22px;padding:42px 48px;flex:1;display:flex;align-items:center;justify-content:center;min-height:0;">
        <div style="display:flex;flex-wrap:wrap;gap:14px 16px;justify-content:center;align-items:center;max-width:1700px;">
          ${chips || `<div style="font-size:22px;color:${C.textMuted};">Sin términos destacados disponibles.</div>`}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;gap:16px;">
        <div style="display:flex;gap:18px;font-size:13px;color:${C.textMid};">
          ${(["positivo","negativo","mixto","neutral"] as const).map(sk => `
            <span style="display:inline-flex;align-items:center;gap:6px;text-transform:capitalize;">
              <span style="width:12px;height:12px;border-radius:3px;background:${KW_SENT[sk].text};display:inline-block;"></span>${sk}
            </span>
          `).join("")}
        </div>
        <div style="background:${C.violetSoft};border-left:4px solid ${C.violet};border-radius:12px;padding:14px 22px;font-size:14px;line-height:1.5;color:${C.text};max-width:1100px;">
          <span style="font-size:10px;letter-spacing:0.25em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-right:10px;">Lectura</span>${escMd(truncate(insight, 500))}
        </div>
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body, sectionLabel: "Términos" });
}

function slideInfluencers(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const top = report.influencers.slice(0, 6);
  const insight = report.influencersInsight || "Las voces anteriores concentran buena parte de la conversación: su tono y alcance marcan el ritmo de la narrativa pública.";
  const rows = top
    .map((inf: InfluencerInfo, i) => {
      const reach = inf.reach || `${fmtNum(inf.mentions)} menciones`;
      const isTop = i === 0;
      return `<div style="display:flex;align-items:center;gap:24px;padding:18px 26px;background:${isTop ? C.violetSoft : C.paper};border-radius:14px;border:1px solid ${isTop ? C.violet : C.border};">
        <div style="width:48px;height:48px;border-radius:14px;background:${isTop ? C.violet : C.paperAlt};color:${isTop ? "#fff" : C.text};display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;flex-shrink:0;letter-spacing:-0.02em;">${String(i + 1).padStart(2, "0")}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:21px;font-weight:700;color:${C.text};line-height:1.2;letter-spacing:-0.01em;">${esc(truncate(inf.name || inf.username, 36))}</div>
          <div style="font-size:13px;color:${C.textMuted};margin-top:4px;letter-spacing:0.05em;">${esc(inf.platform).toUpperCase()} · ${esc(reach)}</div>
        </div>
        <div style="text-align:right;min-width:90px;">
          <div style="font-size:28px;font-weight:800;color:${C.text};line-height:1;letter-spacing:-0.02em;">${inf.mentions}</div>
          <div style="font-size:11px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.15em;font-weight:700;margin-top:4px;">menciones</div>
        </div>
        <span style="background:${sentColor(inf.sentiment)}15;color:${sentColor(inf.sentiment)};padding:6px 14px;border-radius:8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;">${sentLabel(inf.sentiment)}</span>
      </div>`;
    })
    .join("");
  const body = `
    <div style="padding:160px 80px 100px 80px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:12px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:18px;">05 · Influenciadores Clave</div>
      <h2 style="font-size:46px;font-weight:800;margin:0 0 28px 0;color:${C.text};line-height:1.05;letter-spacing:-0.02em;">Voces con mayor impacto en redes</h2>
      <div style="display:flex;flex-direction:column;gap:10px;flex:1;min-height:0;">${rows || `<div style="font-size:22px;color:${C.textMuted};text-align:center;padding:80px;">Sin influenciadores destacados.</div>`}</div>
      <div style="margin-top:16px;background:${C.violetSoft};border-left:4px solid ${C.violet};border-radius:12px;padding:18px 24px;font-size:15px;line-height:1.5;color:${C.text};">
        <span style="font-size:10px;letter-spacing:0.25em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-right:10px;">Lectura</span>${escMd(truncate(insight, 700))}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body, sectionLabel: "Influenciadores" });
}

function slideMediaOutlets(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const media = (report.mediaOutlets || []).slice(0, 6);
  const insight = report.mediaInsight || "El conjunto de medios anteriores define el encuadre editorial dominante del periodo y orienta la percepción pública sobre el tema.";
  const rows = media
    .map((m: MediaOutletInfo, i) => {
      const isTop = i === 0;
      return `<div style="display:flex;align-items:center;gap:24px;padding:18px 26px;background:${isTop ? C.orangeSoft : C.paper};border-radius:14px;border:1px solid ${isTop ? C.orange : C.border};">
        <div style="width:48px;height:48px;border-radius:14px;background:${isTop ? C.orange : C.paperAlt};color:${isTop ? "#fff" : C.text};display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;flex-shrink:0;letter-spacing:-0.02em;">${String(i + 1).padStart(2, "0")}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:21px;font-weight:700;color:${C.text};line-height:1.2;letter-spacing:-0.01em;">${esc(truncate(m.name, 40))}</div>
          <div style="font-size:13px;color:${C.textMuted};margin-top:4px;font-family:'Menlo',monospace;">${esc(m.domain)}</div>
        </div>
        <div style="text-align:right;min-width:90px;">
          <div style="font-size:28px;font-weight:800;color:${C.text};line-height:1;letter-spacing:-0.02em;">${m.articles}</div>
          <div style="font-size:11px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.15em;font-weight:700;margin-top:4px;">artículos</div>
        </div>
        <span style="background:${sentColor(m.sentiment)}15;color:${sentColor(m.sentiment)};padding:6px 14px;border-radius:8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;">${sentLabel(m.sentiment)}</span>
      </div>`;
    })
    .join("");
  const body = `
    <div style="padding:160px 80px 100px 80px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:12px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:18px;">06 · Medios Digitales</div>
      <h2 style="font-size:46px;font-weight:800;margin:0 0 28px 0;color:${C.text};line-height:1.05;letter-spacing:-0.02em;">Cobertura editorial dominante</h2>
      <div style="display:flex;flex-direction:column;gap:10px;flex:1;min-height:0;">${rows || `<div style="font-size:22px;color:${C.textMuted};text-align:center;padding:80px;">Sin medios digitales destacados.</div>`}</div>
      <div style="margin-top:16px;background:${C.orangeSoft};border-left:4px solid ${C.orange};border-radius:12px;padding:18px 24px;font-size:15px;line-height:1.5;color:${C.text};">
        <span style="font-size:10px;letter-spacing:0.25em;color:${C.orange};font-weight:800;text-transform:uppercase;margin-right:10px;">Lectura</span>${escMd(truncate(insight, 700))}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body, sectionLabel: "Medios" });
}

function slideSourceMix(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const sources = report.sourceBreakdown.slice(0, 8);
  const data = sources.map((s) => ({ label: s.source, value: s.count, color: C.violet }));
  const insight = report.platformsInsight || "La distribución por plataforma indica dónde se concentra la conversación y orienta dónde priorizar el monitoreo y la respuesta.";
  const body = `
    <div style="padding:160px 80px 100px 80px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:12px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:18px;">07 · Mix de Plataformas</div>
      <h2 style="font-size:46px;font-weight:800;margin:0 0 28px 0;color:${C.text};line-height:1.05;letter-spacing:-0.02em;">¿Dónde sucede la conversación?</h2>
      <div style="background:${C.paperAlt};border-radius:20px;padding:36px 32px;flex:1;display:flex;align-items:center;justify-content:center;min-height:0;">
        ${data.length ? svgHorizontalBars(data, 1700, 60) : `<div style="font-size:22px;color:${C.textMuted};">Sin datos de plataforma.</div>`}
      </div>
      <div style="margin-top:16px;background:${C.violetSoft};border-left:4px solid ${C.violet};border-radius:12px;padding:18px 24px;font-size:15px;line-height:1.5;color:${C.text};">
        <span style="font-size:10px;letter-spacing:0.25em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-right:10px;">Lectura</span>${escMd(truncate(insight, 700))}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body, sectionLabel: "Plataformas" });
}

function slideKeyFindings(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const findings = report.keyFindings.slice(0, 4);
  const labels = ["Riesgo", "Oportunidad", "Tendencia", "Señal"];
  const items = findings
    .map(
      (f, i) => `<div style="display:flex;gap:24px;align-items:stretch;background:${C.paper};border:1px solid ${C.border};border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(11,10,31,0.04);min-height:150px;">
      <div style="background:linear-gradient(160deg,${C.violet} 0%,${C.violetGlow} 100%);color:#fff;padding:28px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:160px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.22em;opacity:0.85;margin-bottom:8px;text-transform:uppercase;white-space:nowrap;">${labels[i] || "Hallazgo"}</div>
        <div style="font-size:48px;font-weight:800;line-height:1;letter-spacing:-0.02em;">${String(i + 1).padStart(2, "0")}</div>
      </div>
      <div style="flex:1;padding:24px 32px;display:flex;align-items:center;font-size:19px;line-height:1.5;color:${C.text};font-weight:500;">
        <p style="display:block;margin:0;width:100%;font:inherit;line-height:inherit;color:inherit;">${escMd(truncate(f, 600))}</p>
      </div>
    </div>`,
    )
    .join("");
  const body = `
    <div style="padding:160px 80px 100px 80px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:12px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:18px;">08 · Hallazgos Clave</div>
      <h2 style="font-size:48px;font-weight:800;margin:0 0 32px 0;color:${C.text};line-height:1.05;letter-spacing:-0.02em;">Lo más importante del periodo</h2>
      <div style="display:flex;flex-direction:column;gap:14px;flex:1;min-height:0;">${items}</div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body, sectionLabel: "Hallazgos" });
}

function slideRecommendations(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const recs = report.recommendations.slice(0, 4);
  const tags = [
    { label: "Inmediato", color: C.negative },
    { label: "Corto plazo", color: C.orange },
    { label: "Mediano plazo", color: C.violet },
    { label: "Seguimiento", color: C.neutral },
  ];
  const items = recs
    .map((r, i) => {
      const tag = tags[i] || tags[3];
      return `<div style="display:flex;gap:24px;align-items:stretch;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 4px 16px rgba(61,31,216,0.08);border:1px solid ${C.border};min-height:150px;">
      <div style="background:${C.text};color:#fff;padding:28px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:160px;">
        <div style="display:inline-flex;align-items:center;gap:6px;background:${tag.color}26;color:#fff;padding:4px 10px;border-radius:100px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;white-space:nowrap;margin-bottom:10px;">
          <span style="width:6px;height:6px;border-radius:50%;background:${tag.color};"></span>${tag.label}
        </div>
        <div style="font-size:48px;font-weight:800;line-height:1;letter-spacing:-0.02em;">${String(i + 1).padStart(2, "0")}</div>
      </div>
      <div style="flex:1;padding:24px 32px;display:flex;align-items:center;font-size:18px;line-height:1.5;color:${C.text};font-weight:500;">
        <p style="display:block;margin:0;width:100%;font:inherit;line-height:inherit;color:inherit;">${escMd(truncate(r, 600))}</p>
      </div>
    </div>`;
    })
    .join("");
  const body = `
    <div style="padding:160px 80px 100px 80px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:12px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:18px;">09 · Recomendaciones</div>
      <h2 style="font-size:48px;font-weight:800;margin:0 0 8px 0;color:${C.text};line-height:1.05;letter-spacing:-0.02em;">Acciones estratégicas sugeridas</h2>
      <div style="font-size:18px;color:${C.textMid};margin-bottom:28px;">Posicionamiento, riesgo reputacional y oportunidades de incidencia.</div>
      <div style="display:flex;flex-direction:column;gap:14px;flex:1;min-height:0;">${items}</div>
    </div>
  `;
  return slideShell({ bg: "accent", pageNumber: page, total, projectName, body, sectionLabel: "Acciones" });
}

function slideClosing(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const conclusion =
    report.conclusions?.[0] ||
    `Reporte generado a partir de ${report.metrics.totalMentions} menciones del periodo. Para análisis detallado revisa el reporte completo en el dashboard.`;
  const body = `
    <!-- Violet glow + sparkles -->
    <div style="position:absolute;top:60px;right:60px;transform:scale(1.6);opacity:0.8;">${sparkles(C.orange, 0.85)}</div>
    <div style="position:absolute;bottom:-340px;right:-220px;width:780px;height:780px;border-radius:50%;background:radial-gradient(circle, ${C.violetGlow} 0%, transparent 70%);opacity:0.35;"></div>
    <div style="position:absolute;top:-180px;left:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle, ${C.violet} 0%, transparent 70%);opacity:0.25;"></div>

    <!-- Header logo -->
    <div style="position:absolute;top:60px;left:80px;display:flex;align-items:center;gap:18px;z-index:5;">
      <img src="${WIZR_LOGO_COLOR_B64}" alt="Wizr" style="height:64px;filter:brightness(0) invert(1);"/>
    </div>

    <div style="position:absolute;top:50%;left:80px;right:80px;transform:translateY(-50%);z-index:5;">
      <div style="display:inline-flex;align-items:center;gap:14px;padding:10px 22px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:100px;margin-bottom:36px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${C.orange};"></span>
        <span style="font-size:13px;letter-spacing:0.28em;color:#fff;font-weight:800;text-transform:uppercase;">Conclusión del periodo</span>
      </div>
      <p style="font-size:42px;font-weight:600;line-height:1.3;margin:0 0 56px 0;color:#fff;max-width:1620px;letter-spacing:-0.018em;">${escMd(truncate(conclusion, 800))}</p>
      <div style="height:1px;background:rgba(255,255,255,0.15);margin:32px 0;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="font-size:13px;color:rgba(255,255,255,0.5);letter-spacing:0.22em;text-transform:uppercase;font-weight:700;">Wizr</div>
          <div style="font-size:18px;color:rgba(255,255,255,0.85);letter-spacing:0.05em;">Media Intelligence · wizr.mx</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px;color:rgba(255,255,255,0.5);letter-spacing:0.22em;text-transform:uppercase;font-weight:700;">Proyecto</div>
          <div style="font-size:18px;color:rgba(255,255,255,0.85);letter-spacing:0.02em;">${esc(projectName)}</div>
        </div>
      </div>
    </div>
  `;
  return slideShell({ bg: "dark", pageNumber: page, total, projectName, body, showHeader: false });
}

// ---------- Public API ----------

export interface BuiltSlides {
  slides: string[];
  fullHtml: string;
  count: number;
}

export function buildSlidesReport(
  report: SmartReportContent,
  projectName: string,
  dateRange: DateRange,
): BuiltSlides {
  const slidesArr: string[] = [];
  const totalEstimate = 12;

  let p = 1;
  slidesArr.push(slideCover(report, projectName, dateRange, totalEstimate));
  p++;
  slidesArr.push(slideSummary(report, projectName, p, totalEstimate));
  p++;
  slidesArr.push(slideSentiment(report, projectName, p, totalEstimate));
  p++;
  if (report.timeline.length > 0) {
    slidesArr.push(slideTimeline(report, projectName, p, totalEstimate));
    p++;
  }
  if (report.narratives.length > 0) {
    slidesArr.push(slideNarratives(report, projectName, p, totalEstimate));
    p++;
  }
  if (((report as { keywords?: unknown[] }).keywords || []).length > 0) {
    slidesArr.push(slideKeywordsCloud(report, projectName, p, totalEstimate));
    p++;
  }
  if (report.influencers.length > 0) {
    slidesArr.push(slideInfluencers(report, projectName, p, totalEstimate));
    p++;
  }
  if ((report.mediaOutlets || []).length > 0) {
    slidesArr.push(slideMediaOutlets(report, projectName, p, totalEstimate));
    p++;
  }
  if (report.sourceBreakdown.length > 0) {
    slidesArr.push(slideSourceMix(report, projectName, p, totalEstimate));
    p++;
  }
  if (report.keyFindings.length > 0) {
    slidesArr.push(slideKeyFindings(report, projectName, p, totalEstimate));
    p++;
  }
  if (report.recommendations.length > 0) {
    slidesArr.push(slideRecommendations(report, projectName, p, totalEstimate));
    p++;
  }
  slidesArr.push(slideClosing(report, projectName, p, totalEstimate));

  const realTotal = slidesArr.length;
  const renumbered = slidesArr.map((html, i) =>
    html.replace(/(\d+)\s*\/\s*\d+(<\/span>\s*<\/footer>)/, `${String(i + 1).padStart(2, "0")} / ${String(realTotal).padStart(2, "0")}$2`),
  );

  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>${esc(projectName)} — Reporte Visual Wizr</title>
    <style>
      @page { size: 1920px 1080px; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin:0; padding:0; background:#fff; }
      body { font-family: 'Inter', 'Segoe UI', sans-serif; -webkit-font-smoothing:antialiased; }
      .slide { page-break-after: always; break-after: page; }
      .slide:last-child { page-break-after: auto; break-after: auto; }
    </style>
    </head><body>${renumbered.join("")}</body></html>`;

  return { slides: renumbered, fullHtml, count: realTotal };
}
