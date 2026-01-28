import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface PostInput {
  message: string;
  contentType: string;
  engagement: number;
  date?: string;
}

interface NarrativeAnalysis {
  dominantNarratives: Array<{
    theme: string;
    description: string;
    frequency: number;
    sentiment: "positive" | "neutral" | "negative";
    examplePosts: string[];
  }>;
  toneAnalysis: {
    overall: "formal" | "informal" | "mixed";
    emotionalTone: string;
    callToAction: boolean;
  };
  topHashtags: Array<{
    tag: string;
    count: number;
  }>;
  contentStrategy: {
    primaryFocus: string;
    strengths: string[];
    opportunities: string[];
  };
  summary: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileName, network, posts, dateRange } = await req.json() as {
      profileName: string;
      network: string;
      posts: PostInput[];
      dateRange?: { from: string; to: string };
    };

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No posts provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Prepare content for analysis (limit to avoid token limits)
    const postsContent = posts.slice(0, 15).map((p, i) => 
      `[Post ${i + 1}] (Engagement: ${p.engagement}, Tipo: ${p.contentType})\n${p.message.substring(0, 500)}`
    ).join("\n\n---\n\n");

    const systemPrompt = `Eres un analista experto en comunicación digital y narrativas de redes sociales. Analiza el contenido publicado por el perfil "${profileName}" en ${network}.

Tu tarea es identificar:
1. Narrativas dominantes: Los 3-5 temas/mensajes principales que caracterizan su comunicación
2. Análisis de tono: Si es formal/informal, el tono emocional, y si usa call-to-actions
3. Hashtags principales: Los más frecuentes
4. Estrategia de contenido: Enfoque principal, fortalezas y oportunidades de mejora
5. Resumen ejecutivo: 2-3 oraciones que capturen la esencia de su comunicación

Responde ÚNICAMENTE con JSON válido siguiendo el schema de la función.`;

    const userPrompt = `Analiza estos ${posts.length} posts de @${profileName} en ${network}${dateRange ? ` del período ${dateRange.from} a ${dateRange.to}` : ''}:

${postsContent}`;

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
              name: "narrative_analysis",
              description: "Return narrative analysis of social media content",
              parameters: {
                type: "object",
                properties: {
                  dominantNarratives: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        theme: { type: "string", description: "Nombre corto del tema/narrativa" },
                        description: { type: "string", description: "Descripción de la narrativa" },
                        frequency: { type: "number", description: "Porcentaje de posts (0-100)" },
                        sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                        examplePosts: { 
                          type: "array", 
                          items: { type: "string" },
                          description: "1-2 fragmentos de ejemplo"
                        }
                      },
                      required: ["theme", "description", "frequency", "sentiment", "examplePosts"]
                    }
                  },
                  toneAnalysis: {
                    type: "object",
                    properties: {
                      overall: { type: "string", enum: ["formal", "informal", "mixed"] },
                      emotionalTone: { type: "string", description: "Ej: Inspirador, Informativo, Promocional" },
                      callToAction: { type: "boolean" }
                    },
                    required: ["overall", "emotionalTone", "callToAction"]
                  },
                  topHashtags: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tag: { type: "string" },
                        count: { type: "number" }
                      },
                      required: ["tag", "count"]
                    }
                  },
                  contentStrategy: {
                    type: "object",
                    properties: {
                      primaryFocus: { type: "string" },
                      strengths: { 
                        type: "array", 
                        items: { type: "string" },
                        description: "3-4 fortalezas"
                      },
                      opportunities: { 
                        type: "array", 
                        items: { type: "string" },
                        description: "2-3 oportunidades de mejora"
                      }
                    },
                    required: ["primaryFocus", "strengths", "opportunities"]
                  },
                  summary: { type: "string", description: "Resumen ejecutivo de 2-3 oraciones" }
                },
                required: ["dominantNarratives", "toneAnalysis", "topHashtags", "contentStrategy", "summary"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "narrative_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "narrative_analysis") {
      throw new Error("Invalid AI response structure");
    }

    const analysis: NarrativeAnalysis = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-narratives error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
