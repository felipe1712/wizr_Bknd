import type { PerformanceReportContent } from "@/hooks/usePerformanceReport";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { WIZR_LOGO_COLOR_B64 } from "./wizrLogoColor";

interface DateRange {
  start: string;
  end: string;
  label: string;
}

const C = {
  ink: "#0B0A1F",
  inkSoft: "#1A1638",
  paper: "#FAFAFC",
  paperAlt: "#F2F1F8",
  border: "#E5E3EE",
  indigoDeep: "#1e1b4b",
  indigoMid: "#312e81",
  indigoBright: "#4338ca",
  indigoGlow: "#6366f1",
  indigoSoft: "#EEF2FF",
  indigoText: "#c7d2fe",
  violet: "#4338ca",
  violetSoft: "#EEF2FF",
  violetGlow: "#6366f1",
  orange: "#FF6B2C",
  orangeSoft: "#FFE9DD",
  text: "#0B0A1F",
  textMid: "#4A4760",
  textMuted: "#8E8BA3",
  positive: "#22C55E",
  negative: "#EF4444",
  neutral: "#9CA3AF",
};

const INDIGO_GRADIENT_RADIAL = "radial-gradient(ellipse at top right, #312e81 0%, #1e1b4b 60%)";

// Network brand colors for accents
const NETWORK_COLORS: Record<string, string> = {
  facebook: "#1877F2",
  instagram: "#E4405F",
  twitter: "#0F172A",
  x: "#0F172A",
  youtube: "#FF0000",
  tiktok: "#000000",
  linkedin: "#0A66C2",
};

function esc(t: string | null | undefined): string {
  if (!t) return "";
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toLocaleString("es-MX");
}

/** Número entero con separador de miles (sin abreviar) */
function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("es-MX");
}

function networkLabel(n: string): string {
  const m: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    twitter: "X",
    x: "X",
    youtube: "YouTube",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
  };
  return m[n.toLowerCase()] || n;
}

function networkColor(n: string): string {
  return NETWORK_COLORS[n.toLowerCase()] || C.violet;
}

function truncate(s: string, n: number): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

// Quita sufijos de red social del nombre de un perfil para agrupar variantes
const NETWORK_SUFFIX_RE = /[\s_\-·|]+\(?(fb|facebook|ig|instagram|tw|twitter|x|yt|youtube|tt|tiktok|li|linkedin|th|threads)\)?\s*$/i;
function cleanProfileName(name: string): string {
  let out = String(name || "").trim();
  for (let i = 0; i < 3; i += 1) {
    const replaced = out.replace(NETWORK_SUFFIX_RE, "").trim();
    if (replaced === out) break;
    out = replaced;
  }
  return out || String(name || "").trim();
}

/** Clave canónica para agrupar marcas: sin acentos, lowercase, elimina sufijos geográficos (mx/mex/mexico) y normaliza separadores */
function brandKey(name: string): string {
  const cleaned = cleanProfileName(name);
  let k = cleaned
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Elimina tokens geográficos sueltos en cualquier posición (mx, mex, mexico, méxico, mx., latam, lat)
  k = k.replace(/\b(mexico|mex|mx|latam|lat)\b/g, "").replace(/\s+/g, " ").trim();
  return k;
}

/** Elige la mejor etiqueta visible entre variantes (prefiere la más larga / con acentos) */
function pickDisplayName(candidates: string[]): string {
  return candidates
    .map((c) => cleanProfileName(c))
    .sort((a, b) => {
      const aHasAccent = /[áéíóúñ]/i.test(a) ? 1 : 0;
      const bHasAccent = /[áéíóúñ]/i.test(b) ? 1 : 0;
      if (aHasAccent !== bHasAccent) return bHasAccent - aHasAccent;
      return b.length - a.length;
    })[0] || candidates[0];
}

function sparkles(color: string, opacity = 1): string {
  return `<svg width="180" height="180" viewBox="0 0 180 180" style="opacity:${opacity};">
    <path d="M90 20 L96 50 L126 56 L96 62 L90 92 L84 62 L54 56 L84 50 Z" fill="${color}"/>
    <path d="M150 90 L154 110 L174 114 L154 118 L150 138 L146 118 L126 114 L146 110 Z" fill="${color}"/>
    <path d="M40 110 L43 124 L57 127 L43 130 L40 144 L37 130 L23 127 L37 124 Z" fill="${color}"/>
  </svg>`;
}

function slideShell(opts: {
  bg: "dark" | "light" | "accent";
  pageNumber: number;
  total: number;
  clientName: string;
  modeLabel: string;
  body: string;
  showHeader?: boolean;
  showFooter?: boolean;
  sectionLabel?: string;
}): string {
  const isDark = opts.bg === "dark";
  const isAccent = opts.bg === "accent";
  let bg: string;
  let fg: string;
  let subtle: string;
  if (isDark) {
    bg = `background: ${INDIGO_GRADIENT_RADIAL};`;
    fg = "#FFFFFF";
    subtle = C.indigoText;
  } else if (isAccent) {
    bg = `background: linear-gradient(135deg, ${C.indigoSoft} 0%, ${C.paper} 100%);`;
    fg = C.text;
    subtle = C.textMuted;
  } else {
    bg = `background: ${C.paper};`;
    fg = C.text;
    subtle = C.textMuted;
  }

  const header = opts.showHeader === false ? "" : `
    <header style="position:absolute;top:44px;left:80px;right:80px;display:flex;justify-content:space-between;align-items:center;z-index:5;">
      <img src="${WIZR_LOGO_COLOR_B64}" alt="Wizr" style="height:54px;${isDark ? "filter:brightness(0) invert(1);" : ""}"/>
      ${opts.sectionLabel ? `<div style="font-size:13px;letter-spacing:0.25em;color:${isDark ? "rgba(255,255,255,0.6)" : C.textMuted};font-weight:700;text-transform:uppercase;">${esc(opts.sectionLabel)}</div>` : ""}
    </header>`;

  const footer = opts.showFooter === false ? "" : `
    <footer style="position:absolute;left:80px;right:80px;bottom:36px;display:flex;justify-content:space-between;align-items:center;font-size:14px;color:${subtle};letter-spacing:0.08em;z-index:5;">
      <span style="font-weight:600;text-transform:uppercase;">${esc(opts.clientName)} · ${esc(opts.modeLabel)}</span>
      <span style="font-variant-numeric:tabular-nums;">${String(opts.pageNumber).padStart(2, "0")} / ${String(opts.total).padStart(2, "0")}</span>
    </footer>`;

  return `<section class="slide" style="position:relative;width:1920px;height:1080px;${bg}color:${fg};font-family:'Inter','Segoe UI',sans-serif;overflow:hidden;page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid;">
    ${header}
    ${opts.body}
    ${footer}
  </section>`;
}

