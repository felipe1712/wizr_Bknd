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
  micro: 500,
  short: 1200,
  medium: 2500,
};

const REPORT_TYPE_PROMPTS = {
  brief: `Genera un BRIEF EJECUTIVO DE MONITOREO detallado y accionable. NO seas genérico.

ESTRUCTURA TU ANÁLISIS:

1. RESUMEN DEL PERÍODO
   - ¿Cuántas menciones hubo y cómo se compara con lo esperado?
   - ¿El sentimiento general es favorable o desfavorable? Cuantifica.
   - ¿Hay algún evento o tema que dominó el período?

2. ANÁLISIS DE FUENTES
   - ¿De dónde provienen las menciones más relevantes?
   - ¿Qué fuentes generan más contenido negativo vs positivo?
   - ¿Hay nuevas fuentes que debamos monitorear?

3. TEMAS Y NARRATIVAS DETECTADAS
   - Identifica 3-5 temas principales mencionados
   - ¿Hay narrativas positivas que debamos amplificar?
   - ¿Hay narrativas negativas que requieran respuesta?

4. ANÁLISIS DE KEYWORDS
   - ¿Qué keywords aparecen más frecuentemente?
   - ¿Hay keywords nuevos o emergentes?
   - ¿Los keywords negativos están asociados a algún tema específico?

5. ALERTAS Y SEÑALES
   - ¿Hay algo que requiera atención inmediata?
   - ¿Cambios significativos vs períodos anteriores?
   - ¿Oportunidades detectadas?`,

  crisis: `Genera una ALERTA DE CRISIS profunda y operativa. Esto requiere URGENCIA y PRECISIÓN.

ESTRUCTURA TU ANÁLISIS:

1. DESCRIPCIÓN DEL EVENTO CRÍTICO
   - ¿Qué pasó exactamente? Sé específico con fechas, fuentes, protagonistas
   - ¿Cuál es el detonante de la crisis?
   - ¿En qué fuentes/plataformas está concentrada?

2. MAGNITUD E IMPACTO
   - ¿Cuántas menciones negativas hay?
   - ¿Qué porcentaje del total representan?
   - ¿La crisis está creciendo, estable o decreciendo?
   - ¿Qué alcance potencial tienen las fuentes que la reportan?

3. ACTORES INVOLUCRADOS
   - ¿Quiénes son los principales detractores/críticos?
   - ¿Hay influenciadores amplificando la crisis?
   - ¿Hay defensores o voces positivas?

4. NARRATIVA DE LA CRISIS
   - ¿Cuál es el mensaje central de la crítica?
   - ¿Qué argumentos se usan en contra?
   - ¿Hay información falsa o tergiversada?

5. PLAN DE CONTENCIÓN (Inmediato)
   - Acciones en las próximas 24 horas
   - Mensajes sugeridos de respuesta
   - Canales prioritarios para intervenir

6. PLAN DE RECUPERACIÓN (Mediano plazo)
   - Estrategia de comunicación sugerida
   - Narrativas positivas a amplificar
   - Aliados potenciales para movilizar`,

  thematic: `Genera un ANÁLISIS TEMÁTICO PROFUNDO. Extrae INTELIGENCIA sobre un tema específico.

ESTRUCTURA TU ANÁLISIS:

1. TEMA PRINCIPAL IDENTIFICADO
   - Define el tema central con precisión
   - ¿Por qué es relevante para el proyecto?
   - ¿Es un tema nuevo, recurrente, o en evolución?

2. SUBTEMAS Y NARRATIVAS
   - Identifica 3-5 subtemas relacionados
   - Para cada subtema: frecuencia, sentimiento predominante, fuentes principales
   - ¿Cómo se conectan los subtemas entre sí?

3. EVOLUCIÓN TEMPORAL
   - ¿Cuándo surgió o se intensificó este tema?
   - ¿Hay picos o patrones temporales?
   - ¿El interés está creciendo o decayendo?

4. ACTORES Y VOCES
   - ¿Quiénes hablan de este tema?
   - ¿Hay líderes de opinión o influenciadores?
   - ¿Hay instituciones o medios que lo cubren regularmente?

5. CONTEXTO E IMPLICACIONES
   - ¿Qué contexto externo explica este tema?
   - ¿Cómo afecta a la marca/entidad monitoreada?
   - ¿Qué oportunidades o riesgos representa?

6. PREDICCIÓN Y RECOMENDACIONES
   - ¿Hacia dónde va este tema?
   - ¿Qué posicionamiento sugerimos?
   - ¿Qué acciones concretas tomar?`,

  comparative: `Genera un ANÁLISIS COMPARATIVO entre entidades. Identifica GANADORES, PERDEDORES Y OPORTUNIDADES.

ESTRUCTURA TU ANÁLISIS:

1. COMPARACIÓN DE VOLUMEN
   - ¿Quién tiene más menciones? Lista de mayor a menor
   - ¿Qué porcentaje del total representa cada entidad?
   - ¿El volumen correlaciona con algo (tamaño, actividad, eventos)?

2. COMPARACIÓN DE SENTIMIENTO
   - ¿Quién tiene mejor ratio positivo/negativo?
   - ¿Quién tiene más menciones negativas (en absoluto y porcentaje)?
   - ¿Hay alguna entidad con sentimiento polarizado?

3. ANÁLISIS DE FUENTES
   - ¿Cada entidad tiene fuentes diferentes o similares?
   - ¿Quién tiene mejor cobertura en medios tradicionales?
   - ¿Quién domina en redes sociales?

4. FORTALEZAS Y DEBILIDADES
   - Para cada entidad: su principal fortaleza comunicacional
   - Para cada entidad: su principal área de mejora
   - Tabla comparativa implícita

5. SHARE OF VOICE
   - ¿Quién "domina la conversación"?
   - ¿Hay entidades invisibilizadas que deberían tener más presencia?
   - ¿Oportunidades de gap en la conversación?

6. BENCHMARK Y OPORTUNIDADES
   - ¿Quién es el líder a seguir y por qué?
   - ¿Qué hace diferente al líder?
   - ¿Qué oportunidades hay para mejorar posición?`,
};

