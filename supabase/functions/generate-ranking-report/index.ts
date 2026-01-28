import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ReportType = "competitive_brief" | "performance_analysis" | "trends_report" | "benchmarking";

interface ProfileData {
  id: string;
  profile_id: string;
  display_name: string | null;
  network: string;
}

interface KPIData {
  fk_profile_id: string;
  followers: number | null;
  follower_growth_percent: number | null;
  engagement_rate: number | null;
  posts_per_day: number | null;
  page_performance_index: number | null;
}

interface NarrativeData {
  profile_id: string;
  summary: string;
  dominantNarratives: Array<{ theme: string; description: string }>;
  contentStrategy: { primaryFocus: string; strengths: string[] };
}

interface ReportRequest {
  rankingName: string;
  reportType: ReportType;
  extension: "micro" | "short" | "medium";
  profiles: ProfileData[];
  kpis: KPIData[];
  narratives?: NarrativeData[];
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
  filterNetwork?: string;
}

interface ReportContent {
  title: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  metrics: {
    totalProfiles: number;
    networks: string[];
    avgEngagement: number;
    topPerformer: string | null;
    avgGrowth: number;
  };
  templates: {
    executive: string;
    technical: string;
    public: string;
  };
}

const EXTENSION_TOKENS = {
  micro: 400,
  short: 1000,
  medium: 2000,
};

const REPORT_TYPE_PROMPTS: Record<ReportType, string> = {
  competitive_brief: `Genera un BRIEF COMPETITIVO ejecutivo. Enfócate en:
- Quién lidera en cada métrica clave (engagement, seguidores, crecimiento)
- Cambios de posición significativos vs periodo anterior
- Share of voice relativo entre competidores
- Insights accionables para la toma de decisiones`,

  performance_analysis: `Genera un ANÁLISIS DE PERFORMANCE detallado. Enfócate en:
- Ranking de performers por engagement y actividad
- Identificar líderes y rezagados con métricas específicas
- Patrones de publicación y su impacto
- Correlaciones entre métricas (seguidores vs engagement)`,

  trends_report: `Genera un REPORTE DE TENDENCIAS. Enfócate en:
- Quién está ganando/perdiendo terreno
- Evolución del crecimiento de seguidores
- Cambios en estrategia de contenido detectados
- Predicciones basadas en tendencias actuales`,

  benchmarking: `Genera un REPORTE DE BENCHMARKING COMPARATIVO. Enfócate en:
- Métricas promedio del grupo como referencia
- Quién supera el promedio y en qué métricas
- Identificar outliers positivos y negativos
- Gaps de performance y oportunidades`,
};

function buildProfilesSummary(profiles: ProfileData[], kpis: KPIData[]): string {
  const profileMap = new Map(profiles.map(p => [p.id, p]));
  
  const summaryLines = kpis.map(kpi => {
    const profile = profileMap.get(kpi.fk_profile_id);
    if (!profile) return null;
    
    return `- ${profile.display_name || profile.profile_id} (${profile.network}): ` +
      `${kpi.followers?.toLocaleString() || 'N/A'} seguidores, ` +
      `${kpi.engagement_rate?.toFixed(2) || 'N/A'}% engagement, ` +
      `${kpi.follower_growth_percent?.toFixed(2) || 'N/A'}% crecimiento, ` +
      `${kpi.posts_per_day?.toFixed(1) || 'N/A'} posts/día`;
  }).filter(Boolean);

  return summaryLines.join('\n');
}

function buildNarrativesSummary(narratives: NarrativeData[]): string {
  if (!narratives || narratives.length === 0) return '';

  return narratives.map(n => 
    `[${n.profile_id}]\n` +
    `Resumen: ${n.summary}\n` +
    `Narrativas: ${n.dominantNarratives.map(dn => dn.theme).join(', ')}\n` +
    `Enfoque: ${n.contentStrategy.primaryFocus}`
  ).join('\n\n');
}