// ---------- SVG charts ----------

function svgRankingBars(
  data: { label: string; value: number; isOwn: boolean; color?: string; valueLabel?: string }[],
  width = 1620,
  rowH = 70,
): string {
  if (!data.length) return "";
  const max = Math.max(...data.map((d) => d.value), 0.01);
  const labelW = 380;
  const valueW = 200;
  const barW = width - labelW - valueW - 60;
  const height = data.length * rowH + 20;
  const rows = data
    .map((d, i) => {
      const y = i * rowH + 10;
      const w = (d.value / max) * barW;
      const color = d.color || (d.isOwn ? C.violet : C.textMuted);
      const vLabel = d.valueLabel ?? fmtInt(d.value);
      return `
        <text x="${labelW - 24}" y="${y + rowH / 2 + 7}" text-anchor="end" font-size="22" font-weight="${d.isOwn ? 800 : 600}" fill="${C.text}">${esc(truncate(d.label, 30))}</text>
        <rect x="${labelW}" y="${y + 16}" width="${barW}" height="${rowH - 32}" rx="6" fill="${C.paperAlt}"/>
        <rect x="${labelW}" y="${y + 16}" width="${w}" height="${rowH - 32}" rx="6" fill="${color}"${d.isOwn ? ` stroke="${C.violet}" stroke-width="2"` : ""}/>
        <text x="${labelW + barW + 24}" y="${y + rowH / 2 + 7}" font-size="22" font-weight="800" fill="${C.text}">${esc(vLabel)}</text>
      `;
    })
    .join("");
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rows}</svg>`;
}

function svgSovDonut(
  data: { label: string; value: number; isOwn: boolean }[],
  size = 460,
): string {
  if (!data.length) return "";
  const total = Math.max(data.reduce((s, d) => s + d.value, 0), 0.001);
  const r = size / 2 - 36;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const palette = [C.violet, "#F97316", "#06B6D4", "#8B5CF6", "#EC4899", "#22C55E", "#EAB308", "#EF4444"];
  let offset = 0;
  const arcs = data
    .map((d, i) => {
      const len = (d.value / total) * circ;
      const dash = `${len} ${circ - len}`;
      const color = d.isOwn ? C.violet : palette[(i + 1) % palette.length];
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="62" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
      return el;
    })
    .join("");
  const own = data.find((d) => d.isOwn);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${arcs}
    ${own ? `<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="68" font-weight="800" fill="${C.text}">${own.value.toFixed(1)}%</text>
    <text x="${cx}" y="${cy + 30}" text-anchor="middle" font-size="18" fill="${C.textMuted}" letter-spacing="2">SoV PROPIO</text>` : ""}
  </svg>`;
}

