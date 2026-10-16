import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaudeTool } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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
  sentiment: string | null;
  created_at: string;
  matched_keywords: string[];
}

interface ConversationAnalysisContent {
  volumeByChannel: {
    mediosDigitales: number;
    facebook: number;
    twitter: number;
    instagram: number;
    linkedin: number;
    tiktok: number;
    otros: number;
  };
  totalMentions: number;
  estimatedReach: string;
  sentimentDistribution: {
    positivo: number;
    neutral: number;
    negativo: number;
  };
  mainNarratives: Array<{
    narrative: string;
    volume: number;
    percentage: number;
  }>;
  relevantActors: Array<{
    name: string;
    type: string;
    mentions: number;
    description: string;
  }>;
  risks: string[];
  recommendations: string[];
  executiveSummary: string;
}

interface InformativeContent {
  context: string;
  whatIsHappening: Array<{
    title: string;
    description: string;
  }>;
  localImplications: Array<{
    title: string;
    description: string;
  }>;
  sources: Array<{
    name: string;
    url: string;
    date: string;
  }>;
  executiveSummary: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { cardType, mentions, title, additionalContext, regenerateSection, currentContent } = body as {
      cardType: "conversation_analysis" | "informative";
      mentions: MentionInput[];
      title: string;
      additionalContext?: string;
      regenerateSection?: string; // e.g., "recommendations", "risks", "executiveSummary", etc.
      currentContent?: any; // Current content for context when regenerating
    };

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    // Handle section regeneration
    if (regenerateSection && currentContent) {
      return await handleSectionRegeneration(
        regenerateSection,
        cardType,
        mentions,
        title,
        currentContent,
        ANTHROPIC_API_KEY
      );
    }

    let systemPrompt: string;
    let userPrompt: string;
    let toolDefinition: any;

