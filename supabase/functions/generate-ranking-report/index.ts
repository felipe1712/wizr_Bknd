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
  micro: 600,
  short: 1500,
  medium: 3000,
};

const REPORT_TYPE_PROMPTS: Record<ReportType, string> = {
  competitive_brief: `Genera un BRIEF COMPETITIVO EJECUTIVO con análisis profundo. Tu objetivo es proporcionar INTELIGENCIA ACCIONABLE, no descripciones genéricas.

ESTRUCTURA TU ANÁLISIS ASÍ:

1. PANORAMA COMPETITIVO
   - Identifica el LÍDER claro del ranking con datos específicos (ej: "@BancoX domina con 2.4M seguidores y 3.2% engagement, 45% arriba del promedio")
   - Menciona quién está en SEGUNDO y TERCER lugar y por qué
   - Señala cualquier CAMBIO DE POSICIÓN significativo

2. ANÁLISIS DE FORTALEZAS Y DEBILIDADES
   - Para los TOP 3: identifica su ventaja competitiva específica
   - Para los ÚLTIMOS 2-3: explica qué los está rezagando con datos

3. SHARE OF VOICE
   - Calcula el share of voice por seguidores
   - Indica quién "domina la conversación" y quién necesita más visibilidad

4. INSIGHTS ACCIONABLES
   - Mínimo 3 hallazgos que alguien pueda usar para tomar decisiones
   - Ejemplo bueno: "El engagement de @PerfilY cayó 2.1% vs periodo anterior, correlacionado con reducción de 40% en posts/día"
   - Ejemplo malo: "Algunos perfiles tienen mejor engagement que otros"`,

  performance_analysis: `Genera un ANÁLISIS DE PERFORMANCE DETALLADO Y CUANTITATIVO. Evita generalidades; usa DATOS ESPECÍFICOS.

ESTRUCTURA TU ANÁLISIS ASÍ:

1. RANKING DE PERFORMANCE (de mejor a peor)
   - Lista los perfiles ordenados por engagement con el valor exacto
   - Indica qué percentil representa cada uno vs el promedio del grupo
   - Señala outliers: quién está muy por encima o muy por debajo

2. CORRELACIONES DETECTADAS
   - ¿Mayor frecuencia de posts = mayor engagement? Cuantifícalo
   - ¿Más seguidores = menor engagement rate? Analiza esta relación
   - ¿Qué red social tiene mejor performance promedio?

3. ANÁLISIS DE ACTIVIDAD
   - ¿Quién publica más? ¿Con qué resultados?
   - ¿Quién publica menos pero logra más impacto por post?
   - Identifica el "sweet spot" de frecuencia de publicación

4. DEEP DIVE EN EXTREMOS
   - TOP PERFORMER: Analiza en detalle qué hace diferente
   - UNDERPERFORMER: Identifica las causas del bajo rendimiento

5. OPORTUNIDADES CUANTIFICADAS
   - "Si @PerfilZ aumentara su frecuencia de X a Y posts/día, podría alcanzar Z% más engagement basado en correlación observada"`,

  trends_report: `Genera un REPORTE DE TENDENCIAS con ANÁLISIS PREDICTIVO Y EVOLUTIVO. Identifica patrones y proyecciones.

ESTRUCTURA TU ANÁLISIS ASÍ:

1. DINÁMICA DE CRECIMIENTO
   - ¿Quién GANA terreno? Lista perfiles con crecimiento positivo y cuantifica
   - ¿Quién PIERDE terreno? Lista perfiles en declive con el porcentaje exacto
   - Identifica el "momentum": quién acelera vs quién desacelera

2. CAMBIOS DE POSICIÓN
   - Compara posiciones actuales vs esperadas por tamaño
   - ¿Hay "Davids" venciendo a "Goliats"? (perfiles pequeños con alto engagement)
   - ¿Hay "Gigantes dormidos"? (muchos seguidores, bajo engagement)

3. PATRONES TEMPORALES
   - ¿Qué patrones de publicación caracterizan a los que crecen?
   - ¿Hay estacionalidad o eventos que expliquen cambios?

4. PROYECCIONES
   - Si las tendencias continúan, ¿quién liderará en 3 meses?
   - ¿Qué perfil tiene el mayor potencial de crecimiento?
   - ¿Quién corre riesgo de perder relevancia?

5. SEÑALES DE ALERTA
   - Perfiles que muestran signos de declive
   - Cambios abruptos que requieren investigación`,

  benchmarking: `Genera un REPORTE DE BENCHMARKING COMPARATIVO con el PROMEDIO DEL GRUPO como referencia central.

ESTRUCTURA TU ANÁLISIS ASÍ:

1. BENCHMARK DEL GRUPO
   - Define claramente los promedios: engagement, crecimiento, actividad
   - Establece RANGOS: ¿qué es "excelente" (>2x promedio), "bueno", "normal", "bajo", "crítico"?

2. POSICIONAMIENTO DE CADA PERFIL
   - Ubica cada perfil en los rangos establecidos para cada métrica
   - Usa formato tabla mental: "@Perfil: Engagement [Excelente], Crecimiento [Normal], Actividad [Bajo]"

3. ANÁLISIS GAP
   - Para cada perfil debajo del promedio, cuantifica la brecha
   - "Para alcanzar el promedio, @PerfilX necesitaría aumentar engagement de 0.8% a 1.6% (+100%)"

4. MEJORES PRÁCTICAS
   - ¿Qué hacen los líderes que los demás no?
   - Identifica 2-3 prácticas replicables con ejemplos específicos

5. PLAN DE ACCIÓN POR PERFIL
   - Para los 2-3 con mayor gap: qué deberían priorizar
   - Cuantifica el impacto potencial de cerrar la brecha`,
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
      `${kpi.posts_per_day?.toFixed(1) || 'N/A'} posts/día, ` +
      `PPI: ${kpi.page_performance_index?.toFixed(0) || 'N/A'}`;
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

function buildDetailedKPIAnalysis(profiles: ProfileData[], kpis: KPIData[]): string {
  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const engagementRates = kpis.map(k => k.engagement_rate).filter((e): e is number => e !== null);
  const avgEngagement = engagementRates.length > 0 ? engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length : 0;
  
  // Sort by engagement
  const sortedByEngagement = [...kpis]
    .filter(k => k.engagement_rate !== null)
    .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));

  // Sort by growth
  const sortedByGrowth = [...kpis]
    .filter(k => k.follower_growth_percent !== null)
    .sort((a, b) => (b.follower_growth_percent || 0) - (a.follower_growth_percent || 0));

  // Sort by followers
  const sortedByFollowers = [...kpis]
    .filter(k => k.followers !== null)
    .sort((a, b) => (b.followers || 0) - (a.followers || 0));

  let analysis = "ANÁLISIS DETALLADO DE KPIs:\n\n";

  analysis += "RANKING POR ENGAGEMENT:\n";
  sortedByEngagement.slice(0, 5).forEach((kpi, i) => {
    const profile = profileMap.get(kpi.fk_profile_id);
    const vsAvg = ((kpi.engagement_rate || 0) / avgEngagement * 100 - 100).toFixed(0);
    analysis += `${i + 1}. ${profile?.display_name || profile?.profile_id}: ${kpi.engagement_rate?.toFixed(2)}% (${Number(vsAvg) >= 0 ? '+' : ''}${vsAvg}% vs promedio)\n`;
  });

  analysis += "\nRANKING POR CRECIMIENTO:\n";
  sortedByGrowth.slice(0, 5).forEach((kpi, i) => {
    const profile = profileMap.get(kpi.fk_profile_id);
    analysis += `${i + 1}. ${profile?.display_name || profile?.profile_id}: ${kpi.follower_growth_percent?.toFixed(2)}%\n`;
  });

  analysis += "\nRANKING POR TAMAÑO (Seguidores):\n";
  sortedByFollowers.slice(0, 5).forEach((kpi, i) => {
    const profile = profileMap.get(kpi.fk_profile_id);
    analysis += `${i + 1}. ${profile?.display_name || profile?.profile_id}: ${kpi.followers?.toLocaleString()}\n`;
  });

  // Identify outliers
  const highPerformers = sortedByEngagement.filter(k => (k.engagement_rate || 0) > avgEngagement * 1.5);
  const lowPerformers = sortedByEngagement.filter(k => (k.engagement_rate || 0) < avgEngagement * 0.5);

  if (highPerformers.length > 0) {
    analysis += "\nOUTLIERS POSITIVOS (>50% arriba del promedio):\n";
    highPerformers.forEach(kpi => {
      const profile = profileMap.get(kpi.fk_profile_id);
      analysis += `- ${profile?.display_name || profile?.profile_id}: ${kpi.engagement_rate?.toFixed(2)}% engagement\n`;
    });
  }

  if (lowPerformers.length > 0) {
    analysis += "\nOUTLIERS NEGATIVOS (<50% del promedio):\n";
    lowPerformers.forEach(kpi => {
      const profile = profileMap.get(kpi.fk_profile_id);
      analysis += `- ${profile?.display_name || profile?.profile_id}: ${kpi.engagement_rate?.toFixed(2)}% engagement\n`;
    });
  }

  return analysis;
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
    const detailedKPIAnalysis = buildDetailedKPIAnalysis(profiles, kpis);

    const maxTokens = EXTENSION_TOKENS[extension];
    const typePrompt = REPORT_TYPE_PROMPTS[reportType];

    const systemPrompt = `Eres un ANALISTA SENIOR de inteligencia competitiva en redes sociales con 15 años de experiencia.

PRINCIPIOS DE TU ANÁLISIS:
1. ESPECIFICIDAD: Siempre menciona NOMBRES Y NÚMEROS concretos. Nunca digas "algunos perfiles" o "varios competidores".
2. COMPARACIÓN: Siempre contextualiza vs el promedio del grupo y vs el líder.
3. ACCIONABILIDAD: Cada hallazgo debe poder convertirse en una decisión o acción.
4. PRIORIZACIÓN: Destaca lo más importante primero. No todo tiene el mismo peso.
5. HONESTIDAD: Si los datos no muestran algo claro, dilo. No inventes patrones.

FORMATO DE OUTPUT:
- Responde en español profesional
- NO uses markdown, asteriscos, ni símbolos especiales
- Usa números exactos, no redondees en exceso
- Nombra a los perfiles por su nombre/handle, no genéricamente`;

    const userPrompt = `${typePrompt}

=== CONTEXTO DEL ANÁLISIS ===

RANKING: ${rankingName}
PERIODO: ${dateRange.label} (${dateRange.start} a ${dateRange.end})
${filterNetwork && filterNetwork !== 'all' ? `RED SOCIAL: ${filterNetwork}` : `REDES INCLUIDAS: ${metrics.networks.join(', ')}`}
TOTAL DE PERFILES: ${profiles.length}

=== DATOS DE CADA PERFIL ===
${profilesSummary}

=== MÉTRICAS AGREGADAS DEL GRUPO ===
- Engagement promedio del grupo: ${metrics.avgEngagement}%
- Crecimiento promedio del grupo: ${metrics.avgGrowth}%
- Top performer por engagement: ${metrics.topPerformer || 'N/A'}
- Redes sociales representadas: ${metrics.networks.join(', ')}

${detailedKPIAnalysis}

${narrativesSummary ? `=== ANÁLISIS DE NARRATIVAS/CONTENIDO ===\n${narrativesSummary}` : ''}

=== TU TAREA ===
Genera un reporte siguiendo la estructura indicada. Sé ESPECÍFICO y CUANTITATIVO.

Responde en formato JSON con esta estructura exacta:
{
  "title": "string - título que refleje el tipo de análisis y el ranking",
  "summary": "string - párrafo ejecutivo de 4-5 oraciones con los hallazgos más importantes, mencionando nombres y números",
  "keyFindings": ["string - hallazgo específico con datos", "string", ...] - mínimo 4 hallazgos,
  "recommendations": ["string - acción específica y cuantificada", "string", ...] - mínimo 3 recomendaciones,
  "templates": {
    "executive": "string - 3-4 párrafos para directivos, enfoque en impacto y decisiones estratégicas",
    "technical": "string - 3-4 párrafos para analistas, con métricas detalladas y metodología", 
    "public": "string - 2 párrafos con emojis apropiados para WhatsApp, resumen accesible"
  }
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens + 800,
        temperature: 0.6,
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