function svgNetworkBars(
  data: { label: string; value: number; color: string }[],
  width = 1620,
  rowH = 80,
  unit = "",
): string {
  if (!data.length) return "";
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 0.01);
  const labelW = 280;
  const valueW = 240;
  const barW = width - labelW - valueW - 60;
  const height = data.length * rowH + 20;
  const rows = data
    .map((d, i) => {
      const y = i * rowH + 10;
      const w = (Math.abs(d.value) / max) * barW;
      const valueText = unit === "%" ? `${d.value.toFixed(2)}%` : fmtInt(d.value);
      return `
        <text x="${labelW - 24}" y="${y + rowH / 2 + 8}" text-anchor="end" font-size="26" font-weight="700" fill="${C.text}">${esc(d.label)}</text>
        <rect x="${labelW}" y="${y + 18}" width="${barW}" height="${rowH - 36}" rx="8" fill="${C.paperAlt}"/>
        <rect x="${labelW}" y="${y + 18}" width="${w}" height="${rowH - 36}" rx="8" fill="${d.color}"/>
        <text x="${labelW + barW + 24}" y="${y + rowH / 2 + 8}" font-size="26" font-weight="800" fill="${C.text}">${esc(valueText)}</text>
      `;
    })
    .join("");
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rows}</svg>`;
}

// ---------- Slides ----------

function slideCover(report: PerformanceReportContent, clientName: string, dateRange: DateRange, total: number): string {
  const isBrand = report.reportMode === "brand";
  const modeLabel = isBrand ? "Reporte de Marca" : "Reporte de Benchmark";
  const dateLabel = (() => {
    try {
      return `${format(new Date(dateRange.start), "d MMM", { locale: es })} — ${format(new Date(dateRange.end), "d MMM yyyy", { locale: es })}`;
    } catch {
      return dateRange.label;
    }
  })();

  const body = `
    <div style="position:absolute;inset:0;display:grid;grid-template-columns:1.35fr 1fr;">
      <div style="position:relative;overflow:hidden;padding:96px 88px;display:flex;flex-direction:column;justify-content:space-between;">
        <div style="position:absolute;bottom:-260px;left:-260px;width:780px;height:780px;border-radius:50%;background:radial-gradient(circle, ${C.violetGlow} 0%, transparent 70%);opacity:0.45;pointer-events:none;"></div>
        <div style="position:absolute;top:-180px;right:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle, rgba(255,107,44,0.18) 0%, transparent 70%);pointer-events:none;"></div>
        <div style="position:absolute;top:60px;right:40px;transform:scale(1.6);opacity:0.85;pointer-events:none;">${sparkles(C.orange, 0.9)}</div>

        <div style="position:relative;z-index:5;">
          <div style="display:inline-flex;align-items:center;gap:12px;padding:11px 24px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:100px;backdrop-filter:blur(8px);">
            <span style="width:8px;height:8px;border-radius:50%;background:${C.orange};box-shadow:0 0 0 6px rgba(255,107,44,0.18);"></span>
            <span style="font-size:13px;letter-spacing:0.28em;color:#fff;font-weight:700;text-transform:uppercase;">Wizr · Performance · ${esc(modeLabel)}</span>
          </div>
        </div>

        <div style="position:relative;z-index:5;display:flex;flex-direction:column;gap:36px;">
          <div style="display:flex;align-items:center;gap:20px;">
            <span style="width:64px;height:3px;background:${C.orange};"></span>
            <span style="font-size:14px;letter-spacing:0.32em;color:rgba(255,255,255,0.55);font-weight:700;text-transform:uppercase;">Periodo</span>
            <span style="font-size:18px;color:rgba(255,255,255,0.85);font-weight:500;">${esc(dateLabel)}</span>
          </div>
          <h1 style="font-size:128px;font-weight:800;line-height:0.92;margin:0;letter-spacing:-0.045em;color:#fff;">${esc(clientName)}</h1>
          <p style="font-size:24px;line-height:1.45;color:rgba(255,255,255,0.7);font-weight:400;max-width:780px;margin:0;">
            ${esc(report.title || (isBrand ? "Síntesis del desempeño en redes sociales del período." : "Análisis competitivo: marca propia vs competencia."))}
          </p>
        </div>

        <div style="position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.12);padding-top:28px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <span style="font-size:11px;letter-spacing:0.32em;color:rgba(255,255,255,0.45);font-weight:700;text-transform:uppercase;">Elaborado por</span>
            <span style="font-size:14px;color:rgba(255,255,255,0.85);font-weight:600;">Wizr · Performance Intelligence</span>
          </div>
          <div style="font-size:11px;letter-spacing:0.32em;color:rgba(255,255,255,0.45);font-weight:700;text-transform:uppercase;">Confidencial</div>
        </div>
      </div>

      <div style="position:relative;background:#FFFFFF;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;">
        <div style="position:absolute;top:-120px;right:-120px;width:360px;height:360px;border-radius:50%;background:${C.violetSoft};opacity:0.6;"></div>
        <div style="position:absolute;bottom:-160px;left:-160px;width:420px;height:420px;border-radius:50%;background:${C.violetSoft};opacity:0.45;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:${C.orange};box-shadow:0 0 0 14px rgba(255,107,44,0.12);"></div>

        <div style="position:relative;z-index:5;display:flex;flex-direction:column;align-items:center;gap:48px;padding:40px;">
          <img src="${WIZR_LOGO_COLOR_B64}" alt="Wizr" style="width:78%;max-width:520px;height:auto;display:block;"/>
          <div style="display:flex;align-items:center;gap:14px;">
            <span style="width:36px;height:2px;background:${C.violet};"></span>
            <span style="font-size:13px;letter-spacing:0.32em;color:${C.violet};font-weight:800;text-transform:uppercase;">Performance Intelligence</span>
            <span style="width:36px;height:2px;background:${C.violet};"></span>
          </div>
        </div>

        <div style="position:absolute;bottom:48px;left:0;right:0;text-align:center;font-size:12px;letter-spacing:0.28em;color:${C.textMid};text-transform:uppercase;font-weight:700;z-index:5;">wizr.mx</div>
      </div>
    </div>
  `;
  return slideShell({ bg: "dark", pageNumber: 1, total, clientName, modeLabel, body, showHeader: false, showFooter: false });
}

function slideAgenda(items: { label: string; desc: string }[], clientName: string, modeLabel: string, page: number, total: number): string {
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:grid;grid-template-columns:1fr 1.4fr;gap:80px;">
      <div style="display:flex;flex-direction:column;justify-content:center;gap:24px;">
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;">Contenido</div>
        <h2 style="font-size:96px;font-weight:800;line-height:0.95;margin:0;letter-spacing:-0.04em;color:${C.text};">Agenda</h2>
        <p style="font-size:20px;line-height:1.55;color:${C.textMid};margin:0;max-width:480px;">Recorrido del análisis: del resumen ejecutivo a las recomendaciones accionables.</p>
        <div style="display:flex;align-items:center;gap:14px;margin-top:8px;">
          <span style="width:40px;height:2px;background:${C.orange};"></span>
          <span style="font-size:13px;letter-spacing:0.3em;color:${C.orange};font-weight:800;text-transform:uppercase;">${items.length} secciones</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;justify-content:center;">
        ${items.map((it, i) => `
          <div style="display:flex;align-items:center;gap:24px;padding:18px 24px;border-radius:14px;background:${i === 0 ? C.violetSoft : "transparent"};border:1px solid ${i === 0 ? C.indigoBright : C.border};">
            <span style="flex-shrink:0;width:52px;height:52px;border-radius:50%;background:${i === 0 ? C.violet : C.paperAlt};color:${i === 0 ? "#fff" : C.text};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;font-variant-numeric:tabular-nums;">${String(i + 1).padStart(2, "0")}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:24px;font-weight:700;color:${C.text};letter-spacing:-0.01em;">${esc(it.label)}</div>
              <div style="font-size:15px;color:${C.textMuted};margin-top:2px;">${esc(it.desc)}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Agenda" });
}

