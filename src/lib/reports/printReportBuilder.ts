import type { SmartReportContent, SourceBreakdown, InfluencerInfo, TimelinePoint, MediaOutletInfo } from "@/hooks/useSmartReport";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LOGO_WHITE_B64 } from "./logoBase64";

interface DateRange {
  start: string;
  end: string;
  label: string;
}

const C = {
  primary: "#1e1b4b",
  accent: "#6366f1",
  accentLight: "#a5b4fc",
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#94a3b8",
  cardBg: "#f8fafc",
  white: "#ffffff",
  textDark: "#111827",
  textGray: "#6b7280",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
};

function sentColor(s: string) {
  if (s === "positivo") return C.positive;
  if (s === "negativo") return C.negative;
  return C.neutral;
}

function sentLabel(s: string) {
  if (s === "positivo") return "Positivo";
  if (s === "negativo") return "Negativo";
  if (s === "mixto") return "Mixto";
  return "Neutral";
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("es-MX");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function detectBadge(report: SmartReportContent, isSummary: boolean): { label: string; bg: string } {
  if (isSummary) return { label: "RESUMEN", bg: "#3b82f6" };
  const total = report.metrics.totalMentions || 1;
  const negPct = (report.metrics.negativeCount / total) * 100;
  if (negPct > 60) return { label: "CRISIS", bg: C.negative };
  if (report.entityComparison) return { label: "COMPARATIVO", bg: "#0891b2" };
  return { label: "BRIEF", bg: "#3b82f6" };
}

function section(title: string, body: string, headerBg = C.accent): string {
  return `<div class="report-section" style="border-radius:6px;overflow:hidden;border:1px solid ${C.border};box-shadow:0 1px 3px rgba(0,0,0,0.04);background:${C.white};">
    <div class="section-header-wrap" style="break-inside:avoid;page-break-inside:avoid;">
      <div class="section-header" style="background:${headerBg};color:#fff;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;padding:8px 16px;">${escapeHtml(title)}</div>
    </div>
    <div class="section-body" style="padding:14px 16px;background:${C.white};">${body}</div>
  </div>`;
}

function estimateTextLines(text: string, charsPerLine = 96): number {
  const plainText = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) return 1;
  return Math.max(1, Math.ceil(plainText.length / charsPerLine));
}

function insightCard(text: string, icon: string, color: string): string {
  // text already comes pre-escaped/highlighted; convert to bullets if multi-sentence.
  // We re-derive from raw text not available here, so accept callers passing raw and switch.
  return `<div class="avoid-break" style="background:${color}08;border-left:4px solid ${color};border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:10px;display:flex;gap:10px;align-items:flex-start;">
    <span style="font-size:14px;flex-shrink:0;margin-top:1px;">${icon}</span>
    <div style="flex:1;font-size:10.5px;line-height:1.6;color:${C.textDark};">${text}</div>
  </div>`;
}

function insightCardBullets(rawText: string, icon: string, color: string): string {
  const body = renderAsBullets(rawText, { fontSize: "10.5px", lineHeight: "1.6", color: C.textDark });
  return `<div class="avoid-break" style="background:${color}08;border-left:4px solid ${color};border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:10px;display:flex;gap:10px;align-items:flex-start;">
    <span style="font-size:14px;flex-shrink:0;margin-top:1px;">${icon}</span>
    <div style="flex:1;">${body}</div>
  </div>`;
}

function highlightText(text: string): string {
  const escaped = escapeHtml(text);
  // 1) Markdown-style **bold** from the AI -> <strong>
  let result = escaped.replace(/\*\*([^*\n]+?)\*\*/g, `<strong>$1</strong>`);
  // 2) Auto-bold metrics
  result = result.replace(/(\d[\d,.]*\s*(?:%|menciones|interacciones|M\b|K\b))/gi, "<strong>$1</strong>");
  // 3) Quoted phrases
  result = result.replace(/&#39;([^&#]+?)&#39;/g, "<strong>'$1'</strong>");
  result = result.replace(/'([^']+?)'/g, "<strong>'$1'</strong>");
  return result;
}

/**
 * Splits a long paragraph into sentence-level fragments for bullet rendering.
 * Keeps very short text as a single item.
 */