    if (cardType === "conversation_analysis") {
      // Prepare mentions content
      const mentionsContent = mentions.map((m, i) => {
        const parts = [`[${i + 1}]`];
        if (m.title) parts.push(`Título: ${m.title.substring(0, 200)}`);
        if (m.description) parts.push(`Descripción: ${m.description.substring(0, 300)}`);
        if (m.source_domain) parts.push(`Fuente: ${m.source_domain}`);
        if (m.sentiment) parts.push(`Sentimiento: ${m.sentiment}`);
        if (m.matched_keywords.length > 0) parts.push(`Keywords: ${m.matched_keywords.join(", ")}`);
        return parts.join(" | ");
      }).join("\n");

      systemPrompt = `Eres un analista de comunicación política y monitoreo de medios experto. Generas "Fichas de Análisis de Conversación Digital" siguiendo el formato profesional de Kimedia.

Tu análisis debe incluir:
1. Volumen de menciones por canal (estima basándote en los dominios)
2. Alcance estimado (usa multiplicadores estándar: 5-10 vistas por interacción)
3. Distribución de sentimiento (basado en los sentimientos de las menciones)
4. Narrativas principales (agrupa por temas similares, máx 5)
5. Actores relevantes (fuentes, medios, personas mencionadas)
6. Riesgos reputacionales identificados
7. Recomendaciones estratégicas
8. Resumen ejecutivo (2-3 oraciones)

Sé específico, usa datos cuantitativos cuando sea posible, y mantén un tono profesional.`;

      userPrompt = `Genera una Ficha de Análisis de Conversación Digital para: "${title}"

${additionalContext ? `Contexto adicional: ${additionalContext}\n\n` : ""}
Se analizaron ${mentions.length} menciones:

${mentionsContent}`;

      toolDefinition = {
        type: "function",
        function: {
          name: "generate_conversation_analysis",
          description: "Generate a conversation analysis thematic card",
          parameters: {
            type: "object",
            properties: {
              volumeByChannel: {
                type: "object",
                properties: {
                  mediosDigitales: { type: "number" },
                  facebook: { type: "number" },
                  twitter: { type: "number" },
                  instagram: { type: "number" },
                  linkedin: { type: "number" },
                  tiktok: { type: "number" },
                  otros: { type: "number" },
                },
                required: ["mediosDigitales", "facebook", "twitter", "instagram", "linkedin", "tiktok", "otros"],
              },
              totalMentions: { type: "number" },
              estimatedReach: { type: "string" },
              sentimentDistribution: {
                type: "object",
                properties: {
                  positivo: { type: "number" },
                  neutral: { type: "number" },
                  negativo: { type: "number" },
                },
                required: ["positivo", "neutral", "negativo"],
              },
              mainNarratives: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    narrative: { type: "string" },
                    volume: { type: "number" },
                    percentage: { type: "number" },
                  },
                  required: ["narrative", "volume", "percentage"],
                },
              },
              relevantActors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string" },
                    mentions: { type: "number" },
                    description: { type: "string" },
                  },
                  required: ["name", "type", "mentions", "description"],
                },
              },
              risks: {
                type: "array",
                items: { type: "string" },
              },
              recommendations: {
                type: "array",
                items: { type: "string" },
              },
              executiveSummary: { type: "string" },
            },
            required: [
              "volumeByChannel",
              "totalMentions",
              "estimatedReach",
              "sentimentDistribution",
              "mainNarratives",
              "relevantActors",
              "risks",
              "recommendations",
              "executiveSummary",
            ],
          },
        },
      };
    } else {
      // Informative card type
      systemPrompt = `Eres un analista de inteligencia estratégica experto. Generas "Fichas Informativas" que explican situaciones complejas de manera clara y estructurada.

Tu análisis debe incluir:
1. Resumen ejecutivo (2-3 oraciones)
2. ¿Qué está pasando? - Puntos clave con título y descripción
3. Implicaciones locales/relevantes - Impactos específicos
4. Fuentes consultadas

Mantén un tono objetivo e informativo. Usa datos específicos cuando estén disponibles.`;

      const mentionsContent = mentions.map((m, i) => {
        const parts = [`[${i + 1}]`];
        if (m.title) parts.push(`${m.title.substring(0, 200)}`);
        if (m.description) parts.push(`${m.description.substring(0, 400)}`);
        if (m.source_domain) parts.push(`(${m.source_domain})`);
        if (m.url) parts.push(`URL: ${m.url}`);
        return parts.join(" - ");
      }).join("\n");

      userPrompt = `Genera una Ficha Informativa para: "${title}"

${additionalContext ? `Contexto adicional del analista: ${additionalContext}\n\n` : ""}
Fuentes disponibles (${mentions.length} menciones):

${mentionsContent}`;

      toolDefinition = {
        type: "function",
        function: {
          name: "generate_informative_card",
          description: "Generate an informative thematic card",
          parameters: {
            type: "object",
            properties: {
              executiveSummary: { type: "string" },
              context: { type: "string" },
              whatIsHappening: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "description"],
                },
              },
              localImplications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "description"],
                },
              },
              sources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    url: { type: "string" },
                    date: { type: "string" },
                  },
                  required: ["name", "url", "date"],
                },
              },
            },
            required: ["executiveSummary", "context", "whatIsHappening", "localImplications", "sources"],
          },
        },
      };
    }

    const toolName = cardType === "conversation_analysis"
      ? "generate_conversation_analysis"
      : "generate_informative_card";

    let content: any;
    try {
      content = await callClaudeTool({
        apiKey: ANTHROPIC_API_KEY,
        systemPrompt,
        userPrompt,
        toolName,
        toolDescription: toolDefinition.function.description,
        toolSchema: toolDefinition.function.parameters,
        maxTokens: 4000,
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
      JSON.stringify({ success: true, content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-thematic-card error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Handle regeneration of specific sections
async function handleSectionRegeneration(
  section: string,
  cardType: string,
  mentions: MentionInput[],
  title: string,
  currentContent: any,
  apiKey: string
): Promise<Response> {
  const sectionConfig = getSectionConfig(section, cardType);
  if (!sectionConfig) {
    return new Response(
      JSON.stringify({ error: `Unknown section: ${section}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const mentionsContext = mentions.slice(0, 10).map((m, i) => {
    const parts = [`[${i + 1}]`];
    if (m.title) parts.push(m.title.substring(0, 150));
    if (m.description) parts.push(m.description.substring(0, 200));
    if (m.source_domain) parts.push(`(${m.source_domain})`);
    return parts.join(" - ");
  }).join("\n");

  const currentSectionContent = JSON.stringify(currentContent[section] || "");

  const systemPrompt = `Eres un analista experto de comunicación y monitoreo de medios. Tu tarea es regenerar UNA SECCIÓN ESPECÍFICA de una ficha temática, manteniéndola coherente con el resto del análisis.`;

  const userPrompt = `Ficha: "${title}"

Contenido actual de la sección "${sectionConfig.label}":
${currentSectionContent}

Contexto del análisis completo:
- Resumen actual: ${currentContent.executiveSummary || "No disponible"}
${cardType === "conversation_analysis" && currentContent.mainNarratives ? 
  `- Narrativas: ${currentContent.mainNarratives.map((n: any) => n.narrative).join(", ")}` : ""}

Menciones analizadas:
${mentionsContext}

INSTRUCCIÓN: Regenera SOLO la sección "${sectionConfig.label}" con contenido fresco y diferente, pero manteniéndolo coherente con el contexto. ${sectionConfig.instruction}`;

  let regeneratedContent: any;
  try {
    regeneratedContent = await callClaudeTool({
      apiKey,
      systemPrompt,
      userPrompt,
      toolName: sectionConfig.tool.function.name,
      toolDescription: `Regenerate ${sectionConfig.label}`,
      toolSchema: sectionConfig.tool.function.parameters,
      maxTokens: 2500,
      temperature: 0.3,
      timeoutMs: 90000,
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
    console.error("Claude regeneration error:", msg);
    throw err;
  }

  return new Response(
    JSON.stringify({
      success: true,
      section,
      content: regeneratedContent[section] || regeneratedContent.value
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function getSectionConfig(section: string, cardType: string): { label: string; instruction: string; tool: any } | null {
  const configs: Record<string, { label: string; instruction: string; tool: any }> = {
    executiveSummary: {
      label: "Resumen Ejecutivo",
      instruction: "Genera un resumen ejecutivo conciso de 2-3 oraciones que capture los puntos más importantes.",
      tool: {
        type: "function",
        function: {
          name: "regenerate_executive_summary",
          parameters: {
            type: "object",
            properties: { value: { type: "string" } },
            required: ["value"],
          },
        },
      },
    },
    recommendations: {
      label: "Recomendaciones",
      instruction: "Genera 3-5 recomendaciones estratégicas accionables basadas en el análisis.",
      tool: {
        type: "function",
        function: {
          name: "regenerate_recommendations",
          parameters: {
            type: "object",
            properties: { recommendations: { type: "array", items: { type: "string" } } },
            required: ["recommendations"],
          },
        },
      },
    },
    risks: {
      label: "Riesgos",
      instruction: "Genera 3-5 riesgos reputacionales o comunicacionales identificados.",
      tool: {
        type: "function",
        function: {
          name: "regenerate_risks",
          parameters: {
            type: "object",
            properties: { risks: { type: "array", items: { type: "string" } } },
            required: ["risks"],
          },
        },
      },
    },
    mainNarratives: {
      label: "Narrativas Principales",
      instruction: "Genera 3-5 narrativas principales identificadas en la conversación, con porcentaje estimado.",
      tool: {
        type: "function",
        function: {
          name: "regenerate_narratives",
          parameters: {
            type: "object",
            properties: {
              mainNarratives: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    narrative: { type: "string" },
                    volume: { type: "number" },
                    percentage: { type: "number" },
                  },
                  required: ["narrative", "volume", "percentage"],
                },
              },
            },
            required: ["mainNarratives"],
          },
        },
      },
    },
    relevantActors: {
      label: "Actores Relevantes",
      instruction: "Genera 3-5 actores relevantes mencionados o involucrados en la conversación.",
      tool: {
        type: "function",
        function: {
          name: "regenerate_actors",
          parameters: {
            type: "object",
            properties: {
              relevantActors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string" },
                    mentions: { type: "number" },
                    description: { type: "string" },
                  },
                  required: ["name", "type", "mentions", "description"],
                },
              },
            },
            required: ["relevantActors"],
          },
        },
      },
    },
    context: {
      label: "Contexto",
      instruction: "Genera un contexto claro y conciso que explique la situación.",
      tool: {
        type: "function",
        function: {
          name: "regenerate_context",
          parameters: {
            type: "object",
            properties: { value: { type: "string" } },
            required: ["value"],
          },
        },
      },
    },
    whatIsHappening: {
      label: "¿Qué está pasando?",
      instruction: "Genera 3-5 puntos clave que expliquen qué está sucediendo.",
      tool: {
        type: "function",
        function: {
          name: "regenerate_what_is_happening",
          parameters: {
            type: "object",
            properties: {
              whatIsHappening: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "description"],
                },
              },
            },
            required: ["whatIsHappening"],
          },
        },
      },
    },
    localImplications: {
      label: "Implicaciones Locales",
      instruction: "Genera 3-5 implicaciones locales o relevantes del tema.",
      tool: {
        type: "function",
        function: {
          name: "regenerate_implications",
          parameters: {
            type: "object",
            properties: {
              localImplications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "description"],
                },
              },
            },
            required: ["localImplications"],
          },
        },
      },
    },
  };

  return configs[section] || null;
}
