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
  matched_keywords: string[];
}

interface ReportRequest {
  mentions: Mention[];
  reportType: "brief" | "crisis" | "thematic" | "comparative";
  extension: "micro" | "short" | "medium";
  projectName: string;
  projectAudience: string;
  projectObjective: string;
  entityNames?: string[];
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
}

interface ReportContent {
  title: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  metrics: {
    totalMentions: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    topSources: string[];
  };
  templates: {
    executive: string;
    technical: string;
    public: string;
  };
}

const EXTENSION_TOKENS = {
  micro: 300,
  short: 800,
  medium: 1500,
};

const REPORT_TYPE_PROMPTS = {
  brief: `Genera un BRIEF EJECUTIVO de monitoreo. Enfócate en:
- Resumen del periodo con tendencias principales
- Cambios significativos vs periodo anterior
- Hallazgos clave y patrones detectados
- Recomendaciones accionables`,
  
  crisis: `Genera una ALERTA DE CRISIS basada en menciones negativas o patrones preocupantes. Enfócate en:
- Descripción del evento/situación crítica
- Impacto potencial y alcance
- Fuentes principales de la crisis
- Acciones inmediatas recomendadas
- Plan de contención sugerido`,
  
  thematic: `Genera un ANÁLISIS TEMÁTICO profundo. Enfócate en:
- Tema principal identificado en las menciones
- Narrativas y subtemas relacionados
- Actores clave mencionados
- Evolución del tema en el periodo
- Implicaciones y contexto`,
  
  comparative: `Genera un REPORTE COMPARATIVO entre entidades monitoreadas. Enfócate en:
- Comparación de volumen de menciones
- Diferencias en sentimiento
- Share of voice relativo
- Fortalezas y debilidades de cada entidad
- Oportunidades detectadas`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body: ReportRequest = await req.json();
    const { mentions, reportType, extension, projectName, projectAudience, projectObjective, entityNames, dateRange } = body;

    if (!mentions || mentions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No mentions provided for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate metrics
    const metrics = {
      totalMentions: mentions.length,
      positiveCount: mentions.filter(m => m.sentiment === "positivo").length,
      negativeCount: mentions.filter(m => m.sentiment === "negativo").length,
      neutralCount: mentions.filter(m => m.sentiment === "neutral").length,
      topSources: [...new Set(mentions.map(m => m.source_domain).filter(Boolean))].slice(0, 5) as string[],
    };

    // Prepare mentions summary for AI
    const mentionsSummary = mentions.slice(0, 50).map(m => ({
      title: m.title,
      source: m.source_domain,
      sentiment: m.sentiment,
      keywords: m.matched_keywords?.join(", "),
    }));

    const maxTokens = EXTENSION_TOKENS[extension];
    const typePrompt = REPORT_TYPE_PROMPTS[reportType];

    const systemPrompt = `Eres un analista de inteligencia estratégica experto. Tu audiencia objetivo es: ${projectAudience}.
El objetivo del proyecto es: ${projectObjective}.

Genera contenido profesional, conciso y accionable. Ajusta el tono según la audiencia:
- Para audiencia técnica: usa datos específicos y terminología precisa
- Para ejecutivos: enfatiza impacto de negocio y decisiones
- Para público general: usa lenguaje accesible y ejemplos claros

IMPORTANTE: Responde en español. No uses markdown ni símbolos especiales.`;

    const userPrompt = `${typePrompt}

PROYECTO: ${projectName}
PERIODO: ${dateRange.label} (${dateRange.start} a ${dateRange.end})
${entityNames?.length ? `ENTIDADES: ${entityNames.join(", ")}` : ""}

MÉTRICAS:
- Total menciones: ${metrics.totalMentions}
- Positivas: ${metrics.positiveCount} (${Math.round(metrics.positiveCount/metrics.totalMentions*100)}%)
- Negativas: ${metrics.negativeCount} (${Math.round(metrics.negativeCount/metrics.totalMentions*100)}%)
- Neutrales: ${metrics.neutralCount} (${Math.round(metrics.neutralCount/metrics.totalMentions*100)}%)
- Fuentes principales: ${metrics.topSources.join(", ")}

MUESTRA DE MENCIONES:
${JSON.stringify(mentionsSummary, null, 2)}

Genera un reporte estructurado con:
1. TÍTULO: Un título descriptivo y profesional
2. RESUMEN: Párrafo ejecutivo con los puntos más importantes
3. HALLAZGOS CLAVE: Lista de 3-5 hallazgos principales
4. RECOMENDACIONES: Lista de 2-4 acciones recomendadas

Además, genera 3 versiones del mensaje para diferentes canales:
5. VERSIÓN EJECUTIVA: Mensaje formal para directivos (2-3 párrafos)
6. VERSIÓN TÉCNICA: Mensaje con más datos para analistas (2-3 párrafos)
7. VERSIÓN PÚBLICA: Mensaje accesible para comunicación externa (1-2 párrafos)

Responde en formato JSON con esta estructura exacta:
{
  "title": "string",
  "summary": "string",
  "keyFindings": ["string", "string", ...],
  "recommendations": ["string", "string", ...],
  "templates": {
    "executive": "string",
    "technical": "string", 
    "public": "string"
  }
}`;

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
        max_tokens: maxTokens + 500, // Extra for JSON structure
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from response
    let reportContent: Partial<ReportContent>;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reportContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      // Fallback: create structure from raw text
      reportContent = {
        title: `Reporte de ${reportType === "brief" ? "Monitoreo" : reportType === "crisis" ? "Crisis" : reportType === "thematic" ? "Análisis Temático" : "Comparativa"}`,
        summary: content.substring(0, 500),
        keyFindings: ["Análisis en proceso"],
        recommendations: ["Revisar datos manualmente"],
        templates: {
          executive: content.substring(0, 300),
          technical: content.substring(0, 400),
          public: content.substring(0, 200),
        },
      };
    }

    const result: ReportContent = {
      title: reportContent.title || "Reporte Inteligente",
      summary: reportContent.summary || "",
      keyFindings: reportContent.keyFindings || [],
      recommendations: reportContent.recommendations || [],
      metrics,
      templates: {
        executive: reportContent.templates?.executive || "",
        technical: reportContent.templates?.technical || "",
        public: reportContent.templates?.public || "",
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating smart report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
