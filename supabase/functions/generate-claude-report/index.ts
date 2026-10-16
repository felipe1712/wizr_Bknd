import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Mention {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  source_domain: string | null;
  sentiment: string | null;
  created_at: string;
  published_at: string | null;
  matched_keywords: string[];
  raw_metadata: Record<string, unknown> | null;
}

interface PrecomputedReport {
  title: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  conclusions?: string[];
  metrics: {
    totalMentions: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    topSources: string[];
    estimatedImpressions: number;
    estimatedReach: number;
  };
  sourceBreakdown: Array<{ source: string; count: number; positive: number; negative: number; neutral: number }>;
  influencers: Array<{ name: string; username: string; platform: string; mentions: number; sentiment: string; reach: string }>;
  timeline: Array<{ date: string; count: number; negative: number; positive: number }>;
  narratives: Array<{ narrative: string; description: string; mentions: number; sentiment: "positivo" | "negativo" | "mixto"; trend: "creciente" | "decreciente" | "estable" }>;
  totalUniqueAuthors: number;
}

interface ReportRequest {
  mentions?: Mention[];
  precomputedReport?: PrecomputedReport;
  reportType: "brief" | "crisis" | "thematic" | "comparative";
  extension: "micro" | "short" | "medium";
  projectName: string;
  projectAudience: string;
  projectObjective: string;
  strategicContext?: string;
  strategicFocus?: string;
  entityNames?: string[];
  dateRange: { start: string; end: string; label: string };
}

const EXTENSION_CONFIG = {
  micro: { sampleCount: 5, maxTokens: 6000, maxSources: 5, maxAuthors: 4, maxKeywords: 5, maxExamples: 2, maxTimelinePoints: 5 },
  short: { sampleCount: 8, maxTokens: 9000, maxSources: 6, maxAuthors: 5, maxKeywords: 6, maxExamples: 3, maxTimelinePoints: 6 },
  medium: { sampleCount: 12, maxTokens: 12000, maxSources: 7, maxAuthors: 6, maxKeywords: 7, maxExamples: 3, maxTimelinePoints: 7 },
} as const;

type ExtensionKey = keyof typeof EXTENSION_CONFIG;

function normalizeSource(source: string | null | undefined): string {
  if (!source) return "desconocido";
  const s = source.toLowerCase();
  if (s.includes("x.com") || s.includes("twitter")) return "twitter.com";
  if (s.includes("facebook")) return "facebook.com";
  if (s.includes("instagram")) return "instagram.com";
  if (s.includes("tiktok")) return "tiktok.com";
  if (s.includes("youtube") || s.includes("youtu.be")) return "youtube.com";
  if (s.includes("linkedin")) return "linkedin.com";
  if (s.includes("reddit")) return "reddit.com";
  return s.replace(/^www\./, "");
}

function sampleEvenly<T>(items: T[], maxItems: number): T[] {
  if (items.length <= maxItems) return items;
  const step = Math.ceil(items.length / maxItems);
  return items.filter((_, index) => index % step === 0).slice(0, maxItems);
}