function splitToBullets(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  // Split by sentence endings, keeping punctuation
  const parts = clean
    .split(/(?<=[\.\?\!])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"'(\[])/)
    .map((s) => s.trim())
    .filter(Boolean);
  // Merge tiny fragments (<35 chars) with the previous one
  const merged: string[] = [];
  for (const p of parts) {
    if (merged.length > 0 && p.length < 35) {
      merged[merged.length - 1] += " " + p;
    } else {
      merged.push(p);
    }
  }
  return merged.length > 0 ? merged : [clean];
}

/**
 * Renders a long text as a bulleted list when it has multiple sentences;
 * otherwise renders a single paragraph.
 */
function renderAsBullets(
  text: string,
  opts: { fontSize?: string; lineHeight?: string; color?: string; minSentencesForList?: number } = {},
): string {
  const fontSize = opts.fontSize || "10.5px";
  const lineHeight = opts.lineHeight || "1.6";
  const color = opts.color || C.textDark;
  const minSentences = opts.minSentencesForList ?? 2;

  const bullets = splitToBullets(text);
  if (bullets.length < minSentences) {
    return `<p style="font-size:${fontSize};line-height:${lineHeight};color:${color};margin:0;">${highlightText(text)}</p>`;
  }
  const items = bullets
    .map(
      (b) => `<li style="font-size:${fontSize};line-height:${lineHeight};color:${color};margin:0 0 5px 0;padding-left:4px;">${highlightText(b)}</li>`,
    )
    .join("");
  return `<ul style="margin:0;padding-left:18px;list-style-type:disc;">${items}</ul>`;
}

function chartPlatformBars(sources: SourceBreakdown[]): string {
  const data = sources.slice(0, 8);
  if (!data.length) return "";
  const max = Math.max(...data.map((s) => s.count), 1);
  const rows = data
    .map((s, i) => {
      const pct = (s.count / max) * 100;
      const color = i < 3 ? C.accent : C.neutral;
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="min-width:90px;font-size:8px;color:${C.textGray};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.source)}</span>
      <div style="flex:1;background:${C.borderLight};border-radius:3px;height:14px;overflow:hidden;">
        <div style="width:${pct}%;background:${color};height:100%;border-radius:3px;min-width:2px;"></div>
      </div>
      <span style="font-size:9px;font-weight:700;min-width:28px;color:${C.textDark};">${s.count}</span>
    </div>`;
    })
    .join("");
  return `<div><div style="font-size:9px;font-weight:700;margin-bottom:6px;text-align:center;color:${C.textDark};text-transform:uppercase;letter-spacing:0.5px;">Menciones por Plataforma</div>${rows}</div>`;
}

function chartDailyBars(timeline: TimelinePoint[]): string {
  const data = timeline.slice(0, 14);
  if (!data.length) return "";
  const max = Math.max(...data.map((t) => t.count), 1);
  const maxIdx = data.indexOf(data.reduce((a, b) => (a.count > b.count ? a : b)));
  const bars = data
    .map((t, i) => {
      const pct = (t.count / max) * 100;
      const color = i === maxIdx ? C.negative : C.accent;
      const dayLabel = t.date.slice(5);
      return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
      <span style="font-size:7px;font-weight:700;color:${C.textDark};margin-bottom:3px;">${t.count}</span>
      <div style="width:55%;background:${color};border-radius:2px 2px 0 0;height:${Math.max(pct * 0.45, 3)}px;"></div>
      <span style="font-size:7px;color:${C.textGray};margin-top:3px;">${dayLabel}</span>
    </div>`;
    })
    .join("");
  return `<div><div style="font-size:9px;font-weight:700;margin-bottom:10px;text-align:center;color:${C.textDark};text-transform:uppercase;letter-spacing:0.5px;">Evolución Diaria de Menciones</div>
    <div style="display:flex;align-items:flex-end;height:55px;gap:3px;">${bars}</div></div>`;
}

function chartSentimentByPlatform(sources: SourceBreakdown[]): string {
  const data = sources.filter((s) => s.count > 0).slice(0, 8);
  if (!data.length) return "";
  const rows = data
    .map((s) => {
      const total = s.count || 1;
      const posPct = (s.positive / total) * 100;
      const neuPct = (s.neutral / total) * 100;
      const negPct = (s.negative / total) * 100;
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="min-width:90px;font-size:8px;color:${C.textGray};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.source)}</span>
      <div style="flex:1;display:flex;height:14px;border-radius:3px;overflow:hidden;">
        <div style="width:${posPct}%;background:${C.positive};"></div>
        <div style="width:${neuPct}%;background:${C.neutral};"></div>
        <div style="width:${negPct}%;background:${C.negative};"></div>
      </div>
    </div>`;
    })
    .join("");
  return `<div><div style="font-size:9px;font-weight:700;margin-bottom:6px;text-align:center;color:${C.textDark};text-transform:uppercase;letter-spacing:0.5px;">Sentimiento por Plataforma</div>${rows}</div>`;
}

function chartTopInfluencersBars(influencers: InfluencerInfo[]): string {
  const data = influencers.slice(0, 6);
  if (!data.length) return "";
  const maxReach = Math.max(
    ...data.map((inf) => parseInt(inf.reach?.replace(/\D/g, "") || "0") || inf.mentions),
    1,
  );
  const rows = data
    .map((inf) => {
      const val = parseInt(inf.reach?.replace(/\D/g, "") || "0") || inf.mentions;
      const pct = (val / maxReach) * 100;
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="min-width:90px;font-size:8px;color:${C.textGray};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(inf.name || inf.username)}</span>
      <div style="flex:1;background:${C.borderLight};border-radius:3px;height:14px;overflow:hidden;">
        <div style="width:${pct}%;background:${sentColor(inf.sentiment)};height:100%;border-radius:3px;min-width:2px;"></div>
      </div>
      <span style="font-size:9px;font-weight:700;min-width:32px;color:${C.textDark};">${fmtNum(val)}</span>
    </div>`;
    })
    .join("");
  return `<div><div style="font-size:9px;font-weight:700;margin-bottom:6px;text-align:center;color:${C.textDark};text-transform:uppercase;letter-spacing:0.5px;">Top Influenciadores</div>${rows}</div>`;
}

export interface BuiltReport {
  html: string;
  header: { source: string; height: string; start_at?: number };
  footer: { source: string; height: string; start_at?: number };
}

export function buildReportHTML(
  report: SmartReportContent,
  projectName: string,
  dateRange: DateRange,
  isSummary: boolean,
): BuiltReport {
  const badge = detectBadge(report, isSummary);
  const generatedDate = format(new Date(), "d MMM yyyy, HH:mm", { locale: es });
  const total = report.metrics.totalMentions || 1;
  const negPct = ((report.metrics.negativeCount / total) * 100).toFixed(1);
  const posPct = ((report.metrics.positiveCount / total) * 100).toFixed(1);

  const summaryFontSize = isSummary ? "12px" : "11px";
  const summaryLineHeight = isSummary ? "1.75" : "1.65";
  const sectionSeparator = isSummary
    ? `<hr style="border:none;border-top:1.5px solid ${C.border};margin:16px 0;">`
    : "";

  const header = `<div style="background:${C.primary};padding:22px 24px;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="${LOGO_WHITE_B64}" alt="Wizr" style="height:34px;width:auto;display:block;" />
    </div>
    <div style="text-align:right;">
      <span style="background:${badge.bg};color:#fff;font-size:8px;font-weight:700;padding:3px 12px;border-radius:3px;text-transform:uppercase;letter-spacing:1px;">${badge.label}</span>
      <div style="color:#fff;font-size:13px;font-weight:600;margin-top:8px;max-width:440px;">${escapeHtml(report.title)}</div>
      <div style="color:${C.accentLight};font-size:9.5px;margin-top:4px;">${escapeHtml(dateRange.label)} · ${generatedDate}</div>
    </div>
  </div>`;

  const metricCell = (value: string, label: string, color = C.textDark) =>
    `<div style="flex:1;text-align:center;padding:10px 6px;">
      <div style="font-size:18px;font-weight:700;color:${color};line-height:1.2;">${value}</div>
      <div style="font-size:8px;color:${C.textGray};margin-top:3px;text-transform:uppercase;letter-spacing:0.5px;font-weight:500;">${label}</div>
    </div>`;
  const sep = `<div style="width:1px;background:${C.border};margin:8px 0;"></div>`;
  const metricsRow = `<div style="display:flex;align-items:stretch;border:1px solid ${C.border};border-radius:6px;margin:6px 20px 0;background:${C.white};box-shadow:0 1px 3px rgba(0,0,0,0.04);">
    ${metricCell(fmtNum(report.metrics.estimatedImpressions), "Impresiones Est.")}${sep}
    ${metricCell(report.metrics.totalMentions.toString(), "Total Menciones")}${sep}
    ${metricCell(fmtNum(report.metrics.estimatedReach), "Alcance Est.")}${sep}
    ${metricCell(negPct + "%", "% Negativo", C.negative)}${sep}
    ${metricCell(posPct + "%", "% Positivo", C.positive)}
  </div>`;

  const posW = (report.metrics.positiveCount / total) * 100;
  const neuW = (report.metrics.neutralCount / total) * 100;
  const negW = (report.metrics.negativeCount / total) * 100;
  const sentBar = `<div style="padding:2px 20px 8px;">
    <div style="display:flex;height:20px;border-radius:10px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.12);">
      <div style="width:${posW}%;background:${C.positive};"></div>
      <div style="width:${neuW}%;background:${C.neutral};"></div>
      <div style="width:${negW}%;background:${C.negative};"></div>
    </div>
    <div style="display:flex;gap:20px;margin-top:6px;font-size:9px;color:${C.textGray};font-weight:500;">
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.positive};display:inline-block;"></span>Positivo ${posW.toFixed(0)}%</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.neutral};display:inline-block;"></span>Neutral ${neuW.toFixed(0)}%</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.negative};display:inline-block;"></span>Negativo ${negW.toFixed(0)}%</span>
    </div>
  </div>`;

  const blocks: string[] = [];

  blocks.push(
    section(
      "Resumen Ejecutivo",
      renderAsBullets(report.summary, { fontSize: summaryFontSize, lineHeight: summaryLineHeight, color: C.textDark }),
    ),
  );

  if (!isSummary) {
    const charts = [
      chartPlatformBars(report.sourceBreakdown),
      chartDailyBars(report.timeline),
      chartSentimentByPlatform(report.sourceBreakdown),
      chartTopInfluencersBars(report.influencers),
    ].filter(Boolean);

    if (charts.length > 0) {
      const grid = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">${charts.join("")}</div>`;
      blocks.push(section("Visualización de Datos", grid));
    }
  }

  if (isSummary) {
    blocks.push(sectionSeparator);
  }

  const findings = isSummary ? report.keyFindings.slice(0, 3) : report.keyFindings;
  let findingsHtml = "";
  if (findings.length > 0) {
    const firstSentiment = parseFloat(negPct) > 60 ? C.negative : C.accent;
    findingsHtml += `<div class="avoid-break">${insightCardBullets(findings[0], "🔍", firstSentiment)}</div>`;
    findings.slice(1).forEach((f, i) => {
      findingsHtml += `<div class="avoid-break" style="margin-bottom:10px;">
        <div class="avoid-break-inner">
          <div style="min-width:24px;height:24px;border-radius:50%;background:${C.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${i + 2}</div>
          <div style="flex:1;">${renderAsBullets(f, { fontSize: "10.5px", lineHeight: "1.6" })}</div>
        </div>
      </div>`;
    });
  }
  blocks.push(section("Hallazgos Clave", findingsHtml));

  if (isSummary) {
    blocks.push(sectionSeparator);
  }

  const infs = isSummary ? report.influencers.slice(0, 5) : report.influencers;
  if (infs.length > 0) {
    const headerRow = `<tr style="background:${C.primary};">
      <th style="padding:7px 10px;font-size:8px;text-align:left;color:#fff;font-weight:600;letter-spacing:0.5px;">#</th>
      <th style="padding:7px 10px;font-size:8px;text-align:left;color:#fff;font-weight:600;letter-spacing:0.5px;">Perfil</th>
      <th style="padding:7px 10px;font-size:8px;text-align:left;color:#fff;font-weight:600;letter-spacing:0.5px;">Red</th>
      <th style="padding:7px 10px;font-size:8px;text-align:center;color:#fff;font-weight:600;letter-spacing:0.5px;">Menciones</th>
      <th style="padding:7px 10px;font-size:8px;text-align:center;color:#fff;font-weight:600;letter-spacing:0.5px;">Sentimiento</th>
      <th style="padding:7px 10px;font-size:8px;text-align:right;color:#fff;font-weight:600;letter-spacing:0.5px;">Interacciones</th>
    </tr>`;
    const rows = infs
      .map((inf, i) => {
        const bg = i % 2 === 0 ? C.white : C.cardBg;
        const sentBg = `${sentColor(inf.sentiment)}15`;
        return `<tr style="background:${bg};">
        <td style="padding:5px 10px;font-size:9px;color:${C.textGray};">${i + 1}</td>
        <td style="padding:5px 10px;font-size:9.5px;font-weight:600;color:${C.textDark};">${escapeHtml(inf.name || inf.username)}</td>
        <td style="padding:5px 10px;font-size:9px;color:${C.textGray};">${escapeHtml(inf.platform)}</td>
        <td style="padding:5px 10px;font-size:9.5px;text-align:center;color:${C.textDark};font-weight:600;">${inf.mentions}</td>
        <td style="padding:5px 10px;font-size:9px;text-align:center;"><span style="background:${sentBg};color:${sentColor(inf.sentiment)};font-weight:700;padding:2px 8px;border-radius:10px;font-size:8px;">${sentLabel(inf.sentiment)}</span></td>
        <td style="padding:5px 10px;font-size:9.5px;text-align:right;font-weight:600;color:${C.textDark};">${escapeHtml(inf.reach || "—")}</td>
      </tr>`;
      })
      .join("");
    const table = `<table style="width:100%;border-collapse:collapse;">${headerRow}${rows}</table>`;
    blocks.push(section("Influenciadores en Redes Sociales", table));
  }

  // Tabla de Medios Digitales
  const outlets = isSummary ? (report.mediaOutlets || []).slice(0, 5) : (report.mediaOutlets || []);
  if (outlets.length > 0) {
    const outletHeader = `<tr style="background:${C.primary};">
      <th style="padding:7px 10px;font-size:8px;text-align:left;color:#fff;font-weight:600;letter-spacing:0.5px;">#</th>
      <th style="padding:7px 10px;font-size:8px;text-align:left;color:#fff;font-weight:600;letter-spacing:0.5px;">Medio</th>
      <th style="padding:7px 10px;font-size:8px;text-align:left;color:#fff;font-weight:600;letter-spacing:0.5px;">Dominio</th>
      <th style="padding:7px 10px;font-size:8px;text-align:center;color:#fff;font-weight:600;letter-spacing:0.5px;">Artículos</th>
      <th style="padding:7px 10px;font-size:8px;text-align:center;color:#fff;font-weight:600;letter-spacing:0.5px;">Sentimiento</th>
    </tr>`;
    const outletRows = outlets.map((o: MediaOutletInfo, i: number) => {
      const bg = i % 2 === 0 ? C.white : C.cardBg;
      const sentBg = `${sentColor(o.sentiment)}15`;
      return `<tr style="background:${bg};">
        <td style="padding:5px 10px;font-size:9px;color:${C.textGray};">${i + 1}</td>
        <td style="padding:5px 10px;font-size:9.5px;font-weight:600;color:${C.textDark};">${escapeHtml(o.name)}</td>
        <td style="padding:5px 10px;font-size:9px;color:${C.textGray};">${escapeHtml(o.domain)}</td>
        <td style="padding:5px 10px;font-size:9.5px;text-align:center;color:${C.textDark};font-weight:600;">${o.articles}</td>
        <td style="padding:5px 10px;font-size:9px;text-align:center;"><span style="background:${sentBg};color:${sentColor(o.sentiment)};font-weight:700;padding:2px 8px;border-radius:10px;font-size:8px;">${sentLabel(o.sentiment)}</span></td>
      </tr>`;
    }).join("");
    const outletTable = `<table style="width:100%;border-collapse:collapse;">${outletHeader}${outletRows}</table>`;
    blocks.push(section("Medios Digitales de Amplio Alcance", outletTable));
  }

  if (isSummary) {
    blocks.push(sectionSeparator);
  }

  if (!isSummary && report.narratives.length > 0) {
    const narrativesHtml = report.narratives
      .map((n) => {
        const trendIcon = n.trend === "creciente" ? "📈" : n.trend === "decreciente" ? "📉" : "➡️";
        return `<div class="avoid-break" style="border:1px solid ${C.border};border-radius:6px;padding:10px 14px;margin-bottom:10px;background:${C.cardBg};border-left:4px solid ${sentColor(n.sentiment)};">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
          <span style="font-size:11px;font-weight:700;color:${C.textDark};">${escapeHtml(n.narrative)}</span>
          <span style="background:${sentColor(n.sentiment)}15;color:${sentColor(n.sentiment)};font-size:8px;padding:2px 8px;border-radius:10px;font-weight:700;">${sentLabel(n.sentiment)}</span>
          <span style="font-size:8px;color:${C.textGray};font-weight:500;">${trendIcon} <strong>${n.mentions}</strong> menciones · ${n.trend}</span>
        </div>
        <div style="font-size:10px;color:${C.textGray};line-height:1.55;">${renderAsBullets(n.description, { fontSize: "10px", lineHeight: "1.55", color: C.textGray })}</div>
      </div>`;
      })
      .join("");
    blocks.push(section("Principales Narrativas", narrativesHtml));
  }

  const recs = isSummary ? report.recommendations.slice(0, 2) : report.recommendations;
  let recsHtml = "";
  if (recs.length > 0) {
    recsHtml += insightCardBullets(recs[0], "💡", C.accent);
    recs.slice(1).forEach((r, i) => {
      recsHtml += `<div class="avoid-break" style="margin-bottom:10px;">
        <div class="avoid-break-inner">
          <div style="min-width:24px;height:24px;border-radius:50%;background:${C.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${i + 2}</div>
          <div style="flex:1;">${renderAsBullets(r, { fontSize: "10.5px", lineHeight: "1.6" })}</div>
        </div>
      </div>`;
    });
  }
  blocks.push(section("Recomendaciones", recsHtml));

  if (isSummary) {
    blocks.push(sectionSeparator);
  }

  if (report.conclusions && report.conclusions.length > 0) {
    const concs = isSummary ? report.conclusions.slice(0, 2) : report.conclusions;
    const bodyWithBullets = concs
      .map(
        (c) => `<div class="avoid-break" style="margin-bottom:10px;">
        <div class="avoid-break-inner">
          <span style="min-width:6px;height:6px;border-radius:50%;background:${C.accent};display:block;margin-top:5px;flex-shrink:0;"></span>
          <div style="flex:1;">${renderAsBullets(c, { fontSize: "10.5px", lineHeight: "1.6" })}</div>
        </div>
      </div>`,
      )
      .join("");
    blocks.push(section("Conclusiones", bodyWithBullets, C.primary));
  }

  const headerContext = truncateText(`${projectName} · ${badge.label} · ${dateRange.label}`, 42);
  const headerSubtitle = truncateText(report.title, 58);

  // PDFShift v3 expects header/footer height in mm (as string).
  // A4 = 210 x 297 mm. We reserve the band physically with these values.
  const HEADER_HEIGHT_MM = 24; // reserva superior estable: evita solapes sin dejar tanto blanco
  const FOOTER_HEIGHT_MM = 10; // ~38 px @ 96dpi
  // Internal padding inside the band so logo/title se mantengan centrados verticalmente.
  const HEADER_PAD_TOP_MM = 4;
  const HEADER_PAD_BOTTOM_MM = 4;

  const pdfHeaderSource = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Helvetica Neue','Inter',Arial,sans-serif;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
html,body{width:100%;height:${HEADER_HEIGHT_MM}mm;overflow:hidden;margin:0;padding:0;background:${C.primary};}
.bar{width:100%;height:${HEADER_HEIGHT_MM}mm;background:${C.primary};display:table;table-layout:fixed;}
.cell{display:table-cell;vertical-align:middle;padding:${HEADER_PAD_TOP_MM}mm 10mm ${HEADER_PAD_BOTTOM_MM}mm 10mm;box-sizing:border-box;}
.cell.left{width:40mm;}
.cell.right{text-align:right;color:#fff;overflow:hidden;}
.logo{height:10mm;width:auto;display:block;}
.text-wrap{display:block;width:100%;max-width:145mm;margin-left:auto;overflow:hidden;}
.ctx{display:block;max-width:145mm;font-size:7pt;line-height:1.1;font-weight:600;color:${C.accentLight};letter-spacing:0.15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.title{display:block;max-width:145mm;font-size:7.6pt;line-height:1.1;font-weight:700;color:#fff;margin-top:0.7mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
</style></head><body>
<div class="bar">
  <div class="cell left"><img class="logo" src="${LOGO_WHITE_B64}" alt="Wizr" /></div>
  <div class="cell right">
    <div class="text-wrap">
      <div class="ctx">${escapeHtml(headerContext)}</div>
      <div class="title">${escapeHtml(headerSubtitle)}</div>
    </div>
  </div>
</div>
</body></html>`;

  const pdfFooterSource = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Helvetica Neue','Inter',Arial,sans-serif;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
html,body{width:100%;height:${FOOTER_HEIGHT_MM}mm;overflow:hidden;}
body{background:transparent;}
.bar{width:100%;height:${FOOTER_HEIGHT_MM}mm;background:${C.primary};display:flex;align-items:center;justify-content:space-between;padding:0 10mm;color:#fff;border-top:1px solid rgba(255,255,255,0.12);}
.left{font-size:7pt;color:${C.accentLight};letter-spacing:0.3px;}
.right{font-size:7pt;font-weight:600;letter-spacing:0.3px;color:#fff;}
</style></head><body>
<div class="bar">
  <div class="left">Generado con Wizr · ${escapeHtml(generatedDate)}</div>
  <div class="right">Página {{page}} de {{total}}</div>
</div>
</body></html>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(report.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{
  font-family:'Inter',sans-serif;
  font-size:11px;
  color:${C.textDark};
  background:#fff;
  width:794px;
  margin:0 auto;
  -webkit-print-color-adjust:exact !important;
  print-color-adjust:exact !important;
  color-adjust:exact !important;
}
strong{font-weight:700;color:${C.primary};}
.report-shell{background:${C.white};}
.page-intro{padding-bottom:6px;}
.page-intro-header{display:none;}
.report-content{padding:14px 20px 18px;}
.report-content > .pdf-section-block{margin-bottom:14px;}
.report-content > .pdf-section-block:last-child{margin-bottom:0;}

/* Pagination rules — apply ALWAYS (not only @media print) so PDFShift respects them */
.report-section{page-break-inside:auto;break-inside:auto;margin-bottom:6px;}
.pdf-section-block{page-break-inside:auto;break-inside:auto;}
.section-header-wrap{page-break-inside:avoid;break-inside:avoid;page-break-after:avoid;break-after:avoid;}
.section-header{page-break-after:avoid;break-after:avoid;page-break-inside:avoid;break-inside:avoid;}
.section-body{page-break-inside:auto;break-inside:auto;padding-bottom:6px;}
.section-body > *:first-child{page-break-before:avoid;break-before:avoid;}
.section-body > *:last-child{margin-bottom:14px;}
.avoid-break{page-break-inside:avoid !important;break-inside:avoid !important;-webkit-column-break-inside:avoid !important;display:block !important;}
.avoid-break-inner{display:flex;gap:10px;align-items:flex-start;}
table{page-break-inside:auto;}
thead{display:table-header-group;}
tr{page-break-inside:avoid;break-inside:avoid;page-break-after:auto;}
p{orphans:3;widows:3;}
li{page-break-inside:avoid;break-inside:avoid;orphans:3;widows:3;}
h1,h2,h3,h4{page-break-after:avoid;break-after:avoid;}

@page{
  size:A4;
  margin:${HEADER_HEIGHT_MM}mm 0 ${FOOTER_HEIGHT_MM}mm 0;
}

@media print{
  body{width:100%;margin:0;padding:0;}
  .report-shell{padding:0;}
  .report-content{padding:14px 20px 12px;}
  .report-content > .pdf-section-block{margin-bottom:14px;padding-bottom:8px;}
}
@media screen{
  body{padding-bottom:30px;background:${C.borderLight};}
  .report-shell{box-shadow:0 8px 24px rgba(15,23,42,0.08);}
}
</style>
</head>
<body>
  <div class="report-shell">
    <div class="page-intro">
      <div class="page-intro-header">${header}</div>
      ${metricsRow}${sentBar}
    </div>
    <div class="report-content">
      ${blocks.map((block, blockIndex) => `<div class="pdf-section-block" data-pdf-section="block-${blockIndex + 1}">${block}</div>`).join("\n")}
    </div>
  </div>
</body>
</html>`;

  return {
    html,
    header: { source: pdfHeaderSource, height: `${HEADER_HEIGHT_MM}mm`, start_at: 1 },
    footer: { source: pdfFooterSource, height: `${FOOTER_HEIGHT_MM}mm`, start_at: 1 },
  };
}