function slideSectionDivider(opts: {
  number: number;
  label: string;
  title: string;
  subtitle: string;
  accent: string;
  clientName: string;
  modeLabel: string;
  page: number;
  total: number;
}): string {
  const body = `
    <div style="position:absolute;inset:0;padding:120px;display:flex;flex-direction:column;justify-content:center;gap:40px;">
      <div style="position:absolute;top:-180px;right:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle, ${opts.accent} 0%, transparent 70%);opacity:0.18;pointer-events:none;"></div>
      <div style="position:absolute;bottom:-180px;left:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle, ${C.indigoGlow} 0%, transparent 70%);opacity:0.15;pointer-events:none;"></div>

      <div style="position:relative;z-index:5;display:flex;align-items:baseline;gap:28px;">
        <span style="font-size:280px;font-weight:800;line-height:0.85;color:${opts.accent};opacity:0.18;letter-spacing:-0.06em;font-variant-numeric:tabular-nums;">${String(opts.number).padStart(2, "0")}</span>
        <div style="display:flex;flex-direction:column;gap:24px;max-width:1200px;">
          <div style="font-size:16px;letter-spacing:0.32em;color:${opts.accent};font-weight:800;text-transform:uppercase;">Sección ${opts.number} · ${esc(opts.label)}</div>
          <h2 style="font-size:120px;font-weight:800;line-height:0.95;margin:0;letter-spacing:-0.04em;color:${C.text};">${esc(opts.title)}</h2>
          <p style="font-size:24px;line-height:1.5;color:${C.textMid};margin:0;max-width:1000px;">${esc(opts.subtitle)}</p>
        </div>
      </div>
    </div>
  `;
  return slideShell({ bg: "accent", pageNumber: opts.page, total: opts.total, clientName: opts.clientName, modeLabel: opts.modeLabel, body, sectionLabel: opts.label });
}