function buildReportContext(body: ReportRequest): string {
  const report = body.precomputedReport;
  if (report) {
    const sourceLines = report.sourceBreakdown
      .slice(0, Math.min(EXTENSION_CONFIG[body.extension].maxSources, 4))
      .map((item) => `${item.source}: ${item.count} menciones, neg ${item.negative}, pos ${item.positive}`)
      .join(" | ");

    const influencerLines = report.influencers
      .slice(0, Math.min(EXTENSION_CONFIG[body.extension].maxAuthors, 4))
      .map((item) => `${item.name} [${item.platform}] ${item.mentions} menciones, ${item.sentiment}`)
      .join(" | ");

    const timelineLines = report.timeline
      .slice(0, Math.min(EXTENSION_CONFIG[body.extension].maxTimelinePoints, 5))
      .map((item) => `${item.date}: ${item.count}`)
      .join(" | ");

    const narrativeLines = report.narratives
      .slice(0, 3)
      .map((item) => `${item.narrative} (${item.mentions}, ${item.sentiment}, ${item.trend})`)
      .join(" | ");

    return [
      `KPIS: total ${report.metrics.totalMentions}, positivas ${report.metrics.positiveCount}, negativas ${report.metrics.negativeCount}, neutrales ${report.metrics.neutralCount}, impresiones ${report.metrics.estimatedImpressions}, alcance ${report.metrics.estimatedReach}, autores ${report.totalUniqueAuthors}`,
      sourceLines ? `FUENTES: ${sourceLines}` : "",
      influencerLines ? `INFLUENCIADORES: ${influencerLines}` : "",
      timelineLines ? `TIMELINE: ${timelineLines}` : "",
      narrativeLines ? `NARRATIVAS: ${narrativeLines}` : "",
      report.summary ? `RESUMEN BASE: ${report.summary.slice(0, 900)}` : "",
      report.keyFindings?.length ? `HALLAZGOS BASE: ${report.keyFindings.slice(0, 4).map((item, index) => `${index + 1}) ${item.slice(0, 220)}`).join(" | ")}` : "",
      report.recommendations?.length ? `RECOMENDACIONES BASE: ${report.recommendations.slice(0, 4).map((item, index) => `${index + 1}) ${item.slice(0, 220)}`).join(" | ")}` : "",
      report.conclusions?.length ? `CONCLUSIONES BASE: ${report.conclusions.slice(0, 3).map((item, index) => `${index + 1}) ${item.slice(0, 220)}`).join(" | ")}` : "",
    ].filter(Boolean).join("\n");
  }

  const mentions = body.mentions || [];
  if (!mentions.length) return "";

  const cfg = EXTENSION_CONFIG[body.extension];
  const positive = mentions.filter((m) => m.sentiment === "positivo");
  const negative = mentions.filter((m) => m.sentiment === "negativo");
  const neutral = mentions.filter((m) => m.sentiment === "neutral");

  const bySource: Record<string, Mention[]> = {};
  const keywordCount: Record<string, number> = {};
  const byDate: Record<string, number> = {};
  const authorMap: Record<string, { name: string; platform: string; count: number; engagement: number; sentiments: string[] }> = {};

  mentions.forEach((m) => {
    const source = normalizeSource(m.source_domain);
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(m);

    m.matched_keywords?.forEach((k) => {
      keywordCount[k] = (keywordCount[k] || 0) + 1;
    });

    const date = (m.published_at || m.created_at || "").split("T")[0];
    if (date) byDate[date] = (byDate[date] || 0) + 1;

    const meta = m.raw_metadata;
    const authorName = (meta?.author || meta?.author_name || meta?.authorName || meta?.author_username || meta?.authorUsername) as string | undefined;
    if (!authorName) return;

    const key = `${authorName}@${source}`;
    if (!authorMap[key]) {
      authorMap[key] = { name: authorName, platform: source, count: 0, engagement: 0, sentiments: [] };
    }
    authorMap[key].count += 1;
    if (m.sentiment) authorMap[key].sentiments.push(m.sentiment);
    authorMap[key].engagement += Number(meta?.likes || 0) + Number(meta?.comments || 0) + Number(meta?.shares || 0) + Number(meta?.views || 0);
  });

  const sortedSources = Object.entries(bySource).sort((a, b) => b[1].length - a[1].length).slice(0, cfg.maxSources);
  const topKeywords = Object.entries(keywordCount).sort((a, b) => b[1] - a[1]).slice(0, cfg.maxKeywords);
  const topAuthors = Object.values(authorMap).sort((a, b) => b.engagement - a.engagement || b.count - a.count).slice(0, cfg.maxAuthors);
  const timeline = sampleEvenly(Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])), cfg.maxTimelinePoints);

  const sections: string[] = [];
  sections.push([
    "RESUMEN CUANTITATIVO:",
    `- Total de menciones: ${mentions.length}`,
    `- Positivas: ${positive.length} (${((positive.length / mentions.length) * 100).toFixed(1)}%)`,
    `- Negativas: ${negative.length} (${((negative.length / mentions.length) * 100).toFixed(1)}%)`,
    `- Neutrales: ${neutral.length} (${((neutral.length / mentions.length) * 100).toFixed(1)}%)`,
  ].join("\n"));

  if (sortedSources.length) {
    sections.push([
      "FUENTES PRINCIPALES:",
      ...sortedSources.map(([source, items]) => {
        const pos = items.filter((item) => item.sentiment === "positivo").length;
        const neg = items.filter((item) => item.sentiment === "negativo").length;
        const engagement = items.reduce((sum, item) => {
          const meta = item.raw_metadata;
          return sum + Number(meta?.likes || 0) + Number(meta?.comments || 0) + Number(meta?.shares || 0);
        }, 0);
        return `- ${source}: ${items.length} menciones, ${neg} negativas, ${pos} positivas, ${engagement} interacciones`;
      }),
    ].join("\n"));
  }

  if (topAuthors.length) {
    sections.push([
      "AUTORES / INFLUENCIADORES CLAVE:",
      ...topAuthors.map((author, index) => {
        const neg = author.sentiments.filter((s) => s === "negativo").length;
        const pos = author.sentiments.filter((s) => s === "positivo").length;
        const tone = neg > pos ? "mayormente negativo" : pos > neg ? "mayormente positivo" : "mixto";
        return `${index + 1}. ${author.name} [${author.platform}]: ${author.count} menciones, ${author.engagement.toLocaleString()} interacciones, tono ${tone}`;
      }),
    ].join("\n"));
  }

  if (topKeywords.length) {
    sections.push(["KEYWORDS DOMINANTES:", ...topKeywords.map(([k, c]) => `- ${k}: ${c}`)].join("\n"));
  }

  if (timeline.length) {
    sections.push(["TIMELINE MUESTREADO:", ...timeline.map(([date, count]) => `- ${date}: ${count} menciones`)].join("\n"));
  }

  if (negative.length) {
    sections.push([
      "MUESTRA DE NEGATIVAS:",
      ...negative.slice(0, cfg.maxExamples).map((m, index) => {
        const meta = m.raw_metadata;
        const author = (meta?.author || meta?.author_name || meta?.author_username || meta?.authorUsername || "") as string;
        const engagement = Number(meta?.likes || 0) + Number(meta?.comments || 0) + Number(meta?.shares || 0);
        return `${index + 1}. [${normalizeSource(m.source_domain)}]${author ? ` por ${author}` : ""} — ${(m.title || m.description || "").slice(0, 180)}${engagement ? ` (${engagement} interacciones)` : ""}`;
      }),
    ].join("\n"));
  }

  return sections.join("\n\n");
}