function calculateMetrics(profiles: ProfileData[], kpis: KPIData[]): ReportContent['metrics'] {
  const networks = [...new Set(profiles.map(p => p.network))];
  const engagementRates = kpis.map(k => k.engagement_rate).filter((e): e is number => e !== null);
  const growthRates = kpis.map(k => k.follower_growth_percent).filter((g): g is number => g !== null);
  
  const avgEngagement = engagementRates.length > 0 
    ? engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length 
    : 0;
  
  const avgGrowth = growthRates.length > 0
    ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length
    : 0;

  // Find top performer by engagement
  let topPerformer: string | null = null;
  let maxEngagement = 0;
  
  kpis.forEach(kpi => {
    if (kpi.engagement_rate && kpi.engagement_rate > maxEngagement) {
      maxEngagement = kpi.engagement_rate;
      const profile = profiles.find(p => p.id === kpi.fk_profile_id);
      topPerformer = profile?.display_name || profile?.profile_id || null;
    }
  });

  return {
    totalProfiles: profiles.length,
    networks,
    avgEngagement: Math.round(avgEngagement * 100) / 100,
    topPerformer,
    avgGrowth: Math.round(avgGrowth * 100) / 100,
  };
}

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
    const { rankingName, reportType, extension, profiles, kpis, narratives, dateRange, filterNetwork } = body;

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ error: "No profiles provided for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate metrics
    const metrics = calculateMetrics(profiles, kpis);

    // Build context for AI
    const profilesSummary = buildProfilesSummary(profiles, kpis);
    const narrativesSummary = buildNarrativesSummary(narratives || []);

    const maxTokens = EXTENSION_TOKENS[extension];
    const typePrompt = REPORT_TYPE_PROMPTS[reportType];

    const systemPrompt = `Eres un analista de inteligencia competitiva experto en redes sociales. 
Generas reportes ejecutivos claros, concisos y accionables para equipos de marketing y directivos.

IMPORTANTE: 
- Responde en español
- No uses markdown ni símbolos especiales
- Sé específico con nombres y números
- Enfócate en insights accionables`;

    const userPrompt = `${typePrompt}

RANKING: ${rankingName}
PERIODO: ${dateRange.label} (${dateRange.start} a ${dateRange.end})
${filterNetwork && filterNetwork !== 'all' ? `RED SOCIAL: ${filterNetwork}` : `REDES: ${metrics.networks.join(', ')}`}

DATOS DE PERFILES (${profiles.length} perfiles):
${profilesSummary}

${narrativesSummary ? `ANÁLISIS DE NARRATIVAS:\n${narrativesSummary}` : ''}

MÉTRICAS AGREGADAS:
- Engagement promedio: ${metrics.avgEngagement}%
- Crecimiento promedio: ${metrics.avgGrowth}%
- Top performer: ${metrics.topPerformer || 'N/A'}

Genera un reporte estructurado con:
1. TÍTULO: Un título descriptivo y profesional
2. RESUMEN: Párrafo ejecutivo con los puntos más importantes (máx 3 oraciones)
3. HALLAZGOS CLAVE: Lista de 3-5 hallazgos principales con datos específicos
4. RECOMENDACIONES: Lista de 2-4 acciones recomendadas

Además, genera 3 versiones del mensaje:
5. VERSIÓN EJECUTIVA: Para directivos (2-3 párrafos, enfoque en impacto y decisiones)
6. VERSIÓN TÉCNICA: Para analistas (2-3 párrafos, con métricas detalladas)
7. VERSIÓN WHATSAPP: Para compartir rápido (1-2 párrafos con emojis apropiados)

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
        max_tokens: maxTokens + 600,
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
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reportContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      reportContent = {
        title: `Reporte de ${rankingName}`,
        summary: content.substring(0, 500),
        keyFindings: ["Análisis en proceso"],
        recommendations: ["Revisar datos manualmente"],
        templates: {
          executive: content.substring(0, 400),
          technical: content.substring(0, 500),
          public: content.substring(0, 250),
        },
      };
    }

    const result: ReportContent = {
      title: reportContent.title || `Reporte de ${rankingName}`,
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
    console.error("Error generating ranking report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