function slideExecutiveSummary(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const summary = report.summary || "";
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:grid;grid-template-columns:1.2fr 1fr;gap:80px;">
      <div style="display:flex;flex-direction:column;gap:36px;">
        <div>
          <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:18px;">Resumen Ejecutivo</div>
          <h2 style="font-size:74px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Síntesis del<br/>período</h2>
        </div>
        <p style="font-size:24px;line-height:1.55;color:${C.textMid};margin:0;font-weight:400;">${esc(truncate(summary, 720))}</p>
      </div>

      <div style="display:flex;flex-direction:column;gap:18px;justify-content:center;">
        ${report.highlights.slice(0, 4).map((h) => `
          <div style="background:linear-gradient(135deg, ${C.violetSoft} 0%, ${C.paper} 100%);border:1px solid ${C.border};border-radius:14px;padding:22px 26px;">
            <div style="font-size:12px;letter-spacing:0.25em;color:${C.textMuted};font-weight:700;text-transform:uppercase;">${esc(h.label)}</div>
            <div style="font-size:42px;font-weight:800;color:${C.violet};margin:6px 0;letter-spacing:-0.02em;">${esc(h.value)}</div>
            <div style="font-size:15px;color:${C.textMid};line-height:1.45;">${esc(h.context)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Resumen" });
}

function slideKpis(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const a = report.analytics;
  const cards = [
    { label: "Perfiles", value: String(report.profiles.length), sub: a.networks.map(networkLabel).join(" · ") },
    { label: "Interacciones / post", value: fmtInt(a.avgInteractionsPerPost), sub: a.bestPerformer ? `Mejor: ${a.bestPerformer.name} (${fmtInt(a.bestPerformer.avgInteractionsPerPost)})` : "" },
    { label: "Crecimiento Promedio", value: `${a.avgGrowth.toFixed(2)}%`, sub: a.fastestGrower ? `Top: ${a.fastestGrower.name}` : "" },
    { label: "Total Seguidores", value: fmtNum(a.totalFollowers), sub: "Suma de audiencia" },
  ];

  // Párrafo interpretativo: usa el primer highlight con context o construye uno desde los datos
  const interp = report.highlights[0]?.context
    || (a.bestPerformer && a.fastestGrower
      ? `${a.bestPerformer.name} lidera en interacciones promedio por post con ${fmtInt(a.bestPerformer.avgInteractionsPerPost)}, mientras que ${a.fastestGrower.name} encabeza el crecimiento de seguidores con ${a.fastestGrower.growth.toFixed(2)}%. La audiencia consolidada del set alcanza ${fmtNum(a.totalFollowers)} seguidores.`
      : `El conjunto agrupa ${report.profiles.length} perfiles distribuidos en ${a.networks.length} redes, con un promedio de ${fmtInt(a.avgInteractionsPerPost)} interacciones por publicación.`);

  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:flex;flex-direction:column;gap:32px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:14px;">KPIs del Período</div>
        <h2 style="font-size:60px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Métricas clave</h2>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:22px;">
        ${cards.map((c) => `
          <div style="background:${C.paperAlt};border:1px solid ${C.border};border-radius:18px;padding:28px 34px;">
            <div style="font-size:13px;letter-spacing:0.25em;color:${C.textMuted};font-weight:700;text-transform:uppercase;">${esc(c.label)}</div>
            <div style="font-size:72px;font-weight:800;color:${C.violet};margin:8px 0;letter-spacing:-0.04em;line-height:1;">${esc(c.value)}</div>
            ${c.sub ? `<div style="font-size:17px;color:${C.textMid};">${esc(c.sub)}</div>` : ""}
          </div>
        `).join("")}
      </div>

      <div style="background:${C.violetSoft};border-left:4px solid ${C.violet};border-radius:0 8px 8px 0;padding:18px 26px;font-size:18px;line-height:1.55;color:${C.text};">${esc(truncate(interp, 360))}</div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "KPIs" });
}

function slideRanking(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const data = report.analytics.rankingByEngagement
    .filter((r) => r.hasData)
    .slice(0, 8)
    .map((r) => ({
      label: `${r.name} · ${networkLabel(r.network)}`,
      value: r.avgInteractionsPerPost,
      isOwn: r.isOwn,
      color: r.isOwn ? C.violet : networkColor(r.network),
      valueLabel: fmtInt(r.avgInteractionsPerPost),
    }));
  const insight = report.rankingInsight
    || (data.length > 0 ? `${data[0].label.split(" · ")[0]} encabeza con ${fmtInt(data[0].value)} interacciones promedio por publicación, marcando la referencia de desempeño del período.` : "");
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:flex;flex-direction:column;gap:24px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:14px;">Ranking</div>
        <h2 style="font-size:60px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Interacciones promedio por post</h2>
        <p style="font-size:18px;color:${C.textMid};margin:12px 0 0 0;">${report.reportMode === "brand" ? "Desempeño de los perfiles de la marca por interacciones absolutas." : "Marca propia (violeta) vs competencia (color de red social)."}</p>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;">${svgRankingBars(data, 1620, 64)}</div>
      ${insight ? `<div style="background:${C.violetSoft};border-left:4px solid ${C.violet};border-radius:0 8px 8px 0;padding:16px 24px;font-size:17px;line-height:1.5;color:${C.text};">${esc(truncate(insight, 320))}</div>` : ""}
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Ranking" });
}

function slideShareOfInteractions(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  // Agrupa share por marca canónica (sin acentos / mex≡méxico) sumando interactionsShare
  const sov = report.analytics.shareOfVoice.filter((s) => s.interactionsShare > 0);
  const byBrand = new Map<string, { variants: string[]; value: number; isOwn: boolean }>();
  for (const s of sov) {
    const key = brandKey(s.name);
    const prev = byBrand.get(key);
    if (prev) {
      prev.value += s.interactionsShare;
      prev.variants.push(s.name);
      prev.isOwn = prev.isOwn || s.isOwn;
    } else {
      byBrand.set(key, { variants: [s.name], value: s.interactionsShare, isOwn: s.isOwn });
    }
  }
  const data = Array.from(byBrand.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 7)
    .map((d) => ({ label: pickDisplayName(d.variants), value: d.value, isOwn: d.isOwn }));

  const own = data.find((d) => d.isOwn);
  const leader = data[0];
  const totalShown = data.reduce((s, d) => s + d.value, 0);
  const interp = (() => {
    if (!leader) return "Sin datos suficientes para calcular el reparto de interacciones del período.";
    if (own && leader.isOwn) {
      return `${own.label} lidera el reparto de interacciones del período con ${own.value.toFixed(1)}% del total agregado, manteniendo ventaja sobre el resto del set competitivo.`;
    }
    if (own) {
      const gap = leader.value > 0 ? (leader.value / Math.max(own.value, 0.01)) : 0;
      return `${leader.label} concentra ${leader.value.toFixed(1)}% de las interacciones del período, mientras que ${own.label} captura ${own.value.toFixed(1)}%${gap > 1 ? ` — una brecha de ${gap.toFixed(1)}× respecto al líder` : ""}. Las ${data.length} marcas mostradas suman ${totalShown.toFixed(1)}% del total.`;
    }
    return `${leader.label} encabeza la distribución con ${leader.value.toFixed(1)}% de las interacciones agregadas del set.`;
  })();

  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:flex;flex-direction:column;gap:20px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:12px;">Share of Interactions</div>
        <h2 style="font-size:56px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Reparto del volumen total de interacciones</h2>
        <p style="font-size:17px;color:${C.textMid};margin:10px 0 0 0;">Distribución porcentual de las interacciones absolutas (likes + comentarios + shares) generadas por cada marca en el período.</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1.1fr;gap:80px;align-items:center;flex:1;">
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${data.map((d, i) => {
            const palette = [C.violet, "#F97316", "#06B6D4", "#8B5CF6", "#EC4899", "#22C55E", "#EAB308"];
            const color = d.isOwn ? C.violet : palette[(i + 1) % palette.length];
            return `<div style="display:flex;align-items:center;gap:14px;font-size:18px;padding:6px 0;">
              <span style="width:16px;height:16px;border-radius:4px;background:${color};flex-shrink:0;"></span>
              <span style="flex:1;color:${d.isOwn ? C.text : C.textMid};font-weight:${d.isOwn ? 800 : 500};">${esc(d.label)}${d.isOwn ? " (marca propia)" : ""}</span>
              <span style="font-weight:800;color:${C.text};font-variant-numeric:tabular-nums;">${d.value.toFixed(1)}%</span>
            </div>`;
          }).join("")}
        </div>
        <div style="display:flex;align-items:center;justify-content:center;">${svgSovDonut(data)}</div>
      </div>
      <div style="background:${C.violetSoft};border-left:4px solid ${C.violet};border-radius:0 8px 8px 0;padding:16px 24px;font-size:17px;line-height:1.5;color:${C.text};">${esc(truncate(interp, 420))}</div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Share of Interactions" });
}

function slideNetworkBreakdown(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  // Interacciones por red (con comas en miles)
  const eng = report.analytics.networkEngagement
    .filter((n) => n.totalInteractions > 0)
    .map((n) => ({
      label: networkLabel(n.network),
      value: n.avgInteractionsPerPost,
      color: networkColor(n.network),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Interacciones promedio por marca (agregado de todas sus redes)
  const brand = (report.analytics.brandEngagement || [])
    .filter((b) => b.avgInteractionsPerPost > 0)
    .map((b) => ({
      label: b.brand,
      value: b.avgInteractionsPerPost,
      color: b.isOwn ? C.violet : C.textMuted,
      isOwn: b.isOwn,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const insight = (() => {
    if (!eng.length || !brand.length) return report.profilesInsight || "";
    const topNet = eng[0];
    const lowNet = eng[eng.length - 1];
    const topBrand = brand[0];
    const ownBrand = brand.find((b) => b.isOwn);
    const netGap = lowNet && topNet.value > 0 ? (topNet.value / Math.max(lowNet.value, 1)) : 0;
    let s = `Por red social, ${topNet.label} concentra el mejor desempeño con ${fmtInt(topNet.value)} interacciones promedio por publicación`;
    if (lowNet && lowNet.label !== topNet.label && netGap > 1) {
      s += `, frente a ${fmtInt(lowNet.value)} de ${lowNet.label} (${netGap.toFixed(1)}× de diferencia entre la mejor y la peor red del set)`;
    }
    s += `. Por marca, ${topBrand.label} encabeza con ${fmtInt(topBrand.value)} interacciones promedio por post`;
    if (ownBrand && !ownBrand.isOwn === false && ownBrand.label !== topBrand.label) {
      const gap = topBrand.value > 0 ? (topBrand.value / Math.max(ownBrand.value, 1)) : 0;
      s += `, mientras que ${ownBrand.label} (marca propia) registra ${fmtInt(ownBrand.value)} — una brecha de ${gap.toFixed(1)}× respecto al líder`;
    }
    s += ".";
    return s;
  })();

  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:flex;flex-direction:column;gap:24px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:14px;">Por Red Social y Marca</div>
        <h2 style="font-size:60px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Desempeño por plataforma</h2>
        <p style="font-size:18px;color:${C.textMid};margin:12px 0 0 0;">Interacciones promedio por post, comparadas por red social y por marca.</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:48px;flex:1;">
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="font-size:15px;letter-spacing:0.2em;color:${C.textMuted};font-weight:800;text-transform:uppercase;">Por red social</div>
          <div style="flex:1;display:flex;align-items:center;">${svgNetworkBars(eng, 780, 64, "")}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="font-size:15px;letter-spacing:0.2em;color:${C.textMuted};font-weight:800;text-transform:uppercase;">Por marca (agregado)</div>
          <div style="flex:1;display:flex;align-items:center;">${svgNetworkBars(brand, 780, 56, "")}</div>
        </div>
      </div>

      ${insight ? `<div style="background:${C.violetSoft};border-left:4px solid ${C.violet};border-radius:0 8px 8px 0;padding:14px 24px;font-size:16px;line-height:1.5;color:${C.text};">${esc(truncate(insight, 480))}</div>` : ""}
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Por Red Social" });
}

function slideTopContent(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const posts = report.topPosts.slice(0, 5);
  const renderCard = (p: typeof posts[number], i: number) => `
    <div style="background:${C.paper};border:1px solid ${C.border};border-radius:14px;padding:24px 26px;display:flex;flex-direction:column;gap:12px;box-shadow:0 2px 8px rgba(11,10,31,0.04);min-height:0;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="flex-shrink:0;width:30px;height:30px;border-radius:50%;background:${C.violet};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;">${i + 1}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:17px;font-weight:700;color:${C.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.authorName)}</div>
          <div style="font-size:12px;color:${C.textMuted};">${esc(networkLabel(p.network))} · ${esc(p.postDate)}</div>
        </div>
        <span style="display:inline-block;padding:3px 10px;border-radius:100px;background:${networkColor(p.network)};color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;">${esc(networkLabel(p.network))}</span>
      </div>
      ${p.postContent ? `<p style="font-size:14px;line-height:1.5;color:${C.textMid};margin:0;">${esc(truncate(p.postContent, 320))}</p>` : ""}
      <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:${C.textMid};margin-top:auto;border-top:1px solid ${C.border};padding-top:10px;">
        <span><strong style="color:${C.violet};font-size:15px;">${fmtNum(p.engagement)}</strong> engagement</span>
        <span>${fmtNum(p.likes)} likes</span>
        <span>${fmtNum(p.comments)} coment.</span>
      </div>
    </div>
  `;
  const top3 = posts.slice(0, 3);
  const next2 = posts.slice(3, 5);
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:flex;flex-direction:column;gap:20px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:12px;">Top Contenidos</div>
        <h2 style="font-size:54px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Mejores publicaciones del período</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:18px;">
        ${top3.map((p, i) => renderCard(p, i)).join("")}
      </div>
      ${next2.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:18px;">
        ${next2.map((p, i) => renderCard(p, i + 3)).join("")}
      </div>` : ""}
      ${report.topContentInsight ? `<div style="background:${C.violetSoft};border-left:4px solid ${C.violet};border-radius:0 8px 8px 0;padding:18px 26px;font-size:15px;line-height:1.55;color:${C.text};max-height:none;">${esc(truncate(report.topContentInsight, 900))}</div>` : ""}
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Top Contenidos" });
}

function slideFindings(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const items = report.keyFindings.slice(0, 5);
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 140px;display:flex;flex-direction:column;gap:28px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.indigoBright};font-weight:800;text-transform:uppercase;margin-bottom:12px;">Sección · Hallazgos Clave</div>
        <h2 style="font-size:56px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Lo más relevante del período</h2>
      </div>
      <ol style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px;flex:1;">
        ${items.map((it, i) => `
          <li style="display:flex;gap:28px;align-items:flex-start;background:#FFFFFF;border:1px solid ${C.border};border-left:6px solid ${C.indigoBright};border-radius:12px;padding:20px 28px;">
            <span style="flex-shrink:0;font-size:54px;font-weight:800;color:${C.indigoBright};line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-0.04em;min-width:72px;">${String(i + 1).padStart(2, "0")}</span>
            <span style="flex:1;font-size:20px;line-height:1.5;color:${C.text};font-weight:500;padding-top:6px;">${esc(truncate(it, 360))}</span>
          </li>
        `).join("")}
      </ol>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Hallazgos" });
}