function buildDetailedMentionAnalysis(mentions: Mention[]): string {
  // Group by sentiment
  const positive = mentions.filter(m => m.sentiment === "positivo");
  const negative = mentions.filter(m => m.sentiment === "negativo");
  const neutral = mentions.filter(m => m.sentiment === "neutral");

  // Group by source
  const bySource: Record<string, Mention[]> = {};
  mentions.forEach(m => {
    const source = m.source_domain || "desconocido";
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(m);
  });

  // Get keyword frequency
  const keywordCount: Record<string, number> = {};
  mentions.forEach(m => {
    m.matched_keywords?.forEach(k => {
      keywordCount[k] = (keywordCount[k] || 0) + 1;
    });
  });
  const topKeywords = Object.entries(keywordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  let analysis = "ANÁLISIS DETALLADO DE MENCIONES:\n\n";

  // Sentiment breakdown
  analysis += "DISTRIBUCIÓN DE SENTIMIENTO:\n";
  analysis += `- Positivas: ${positive.length} (${(positive.length/mentions.length*100).toFixed(1)}%)\n`;
  analysis += `- Negativas: ${negative.length} (${(negative.length/mentions.length*100).toFixed(1)}%)\n`;
  analysis += `- Neutrales: ${neutral.length} (${(neutral.length/mentions.length*100).toFixed(1)}%)\n\n`;

  // Source breakdown
  const sortedSources = Object.entries(bySource).sort((a, b) => b[1].length - a[1].length);
  analysis += "TOP FUENTES:\n";
  sortedSources.slice(0, 5).forEach(([source, items]) => {
    const posCount = items.filter(i => i.sentiment === "positivo").length;
    const negCount = items.filter(i => i.sentiment === "negativo").length;
    analysis += `- ${source}: ${items.length} menciones (${posCount} pos, ${negCount} neg)\n`;
  });
  analysis += "\n";

  // Keywords
  if (topKeywords.length > 0) {
    analysis += "KEYWORDS MÁS FRECUENTES:\n";
    topKeywords.forEach(([keyword, count]) => {
      analysis += `- "${keyword}": ${count} menciones\n`;
    });
    analysis += "\n";
  }

  // Sample of negative mentions (important for crisis detection)
  if (negative.length > 0) {
    analysis += "MUESTRA DE MENCIONES NEGATIVAS:\n";
    negative.slice(0, 5).forEach((m, i) => {
      analysis += `${i+1}. [${m.source_domain}] ${m.title || ''}: ${(m.description || '').substring(0, 150)}...\n`;
    });
    analysis += "\n";
  }

  // Sample of positive mentions
  if (positive.length > 0) {
    analysis += "MUESTRA DE MENCIONES POSITIVAS:\n";
    positive.slice(0, 3).forEach((m, i) => {
      analysis += `${i+1}. [${m.source_domain}] ${m.title || ''}: ${(m.description || '').substring(0, 150)}...\n`;
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

    // Build detailed analysis
    const detailedAnalysis = buildDetailedMentionAnalysis(mentions);

    // Prepare mentions summary for AI (more context per mention)
    const mentionsSummary = mentions.slice(0, 40).map(m => ({
      title: m.title,
      description: m.description?.substring(0, 200),
      source: m.source_domain,
      sentiment: m.sentiment,
      keywords: m.matched_keywords?.join(", "),
      date: m.created_at?.split('T')[0],
    }));

    const maxTokens = EXTENSION_TOKENS[extension];
    const typePrompt = REPORT_TYPE_PROMPTS[reportType];

    const systemPrompt = `Eres un ANALISTA SENIOR de inteligencia estratégica con experiencia en monitoreo de medios y reputación.

TU AUDIENCIA: ${projectAudience}
OBJETIVO DEL MONITOREO: ${projectObjective}

PRINCIPIOS DE TU ANÁLISIS:
1. ESPECIFICIDAD: Usa nombres de fuentes, títulos de notas, fechas. Nunca digas "varias fuentes" o "algunos medios".
2. CUANTIFICACIÓN: Incluye números, porcentajes, comparaciones. No hables en términos vagos.
3. CONTEXTO: Explica el "por qué" detrás de los datos. ¿Por qué es importante este hallazgo?
4. ACCIONABILIDAD: Cada insight debe poder convertirse en una decisión o acción concreta.
5. PRIORIZACIÓN: Lo más importante primero. Destaca lo crítico vs lo informativo.

FORMATO:
- Responde en español profesional
- NO uses markdown, asteriscos, ni símbolos especiales (excepto en versión WhatsApp donde puedes usar emojis)
- Cita fuentes específicas cuando menciones un hallazgo
- Usa números exactos`;

    const userPrompt = `${typePrompt}

=== CONTEXTO DEL PROYECTO ===
PROYECTO: ${projectName}
PERIODO ANALIZADO: ${dateRange.label} (${dateRange.start} a ${dateRange.end})
${entityNames?.length ? `ENTIDADES MONITOREADAS: ${entityNames.join(", ")}` : ""}

=== MÉTRICAS DEL PERÍODO ===
- Total de menciones: ${metrics.totalMentions}
- Positivas: ${metrics.positiveCount} (${Math.round(metrics.positiveCount/metrics.totalMentions*100)}%)
- Negativas: ${metrics.negativeCount} (${Math.round(metrics.negativeCount/metrics.totalMentions*100)}%)
- Neutrales: ${metrics.neutralCount} (${Math.round(metrics.neutralCount/metrics.totalMentions*100)}%)
- Fuentes principales: ${metrics.topSources.join(", ")}

${detailedAnalysis}

=== MUESTRA DE MENCIONES (${mentionsSummary.length} de ${mentions.length}) ===
${JSON.stringify(mentionsSummary, null, 2)}

=== TU TAREA ===
Analiza los datos y genera un reporte siguiendo la estructura indicada. Sé ESPECÍFICO y CUANTITATIVO.

Responde en formato JSON con esta estructura exacta:
{
  "title": "string - título profesional que refleje el contenido del reporte",
  "summary": "string - párrafo ejecutivo de 4-6 oraciones con los hallazgos críticos, mencionando fuentes y números específicos",
  "keyFindings": ["string - hallazgo específico citando fuentes/datos", ...] - mínimo 4 hallazgos ordenados por importancia,
  "recommendations": ["string - acción específica y priorizada", ...] - mínimo 3 recomendaciones concretas,
  "templates": {
    "executive": "string - 3-4 párrafos para directivos, enfoque en impacto de negocio y decisiones",
    "technical": "string - 3-4 párrafos para analistas, con metodología y datos detallados", 
    "public": "string - 2-3 párrafos con emojis apropiados para WhatsApp, resumen accesible"
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
        max_tokens: maxTokens + 700,
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
