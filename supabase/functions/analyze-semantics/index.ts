import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  try {
    const { mentions } = await req.json() as { mentions: MentionInput[] };

    if (!mentions || mentions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No mentions provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

Responde ÚNICAMENTE con JSON válido.`;

    const userPrompt = `Analiza estas ${mentions.length} menciones:

${contentForAnalysis}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "semantic_analysis",
              description: "Return semantic analysis of mentions",
              parameters: {
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
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "semantic_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    
    // Extract the function call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "semantic_analysis") {
      throw new Error("Invalid AI response structure");
    }

    const analysis: SemanticAnalysis = JSON.parse(toolCall.function.arguments);

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