function slideRecommendations(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const items = report.recommendations.slice(0, 5);
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 140px;display:flex;flex-direction:column;gap:28px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.orange};font-weight:800;text-transform:uppercase;margin-bottom:12px;">Sección · Recomendaciones</div>
        <h2 style="font-size:56px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Próximos pasos</h2>
      </div>
      <ol style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;flex:1;">
        ${items.map((it, i) => `
          <li style="display:flex;gap:24px;align-items:flex-start;background:#FFFFFF;border:1px solid ${C.border};border-left:6px solid ${C.orange};border-radius:12px;padding:16px 24px;">
            <span style="flex-shrink:0;font-size:44px;font-weight:800;color:${C.orange};line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-0.04em;min-width:64px;">${String(i + 1).padStart(2, "0")}</span>
            <span style="flex:1;font-size:16px;line-height:1.5;color:${C.text};font-weight:500;padding-top:4px;">${esc(truncate(it, 600))}</span>
          </li>
        `).join("")}
      </ol>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Recomendaciones" });
}

function slideClosing(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const fullConclusion = (report.conclusion || "El período cierra con señales claras para la próxima ventana de acción.").trim();
  const headline = truncate(fullConclusion.split(/[.!?]/)[0] + ".", 220);
  const showBody = report.conclusion && fullConclusion.length > headline.length;
  const body = `
    <div style="position:absolute;inset:0;padding:120px 120px 160px;display:flex;flex-direction:column;justify-content:center;gap:32px;">
      <div style="position:absolute;bottom:-200px;right:-200px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle, ${C.violetGlow} 0%, transparent 70%);opacity:0.35;pointer-events:none;"></div>
      <div style="position:absolute;top:60px;right:80px;transform:scale(1.2);opacity:0.6;pointer-events:none;">${sparkles(C.orange, 0.85)}</div>

      <div style="position:relative;z-index:5;max-width:1500px;">
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.orange};font-weight:800;text-transform:uppercase;margin-bottom:18px;">Conclusión</div>
        <h2 style="font-size:56px;font-weight:800;line-height:1.1;margin:0 0 24px 0;letter-spacing:-0.025em;color:#fff;">${esc(headline)}</h2>
        ${showBody ? `<p style="font-size:21px;line-height:1.55;color:rgba(255,255,255,0.78);margin:0;max-width:1400px;">${esc(truncate(fullConclusion, 720))}</p>` : ""}
      </div>

      <div style="position:relative;z-index:5;display:flex;align-items:center;gap:20px;border-top:1px solid rgba(255,255,255,0.15);padding-top:24px;margin-top:16px;">
        <img src="${WIZR_LOGO_COLOR_B64}" alt="Wizr" style="height:36px;filter:brightness(0) invert(1);"/>
        <span style="font-size:13px;letter-spacing:0.3em;color:rgba(255,255,255,0.55);font-weight:700;text-transform:uppercase;">Performance Intelligence · ${esc(clientName)}</span>
      </div>
    </div>
  `;
  return slideShell({ bg: "dark", pageNumber: page, total, clientName, modeLabel, body, showHeader: false });
}

