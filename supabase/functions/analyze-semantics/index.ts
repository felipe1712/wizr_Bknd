import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaudeTool } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // Be permissive to avoid browser preflight blocking
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface MentionInput {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  source_domain: string | null;
  matched_keywords: string[];
}

interface SemanticAnalysis {
  topics: Array<{
    name: string;
    relevance: number;
    mentionCount: number;
  }>;
  keywords: Array<{
    word: string;
    frequency: number;
    sentiment: "positivo" | "neutral" | "negativo";
  }>;
  sentimentDistribution: {
    positivo: number;
    neutral: number;
    negativo: number;
  };
  summary: string;
  mentionSentiments: Array<{
    id: string;
    sentiment: "positivo" | "neutral" | "negativo";
    confidence: number;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Minimal request logging to verify requests are reaching the function
  try {
    const url = new URL(req.url);
    console.log("analyze-semantics: request", req.method, url.pathname);
    console.log("analyze-semantics: content-length", req.headers.get("content-length"));
  } catch {
    // ignore
  }

  try {
    const { mentions } = await req.json() as { mentions: MentionInput[] };

    if (!mentions || mentions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No mentions provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    // Prepare content for analysis
    const contentForAnalysis = mentions.map((m, i) => {
      const parts = [`[${i + 1}] ID: ${m.id}`];
      if (m.title) parts.push(`Título: ${m.title}`);
      if (m.description) parts.push(`Descripción: ${m.description}`);
      if (m.source_domain) parts.push(`Fuente: ${m.source_domain}`);
      if (m.matched_keywords.length > 0) parts.push(`Keywords: ${m.matched_keywords.join(", ")}`);
      return parts.join("\n");
    }).join("\n\n---\n\n");

    const systemPrompt = `Eres un analista de medios experto en análisis semántico. Analiza las siguientes menciones y extrae:
1. Temas principales (máximo 8) con su relevancia (0-100) y cantidad de menciones relacionadas
2. Palabras clave más frecuentes (máximo 15) con frecuencia y sentimiento asociado
3. Distribución general de sentimiento (positivo, neutral, negativo como porcentajes que sumen 100)
4. Un resumen ejecutivo de 2-3 oraciones
5. El sentimiento individual de cada mención (usando su ID) con nivel de confianza (0-100)

Responde ÚNICAMENTE invocando la herramienta semantic_analysis.`;

    const userPrompt = `Analiza estas ${mentions.length} menciones:

${contentForAnalysis}`;

    const toolSchema = {
      type: "object",
      properties: {
        topics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              relevance: { type: "number" },
              mentionCount: { type: "number" },
            },
            required: ["name", "relevance", "mentionCount"],
          },
        },
        keywords: {
          type: "array",
          items: {
            type: "object",
            properties: {
              word: { type: "string" },
              frequency: { type: "number" },
              sentiment: { type: "string", enum: ["positivo", "neutral", "negativo"] },
            },
            required: ["word", "frequency", "sentiment"],
          },
        },
        sentimentDistribution: {
          type: "object",
          properties: {
            positivo: { type: "number" },
            neutral: { type: "number" },
            negativo: { type: "number" },
          },
          required: ["positivo", "neutral", "negativo"],
        },
        summary: { type: "string" },
        mentionSentiments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              sentiment: { type: "string", enum: ["positivo", "neutral", "negativo"] },
              confidence: { type: "number" },
            },
            required: ["id", "sentiment", "confidence"],
          },
        },
      },
      required: ["topics", "keywords", "sentimentDistribution", "summary", "mentionSentiments"],
    };

    let analysis: SemanticAnalysis;
    try {
      analysis = await callClaudeTool<SemanticAnalysis>({
        apiKey: ANTHROPIC_API_KEY,
        systemPrompt,
        userPrompt,
        toolName: "semantic_analysis",
        toolDescription: "Return semantic analysis of mentions",
        toolSchema,
        maxTokens: 6000,
        temperature: 0.2,
        timeoutMs: 110000,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "RATE_LIMIT") {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (msg === "PAYMENT_REQUIRED") {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Claude error:", msg);
      throw err;
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-semantics error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