function buildPrompt(body: ReportRequest): string {
  const { mentions = [], precomputedReport, reportType, extension, projectName, projectAudience, projectObjective, strategicContext, strategicFocus, entityNames, dateRange } = body;
  const cfg = EXTENSION_CONFIG[extension];
  const contextSummary = buildReportContext(body);

  const mentionsSample = precomputedReport
    ? precomputedReport.influencers
        .slice(0, Math.min(cfg.sampleCount, 4))
        .map((item) => `[${item.platform}] ${item.name} | ${item.sentiment} | ${item.mentions}`)
    : mentions.slice(0, Math.min(cfg.sampleCount, 4)).map((m) => {
        const meta = m.raw_metadata;
        const author = (meta?.author || meta?.author_name || meta?.authorUsername || null) as string | null;
        return `[${normalizeSource(m.source_domain)}] ${(m.published_at || m.created_at)?.split("T")[0] || "?"} | ${m.sentiment || "?"} | ${author || "anon"}`;
      });

  return `Return ONLY a complete HTML document starting with <!DOCTYPE html> in Spanish (es-MX) for a 794px-wide report optimized for html2canvas.

PROJECT
- ${projectName}
- ${dateRange.label}
- Tipo: ${reportType}
- Extensión: ${extension}
- Audiencia: ${projectAudience}
- Objetivo: ${projectObjective}
${strategicContext ? `- Contexto: ${strategicContext}` : ""}
${strategicFocus ? `- Enfoque: ${strategicFocus}` : ""}
${entityNames?.length ? `- Entidades: ${entityNames.join(", ")}` : ""}

DATA
${contextSummary}

REFERENCE
${mentionsSample.join("\n")}

RENDER RULES
- Un solo bloque <style>
- Sin JavaScript, sin SVG, sin canvas
- Usar solo HTML/CSS
- Mantener layout ligero y denso
- Secciones obligatorias: header, metrics, summary, findings, influencers, narratives, recommendations, conclusions, footer
- Círculos numerados con inline-block
- Evitar page-break-inside

Return the final HTML now.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const body: ReportRequest = await req.json();
    const mentionCount = body.mentions?.length || 0;
    const hasPrecomputedReport = Boolean(body.precomputedReport);
    if (!hasPrecomputedReport && !mentionCount) {
      return new Response(JSON.stringify({ error: "No report data provided for analysis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating Claude report: ${body.reportType}, ${body.extension}, mentions=${mentionCount}, precomputed=${hasPrecomputedReport}, project: ${body.projectName}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: EXTENSION_CONFIG[body.extension].maxTokens,
          temperature: 0.4,
          messages: [{ role: "user", content: buildPrompt(body) }],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Anthropic API error: ${response.status}`, details: errorText.slice(0, 500) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const html = Array.isArray(data.content)
      ? data.content.map((block: { type?: string; text?: string }) => block?.text || "").join("\n").trim()
      : "";

    if (!html) {
      return new Response(JSON.stringify({ error: "Claude returned empty HTML" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanedHtml = html
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    console.log(`Claude report generated successfully, HTML length: ${cleanedHtml.length}`);

    return new Response(JSON.stringify({ html: cleanedHtml }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const description = isTimeout
      ? "Claude tardó demasiado. Intenta con extensión 'micro' o menos menciones."
      : error instanceof Error ? error.message : "Error desconocido";
    console.error("Error in generate-claude-report:", description);

    return new Response(JSON.stringify({ error: description }), {
      status: isTimeout ? 504 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