function slideThankYou(clientName: string, modeLabel: string, page: number, total: number): string {
  const body = `
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:1100px;height:1100px;border-radius:50%;background:radial-gradient(circle, ${C.violetGlow} 0%, transparent 60%);opacity:0.35;pointer-events:none;"></div>
      <div style="position:absolute;top:120px;right:160px;transform:scale(1.8);opacity:0.6;pointer-events:none;">${sparkles(C.orange, 0.8)}</div>
      <div style="position:absolute;bottom:120px;left:160px;transform:scale(1.4) rotate(180deg);opacity:0.5;pointer-events:none;">${sparkles("#FFFFFF", 0.7)}</div>

      <div style="position:relative;z-index:5;display:flex;flex-direction:column;align-items:center;gap:48px;text-align:center;padding:80px;">
        <div style="display:inline-flex;align-items:center;gap:14px;padding:12px 28px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:100px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${C.orange};box-shadow:0 0 0 6px rgba(255,107,44,0.18);"></span>
          <span style="font-size:14px;letter-spacing:0.3em;color:#fff;font-weight:700;text-transform:uppercase;">Fin del reporte</span>
        </div>

        <h2 style="font-size:200px;font-weight:800;line-height:0.9;margin:0;letter-spacing:-0.05em;color:#fff;">Gracias</h2>

        <div style="display:flex;align-items:center;gap:20px;">
          <span style="width:60px;height:2px;background:${C.orange};"></span>
          <span style="font-size:18px;letter-spacing:0.32em;color:rgba(255,255,255,0.7);font-weight:600;text-transform:uppercase;">${esc(clientName)} · ${esc(modeLabel)}</span>
          <span style="width:60px;height:2px;background:${C.orange};"></span>
        </div>

        <p style="font-size:22px;line-height:1.5;color:rgba(255,255,255,0.65);margin:0;max-width:900px;">Para profundizar en cualquier hallazgo o explorar nuevos ángulos analíticos, el equipo Wizr está disponible.</p>

        <div style="display:flex;align-items:center;gap:32px;margin-top:24px;">
          <img src="${WIZR_LOGO_COLOR_B64}" alt="Wizr" style="height:48px;filter:brightness(0) invert(1);"/>
          <span style="font-size:14px;letter-spacing:0.3em;color:rgba(255,255,255,0.5);font-weight:700;text-transform:uppercase;">wizr.mx</span>
        </div>
      </div>
    </div>
  `;
  return slideShell({ bg: "dark", pageNumber: page, total, clientName, modeLabel, body, showHeader: false, showFooter: false });
}

