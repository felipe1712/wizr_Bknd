import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface MentionInput {
  id: string;
  title: string | null;
  description: string | null;
}

interface SentimentResult {
  id: string;
  sentiment: "positivo" | "neutral" | "negativo";
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mentions } = await req.json() as { mentions: MentionInput[] };

    if (!mentions || mentions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Limit batch size to prevent timeouts
    const MAX_BATCH = 25;
    const mentionsToProcess = mentions.slice(0, MAX_BATCH);

    // Prepare content for analysis
    const contentForAnalysis = mentionsToProcess
      .map((m, i) => {
        const text = [m.title, m.description].filter(Boolean).join(" - ");
        return `[${m.id}] ${text.substring(0, 400)}`;
      })
      .join("\n\n");

    const systemPrompt = `Eres un analista de sentimiento experto en español. Para cada mención, clasifica su sentimiento como:
- positivo: contenido favorable, elogioso, optimista
- neutral: informativo, factual, sin carga emocional clara
- negativo: crítico, desfavorable, pesimista, queja

Responde ÚNICAMENTE con JSON válido.`;

    const userPrompt = `Analiza el sentimiento de estas ${mentionsToProcess.length} menciones:

${contentForAnalysis}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sentiment_results",
              description: "Return sentiment analysis results for each mention",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "The mention ID" },
                        sentiment: { 
                          type: "string", 
                          enum: ["positivo", "neutral", "negativo"] 
                        },
                        confidence: { 
                          type: "number", 
                          description: "Confidence score 0-100" 
                        },
                      },
                      required: ["id", "sentiment", "confidence"],
                    },
                  },
                },
                required: ["results"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sentiment_results" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== "sentiment_results") {
      throw new Error("Invalid AI response structure");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const results: SentimentResult[] = parsed.results || [];

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-sentiment error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
