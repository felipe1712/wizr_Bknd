import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaudeTool } from "../_shared/anthropic.ts";

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

interface ProfileInput {
  profileName: string;
  network: string;
  posts: PostInput[];
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

interface ComparativeAnalysis {
  profiles: Array<{
    profileId: string;
    profileName: string;
    network: string;
    analysis: NarrativeAnalysis;
  }>;
  comparison?: {
    commonThemes: string[];
    differentiators: Array<{
      profileName: string;
      uniqueAspect: string;
    }>;
    leaderInEngagement?: string;
    mostFormalTone?: string;
    overallInsight: string;
  };
}

// Single profile analysis
async function analyzeProfile(
  profile: ProfileInput,
  dateRange: { from: string; to: string } | null,
  apiKey: string,
  analysisContext: "brand" | "benchmark" = "benchmark",
  brandName?: string,
  totalProfilesInScope?: number
): Promise<NarrativeAnalysis> {
  // Calculate engagement stats
  const engagements = profile.posts.map(p => p.engagement).filter(e => e > 0);
  const avgEngagement = engagements.length > 0 ? engagements.reduce((a, b) => a + b, 0) / engagements.length : 0;
  const maxEngagement = Math.max(...engagements, 0);
  const topPosts = [...profile.posts].sort((a, b) => b.engagement - a.engagement).slice(0, 5);
  
  // Group by content type
  const contentTypes: Record<string, number> = {};
  profile.posts.forEach(p => {
    const type = p.contentType || 'unknown';
    contentTypes[type] = (contentTypes[type] || 0) + 1;
  });

  const postsContent = profile.posts.slice(0, 20).map((p, i) => 
    `[Post ${i + 1}] (Engagement: ${p.engagement}, Tipo: ${p.contentType}${p.date ? `, Fecha: ${p.date}` : ''})\n${p.message.substring(0, 600)}`
  ).join("\n\n---\n\n");

  // === CONTEXT-AWARE FRAMING ===
  // El AI debe saber si está analizando UNA marca propia o un ECOSISTEMA competitivo
  const isBrand = analysisContext === "brand";
  const focusLabel = isBrand
    ? (brandName ? `la marca "${brandName}"` : `la marca propia`)
    : `un ecosistema competitivo de ${totalProfilesInScope ?? "múltiples"} perfiles`;

  const contextBlock = isBrand
    ? `MODO DE ANÁLISIS: ANÁLISIS DE MARCA PROPIA (Performance/Listening)
Estás analizando el contenido de UNA SOLA MARCA propia${brandName ? ` ("${brandName}")` : ""} con el objetivo de evaluar SU desempeño narrativo individual. NO es un análisis competitivo. NO compares con "el sector" ni hables de "los demás bancos/competidores". Concéntrate en:
- Qué historia cuenta ESTA marca
- Coherencia interna de su narrativa
- Qué está funcionando para ELLA específicamente
- Oportunidades de mejora dentro de SU propia estrategia
PROHIBIDO frases como "se diferencia de competidores", "vs. el resto del sector", "ecosistema multi-marca", "estrategia multi-marca", "38 perfiles bancarios", etc.`
    : `MODO DE ANÁLISIS: BENCHMARKING COMPETITIVO
Estás analizando un ECOSISTEMA de ${totalProfilesInScope ?? "varios"} perfiles competidores en conjunto. El objetivo es entender el panorama competitivo, identificar quién lidera en qué territorios narrativos y dónde existen huecos o convergencias. Concéntrate en:
- Patrones colectivos del sector
- Quién domina cada territorio temático
- Diferenciadores entre actores
- Huecos competitivos`;

  const systemPrompt = `Eres un ANALISTA SENIOR de comunicación digital especializado en análisis de contenido y narrativas institucionales.

${contextBlock}

CONTEXTO DEL DATASET:
- Perfil: @${profile.profileName} en ${profile.network}
- Alcance del análisis: ${focusLabel}
- Total de posts analizados: ${profile.posts.length}
- Engagement promedio: ${avgEngagement.toFixed(0)}
- Engagement máximo: ${maxEngagement}
- Distribución por tipo: ${Object.entries(contentTypes).map(([k, v]) => `${k}: ${v}`).join(', ')}

TU TAREA ES REALIZAR UN ANÁLISIS PROFUNDO Y ESPECÍFICO:

1. NARRATIVAS DOMINANTES (3-5)
   - NO uses descripciones genéricas como "contenido institucional" o "información general"
   - Identifica LOS TEMAS ESPECÍFICOS: ¿Hablan de qué productos? ¿Qué servicios? ¿Qué valores? ¿Qué campañas?
   - Cuantifica: ¿qué porcentaje de posts corresponde a cada narrativa?
   - Incluye fragmentos textuales reales como ejemplo

2. ANÁLISIS DE TONO
   - ¿Es formal/informal/mixto? Justifica con ejemplos
   - ¿Qué emociones buscan generar? (inspiración, urgencia, confianza, diversión...)
   - ¿Usan call-to-actions? ¿De qué tipo?

3. ESTRATEGIA DE CONTENIDO
   - ${isBrand ? `¿Cuál es el ENFOQUE PRINCIPAL de ${brandName ?? "la marca"}? Sé específico.` : `¿Cuál es su ENFOQUE PRINCIPAL? Sé específico (ej: "educación financiera para jóvenes" no "contenido variado")`}
   - FORTALEZAS: ${isBrand ? `¿Qué hace bien ESTA marca? ¿Qué posts generan más engagement y por qué?` : `¿Qué hacen bien? ¿Qué posts generan más engagement y por qué?`}
   - OPORTUNIDADES: ${isBrand ? `¿Qué podría mejorar ESTA marca dentro de su propia estrategia?` : `¿Qué podrían mejorar? ¿Qué temas no cubren pero deberían?`}

4. RESUMEN EJECUTIVO
   - 3-4 oraciones que capturen LA ESENCIA de su comunicación
   - Incluye al menos un número o dato específico
   - ${isBrand ? `Enfocado SOLO en ${brandName ?? "esta marca"}. NO menciones otras marcas, sectores ni ecosistemas.` : `Incluye una observación sobre qué los diferencia (o no) de otros perfiles similares.`}

Responde ÚNICAMENTE con JSON válido siguiendo el schema de la función.`;

  const userPrompt = `Analiza estos ${profile.posts.length} posts de @${profile.profileName} en ${profile.network}${dateRange ? ` del período ${dateRange.from} a ${dateRange.to}` : ''}.

TOP 5 POSTS POR ENGAGEMENT:
${topPosts.map((p, i) => `${i+1}. (Eng: ${p.engagement}) ${p.message.substring(0, 200)}...`).join('\n')}

TODOS LOS POSTS:
${postsContent}`;

  const toolSchema = {
    type: "object",
    properties: {
      dominantNarratives: {
        type: "array",
        items: {
          type: "object",
          properties: {
            theme: { type: "string", description: "Nombre específico del tema/narrativa (NO genérico)" },
            description: { type: "string", description: "Descripción detallada de la narrativa con contexto" },
            frequency: { type: "number", description: "Porcentaje de posts que usan esta narrativa (0-100)" },
            sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
            examplePosts: {
              type: "array",
              items: { type: "string" },
              description: "2-3 fragmentos textuales REALES de los posts como ejemplo"
            }
          },
          required: ["theme", "description", "frequency", "sentiment", "examplePosts"]
        }
      },
      toneAnalysis: {
        type: "object",
        properties: {
          overall: { type: "string", enum: ["formal", "informal", "mixed"] },
          emotionalTone: { type: "string", description: "Tono emocional específico: Inspirador, Informativo, Promocional, Educativo, Urgente, etc." },
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
          primaryFocus: { type: "string", description: "Enfoque principal ESPECÍFICO, no genérico" },
          strengths: {
            type: "array",
            items: { type: "string" },
            description: "3-4 fortalezas específicas con justificación"
          },
          opportunities: {
            type: "array",
            items: { type: "string" },
            description: "2-3 oportunidades de mejora concretas y accionables"
          }
        },
        required: ["primaryFocus", "strengths", "opportunities"]
      },
      summary: { type: "string", description: "Resumen ejecutivo de 3-4 oraciones con datos específicos y una observación diferenciadora" }
    },
    required: ["dominantNarratives", "toneAnalysis", "topHashtags", "contentStrategy", "summary"]
  };

  return await callClaudeTool<NarrativeAnalysis>({
    apiKey,
    systemPrompt,
    userPrompt,
    toolName: "narrative_analysis",
    toolDescription: "Return detailed narrative analysis of social media content",
    toolSchema,
    maxTokens: 4000,
    temperature: 0.2,
    timeoutMs: 90000,
  });
}

// Generate comparative insights
async function generateComparison(
  profilesWithAnalysis: Array<{
    profileId: string;
    profileName: string;
    network: string;
    analysis: NarrativeAnalysis;
  }>,
  apiKey: string
): Promise<ComparativeAnalysis["comparison"]> {
  const profileSummaries = profilesWithAnalysis.map(p => {
    const narrativesList = p.analysis.dominantNarratives.map(n => 
      `"${n.theme}" (${n.frequency}%, ${n.sentiment})`
    ).join(", ");
    
    return `@${p.profileName} (${p.network}):
- Resumen: ${p.analysis.summary}
- Narrativas: ${narrativesList}
- Tono: ${p.analysis.toneAnalysis.overall}, ${p.analysis.toneAnalysis.emotionalTone}
- Enfoque principal: ${p.analysis.contentStrategy.primaryFocus}
- Fortalezas: ${p.analysis.contentStrategy.strengths.join("; ")}`;
  }).join("\n\n---\n\n");

  const systemPrompt = `Eres un ANALISTA SENIOR de comunicación digital. Tu tarea es comparar las estrategias de comunicación de ${profilesWithAnalysis.length} perfiles y generar INSIGHTS ACCIONABLES.

PRINCIPIOS DE TU ANÁLISIS:
1. ESPECIFICIDAD: Nombra perfiles específicos, no hables en genérico
2. DIFERENCIACIÓN: Identifica qué hace ÚNICO a cada perfil
3. COMPETITIVIDAD: ¿Quién lo hace mejor y por qué?
4. ACCIONABILIDAD: Qué puede aprender cada uno de los otros

NO uses frases genéricas como "todos tienen contenido interesante" o "cada uno tiene su estilo".`;

  const userPrompt = `Compara estos ${profilesWithAnalysis.length} perfiles y genera un análisis comparativo profundo:

${profileSummaries}

Identifica:
1. Temas que COMPARTEN (con evidencia)
2. Lo que hace ÚNICO a cada uno (su diferenciador)
3. Quién tiene la mejor estrategia de engagement y por qué
4. Quién tiene el tono más profesional/institucional
5. Un INSIGHT GLOBAL de 2-3 oraciones que resuma la comparación con datos específicos`;

  const toolSchema = {
    type: "object",
    properties: {
      commonThemes: {
        type: "array",
        items: { type: "string" },
        description: "Temas específicos que comparten la mayoría, con evidencia"
      },
      differentiators: {
        type: "array",
        items: {
          type: "object",
          properties: {
            profileName: { type: "string" },
            uniqueAspect: { type: "string", description: "Lo que lo diferencia DE FORMA ESPECÍFICA" }
          },
          required: ["profileName", "uniqueAspect"]
        }
      },
      leaderInEngagement: { type: "string", description: "Nombre del perfil con mejor estrategia de engagement y por qué" },
      mostFormalTone: { type: "string", description: "Nombre del perfil con tono más formal/institucional" },
      overallInsight: { type: "string", description: "Insight clave de 2-3 oraciones CON DATOS ESPECÍFICOS que resuma la comparación" }
    },
    required: ["commonThemes", "differentiators", "overallInsight"]
  };

  try {
    return await callClaudeTool<NonNullable<ComparativeAnalysis["comparison"]>>({
      apiKey,
      systemPrompt,
      userPrompt,
      toolName: "comparative_analysis",
      toolDescription: "Return detailed comparative analysis of multiple profiles",
      toolSchema,
      maxTokens: 3000,
      temperature: 0.2,
      timeoutMs: 90000,
    });
  } catch (err) {
    console.error("Comparison error:", err);
    return undefined;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Support both single profile (legacy) and multiple profiles
    const profiles: ProfileInput[] = body.profiles || [{
      profileName: body.profileName,
      network: body.network,
      posts: body.posts
    }];
    
    const dateRange = body.dateRange as { from: string; to: string } | null;

    // Analysis context: distinguishes brand-focused (Performance) from competitive (Benchmark)
    const analysisContext: "brand" | "benchmark" = body.analysisContext === "brand" ? "brand" : "benchmark";
    const brandName: string | undefined = typeof body.brandName === "string" ? body.brandName : undefined;

    if (!profiles || profiles.length === 0 || !profiles[0].posts || profiles[0].posts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No profiles or posts provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to 5 profiles max
    const limitedProfiles = profiles.slice(0, 5);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    // Analyze each profile
    const profilesWithAnalysis: ComparativeAnalysis["profiles"] = [];
    
    for (const profile of limitedProfiles) {
      if (!profile.posts || profile.posts.length === 0) continue;
      
      try {
        const analysis = await analyzeProfile(
          profile,
          dateRange,
          ANTHROPIC_API_KEY,
          analysisContext,
          brandName,
          limitedProfiles.length
        );
        profilesWithAnalysis.push({
          profileId: profile.profileName, // Using name as ID
          profileName: profile.profileName,
          network: profile.network,
          analysis
        });
      } catch (err) {
        if ((err as Error).message === "RATE_LIMIT") {
          return new Response(
            JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if ((err as Error).message === "PAYMENT_REQUIRED") {
          return new Response(
            JSON.stringify({ success: false, error: "Payment required. Please add credits." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.error(`Error analyzing ${profile.profileName}:`, err);
        // Continue with other profiles
      }
    }

    if (profilesWithAnalysis.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not analyze any profiles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate comparison if multiple profiles
    let comparison: ComparativeAnalysis["comparison"] = undefined;
    if (profilesWithAnalysis.length > 1) {
      comparison = await generateComparison(profilesWithAnalysis, ANTHROPIC_API_KEY);
    }

    // Return result - maintain backwards compatibility for single profile
    if (limitedProfiles.length === 1 && !body.profiles) {
      // Legacy single profile response
      return new Response(
        JSON.stringify({ success: true, analysis: profilesWithAnalysis[0].analysis }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Multi-profile response
    const result: ComparativeAnalysis = {
      profiles: profilesWithAnalysis,
      comparison
    };

    return new Response(
      JSON.stringify({ success: true, comparative: result }),
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