export function buildPerformanceSlidesReport(
  report: PerformanceReportContent,
  clientName: string,
  dateRange: DateRange,
): { slides: string[]; fullHtml: string; count: number } {
  const isBrand = report.reportMode === "brand";
  const modeLabel = isBrand ? "Marca" : "Benchmark";

  const hasSov = !isBrand && report.analytics.shareOfVoice.length > 0;
  const hasTopPosts = report.topPosts.length > 0;
  const hasRecs = report.recommendations.length > 0;
  const hasNetworkBreakdown = report.analytics.networkEngagement.some((n) => n.totalInteractions > 0)
    || report.analytics.networkGrowth.some((n) => Number.isFinite(n.avgGrowth));

  // Build agenda items list
  const agendaItems: { label: string; desc: string }[] = [
    { label: "Resumen Ejecutivo", desc: "Síntesis y highlights del período" },
    { label: "KPIs del período", desc: "Métricas clave consolidadas" },
    { label: "Ranking por Engagement", desc: "Desempeño por perfil" },
  ];
  if (hasSov) agendaItems.push({ label: "Share of Interactions", desc: "Reparto del volumen de interacciones por marca" });
  if (hasNetworkBreakdown) agendaItems.push({ label: "Por Red Social", desc: "Desempeño por plataforma" });
  if (hasTopPosts) agendaItems.push({ label: "Top Contenidos", desc: "Mejores publicaciones del período" });
  agendaItems.push({ label: "Hallazgos Clave", desc: "Lo más relevante para destacar" });
  if (hasRecs) agendaItems.push({ label: "Recomendaciones", desc: "Próximos pasos accionables" });
  agendaItems.push({ label: "Conclusión", desc: "Cierre estratégico del período" });

  // Compute total slide count: cover + agenda + 2 dividers (data, insights) + content slides + closing + thanks
  const dataSlides =
    1 + // exec summary
    1 + // kpis
    1 + // ranking
    (hasSov ? 1 : 0) +
    (hasNetworkBreakdown ? 1 : 0) +
    (hasTopPosts ? 1 : 0);
  const insightSlides = 1 + (hasRecs ? 1 : 0); // findings + recs

  const total =
    1 + // cover
    1 + // agenda
    1 + // divider 1: Datos
    dataSlides +
    1 + // divider 2: Insights
    insightSlides +
    1 + // closing
    1; // thanks

  const slides: string[] = [];
  let p = 1;

  // 1. Cover
  slides.push(slideCover(report, clientName, dateRange, total));
  p++;

  // 2. Agenda
  slides.push(slideAgenda(agendaItems, clientName, modeLabel, p++, total));

  // 3. Section divider — Datos
  slides.push(
    slideSectionDivider({
      number: 1,
      label: "Datos",
      title: "El período en cifras",
      subtitle: "Métricas, ranking y distribución del engagement por perfil, marca y red social.",
      accent: C.violet,
      clientName,
      modeLabel,
      page: p++,
      total,
    }),
  );

  // Data slides
  slides.push(slideExecutiveSummary(report, clientName, modeLabel, p++, total));
  slides.push(slideKpis(report, clientName, modeLabel, p++, total));
  slides.push(slideRanking(report, clientName, modeLabel, p++, total));
  if (hasSov) slides.push(slideShareOfInteractions(report, clientName, modeLabel, p++, total));
  if (hasNetworkBreakdown) slides.push(slideNetworkBreakdown(report, clientName, modeLabel, p++, total));
  if (hasTopPosts) slides.push(slideTopContent(report, clientName, modeLabel, p++, total));

  // Section divider — Insights
  slides.push(
    slideSectionDivider({
      number: 2,
      label: "Insights",
      title: "Lecturas y próximos pasos",
      subtitle: "Hallazgos clave del período y recomendaciones accionables para la siguiente ventana.",
      accent: C.orange,
      clientName,
      modeLabel,
      page: p++,
      total,
    }),
  );

  // Insight slides
  slides.push(slideFindings(report, clientName, modeLabel, p++, total));
  if (hasRecs) slides.push(slideRecommendations(report, clientName, modeLabel, p++, total));

  // Closing + Thanks
  slides.push(slideClosing(report, clientName, modeLabel, p++, total));
  slides.push(slideThankYou(clientName, modeLabel, p++, total));

  const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(report.title || clientName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body { margin: 0; padding: 0; background: #000; font-family: 'Inter','Segoe UI',sans-serif; }
  @page { size: 1920px 1080px; margin: 0; }
  .slide { display: block; page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; }
  .slide:last-child { page-break-after: auto; break-after: auto; }
  img { display: block; max-width: 100%; }
</style>
</head>
<body>
${slides.join("\n")}
</body>
</html>`;

  return { slides, fullHtml, count: slides.length };
}
