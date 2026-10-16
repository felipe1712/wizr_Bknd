import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaudeTool } from "../_shared/anthropic.ts";

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
  published_at: string | null;
  matched_keywords: string[];
  raw_metadata: Record<string, unknown> | null;
}

interface ReportRequest {
  mentions: Mention[];
  reportFormat: "summary" | "full";
  projectName: string;
  projectAudience: string;
  projectObjective: string;
  strategicContext?: string;
  strategicFocus?: string;
  entityNames?: string[];
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
}

interface NarrativeItem {
  narrative: string;
  description: string;
  mentions: number;
  sentiment: "positivo" | "negativo" | "mixto";
  trend: "creciente" | "decreciente" | "estable";
}

interface KeywordCloudItem {
  term: string;
  count: number;
  sentiment: "positivo" | "negativo" | "neutral" | "mixto";
}

interface ReportContent {
  title: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  conclusions?: string[];
  impactAssessment?: string;
  sentimentAnalysis?: string;
  narratives?: NarrativeItem[];
  keywords?: KeywordCloudItem[];
  keywordsInsight?: string;
  narrativesInsight?: string;
  timelineInsight?: string;
  influencersInsight?: string;
  mediaInsight?: string;
  platformsInsight?: string;
  entityComparison?: string;
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

type AudiencePerspective = "institutional" | "external" | "observer";

function inferAudiencePerspective(projectAudience = "", projectObjective = ""): AudiencePerspective {
  const text = `${projectAudience} ${projectObjective}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(activista|activistas|empresario|empresarios|sociedad civil|ong|colectivo|colectivos|lider social|lideres sociales|ciudadan|candidat|comunicador independiente|sector privado|camara empresarial)\b/.test(text)) {
    return "external";
  }
  if (/\b(academia|academico|academica|investigador|investigadora|analista|consultor|consultoria|think tank|observador|prensa|periodista)\b/.test(text)) {
    return "observer";
  }
  if (/\b(gobierno|gubernamental|autoridad|alcaldia|municipio|ayuntamiento|secretaria|dependencia|institucion|institucional|voceria oficial|comunicacion corporativa|comunicacion social|prensa oficial|marca monitoreada|organizacion monitoreada)\b/.test(text)) {
    return "institutional";
  }
  return "external";
}

function isInstitutionalRecommendation(text: string): boolean {
  return /(área de comunicación|area de comunicacion|comunicación estratégica|comunicacion estrategica|asuntos públicos|asuntos publicos|respuesta pública|respuesta publica|capacidad de respuesta|respuesta institucional|postura rectora|dirección responsable|direccion responsable|coordinación institucional|coordinacion institucional|contrapeso institucional|posicionamiento institucional|vocería oficial|voceria oficial|equipo a cargo|contención de tono|contencion de tono|gestión por tipo de canal|gestion por tipo de canal|mitigar riesgo reputacional|umbrales? claros? de escalamiento|proteger a la organización|proteger a la organizacion|sobreexponer a la organización|sobreexponer a la organizacion|gestión reputacional|gestion reputacional|comité de crisis|comite de crisis|acción correctiva|accion correctiva|intervenir|intervención|intervencion|autoridad pública|autoridad publica)/i.test(text);
}

function normalizeTextList(items: unknown[]): string[] {
  const seen = new Set<string>();

  return items
    .map((item) => (typeof item === "string" ? item.replace(/\s+/g, " ").trim() : ""))
    .filter((item) => item.length > 0)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getPrimaryDate(mention: Mention): string {
  return (mention.published_at || mention.created_at || "").split("T")[0];
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function sanitizeFindingText(text: string): string {
  // 1) Strip in-sentence "para [Audiencia/cargo]" tails that delatan plantilla.
  let cleaned = text
    .replace(/\s+(?:que\s+)?conviene\s+leer\s+con\s+prioridad\s+para\s+[^.;]+(?=[.;]|$)/gi, " que define el encuadre dominante de la ventana monitoreada")
    .replace(/\s+(?:y\s+)?(?:que\s+)?(?:resulta|es)\s+(?:de\s+especial\s+)?relevante\s+para\s+[^.;]+(?=[.;]|$)/gi, "")
    .replace(/\s+(?:lo\s+que\s+)?(?:le\s+)?importa\s+a\s+[^.;]+(?=[.;]|$)/gi, "")
    .replace(/\s+para\s+(?:el|la)\s+(?:Director(?:a)?(?:\s+\w+){0,3}|Gerente(?:\s+\w+){0,3}|CEO|CMO|CCO|COO|equipo\s+\w+|área\s+\w+)(?=[.;]|$)/gi, "");

  // 2) Strip generic meta-closing sentences entirely.
  const genericTailPatterns = [
    /^(para que este dato sea accionable|conviene cruzar|conviene contrastar|la pregunta operativa es|el paso siguiente es|esto ayuda a|esto permite|sirve para|lo cual debe leerse|para la lectura estratégica|en términos estratégicos|estratégicamente,? la recurrencia|esta combinación aumenta la probabilidad|esta proporción es el insumo|este reparto (es el insumo|sirve como insumo|funciona como insumo)|sirve como insumo base|cuando aparecen términos no previstos|hay que revisar si el enfoque)/i,
  ];

  const sentences = splitSentences(cleaned);
  while (
    sentences.length > 2 &&
    genericTailPatterns.some((pattern) => pattern.test(sentences[sentences.length - 1]))
  ) {
    sentences.pop();
  }

  return sentences.join(" ").replace(/\s+/g, " ").trim();
}

// Corrige porcentajes inventados de sentimiento en texto narrativo.
// Si el modelo escribe "51.7% positivo" pero el real es 34.9%, lo reemplaza.
function sanitizeSentimentPercents(
  text: string | undefined | null,
  m: { totalMentions: number; positiveCount: number; negativeCount: number; neutralCount: number } | undefined,
): string | undefined {
  if (!text) return text ?? undefined;
  if (!m || !m.totalMentions) return text;
  const total = m.totalMentions;
  const posPct = (m.positiveCount / total) * 100;
  const negPct = (m.negativeCount / total) * 100;
  const neuPct = (m.neutralCount / total) * 100;
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace(/\.0$/, "");

  // Patrón: número% (palabras opcionales) (positiv|negativ|neutral)
  const re = /(\d{1,3}(?:[.,]\d+)?)\s*%(\s+(?:de\s+)?(?:sentimiento\s+|menciones\s+|tono\s+|cobertura\s+)?)(positiv\w*|negativ\w*|neutral\w*)/gi;
  let out = text.replace(re, (full, num: string, mid: string, label: string) => {
    const v = parseFloat(num.replace(",", "."));
    const lbl = label.toLowerCase();
    const verified = lbl.startsWith("positiv") ? posPct : lbl.startsWith("negativ") ? negPct : neuPct;
    if (!Number.isFinite(v)) return full;
    if (Math.abs(v - verified) <= 2) return full; // tolerancia ±2pp
    return `${fmt(verified)}%${mid}${label}`;
  });

  // Patrón inverso: (positiv|negativ|neutral) ... número%
  const re2 = /(positiv\w*|negativ\w*|neutral\w*)(\s+(?:representa|equivale a|alcanza|asciende a|llega a|es de|del?\s+)?\s*)(\d{1,3}(?:[.,]\d+)?)\s*%/gi;
  out = out.replace(re2, (full, label: string, mid: string, num: string) => {
    const v = parseFloat(num.replace(",", "."));
    const lbl = label.toLowerCase();
    const verified = lbl.startsWith("positiv") ? posPct : lbl.startsWith("negativ") ? negPct : neuPct;
    if (!Number.isFinite(v)) return full;
    if (Math.abs(v - verified) <= 2) return full;
    return `${label}${mid}${fmt(verified)}%`;
  });

  return out;
}

// Sanitiza cifras "N menciones" / "N mención" cuando refieren a un término del Enfoque.
// - Si en el contexto cercano (±220 chars) aparece un término de CONTEOS VERIFICADOS y el número
//   se desvía >max(5, 30%) del conteo verificado → reemplaza por el verificado.
// - Si el número NO equivale al total ni a sub-totales conocidos y no hay término verificado en el
//   contexto pero sí hay nombres propios del Enfoque (knownProperNames), neutraliza a "varias menciones".
function sanitizeMentionCounts(
  text: string | undefined | null,
  verified: Array<{ term: string; count: number }>,
  totals: { total: number; positive: number; negative: number; neutral: number },
  knownProperNames: string[],
  allowedExtra: number[] = [],
): string | undefined {
  if (!text) return text ?? undefined;
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const allowedExact = new Set<number>([
    totals.total, totals.positive, totals.negative, totals.neutral,
    ...allowedExtra,
  ].filter((n) => n > 0));
  const verifiedNums = new Set<number>(verified.map((v) => v.count).filter((n) => n > 0));

  const re = /(\d{1,4})\s+(menciones|mención|menciónes)\b/gi;
  return text.replace(re, (full, numStr: string, word: string, offset: number) => {
    const num = parseInt(numStr, 10);
    if (!Number.isFinite(num)) return full;
    const ctxStart = Math.max(0, offset - 220);
    const ctxEnd = Math.min(text!.length, offset + 220);
    const ctxNorm = normalize(text!.slice(ctxStart, ctxEnd));

    // 0) Cifra > universo total → alucinación clara. Capear al total real.
    if (totals.total > 0 && num > totals.total) {
      const w = totals.total === 1 ? "mención" : "menciones";
      return `${totals.total} ${w}`;
    }

    // 1) Buscar término verificado en contexto y comparar
    let bestMatch: { term: string; count: number } | null = null;
    for (const v of verified) {
      const tn = normalize(v.term);
      if (tn.length >= 4 && ctxNorm.includes(tn)) {
        if (!bestMatch || tn.length > normalize(bestMatch.term).length) bestMatch = v;
      }
    }
    if (bestMatch) {
      const tolerance = Math.max(5, Math.round(bestMatch.count * 0.3));
      if (Math.abs(num - bestMatch.count) > tolerance) {
        const w = bestMatch.count === 1 ? "mención" : "menciones";
        return `${bestMatch.count} ${w}`;
      }
      return full;
    }

    // 2) Coincide con totales/sub-totales/conteos auditados (plataforma, día, autor, fuente) → permitir.
    if (allowedExact.has(num) || verifiedNums.has(num)) return full;

    // 3) Nombre propio del Enfoque sin verificar en contexto → neutralizar.
    const hasUnverifiedProper = knownProperNames.some((p) => {
      const pn = normalize(p);
      return pn.length >= 4 && ctxNorm.includes(pn);
    });
    if (hasUnverifiedProper && num >= 5) {
      return `varias ${word.toLowerCase().startsWith("menci") ? "menciones" : word}`;
    }

    // 4) Catch-all anti-alucinación: cualquier cifra ≥5 que no coincida con ningún conteo auditado se neutraliza.
    if (num >= 5) {
      return `varias ${word.toLowerCase().startsWith("menci") ? "menciones" : word}`;
    }
    return full;
  });
}

// Sanitiza cifras pegadas a un contexto categórico (plataforma o fecha).
// - "Facebook (89 menciones)" → verifica contra gtByPlatform.facebook; si no coincide, reemplaza o neutraliza.
// - "15 de mayo con 100 menciones" → verifica contra gtByDate de ese día; si no coincide, reemplaza.
// - Apertura tipo "se registraron N menciones" / "se contabilizaron N..." → fuerza el total real del universo.
function sanitizeContextualCounts(
  text: string | undefined | null,
  gtByPlatform: Record<string, number>,
  gtByDate: Record<string, number>,
  totalMentions: number,
): string | undefined {
  if (!text) return text ?? undefined;
  let out = text;

  // 1) Forzar el total del universo en frases de apertura ("se registraron/contabilizaron/documentaron/identificaron N menciones")
  if (totalMentions > 0) {
    const openingRe = /\b(se\s+(?:registraron|contabilizaron|documentaron|identificaron|detectaron|recopilaron|capturaron|monitorearon)\s+)(\d{1,5})(\s+menciones?\b)/gi;
    out = out.replace(openingRe, (_full, pre: string, num: string, post: string) => {
      const n = parseInt(num, 10);
      if (Number.isFinite(n) && n !== totalMentions) {
        const w = totalMentions === 1 ? " mención" : " menciones";
        return `${pre}${totalMentions}${post.replace(/\s+menciones?/i, w)}`;
      }
      return `${pre}${num}${post}`;
    });
  }

  // 2) Plataformas: "Facebook (N menciones)" o "Facebook con N menciones" o "en Facebook ... N menciones"
  const platformAliases: Record<string, string> = {
    facebook: "facebook",
    instagram: "instagram",
    twitter: "twitter",
    "x (twitter)": "twitter",
    "x/twitter": "twitter",
    tiktok: "tiktok",
    youtube: "youtube",
    reddit: "reddit",
    linkedin: "linkedin",
  };
  for (const [alias, key] of Object.entries(platformAliases)) {
    const real = gtByPlatform[key];
    if (typeof real !== "number") continue;
    // a) "Alias (N menciones)" o "Alias (N)"
    const reParen = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b\\s*\\(\\s*(\\d{1,5})\\s*(menciones?|posts?|publicaciones?)?\\s*\\)`, "gi");
    out = out.replace(reParen, (_full, num: string, word?: string) => {
      const n = parseInt(num, 10);
      if (Number.isFinite(n) && n !== real) {
        const w = word ? (real === 1 ? "mención" : "menciones") : "menciones";
        return `${alias.charAt(0).toUpperCase()}${alias.slice(1)} (${real} ${w})`;
      }
      return _full;
    });
    // b) "Alias con N menciones"
    const reCon = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b(\\s+(?:con|que\\s+suma|suma|concentra|acumula|registra)\\s+)(\\d{1,5})(\\s+menciones?\\b)`, "gi");
    out = out.replace(reCon, (_full, mid: string, num: string, post: string) => {
      const n = parseInt(num, 10);
      if (Number.isFinite(n) && n !== real) {
        const w = real === 1 ? " mención" : " menciones";
        return `${alias.charAt(0).toUpperCase()}${alias.slice(1)}${mid}${real}${post.replace(/\s+menciones?/i, w)}`;
      }
      return _full;
    });
  }

  // 3) Fechas españolas: "15 de mayo con 100 menciones" / "el 15 de mayo (100 menciones)" / "el 17 de mayo, 32 menciones"
  const MONTHS: Record<string, string> = {
    enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
    julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
  };
  const peakYear = (() => {
    const years = Object.keys(gtByDate).map((d) => d.slice(0, 4)).filter(Boolean);
    if (years.length === 0) return new Date().getFullYear().toString();
    const freq: Record<string, number> = {};
    for (const y of years) freq[y] = (freq[y] || 0) + 1;
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  })();
  const dateRe = /\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b([^.;:\n(]{0,80}?)(\(?\b(\d{1,5})\s+menciones?\b\)?)/gi;
  out = out.replace(dateRe, (full, day: string, month: string, between: string, tail: string, num: string) => {
    const mm = MONTHS[month.toLowerCase()];
    if (!mm) return full;
    const dd = day.padStart(2, "0");
    const iso = `${peakYear}-${mm}-${dd}`;
    const real = gtByDate[iso];
    const n = parseInt(num, 10);
    if (typeof real !== "number" || !Number.isFinite(n)) {
      // Día sin datos verificados pero el modelo cita una cifra → neutralizar
      if (Number.isFinite(n) && n >= 5) {
        return full.replace(tail, "varias menciones");
      }
      return full;
    }
    if (n !== real) {
      const w = real === 1 ? "mención" : "menciones";
      const replacement = tail.startsWith("(") ? `(${real} ${w})` : `${real} ${w}`;
      return full.replace(tail, replacement);
    }
    return full;
  });

  return out;
}

function clipAtWordBoundary(text: string, maxChars: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) return compact;
  const slice = compact.slice(0, maxChars);
  // Prefer ending at sentence boundary, then comma, then word boundary
  const lastSentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("; "), slice.lastIndexOf(": "));
  if (lastSentence >= maxChars * 0.5) return slice.slice(0, lastSentence).trim();
  const lastComma = slice.lastIndexOf(", ");
  if (lastComma >= maxChars * 0.5) return slice.slice(0, lastComma).trim();
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 0) return `${slice.slice(0, lastSpace).trim()}…`;
  return `${slice.trim()}…`;
}

function buildStrategicAnchor(options?: {
  knownCases?: string[];
  strategicFocus?: string;
  strategicContext?: string;
}): string {
  const raw = options?.knownCases?.[0] || options?.strategicFocus || options?.strategicContext || "";
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) return "el asunto priorizado por el proyecto";
  // Avoid truncating mid-word; if too long, fall back to a generic anchor
  if (compact.length > 90) {
    return "el asunto priorizado en el Enfoque Estratégico";
  }
  return options?.knownCases?.[0] ? `el caso ${compact}` : compact;
}

function buildShortAnchor(options?: {
  knownCases?: string[];
  strategicFocus?: string;
  strategicContext?: string;
}): string {
  // Lighter reference for variety: avoid repeating the full case in every bullet
  if (options?.knownCases?.[0] && options.knownCases[0].length <= 90) {
    return "el caso descrito en el Enfoque Estratégico";
  }
  return "el Enfoque Estratégico del proyecto";
}

function buildFallbackNarratives(mentions: Mention[]): NarrativeItem[] {
  // Build thematic clusters from frequent significant terms in titles/descriptions,
  // NOT from platform/domain. Falls back to a single generic narrative if signal is too weak.
  const STOP = new Set<string>([
    "el","la","los","las","un","una","unos","unas","de","del","al","a","y","o","u","e","que","qué","como","cómo",
    "con","sin","por","para","en","sobre","entre","hasta","desde","contra","bajo","tras","durante","mediante","según",
    "ante","es","son","fue","fueron","ser","está","están","estar","ha","han","muy","más","menos","ya","aún","aun",
    "tan","tanto","esto","esta","este","estos","estas","ese","esa","esos","esas","cuando","mientras","donde","quien",
    "cual","cuales","si","sí","no","ni","pero","aunque","porque","sino","luego","ahora","aquí","allí","cada","todo",
    "toda","todos","todas","otro","otra","otros","otras","mucho","mucha","muchos","muchas","sus","mi","tu","su",
    "the","a","an","of","in","on","for","and","or","to","from","by","with","is","are","was","were","be","been","this",
    "that","these","those","it","its","at","as","but","not",
  ]);

  type Cluster = { term: string; count: number; pos: number; neg: number; samples: string[] };
  const clusters = new Map<string, Cluster>();

  const addToken = (raw: string, mention: Mention) => {
    const term = raw.toLowerCase().replace(/[^a-záéíóúñü0-9 ]/gi, "").trim();
    if (!term || term.length < 4 || STOP.has(term) || /^\d+$/.test(term)) return;
    if (!clusters.has(term)) clusters.set(term, { term, count: 0, pos: 0, neg: 0, samples: [] });
    const c = clusters.get(term)!;
    c.count += 1;
    if (mention.sentiment === "positivo") c.pos += 1;
    if (mention.sentiment === "negativo") c.neg += 1;
    if (c.samples.length < 2) {
      const sample = (mention.title || mention.description || "").trim();
      if (sample && !c.samples.includes(sample)) c.samples.push(sample);
    }
  };

  for (const m of mentions) {
    const text = `${m.title || ""} ${m.description || ""}`;
    const words = text.split(/\s+/);
    // unigrams
    for (const w of words) addToken(w, m);
    // bigrams (more thematic)
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      const lc = bigram.toLowerCase();
      const tokens = lc.split(" ");
      if (tokens.some((t) => STOP.has(t.replace(/[^a-záéíóúñü0-9]/gi, "")))) continue;
      addToken(bigram, m);
    }
  }

  const ranked = Array.from(clusters.values())
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count);

  // Dedupe overlapping themes (keep larger n-gram if it contains a smaller one already taken)
  const picked: Cluster[] = [];
  for (const c of ranked) {
    if (picked.length >= 5) break;
    const overlaps = picked.some((p) => p.term.includes(c.term) || c.term.includes(p.term));
    if (!overlaps) picked.push(c);
  }

  if (picked.length < 4) {
    // Last-resort generic narrative — never platform-named
    const total = mentions.length;
    return [{
      narrative: "Conversación general sobre el caso monitoreado",
      description: `La muestra agrupa ${total} menciones sin un eje temático dominante claro; predomina cobertura informativa y reacciones dispersas.`,
      mentions: total,
      sentiment: "mixto",
      trend: "estable",
    }];
  }

  return picked.map((c) => ({
    narrative: `Eje temático: ${c.term}`,
    description: `Conjunto de menciones que giran alrededor de "${c.term}" (${c.count} apariciones). Ejemplos: ${c.samples.join("; ").slice(0, 220)}.`,
    mentions: c.count,
    sentiment: c.neg > c.pos ? "negativo" : c.pos > c.neg ? "positivo" : "mixto",
    trend: "estable",
  }));
}

function buildFallbackFindings(
  metrics: ReportContent["metrics"],
  mentions: Mention[],
  options?: {
    projectAudience?: string;
    strategicContext?: string;
    strategicFocus?: string;
    knownCases?: string[];
  },
): string[] {
  const sourceMap = new Map<string, { count: number; positive: number; negative: number; neutral: number }>();
  const authorMap = new Map<string, { count: number; platform: string; engagement: number; samples: string[] }>();
  const dayMap = new Map<string, { count: number; samples: Array<{ source: string; title: string; sentiment: string | null }> }>();
  const keywordMap = new Map<string, number>();

  for (const mention of mentions) {
    const source = mention.source_domain || "fuentes digitales";
    const sourceBucket = sourceMap.get(source) || { count: 0, positive: 0, negative: 0, neutral: 0 };
    sourceBucket.count += 1;
    if (mention.sentiment === "positivo") sourceBucket.positive += 1;
    if (mention.sentiment === "negativo") sourceBucket.negative += 1;
    if (mention.sentiment === "neutral") sourceBucket.neutral += 1;
    sourceMap.set(source, sourceBucket);

    const date = getPrimaryDate(mention);
    if (date) {
      const dayBucket = dayMap.get(date) || { count: 0, samples: [] };
      dayBucket.count += 1;
      if (dayBucket.samples.length < 3 && (mention.title || mention.description)) {
        dayBucket.samples.push({
          source: mention.source_domain || "fuente digital",
          title: (mention.title || mention.description || "").trim().slice(0, 110),
          sentiment: mention.sentiment,
        });
      }
      dayMap.set(date, dayBucket);
    }

    for (const keyword of mention.matched_keywords || []) {
      const cleanKeyword = keyword.trim();
      if (cleanKeyword.length >= 3) {
        keywordMap.set(cleanKeyword, (keywordMap.get(cleanKeyword) || 0) + 1);
      }
    }

    const meta = mention.raw_metadata || {};
    const authorName = (meta.author || meta.author_name || meta.authorName || meta.author_username || meta.authorUsername) as string | undefined;
    if (authorName) {
      const key = `${authorName}@@${source}`;
      // Interacciones reales: likes + comments + shares. Las views NO son interacciones (inflan en órdenes de magnitud videos virales antiguos como VEVO).
      const engagement = Number(meta.likes || 0) + Number(meta.comments || 0) + Number(meta.shares || 0);
      const authorBucket = authorMap.get(key) || { count: 0, platform: source, engagement: 0, samples: [] };
      authorBucket.count += 1;
      authorBucket.engagement += engagement;
      if (authorBucket.samples.length < 1 && (mention.title || mention.description)) {
        authorBucket.samples.push((mention.title || mention.description || "").trim().slice(0, 90));
      }
      authorMap.set(key, authorBucket);
    }
  }

  const sortedSources = Array.from(sourceMap.entries()).sort((a, b) => b[1].count - a[1].count);
  const sortedAuthors = Array.from(authorMap.entries()).sort((a, b) => b[1].engagement - a[1].engagement || b[1].count - a[1].count);
  const sortedDays = Array.from(dayMap.entries()).sort((a, b) => b[1].count - a[1].count);

  // Dedup keywords by normalized form (Zaga Tawil / zaga tawil / Rafael Zaga Tawil → keep canonical with highest count + longest variant)
  const normalizeKey = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const keywordGroups = new Map<string, { display: string; count: number }>();
  for (const [term, count] of keywordMap.entries()) {
    const norm = normalizeKey(term);
    // Group also by containment: if "Rafael Zaga Tawil" contains "Zaga Tawil", they share the longer key's normalized form
    let groupKey = norm;
    for (const existingKey of keywordGroups.keys()) {
      if (existingKey.includes(norm) || norm.includes(existingKey)) {
        groupKey = existingKey.length >= norm.length ? existingKey : norm;
        break;
      }
    }
    const existing = keywordGroups.get(groupKey);
    if (!existing) {
      keywordGroups.set(groupKey, { display: term, count });
    } else {
      // Prefer the longer / properly capitalized form as display
      const better = term.length > existing.display.length || (/^[A-ZÁÉÍÓÚÑ]/.test(term) && !/^[A-ZÁÉÍÓÚÑ]/.test(existing.display));
      if (better) existing.display = term;
      existing.count += count;
      // If we promoted a longer key, update map entry
      if (groupKey !== norm && norm.length > groupKey.length) {
        keywordGroups.delete(groupKey);
        keywordGroups.set(norm, existing);
      }
    }
  }
  const sortedKeywords = Array.from(keywordGroups.values())
    .sort((a, b) => b.count - a.count)
    .map((entry) => [entry.display, entry.count] as [string, number]);

  const negativeShare = metrics.totalMentions > 0 ? Math.round((metrics.negativeCount / metrics.totalMentions) * 100) : 0;
  const positiveShare = metrics.totalMentions > 0 ? Math.round((metrics.positiveCount / metrics.totalMentions) * 100) : 0;
  const neutralShare = metrics.totalMentions > 0 ? Math.round((metrics.neutralCount / metrics.totalMentions) * 100) : 0;
  const audienceLabel = options?.projectAudience?.trim() || "";
  void buildStrategicAnchor; void buildShortAnchor; // anchors retained as helpers; not used in current bullets

  const findings: string[] = [];

  void audienceLabel;
  const sentimentReadingClause = negativeShare >= 50
    ? `el periodo cierra con carga reputacional mayoritariamente adversa: la conversación pública se vuelve un terreno hostil que define el encuadre dominante de la ventana monitoreada`
    : negativeShare >= 30
      ? `el periodo presenta tono mixto con sesgo adverso, mezcla que suele preceder consolidaciones negativas si no se interviene en el encuadre`
      : `el tono adverso es minoritario y la conversación pública mantiene espacio editorial neutral o favorable que puede ser capitalizado`;
  findings.push(
    `Distribución de sentimiento: ${metrics.totalMentions} menciones en el periodo, ${metrics.negativeCount} negativas (${negativeShare}%), ${metrics.positiveCount} positivas (${positiveShare}%) y ${metrics.neutralCount} neutrales (${neutralShare}%). En lectura ejecutiva, ${sentimentReadingClause}.`
  );

  if (sortedSources.length > 0) {
    const topThree = sortedSources.slice(0, 3).map(([source, data]) => `${source} (${data.count})`).join(", ");
    const mainSource = sortedSources[0];
    const mainShare = metrics.totalMentions > 0 ? Math.round((mainSource[1].count / metrics.totalMentions) * 100) : 0;
    const mainNeg = mainSource[1].negative;
    const mainNegShare = mainSource[1].count > 0 ? Math.round((mainNeg / mainSource[1].count) * 100) : 0;
    const toneClause = mainNegShare >= 50
      ? `con tono mayoritariamente adverso dentro de ese canal (${mainNeg} de ${mainSource[1].count} negativas)`
      : mainNegShare >= 30
        ? `con presencia relevante de tono adverso en ese canal (${mainNeg} negativas de ${mainSource[1].count})`
        : `con tono mixto dentro de ese canal`;
    findings.push(
      `Concentración de cobertura: ${topThree}. ${mainSource[0]} concentra ${mainShare}% del volumen total ${toneClause}. Esto vuelve a ${mainSource[0]} el canal donde se está fijando primero la lectura pública del periodo, por encima de cualquier otra plataforma de la muestra.`
    );
  }

  // Voces con mayor tracción: solo si hay autores con tracción real (≥3 menciones o engagement ≥ 500)
  const TRACTION_MIN_MENTIONS = 3;
  const TRACTION_MIN_ENGAGEMENT = 500;
  const tractionAuthors = sortedAuthors.filter(([, data]) => data.count >= TRACTION_MIN_MENTIONS || data.engagement >= TRACTION_MIN_ENGAGEMENT).slice(0, 3);
  if (tractionAuthors.length > 0) {
    const topAuthors = tractionAuthors.map(([key, data]) => {
      const name = key.split("@@")[0];
      const engPart = data.engagement >= 100 ? `; ${data.engagement.toLocaleString()} interacciones acumuladas` : "";
      return `${name} en ${data.platform} (${data.count} ${data.count === 1 ? "publicación" : "publicaciones"}${engPart})`;
    }).join("; ");
    const totalEng = tractionAuthors.reduce((acc, [, d]) => acc + d.engagement, 0);
    const engClause = totalEng >= 1000
      ? `Estas cuentas concentran ${totalEng.toLocaleString()} interacciones en la muestra, por lo que un encuadre adverso en cualquiera de ellas escala más por capacidad de arrastre del emisor que por volumen disperso.`
      : `Su peso viene del volumen propio de publicaciones más que del engagement, lo que las vuelve emisores recurrentes a vigilar en futuras ventanas.`;
    findings.push(
      `Voces con tracción medible: ${topAuthors}. ${engClause}`
    );
  }

  if (sortedDays.length > 0) {
    const [peakDay, peakData] = sortedDays[0];
    const peakShare = metrics.totalMentions > 0 ? Math.round((peakData.count / metrics.totalMentions) * 100) : 0;
    const sampleClause = peakData.samples.length > 0
      ? ` Entre lo publicado ese día destacan piezas como "${peakData.samples[0].title}" en ${peakData.samples[0].source}${peakData.samples[1] ? ` y "${peakData.samples[1].title}" en ${peakData.samples[1].source}` : ""}.`
      : "";
    const driverClause = peakShare >= 30
      ? `La concentración indica un detonador puntual y no un crecimiento sostenido: esa jornada funciona como punto de máxima exposición acumulada del periodo.`
      : `El día concentra el volumen más alto del periodo aunque sin formar una crisis sostenida, lo que sugiere un evento detonador acotado.`;
    findings.push(
      `Pico de actividad: ${peakDay} con ${peakData.count} menciones (${peakShare}% del total).${sampleClause} ${driverClause}`
    );
  }

  if (sortedKeywords.length > 0) {
    const topTerms = sortedKeywords.slice(0, 5).map(([term, count]) => `${term} (${count})`).join(", ");
    findings.push(
      `Términos más reiterados: ${topTerms}. Estos son los marcos concretos que están estructurando el encuadre de la conversación más allá de titulares aislados; la reiteración indica que el periodo quedó anclado a estos nombres y conceptos, no a hechos puntuales dispersos.`
    );
  }

  if (sortedSources.length > 1) {
    const socialCount = mentions.filter((m) => {
      const source = (m.source_domain || "").toLowerCase();
      return ["twitter", "x.com", "facebook", "instagram", "tiktok", "youtube", "linkedin", "reddit"].some((token) => source.includes(token));
    }).length;
    const mediaCount = Math.max(0, mentions.length - socialCount);
    const socialShare = metrics.totalMentions > 0 ? Math.round((socialCount / metrics.totalMentions) * 100) : 0;
    const balanceClause = socialShare >= 70
      ? `El predominio de redes (${socialShare}%) indica que la exposición fue principalmente reactiva: conversación impulsada por usuarios, no por cobertura editorial estructurada. Esto eleva la velocidad pero baja la durabilidad del registro.`
      : mediaCount >= socialCount
        ? `El peso de medios digitales (${mediaCount} publicaciones) vuelve la exposición más durable porque deja huella verificable en archivos de prensa, frente a la volatilidad de redes.`
        : `La combinación equilibrada de ambos canales produjo tanto aceleración social como registro público persistente, doble carril que conviene leer por separado.`;
    findings.push(
      `Reparto entre redes sociales (${socialCount} menciones, ${socialShare}%) y medios digitales (${mediaCount}). ${balanceClause}`
    );
  }

   return normalizeTextList(findings.map(sanitizeFindingText)).slice(0, 8);
}

function buildFallbackRecommendations(metrics: ReportContent["metrics"], mentions: Mention[], perspective: AudiencePerspective = "external"): string[] {
  const dominantTone = metrics.negativeCount > metrics.positiveCount ? "predominio de tono adverso" : metrics.positiveCount > metrics.negativeCount ? "ventana de tono favorable" : "equilibrio inestable de tono";

  // Rank sources by volume (NOT order of appearance) and keep only those with material weight
  const sourceCounts = new Map<string, number>();
  for (const m of mentions) {
    const s = m.source_domain;
    if (!s) continue;
    sourceCounts.set(s, (sourceCounts.get(s) || 0) + 1);
  }
  const sortedByVolume = Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1]);
  const minMaterial = Math.max(2, Math.round(mentions.length * 0.03));
  const topSources = sortedByVolume.filter(([, c]) => c >= minMaterial).slice(0, 3).map(([s]) => s).join(", ");

  const socialCount = mentions.filter((m) => {
    const source = (m.source_domain || "").toLowerCase();
    return ["twitter", "x.com", "facebook", "instagram", "tiktok", "youtube", "linkedin", "reddit"].some((token) => source.includes(token));
  }).length;
  const mediaCount = Math.max(0, mentions.length - socialCount);

  const externalRecommendations = [
    `En el plazo inmediato, convendría construir una **postura propia** frente al ${dominantTone} observado, usando datos verificables y lenguaje público claro. La meta no es administrar la conversación desde una autoridad, sino participar con una voz reconocible en los temas que ya están captando atención. Esto permite entrar al debate sin depender del encuadre que impongan actores con mayor volumen inicial.`,
    `En las próximas **2 a 4 semanas**, se sugiere priorizar presencia en ${topSources || "los canales con mayor concentración de volumen"}. La decisión útil es identificar dónde se está formando opinión y concentrar ahí contenidos, voceros aliados y piezas breves de explicación pública. Para activistas, empresarios o actores ciudadanos, esa focalización evita dispersión y mejora capacidad de incidencia.`,
    `Dado que la conversación combina **${socialCount} menciones en redes sociales** y **${mediaCount} en medios digitales**, conviene separar tácticas por ecosistema durante el próximo mes. En redes, la prioridad es conversación, oportunidad y velocidad; en medios, contexto, argumentos verificables y permanencia del mensaje. Esa diferencia ayuda a participar sin tratar todos los espacios como si exigieran la misma respuesta.`,
    `Si el volumen adverso vuelve a concentrarse en pocos emisores o fechas críticas, podría convenir activar una red de **aliados y voces creíbles** antes de que el encuadre se consolide. La acción no sería pedir una reacción oficial, sino abrir conversación pública con testimonios, datos locales y argumentos compartibles. Este enfoque amplía presencia desde el espacio ciudadano y privado, sin asumir control sobre el debate.`,
    `En el horizonte de **2 a 4 semanas**, se sugiere aprovechar cualquier ventana neutral o positiva para introducir contexto propio sobre los temas con mayor interés público. La oportunidad está en sumar información útil, casos concretos y propuestas entendibles, no en sobreexponer una marca u organización. Para participantes externos, esa entrada gradual puede convertir escucha digital en presencia pública sostenida.`,
    `También convendría revisar semanalmente si los términos y narrativas más repetidos están cambiando de intensidad o solo reciclando el mismo encuadre. Esa lectura permite decidir cuándo publicar, cuándo sumar aliados y cuándo dejar que una conversación pierda fuerza por sí sola. La utilidad está en escoger momentos de participación, no en intentar controlar todo el debate.`,
  ];

  const observerRecommendations = [
    `En el plazo inmediato, convendría documentar qué temas sostienen el ${dominantTone} observado y cuáles solo aparecen como ruido periférico. La tarea principal es separar evidencia, volumen y actores antes de convertir la conversación en conclusiones públicas. Esto permite producir una lectura más rigurosa del periodo monitoreado.`,
    `En las próximas **2 a 4 semanas**, se sugiere contrastar ${topSources || "las fuentes con mayor concentración de volumen"} con otros espacios de conversación. La comparación ayuda a distinguir si el encuadre es amplio o si depende de pocos canales con alta actividad. Esa diferencia es clave para interpretar alcance real frente a visibilidad aparente.`,
    `Dado que la conversación combina **${socialCount} menciones en redes sociales** y **${mediaCount} en medios digitales**, conviene mantener análisis separado por tipo de fuente. Las redes muestran velocidad y reacción; los medios digitales dejan registro más estable y verificable. Separar ambos planos evita conclusiones sobredimensionadas.`,
    `Durante el próximo mes, podría convenir profundizar en los emisores y términos que más se repiten para identificar hipótesis de lectura más finas. La recomendación es documentar patrones, no intervenir en ellos. Esa disciplina analítica permite distinguir conversación orgánica, amplificación puntual y cobertura editorial.`,
    `También se sugiere actualizar semanalmente las narrativas dominantes para observar si el tema cambia de intensidad o mantiene el mismo marco. El valor está en construir una serie comparativa que muestre evolución, no solo una fotografía aislada. Esto mejora la capacidad de explicar la conversación pública con evidencia acumulada.`,
  ];

  const institutionalRecommendations = [
    `En el plazo inmediato, se sugiere definir una **postura rectora** para ordenar la respuesta pública ante el ${dominantTone} observado. La decisión no pasa por reaccionar a cada mención, sino por fijar un marco interpretativo consistente para mensajes y vocerías. Esto reduce contradicciones y evita que terceros impongan el sentido dominante del tema.`,
    `En las próximas **2 a 4 semanas**, podría convenir priorizar seguimiento ejecutivo sobre ${topSources || "las fuentes con mayor concentración de volumen"}. La oportunidad está en actuar sobre los espacios que realmente moldean percepción. Esta jerarquización permite asignar atención según incidencia real y no solo visibilidad aparente.`,
    `Dado que la conversación combina **${socialCount} menciones en redes sociales** y **${mediaCount} en medios digitales**, se recomienda diferenciar la lógica de gestión por canal durante el próximo mes. En redes, el foco debería estar en velocidad de lectura y escalamiento; en medios, en contextualización y precisión. Esta separación permite mitigar riesgo sin confundir ecosistemas distintos.`,
    `Conviene evaluar umbrales claros de escalamiento para los próximos días, especialmente si el volumen negativo vuelve a concentrarse en pocos emisores o fechas críticas. La decisión estratégica es anticipar cuándo un tema deja de ser monitoreable y exige coordinación más amplia. Ese criterio reduce improvisación y mejora tiempos de reacción.`,
    `En el horizonte de **2 a 4 semanas**, se sugiere capitalizar cualquier ventana neutral o positiva para reequilibrar el marco de conversación con mensajes verificables. La oportunidad no radica en sobreexponer, sino en introducir contexto suficiente para que la percepción pública no quede definida solo por vectores adversos.`,
  ];

  const recommendations = perspective === "institutional" ? institutionalRecommendations : perspective === "observer" ? observerRecommendations : externalRecommendations;

  return normalizeTextList(recommendations).slice(0, 7);
}

// Always generate full report; PDF trimming happens client-side
const MAX_TOKENS = 4200;

// Detect if entity names are semantically the same (different capitalizations/variations of the same name)
function areEntitiesDistinct(names: string[]): boolean {
  if (!names || names.length < 2) return false;
  
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const normalized = names.map(normalize);
  
  // Check pairwise Jaccard similarity on character trigrams
  const trigrams = (s: string): Set<string> => {
    const t = new Set<string>();
    for (let i = 0; i <= s.length - 3; i++) t.add(s.substring(i, i + 3));
    return t;
  };
  
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = trigrams(normalized[i]);
      const b = trigrams(normalized[j]);
      if (a.size === 0 || b.size === 0) continue;
      const intersection = new Set([...a].filter(x => b.has(x)));
      const union = new Set([...a, ...b]);
      const similarity = intersection.size / union.size;
      // If any pair is very similar (>0.6), they're likely the same entity
      if (similarity > 0.6) return false;
    }
  }
  return true;
}

function buildDetailedMentionAnalysis(mentions: Mention[]): string {
  const positive = mentions.filter(m => m.sentiment === "positivo");
  const negative = mentions.filter(m => m.sentiment === "negativo");
  const neutral = mentions.filter(m => m.sentiment === "neutral");

  const bySource: Record<string, Mention[]> = {};
  mentions.forEach(m => {
    const source = m.source_domain || "desconocido";
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(m);
  });

  const keywordCount: Record<string, number> = {};
  mentions.forEach(m => {
    m.matched_keywords?.forEach(k => {
      keywordCount[k] = (keywordCount[k] || 0) + 1;
    });
  });
  const topKeywords = Object.entries(keywordCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const authorMap: Record<string, { name: string; platform: string; count: number; engagement: number; sentiment: string[] }> = {};
  mentions.forEach(m => {
    const meta = m.raw_metadata;
    const authorName = (meta?.author || meta?.author_name || meta?.authorName || meta?.author_username || meta?.authorUsername) as string | undefined;
    if (!authorName) return;
    const key = `${authorName}@${m.source_domain || "unknown"}`;
    if (!authorMap[key]) {
      authorMap[key] = { name: authorName, platform: m.source_domain || "unknown", count: 0, engagement: 0, sentiment: [] };
    }
    authorMap[key].count++;
    if (m.sentiment) authorMap[key].sentiment.push(m.sentiment);
    const eng = ((meta?.likes as number) || 0) + ((meta?.comments as number) || 0) + ((meta?.shares as number) || 0);
    authorMap[key].engagement += eng;
  });
  const topAuthors = Object.values(authorMap).sort((a, b) => b.count - a.count).slice(0, 10);

  const byDate: Record<string, number> = {};
  mentions.forEach(m => {
    const date = (m.published_at || m.created_at || "").split("T")[0];
    if (date) byDate[date] = (byDate[date] || 0) + 1;
  });
  const sortedDates = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));

  let analysis = "ANÁLISIS DETALLADO DE MENCIONES:\n\n";

  analysis += "DISTRIBUCIÓN DE SENTIMIENTO:\n";
  analysis += `- Positivas: ${positive.length} (${(positive.length/mentions.length*100).toFixed(1)}%)\n`;
  analysis += `- Negativas: ${negative.length} (${(negative.length/mentions.length*100).toFixed(1)}%)\n`;
  analysis += `- Neutrales: ${neutral.length} (${(neutral.length/mentions.length*100).toFixed(1)}%)\n\n`;

  const sortedSources = Object.entries(bySource).sort((a, b) => b[1].length - a[1].length);
  analysis += "TOP FUENTES/MEDIOS:\n";
  sortedSources.slice(0, 8).forEach(([source, items]) => {
    const posCount = items.filter(i => i.sentiment === "positivo").length;
    const negCount = items.filter(i => i.sentiment === "negativo").length;
    analysis += `- ${source}: ${items.length} menciones (${posCount} pos, ${negCount} neg)\n`;
  });
  analysis += "\n";

  if (topAuthors.length > 0) {
    analysis += "INFLUENCIADORES / AUTORES PRINCIPALES:\n";
    topAuthors.forEach((a, i) => {
      const negCount = a.sentiment.filter(s => s === "negativo").length;
      const posCount = a.sentiment.filter(s => s === "positivo").length;
      analysis += `${i+1}. ${a.name} [${a.platform}]: ${a.count} menciones, ${a.engagement > 0 ? a.engagement.toLocaleString() + " interacciones, " : ""}${negCount > posCount ? "negativo" : posCount > negCount ? "positivo" : "mixto"}\n`;
    });
    analysis += "\n";
  }

  if (topKeywords.length > 0) {
    analysis += "KEYWORDS: " + topKeywords.map(([k, c]) => `"${k}"(${c})`).join(", ") + "\n\n";
  }

  if (sortedDates.length > 0) {
    analysis += "ACTIVIDAD POR DÍA:\n";
    sortedDates.forEach(([date, count]) => {
      analysis += `- ${date}: ${count}\n`;
    });
    analysis += "\n";
  }

  if (negative.length > 0) {
    analysis += "MUESTRA DE MENCIONES NEGATIVAS:\n";
    negative.slice(0, 8).forEach((m, i) => {
      const meta = m.raw_metadata;
      const author = (meta?.author || meta?.author_name || meta?.author_username || "") as string;
      analysis += `${i+1}. [${m.source_domain}]${author ? " " + author : ""}: ${(m.title || "").substring(0, 80)} — ${(m.description || "").substring(0, 200)}\n`;
    });
    analysis += "\n";
  }

  if (positive.length > 0) {
    analysis += "MUESTRA DE MENCIONES POSITIVAS:\n";
    positive.slice(0, 5).forEach((m, i) => {
      analysis += `${i+1}. [${m.source_domain}] ${(m.title || "").substring(0, 80)}: ${(m.description || "").substring(0, 150)}\n`;
    });
  }

  return analysis;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ANTHROPIC_API_KEY checked later before AI call

    const body: ReportRequest = await req.json();
    const { mentions, reportFormat = "full", projectName, projectAudience, projectObjective, strategicContext, strategicFocus, entityNames, dateRange } = body;
    const audiencePerspective = inferAudiencePerspective(projectAudience, projectObjective);

    if (!mentions || mentions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No mentions provided for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metrics = {
      totalMentions: mentions.length,
      positiveCount: mentions.filter(m => m.sentiment === "positivo").length,
      negativeCount: mentions.filter(m => m.sentiment === "negativo").length,
      neutralCount: mentions.filter(m => m.sentiment === "neutral").length,
      topSources: [...new Set(mentions.map(m => m.source_domain).filter(Boolean))].slice(0, 5) as string[],
    };

    // ===== GROUND TRUTH COUNTS sobre TODAS las menciones (no muestra) =====
    const gtByPlatform: Record<string, number> = {};
    const gtBySource: Record<string, number> = {};
    const gtByDate: Record<string, number> = {};
    const gtByAuthor: Record<string, number> = {};
    mentions.forEach((m) => {
      const src = (m.source_domain || "").toLowerCase();
      if (src) gtBySource[src] = (gtBySource[src] || 0) + 1;
      // Plataforma agregada (Facebook, Instagram, X/Twitter, TikTok, YouTube, Reddit, LinkedIn)
      let plat = "";
      if (src.includes("facebook")) plat = "facebook";
      else if (src.includes("instagram")) plat = "instagram";
      else if (src.includes("twitter") || src === "x.com" || src.endsWith(".x.com")) plat = "twitter";
      else if (src.includes("tiktok")) plat = "tiktok";
      else if (src.includes("youtube") || src.includes("youtu.be")) plat = "youtube";
      else if (src.includes("reddit")) plat = "reddit";
      else if (src.includes("linkedin")) plat = "linkedin";
      if (plat) gtByPlatform[plat] = (gtByPlatform[plat] || 0) + 1;
      const d = (m.published_at || m.created_at || "").split("T")[0];
      if (d) gtByDate[d] = (gtByDate[d] || 0) + 1;
      const meta = m.raw_metadata as Record<string, unknown> | null;
      const author = (meta?.author || meta?.author_name || meta?.authorName || meta?.author_username || meta?.authorUsername) as string | undefined;
      if (author) gtByAuthor[author] = (gtByAuthor[author] || 0) + 1;
    });
    const gtDates = Object.entries(gtByDate).sort((a, b) => b[1] - a[1]);
    const gtPlatforms = Object.entries(gtByPlatform).sort((a, b) => b[1] - a[1]);
    const gtSources = Object.entries(gtBySource).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const gtAuthors = Object.entries(gtByAuthor).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const peakEntry = gtDates[0];

    const allowedExtraCounts: number[] = [
      ...Object.values(gtByPlatform),
      ...Object.values(gtBySource),
      ...Object.values(gtByDate),
      ...Object.values(gtByAuthor),
    ];

    const volumeTruthBlock = `\n=== VOLUMEN VERIFICADO (HECHOS AUDITABLES — USAR LITERALMENTE) ===\nTotal del universo monitoreado: ${metrics.totalMentions} menciones (esta cifra es el TECHO ABSOLUTO; ninguna sub-cifra puede ser mayor).\nOBLIGATORIO en 'summary' y en el primer keyFinding: abrir la oración de volumen citando EXACTAMENTE "${metrics.totalMentions} menciones" (no 58, no otra cifra). PROHIBIDO escribir "se registraron N menciones" con un N distinto a ${metrics.totalMentions}.\n${peakEntry ? `Pico diario REAL: ${peakEntry[0]} con ${peakEntry[1]} menciones. PROHIBIDO afirmar que otro día tuvo más, o que el pico tuvo un número distinto.\n` : ""}${gtDates.slice(0, 5).length > 0 ? `Top 5 días por volumen REAL (usar literalmente al describir picos o evolución):\n${gtDates.slice(0, 5).map(([d, c]) => `  - ${d}: ${c} menciones`).join("\n")}\n` : ""}${gtPlatforms.length > 0 ? `Conteo REAL por plataforma social (universo completo). Cuando cites "Facebook (N menciones)" o equivalente, N DEBE ser exactamente el listado:\n${gtPlatforms.map(([p, c]) => `  - ${p}: ${c}`).join("\n")}\n` : ""}${gtSources.length > 0 ? `Top fuentes/dominios (universo completo):\n${gtSources.map(([s, c]) => `  - ${s}: ${c}`).join("\n")}\n` : ""}REGLA: cualquier afirmación con "N menciones" que NO coincida con alguno de los conteos listados arriba (o con los CONTEOS VERIFICADOS de términos del Enfoque) está PROHIBIDA. Usa lenguaje cualitativo en su lugar ("varias menciones", "presencia recurrente"). PROHIBIDO especialmente: pegar una cifra de un día/plataforma a otro día/plataforma distinto.\n`;

    // ===== SEÑALES DE AMPLIFICACIÓN (para calibrar severidad) =====
    const TIER1_DOMAINS = /(nytimes|washingtonpost|reuters|bloomberg|wsj|ft\.com|bbc|cnn|elpais|elmundo|reforma|eluniversal|milenio|jornada|excelsior|proceso|animalpolitico|aristegui|infobae|expansion|forbes|economista|elfinanciero|sdpnoticias|televisa|tvazteca|heraldodemexico)/i;
    let totalEngagement = 0;
    let maxAuthorEngagement = 0;
    let tier1Mentions = 0;
    const authorAgg: Record<string, number> = {};
    mentions.forEach(m => {
      const meta = m.raw_metadata as Record<string, unknown> | null;
      const eng = (Number(meta?.likes) || 0) + (Number(meta?.comments) || 0) + (Number(meta?.shares) || 0);
      totalEngagement += eng;
      const author = (meta?.author || meta?.author_name || meta?.authorUsername || meta?.author_username) as string | undefined;
      if (author) {
        authorAgg[author] = (authorAgg[author] || 0) + eng;
        if (authorAgg[author] > maxAuthorEngagement) maxAuthorEngagement = authorAgg[author];
      }
      if (m.source_domain && TIER1_DOMAINS.test(m.source_domain)) tier1Mentions++;
    });
    // Calibración de severidad: SEVERA exige amplificación demostrable, no solo % negativo.
    let severityLevel: "monitoreo" | "atencion" | "potencialmente_critica" | "severa" = "monitoreo";
    if (totalEngagement >= 50000 || maxAuthorEngagement >= 20000 || tier1Mentions >= 5) severityLevel = "severa";
    else if (totalEngagement >= 10000 || maxAuthorEngagement >= 5000 || tier1Mentions >= 2) severityLevel = "potencialmente_critica";
    else if (totalEngagement >= 2000 || maxAuthorEngagement >= 1000 || tier1Mentions >= 1 || metrics.totalMentions >= 100) severityLevel = "atencion";

    const amplificationBlock = `\n=== SEÑALES DE AMPLIFICACIÓN MEDIDAS ===\n- Engagement total acumulado (likes+comentarios+shares): ${totalEngagement.toLocaleString()}\n- Engagement máximo concentrado en un autor: ${maxAuthorEngagement.toLocaleString()}\n- Menciones en medios tier-1 (cobertura editorial amplia): ${tier1Mentions}\n- Volumen total: ${metrics.totalMentions} menciones\n- NIVEL DE SEVERIDAD CALIBRADO (USO OBLIGATORIO PARA INTERPRETAR EL CASO): ${severityLevel.toUpperCase().replace("_", " ")}\n`;

    const detailedAnalysis = buildDetailedMentionAnalysis(mentions.slice(0, 120)) + amplificationBlock + volumeTruthBlock;

    const mentionsSummary = mentions.slice(0, 20).map(m => ({
      title: m.title,
      description: m.description?.substring(0, 140),
      source: m.source_domain,
      sentiment: m.sentiment,
      keywords: m.matched_keywords?.join(", "),
      date: (m.published_at || m.created_at)?.split('T')[0],
      author: (m.raw_metadata?.author || m.raw_metadata?.author_name || m.raw_metadata?.authorUsername || null) as string | null,
    }));

    // Always generate full report
    const hasDistinctEntities = entityNames && entityNames.length >= 2 && areEntitiesDistinct(entityNames);

    // ===== PRE-EXTRACCIÓN DE CASOS/HECHOS CONOCIDOS DEL ENFOQUE ESTRATÉGICO =====
    const extractKnownCases = (text: string): string[] => {
      if (!text) return [];
      const cases: string[] = [];
      // Capture full clauses up to sentence/clause boundary, NOT mid-word
      const patterns = [
        /\blitigio[s]?\s+(?:con|contra|de|entre)\s+[^.;,\n]{3,140}/gi,
        /\bcaso\s+[A-ZÁÉÍÓÚÑ][^.;,\n]{3,120}/gi,
        /\bdisputa[s]?\s+(?:con|contra|de)\s+[^.;,\n]{3,120}/gi,
        /\bdemanda[s]?\s+(?:de|contra|por)\s+[^.;,\n]{3,120}/gi,
        /\bcontroversia[s]?\s+(?:con|sobre|de)\s+[^.;,\n]{3,120}/gi,
        /\binvestigaci[oó]n(?:es)?\s+(?:sobre|contra|de)\s+[^.;,\n]{3,120}/gi,
        /\bacusaci[oó]n(?:es)?\s+(?:de|contra|por)\s+[^.;,\n]{3,120}/gi,
        /\bfraude[s]?\s+(?:al|contra|a|de|por)\s+[^.;,\n]{3,120}/gi,
      ];
      const stopTail = /\b(de|la|el|los|las|un|una|unos|unas|del|al|en|con|por|para|y|o|que)$/i;
      for (const re of patterns) {
        let m;
        while ((m = re.exec(text)) !== null) {
          let clean = m[0].trim().replace(/\s+/g, " ");
          // Trim trailing stopwords/orphan articles to avoid "...mal manejo de un"
          while (stopTail.test(clean)) {
            clean = clean.replace(/\s+\S+$/, "").trim();
          }
          if (clean.length >= 12 && clean.length <= 140) cases.push(clean);
        }
      }
      const properNouns = text.match(/\b[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+){0,3}\b/g) || [];
      const filtered = [...new Set(properNouns)].filter(n => n.length > 4).slice(0, 15);
      return [...new Set([...cases, ...filtered])];
    };

    const knownCases = extractKnownCases(`${strategicContext || ''} ${strategicFocus || ''}`);

    // ===== PRE-CONTEO DETERMINÍSTICO DE TÉRMINOS CANÓNICOS =====
    // Contamos sobre TODO el universo de menciones cuántas contienen cada término clave
    // (casos conocidos + entidades). Este conteo es la VERDAD AUDITABLE; la IA no puede inventar números.
    const extractCanonicalTerms = (cases: string[], entities: string[] | undefined): string[] => {
      const terms = new Set<string>();
      // De cada "caso conocido" extraer el sustantivo propio principal (parte después de la preposición)
      for (const c of cases) {
        // Tomar la última secuencia capitalizada significativa
        const propers = c.match(/\b[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+){0,2}\b/g) || [];
        propers.forEach(p => { if (p.length >= 4) terms.add(p.trim()); });
      }
      (entities || []).forEach(e => { if (e && e.length >= 3) terms.add(e.trim()); });
      return [...terms];
    };

    const normalizeForMatch = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const countMentionsForTerm = (term: string): number => {
      const needle = normalizeForMatch(term);
      // Escapar regex y construir matcher con límite de palabra cuando aplique
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      let count = 0;
      for (const m of mentions) {
        const haystack = normalizeForMatch(`${m.title || ""} ${m.description || ""} ${(m.matched_keywords || []).join(" ")}`);
        if (re.test(haystack)) count++;
      }
      return count;
    };

    const canonicalTerms = extractCanonicalTerms(knownCases, entityNames);
    const rawVerified: Array<{ term: string; count: number }> = canonicalTerms
      .map(t => ({ term: t, count: countMentionsForTerm(t) }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);

    // Dedup: collapse case/accent variants AND substring containment (e.g. "Zaga Tawil" ⊂ "Rafael Zaga Tawil").
    const verifiedCounts: Array<{ term: string; count: number }> = [];
    for (const candidate of rawVerified) {
      const candNorm = normalizeForMatch(candidate.term);
      const existingIdx = verifiedCounts.findIndex(v => {
        const vn = normalizeForMatch(v.term);
        return vn === candNorm || vn.includes(candNorm) || candNorm.includes(vn);
      });
      if (existingIdx === -1) {
        verifiedCounts.push(candidate);
      } else {
        const existing = verifiedCounts[existingIdx];
        const preferCandidate = candidate.term.length > existing.term.length;
        verifiedCounts[existingIdx] = {
          term: preferCandidate ? candidate.term : existing.term,
          count: Math.max(existing.count, candidate.count),
        };
      }
    }
    verifiedCounts.sort((a, b) => b.count - a.count);

    let strategicBlock = "";
    if (strategicContext || strategicFocus) {
      strategicBlock = "\n=== CONTEXTO ESTRATÉGICO (FUENTE CANÓNICA DE VERDAD) ===\n";
      if (strategicContext) strategicBlock += `CONTEXTO DEL PROYECTO: ${strategicContext}\n`;
      if (strategicFocus) strategicBlock += `ENFOQUE ESPECÍFICO: ${strategicFocus}\n`;
      if (knownCases.length > 0) {
        strategicBlock += `\nCASOS/HECHOS/ENTIDADES CONOCIDOS YA DESCRITOS EN EL ENFOQUE (NO recategorizar como "nuevos"):\n${knownCases.map(c => `  - ${c}`).join('\n')}\n`;
      }
      if (verifiedCounts.length > 0) {
        strategicBlock += `\n=== CONTEOS VERIFICADOS (HECHOS AUDITABLES — USAR LITERALMENTE) ===\n`;
        strategicBlock += `Estos conteos provienen de un escaneo determinístico sobre las ${mentions.length} menciones del universo (no muestra). Son la ÚNICA fuente válida de cifras de cobertura por término:\n`;
        verifiedCounts.forEach(v => {
          strategicBlock += `  - "${v.term}": ${v.count} mención(es) en el universo total\n`;
        });
        strategicBlock += `\nREGLAS DE USO DE CONTEOS:\n`;
        strategicBlock += `  1. Si una narrativa se refiere a un término listado, DEBES usar EXACTAMENTE el conteo verificado correspondiente — no estimes ni redondees a partir de la muestra.\n`;
        strategicBlock += `  2. Si un término NO aparece en esta lista, NO inventes un número específico: usa lenguaje cualitativo ("varias menciones", "presencia recurrente", "porción minoritaria de la conversación").\n`;
        strategicBlock += `  3. PROHIBIDO afirmar "una sola mención", "solo X menciones" o cualquier cifra exacta para términos no listados aquí.\n`;
      } else {
        strategicBlock += `\n=== SIN CONTEOS VERIFICADOS DISPONIBLES ===\nNO uses cifras exactas para casos del Enfoque Estratégico. Usa lenguaje cualitativo: "varias menciones", "presencia recurrente", "porción minoritaria".\n`;
      }
      strategicBlock += `\nIMPORTANTE: Usa este contexto para INTERPRETAR el sentimiento. Lo negativo hacia un actor externo puede ser positivo para el cliente. Evalúa cada hallazgo según cómo impacta a la marca/entidad principal en este contexto.\n`;
      strategicBlock += `\n=== LENTE DEL DESTINATARIO (USO INTERNO, NO LITERAL) ===\nEl reporte se entrega a un perfil tipo: ${projectAudience}.\nObjetivo del monitoreo: ${projectObjective}.\nEsta lente se usa para PRIORIZAR qué dato merece ser hallazgo y cómo interpretarlo. NO debe aparecer literalmente en los textos.\n- PROHIBIDO TERMINANTE escribir frases tipo "para ${projectAudience}", "relevante para ${projectAudience}", "que conviene leer con prioridad para [cargo/audiencia]", "esto le importa a [cargo]". Son fórmulas que delatan plantilla y deben suprimirse: el texto debe demostrar la relevancia con el contenido, no nombrarla.\n- En lugar de nombrar la audiencia, ESCRIBE COMO si te dirigieras a ella directamente: tono ejecutivo, tercera persona, sin meta-comentarios sobre quién leerá esto.\n- ANCLAJE REAL AL ENFOQUE: cuando un hallazgo se conecte al Enfoque Estratégico, debe nombrar literalmente el caso, actor, riesgo u oportunidad descrito en el Enfoque (palabras concretas del bloque ENFOQUE ESPECÍFICO). NO basta con escribir la frase "Enfoque Estratégico" como etiqueta; eso se considera anclaje vacío.\n- OBLIGATORIO: al menos 5 de los 6-8 hallazgos deben citar nominalmente un elemento textual del CONTEXTO o del ENFOQUE (caso, actor, tema, riesgo u oportunidad listada arriba). No basta con citar la marca/entidad genéricamente ni con repetir el rótulo "Enfoque Estratégico".\n- OBLIGATORIO: al menos 4 de las 5-7 recomendaciones deben articularse en función de un elemento textual del Enfoque (mitigar el riesgo X nombrado, capitalizar la oportunidad Y nombrada, anticipar escalamiento del caso Z conocido). Una recomendación que no se conecte al Enfoque debe omitirse.\n- OBLIGATORIO en 'summary' e 'impactAssessment': abrir explicando qué significa el periodo monitoreado para el caso/actor del Enfoque (no nombrar audiencia ni cargo), no solo describir métricas.\n- PROHIBIDO entregar hallazgos/recomendaciones genéricos de "mejores prácticas de comunicación" desconectados del Enfoque. Si el dato no se puede leer en clave del Enfoque, no es material para este reporte.\n`;
    }

    const formatInstructions = `FORMATO: Reporte COMPLETO (4-6 páginas A4). Sé exhaustivo y detallado.
- summary: 5-8 oraciones
- keyFindings: OBLIGATORIO entre 6 y 8 hallazgos. Cada hallazgo debe tener entre 3 y 5 oraciones (aprox. 350-550 caracteres) y seguir esta estructura interna: (1) QUÉ se observó con cifra/auditoría, (2) DÓNDE/QUIÉN lo dice (medio, autor, plataforma específica), (3) IMPLICACIÓN concreta sobre el caso/actor/riesgo del Enfoque (nombrándolo literalmente, no como etiqueta "Enfoque Estratégico"). Al menos 5 de los hallazgos deben mencionar nominalmente un elemento textual del Enfoque (caso, actor, riesgo u oportunidad listada). PROHIBIDO TERMINANTE escribir "para ${projectAudience}", "relevante para [cargo]" o cualquier referencia a la audiencia o cargo destinatario: el cierre debe declarar la consecuencia con verbos y sujetos del propio caso (qué medio fija el encuadre, qué actor escala el riesgo, qué término ancla la asociación pública). Evita hallazgos genéricos, descriptivos o que solo repitan métricas globales. PROHIBIDO cerrar con frases meta o de trámite como "esto ayuda a...", "conviene cruzarlo...", "la pregunta operativa es...", "el paso siguiente es..." o equivalentes.
- recommendations: OBLIGATORIO entre 5 y 7 recomendaciones. Cada una con 3-4 oraciones (aprox. 380-600 caracteres) ESCRITA DESDE LA PERSPECTIVA DE LA AUDIENCIA REAL del reporte (ver bloque PERSPECTIVA DE LA AUDIENCIA más abajo). Debe responder: (a) DECISIÓN o acción concreta que la audiencia destinataria puede tomar dentro de su rol real —no asumir que es la institución monitoreada ni que tiene autoridad para intervenir oficialmente la conversación—, (b) por qué importa según un elemento nombrado del Enfoque, (c) PLAZO sugerido (inmediato / 2-4 semanas / mes), (d) actor/canal/ámbito sobre el que la audiencia tiene capacidad real de actuar (su propia vocería, contenidos, alianzas, presencia digital, espacios de incidencia pública). Al menos 4 de las recomendaciones deben referenciar explícitamente un elemento del Enfoque. Evita recomendaciones repetidas, genéricas, o que asuman que la audiencia es una autoridad pública, equipo interno de comunicación institucional o área de asuntos públicos cuando NO lo es.
- narratives: OBLIGATORIO entregar entre 4 y 5 narrativas. NUNCA menos de 4. Si dudas si una idea merece narrativa propia, sepárala antes que fusionarla — es preferible una narrativa secundaria que quedarse en 3.
- keywords: OBLIGATORIO entregar entre 18 y 25 términos clave (sustantivos, adjetivos calificativos, conceptos o nombres propios). Excluye terminantemente stopwords (artículos, preposiciones, conjunciones, pronombres, verbos auxiliares, números sueltos, palabras vacías). Ordena por relevancia/frecuencia descendente.
- conclusions: 3-5
- Cada insight interpretativo (timelineInsight, narrativesInsight, keywordsInsight, influencersInsight, mediaInsight, platformsInsight): 2-3 oraciones, máximo 320 caracteres.

ÉNFASIS TIPOGRÁFICO (OBLIGATORIO en summary, keyFindings, recommendations, conclusions y descripciones de narratives):
- Envuelve con **doble asterisco** las palabras o frases CLAVE que el lector debe captar de un vistazo: cifras y porcentajes con su unidad (p.ej. **62%**, **1,240 menciones**), nombres propios de actores/medios/voceros relevantes (p.ej. **Aristegui Noticias**, **Las Libres**), conceptos eje del hallazgo (p.ej. **encuadre adverso**, **riesgo reputacional**, **oportunidad de posicionamiento**) y verbos de implicación cuando definen la consecuencia (p.ej. **escala**, **consolida**, **fragmenta**).
- Marca entre **3 y 6 fragmentos por bullet/oración larga**, nunca más: el énfasis pierde valor si se abusa. No marques artículos, conectores ni frases enteras de más de 6 palabras.
- NO uses otros símbolos de markdown (sin _itálicas_, sin \`código\`, sin # encabezados, sin listas con guiones); solo **negritas** dentro del texto plano.`;

    const entityComparisonInstruction = hasDistinctEntities
      ? `\n"entityComparison": "string - Párrafo comparando volumen, sentimiento y cobertura entre las entidades: ${entityNames!.join(', ')}. Incluye share of voice y diferenciadores."`
      : "";

    const entityMergeBlock = entityNames && entityNames.length >= 2 && !hasDistinctEntities
      ? `\n=== ENTIDADES SINÓNIMAS / MISMO TEMA ===
Las entidades [${entityNames.join(", ")}] son variantes del MISMO sujeto/tema. NO las enumeres por separado en hallazgos, narrativas o recomendaciones.
- PROHIBIDO escribir frases tipo "La conversación sobre ${entityNames.slice(0,3).join(", ")}..." enumerándolas — se lee como redundancia.
- En su lugar usa el nombre canónico (el más breve y reconocible) o un descriptor único ("el sujeto monitoreado", "la figura analizada").
- Solo distingue entre ellas si hay una diferencia factual evidente en las menciones.\n`
      : "";

    const audiencePerspectiveInstruction = audiencePerspective === "institutional"
      ? `CLASIFICACIÓN DE AUDIENCIA: A) INSTITUCIONAL / VOCERÍA OFICIAL. Puede recomendar coordinación de vocería, respuesta institucional o gestión reputacional, siempre sin inventar áreas internas específicas.`
      : audiencePerspective === "observer"
        ? `CLASIFICACIÓN DE AUDIENCIA: C) OBSERVADOR / ANALISTA. NO interviene ni gestiona la conversación: documenta, contrasta fuentes, profundiza hipótesis y organiza evidencia.`
        : `CLASIFICACIÓN DE AUDIENCIA: B) PARTICIPANTE EXTERNO / SOCIEDAD CIVIL / ACTORES PRIVADOS. NO es autoridad, NO controla a la entidad monitoreada y NO gestiona la conversación oficial. Sus acciones posibles son: construir postura propia, publicar contenidos, sumar voceros aliados, abrir espacios de conversación, aportar datos, activar presencia digital y participar en el debate público.`;

    const systemPrompt = `Eres un ANALISTA SENIOR de inteligencia estratégica y monitoreo de medios.

TU AUDIENCIA: ${projectAudience}
OBJETIVO DEL MONITOREO: ${projectObjective}
${audiencePerspectiveInstruction}

PRINCIPIOS:
1. ESPECIFICIDAD: Usa nombres de fuentes, autores, fechas. Nunca "varias fuentes" o "algunos medios".
2. CUANTIFICACIÓN: Incluye números, porcentajes, comparaciones.
3. CONTEXTO ESTRATÉGICO: Usa el enfoque estratégico para INTERPRETAR el sentimiento — lo negativo hacia un actor externo puede ser positivo para el cliente.
4. ACCIONABILIDAD: Cada insight debe poder convertirse en una decisión concreta.
${entityMergeBlock}
=== REGLA CRÍTICA #1: LENGUAJE CAUTELOSO Y CIFRAS AUDITABLES ===
NUNCA hagas afirmaciones absolutas sobre la ausencia o presencia de información. Los datos que recibes son UNA MUESTRA textual, pero los CONTEOS VERIFICADOS abarcan el universo completo.
- PROHIBIDO: "No se identificaron menciones que...", "No existe evidencia de...", "No hay menciones que vinculen..."
- PROHIBIDO inventar cifras exactas ("una sola mención", "solo 3 menciones", "apenas 2 referencias", "fue mencionado en X ocasiones", "X menciones en el universo total de Y") para temas/términos que NO aparezcan en CONTEOS VERIFICADOS. Para esos casos usa lenguaje cualitativo: "varias menciones", "presencia recurrente", "porción minoritaria de la conversación", "cobertura puntual".
- PROHIBIDO construir frases del tipo "el término X fue mencionado en N ocasiones en el universo total de M menciones" salvo que TANTO N (para X) COMO M (total global del reporte = ${metrics.totalMentions}) estén respaldados: N debe estar en CONTEOS VERIFICADOS y M debe ser exactamente ${metrics.totalMentions}.
- PROHIBIDO derivar interpretaciones tipo "baja vinculación", "alta concentración" o porcentajes a partir de números que tú mismo inventes. Solo puedes hacerlo si los dos números (numerador y denominador) son auditables.
- OBLIGATORIO cuando exista CONTEO VERIFICADO: usa el número EXACTO listado, ni más ni menos. Ej: si "Actinver: 14" → escribe "14 menciones vinculadas a Actinver", nunca "1 mención" ni "varias decenas".
- OBLIGATORIO en general: "En la muestra analizada...", "Con base en los datos disponibles...", "De las ${metrics.totalMentions} menciones recopiladas...", "En el periodo y fuentes monitoreadas..."
- Si hay pocas menciones sobre un tema sin conteo verificado, di "se detectó baja presencia de este tema en la muestra" — NUNCA "no existe" ni cifres exacto.
- Cada hallazgo debe estar respaldado por datos concretos. No inventes ni extrapoles más allá de lo observable.

=== REGLA CRÍTICA #2: NO INVENTAR EVENTOS NUEVOS — ANCLAR AL ENFOQUE ESTRATÉGICO ===
El CONTEXTO ESTRATÉGICO y los CASOS/HECHOS CONOCIDOS listados arriba son la VERDAD CANÓNICA. Si una mención coincide temáticamente con un caso ya descrito, DEBES tratarla como parte de ese caso, NO como un evento independiente.
- PROHIBIDO usar adjetivos como "nuevo", "otro", "adicional", "segundo", "distinto", "emergente" o "separado" para describir hechos, fraudes, litigios, demandas, casos, controversias o investigaciones que ya estén mencionados o sean razonablemente subsumibles en el Enfoque Estratégico.
- PROHIBIDO inferir la existencia de eventos no documentados en las menciones (ej: "un nuevo fraude", "otra acusación") a partir de cobertura mediática que pueda referirse al mismo hecho ya conocido.
- OBLIGATORIO cuando una narrativa coincida con un caso conocido: referenciarla explícitamente con frases como "vinculada al [litigio/caso/disputa] descrito en el Enfoque Estratégico", "en el marco del caso ya documentado", "como parte de la cobertura del litigio referido en el contexto del proyecto".
- Ante AMBIGÜEDAD entre "es el mismo caso" vs "es un caso nuevo": SIEMPRE asume que es el mismo caso ya descrito en el Enfoque Estratégico, salvo que las menciones aporten evidencia explícita e inequívoca de un evento distinto (fechas, contrapartes y hechos diferentes claramente nombrados).
- Antes de calificar algo como "nuevo" o "adicional", verifica que NO esté listado en CASOS/HECHOS CONOCIDOS y que las menciones lo describan como un evento factualmente distinto.

=== REGLA CRÍTICA #3: NO INVENTAR ESTRUCTURA INTERNA NI ROLES DE LA ORGANIZACIÓN ===
Desconoces la estructura organizacional, áreas, direcciones, voceros oficiales y procesos internos de la marca/entidad monitoreada salvo que estén EXPLÍCITAMENTE mencionados en el CONTEXTO ESTRATÉGICO o en las menciones.
- PROHIBIDO nombrar áreas internas inventadas: "Dirección de Comunicación Corporativa", "Área de Asuntos Públicos", "Vocería oficial", "Equipo Legal", "Gerencia de Riesgos", "Departamento de Prensa", "Comité de Crisis", etc., a menos que aparezcan textualmente en el contexto o en las menciones.
- PROHIBIDO atribuir acciones, responsabilidades o liderazgo a roles/áreas no documentadas ("liderado por X", "coordinado desde Y", "bajo la responsabilidad de Z").
- PROHIBIDO inventar nombres propios de funcionarios, voceros o ejecutivos de la organización monitoreada.
- Si la audiencia NO está clasificada como A) institucional, también están PROHIBIDAS las fórmulas neutras institucionales: "área responsable", "organización", "vocería", "equipo a cargo", "áreas correspondientes". En esos casos escribe desde la capacidad real de participantes externos u observadores: voz propia, aliados, contenidos, datos, presencia digital, documentación o análisis.
- Lo mismo aplica a contrapartes (litigantes, autoridades, competidores): solo nómbralas si aparecen en menciones o contexto.

=== PERSPECTIVA DE LA AUDIENCIA (CRÍTICO PARA RECOMENDACIONES) ===
Antes de redactar recomendaciones, INFIERE qué tipo de audiencia es "${projectAudience}" combinado con el Objetivo "${projectObjective}" y clasifícala en UNA de estas perspectivas. La redacción cambia totalmente según la categoría:

A) INSTITUCIONAL / VOCERÍA OFICIAL (gobierno, marca, organización monitoreada, equipo de comunicación corporativa o de prensa): la audiencia controla una vocería oficial y puede emitir respuesta institucional. Recomendaciones tipo "definir postura rectora", "anticipar respuesta institucional", "coordinar vocería", "priorizar seguimiento ejecutivo". Tono: gestión de riesgo reputacional desde adentro.

B) PARTICIPANTE EXTERNO / SOCIEDAD CIVIL / ACTORES PRIVADOS (activistas, empresarios, candidatos, colectivos, ONG, líderes sociales, comunicadores independientes, analistas): la audiencia NO controla a la entidad monitoreada, NO puede ordenar respuesta institucional, NO es autoridad. SU rol es ENTRAR a la conversación pública desde su propia voz, contenidos, alianzas, agenda y presencia digital. Recomendaciones tipo "construir mensaje propio sobre el tema X", "identificar voceros aliados para amplificar postura Y", "abrir espacio de conversación sobre Z aprovechando el pico de interés", "participar en la discusión sobre W con datos propios", "establecer presencia en los canales donde se concentra el debate". PROHIBIDO sugerir "intervenir", "ordenar respuesta", "definir postura rectora", "coordinar vocería oficial", "involucrar al área de asuntos públicos/comunicación institucional" como si fueran la institución.

C) OBSERVADOR / ANALISTA / INVESTIGADOR (academia, prensa, consultoría, think tank): la audiencia documenta y analiza, no interviene. Recomendaciones tipo "profundizar análisis sobre", "documentar la evolución de", "contrastar con otras fuentes", "considerar nuevas hipótesis de lectura".

REGLA DURA: si la audiencia NO es claramente Categoría A, NUNCA escribas recomendaciones que asuman autoridad institucional sobre el tema/entidad monitoreada. NO uses fórmulas como "el área de comunicación estratégica", "el equipo a cargo de asuntos públicos", "la dirección responsable", "respuesta institucional", "postura rectora" salvo que estés seguro de estar en Categoría A. En B y C, las recomendaciones se dirigen a la audiencia como PARTICIPANTE del debate público, no como gestora del mismo.

Cada recomendación debe contestar, según la categoría: ¿Qué acción concreta puede tomar ESTA audiencia desde su rol real? ¿Qué riesgo evita o qué oportunidad captura DENTRO de su capacidad de acción? ¿En qué plazo? Mantén tono prudente: "se sugiere evaluar", "podría convenir", "convendría considerar".

EJEMPLOS DE TRADUCCIÓN (Categoría A → B):
- A: "Definir una postura rectora para ordenar la respuesta pública ante el tono adverso"
- B: "Construir una postura propia, basada en datos verificables, sobre los temas donde la conversación está dominada por encuadres adversos, para participar con voz propia en el debate público"
- A: "Anticipar respuesta institucional ante el escalamiento"
- B: "Anticipar la entrada al debate con mensajes y voceros propios antes de que el encuadre adverso se consolide entre los actores con mayor tracción digital"

=== REGLA CRÍTICA #4: CALIDAD EDITORIAL DE HALLAZGOS (ANTI-CLICHÉ) ===
Cada hallazgo será leído por un directivo que descartará el reporte si suena a plantilla. Aplica estas reglas SIN EXCEPCIÓN:
- PROHIBIDO llamar "tracción", "voces clave" o "amplificación" a cuentas con menos de 3 menciones o sin engagement medible (≥500 interacciones acumuladas en la muestra). Si los autores top tienen 1-2 menciones y bajo engagement, NO incluyas un bullet de "voces con tracción"; en su lugar, omite ese hallazgo o reformúlalo como "emisores recurrentes a vigilar" sin atribuirles peso real.
- PROHIBIDO escribir un bullet de "pico de actividad" SIN nombrar al menos un titular, autor o medio concreto que publicó ese día. El pico debe explicar QUÉ pasó, no solo cuándo.
- PROHIBIDO repetir la frase "Enfoque Estratégico" más de 2 veces en el conjunto de hallazgos. Varía: "el caso/asunto descrito en el contexto del proyecto", "lo que el proyecto definió como prioridad", "el ángulo estratégico del monitoreo", o nombra directamente el caso/actor cuando esté disponible. La repetición textual es una bandera roja editorial.
- PROHIBIDO cerrar bullets con frases descriptivas vacías tipo "la conversación no se reparte de forma homogénea", "esto debe leerse contra los riesgos del Enfoque", "lo cual es relevante para la lectura estratégica", "esta combinación aumenta la probabilidad de...", "este reparto sirve como insumo base para...". Cada cierre debe nombrar una CONSECUENCIA OBSERVABLE concreta (qué medio fija el encuadre, qué actor escala el riesgo, qué término ancla la asociación pública, qué jornada concentra exposición).
- PROHIBIDO repetir "tono adverso", "carga reputacional", "lectura pública" o "encuadre del periodo" en más del 50% de los hallazgos. Sustituye por verbos y sustantivos concretos: "el medio X fija la cobertura crítica", "el autor Y impulsa el ángulo de escrutinio", "el término Z reaparece en cada pieza".
- OBLIGATORIO: si un hallazgo describe un dato (volumen, %, autor, día, plataforma) DEBE seguir con qué decisión o vigilancia concreta se desprende, no con una repetición meta del marco estratégico.

=== REGLA CRÍTICA #5: CALIBRACIÓN DE SEVERIDAD (ANTI-ALARMISMO) ===
La gravedad de una situación reputacional NO se determina por el % de tono negativo aislado, sino por la combinación de volumen + AMPLIFICACIÓN MEDIBLE (engagement, alcance de influenciadores, cobertura tier-1). Usa OBLIGATORIAMENTE el NIVEL DE SEVERIDAD CALIBRADO entregado en SEÑALES DE AMPLIFICACIÓN MEDIDAS y respeta esta gramática:

- Si severidad = SEVERA → puedes escribir "crisis", "impacto reputacional severo", "escalamiento confirmado". Debes nombrar la fuente concreta de amplificación (autor X con N interacciones, o medio tier-1 Y).
- Si severidad = POTENCIALMENTE CRITICA → usa "situación potencialmente crítica", "riesgo reputacional latente", "encuadre adverso con potencial de escalamiento si se amplifica". PROHIBIDO escribir "crisis severa", "impacto severo", "crisis confirmada".
- Si severidad = ATENCION → usa "conversación negativa que conviene monitorear", "encuadre adverso acotado", "presencia crítica que aún no amplifica masivamente". PROHIBIDO escribir "crisis", "severo/severa", "escalamiento", "viralización confirmada".
- Si severidad = MONITOREO → usa "actividad baja con tono negativo predominante", "señal temprana", "ruido reputacional menor". PROHIBIDO usar el vocabulario de crisis.

REGLA ADICIONAL — VIRALIZACIÓN: NO afirmes que algo "se viralizó" o "tiene potencial viral" basándote solo en la presencia en TikTok o en el número de menciones. Una mención sin views/likes/shares NO es evidencia de viralización. Para usar "viral" debes citar una cifra concreta de views, shares o engagement ≥ 5,000 en al menos un post.

REGLA ADICIONAL — TONO NEGATIVO: 60-80% negativo en un universo pequeño (<100 menciones) sin amplificación describe "conversación de tono predominantemente negativo en un nicho acotado", NO una crisis. La crisis exige que ese tono ESTÉ AMPLIFICADO.

FORMATO: Español profesional, sin markdown ni asteriscos. Cita fuentes y autores específicos solo cuando aparezcan en las menciones.`;

    const userPrompt = `${formatInstructions}
${strategicBlock}
=== PROYECTO ===
PROYECTO: ${projectName}
PERIODO: ${dateRange.label} (${dateRange.start} a ${dateRange.end})
${entityNames?.length ? `ENTIDADES: ${entityNames.join(", ")}` : ""}

=== MÉTRICAS ===
Total: ${metrics.totalMentions} | Positivas: ${metrics.positiveCount} (${Math.round(metrics.positiveCount/metrics.totalMentions*100)}%) | Negativas: ${metrics.negativeCount} (${Math.round(metrics.negativeCount/metrics.totalMentions*100)}%) | Neutrales: ${metrics.neutralCount} (${Math.round(metrics.neutralCount/metrics.totalMentions*100)}%)

⚠️ CIFRAS DE SENTIMIENTO BLOQUEADAS: los únicos porcentajes válidos son los listados arriba (positivo ${Math.round(metrics.positiveCount/metrics.totalMentions*100)}%, negativo ${Math.round(metrics.negativeCount/metrics.totalMentions*100)}%, neutral ${Math.round(metrics.neutralCount/metrics.totalMentions*100)}% sobre ${metrics.totalMentions} menciones). PROHIBIDO inventar otros porcentajes (ej. "51.7% positivo" cuando el real es ${Math.round(metrics.positiveCount/metrics.totalMentions*100)}%) o mezclar "porcentajes de la muestra" con "porcentajes del universo": en este reporte la muestra ES el universo. Cualquier porcentaje de sentimiento que escribas debe coincidir EXACTAMENTE (±1pp) con los valores anteriores.
Fuentes: ${metrics.topSources.join(", ")}

${detailedAnalysis}

=== MUESTRA (${mentionsSummary.length} de ${mentions.length}) ===
${JSON.stringify(mentionsSummary, null, 2)}

=== RESPONDE EN JSON ===
{
  "title": "string - título profesional",
  "summary": "string - brief ejecutivo con hallazgos críticos, fuentes y números (5-8 oraciones, hasta ~900 caracteres)",
  "impactAssessment": "string - cómo los eventos afectan a la marca/entidad en el contexto estratégico",
  "sentimentAnalysis": "string - distribución de sentimiento y sus drivers, interpretado según el contexto estratégico (3-5 oraciones, hasta ~600 caracteres)",
  "timelineInsight": "string - 2-3 oraciones interpretando la evolución diaria: pico, caída, drivers del volumen. Máx 320 caracteres.",
  "narratives": [
    {
      "narrative": "string - nombre de la narrativa temática (ej: 'Cuestionamiento de transparencia')",
      "description": "string - qué dice, quién la promueve, en qué medios",
      "mentions": "number - OBLIGATORIO entero, NUNCA null ni vacío. Si no puedes calcular exacto, estima conservadoramente con base en la muestra.",
      "sentiment": "positivo | negativo | mixto",
      "trend": "creciente | decreciente | estable"
    }
  ],
  "narrativesInsight": "string - 2-3 oraciones explicando qué dice el conjunto de narrativas sobre la conversación pública. Máx 320 caracteres.",
  "keywords": [
    {
      "term": "string - palabra o término clave (1-3 palabras). NUNCA incluyas artículos, preposiciones, conjunciones, pronombres, verbos auxiliares ni stopwords. Ej válidos: 'litigio', 'transparencia financiera', 'bursátil'. Ej inválidos: 'el', 'de', 'que', 'para', 'con', 'una', 'son', 'fue', 'the', 'and', 'this'. Términos en español preferentemente, en minúscula salvo nombres propios.",
      "count": "number - entero ≥ 1. Frecuencia aproximada de aparición en la muestra; usa la heurística de la muestra y los CONTEOS VERIFICADOS si aplica.",
      "sentiment": "positivo | negativo | neutral | mixto - sentimiento dominante asociado al término en el corpus"
    }
  ],
  "keywordsInsight": "string - 2-3 oraciones interpretando los términos dominantes y qué revelan sobre el encuadre de la conversación. Máx 280 caracteres.",
  "influencersInsight": "string - 2-3 oraciones interpretando el peso de las voces top: concentración, tono dominante, riesgo/oportunidad. Máx 320 caracteres.",
  "mediaInsight": "string - 2-3 oraciones interpretando la cobertura editorial: tipo de medios (tier-1, especializados, regionales), encuadre dominante. Máx 320 caracteres.",
  "platformsInsight": "string - 2-3 oraciones explicando dónde se concentra la conversación y qué implica para la estrategia. Máx 320 caracteres.",${entityComparisonInstruction}
  "keyFindings": ["string - hallazgo de 3-5 oraciones con estructura QUÉ + DÓNDE/QUIÉN + IMPLICACIÓN ESTRATÉGICA, citando fuentes específicas y datos auditables. NUNCA un párrafo genérico ni una sola oración descriptiva."],
  "conclusions": ["string - conclusión ESTRATÉGICA integrando múltiples datos"],
  "recommendations": ["string - recomendación de 3-4 oraciones escrita DESDE LA PERSPECTIVA REAL de la audiencia (institucional, participante externo, u observador, según el bloque PERSPECTIVA DE LA AUDIENCIA). Debe articular acción concreta dentro del rol real de la audiencia + por qué importa (anclado al Enfoque) + plazo + ámbito de acción propio. PROHIBIDO asumir autoridad institucional o vocería oficial si la audiencia no la tiene. NUNCA tarea operativa de monitoreo."],
  "templates": {
    "executive": "string - 3-4 párrafos para directivos",
    "technical": "string - 3-4 párrafos para analistas",
    "public": "string - 2-3 párrafos con emojis para resumen público"
  }
}

SOBRE "narratives": Identifica OBLIGATORIAMENTE entre 4 y 5 NARRATIVAS TEMÁTICAS (ideas/argumentos recurrentes, NO keywords ni nombres propios). NUNCA entregues menos de 4. Si el ecosistema parece girar en torno a pocas ideas, descompón ángulos secundarios (encuadre mediático, reacción de audiencias, dimensión regulatoria, dimensión reputacional, presencia en redes vs prensa, etc.) hasta llegar a 4-5. Ordénalas por frecuencia. El campo "mentions" SIEMPRE debe ser un entero ≥ 1.`;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const reportToolSchema = {
      type: "object",
      additionalProperties: false,
      required: ["title", "summary", "keyFindings", "recommendations", "narratives", "templates"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        impactAssessment: { type: "string" },
        sentimentAnalysis: { type: "string" },
        timelineInsight: { type: "string" },
        narrativesInsight: { type: "string" },
        keywordsInsight: { type: "string" },
        influencersInsight: { type: "string" },
        mediaInsight: { type: "string" },
        platformsInsight: { type: "string" },
        entityComparison: { type: "string" },
        keyFindings: { type: "array", minItems: 6, maxItems: 8, items: { type: "string", minLength: 280 } },
        conclusions: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", minItems: 5, maxItems: 7, items: { type: "string", minLength: 320 } },
        narratives: {
          type: "array",
          minItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["narrative", "description", "mentions", "sentiment", "trend"],
            properties: {
              narrative: { type: "string" },
              description: { type: "string" },
              mentions: { type: "number" },
              sentiment: { type: "string", enum: ["positivo", "negativo", "mixto"] },
              trend: { type: "string", enum: ["creciente", "decreciente", "estable"] },
            },
          },
        },
        keywords: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["term", "count", "sentiment"],
            properties: {
              term: { type: "string" },
              count: { type: "number" },
              sentiment: { type: "string", enum: ["positivo", "negativo", "neutral", "mixto"] },
            },
          },
        },
        templates: {
          type: "object",
          additionalProperties: false,
          required: ["executive", "technical", "public"],
          properties: {
            executive: { type: "string" },
            technical: { type: "string" },
            public: { type: "string" },
          },
        },
      },
    } as const;

    let reportContent: Partial<ReportContent>;
    try {
      reportContent = await callClaudeTool<Partial<ReportContent>>({
        apiKey: ANTHROPIC_API_KEY,
        systemPrompt,
        userPrompt,
        toolName: "generate_smart_report",
        toolDescription: "Return the full smart report as structured JSON",
        toolSchema: reportToolSchema,
        maxTokens: MAX_TOKENS,
        temperature: 0.2,
        timeoutMs: 120000,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "RATE_LIMIT") {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (msg === "PAYMENT_REQUIRED") {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Claude error:", msg);
      throw err;
    }

    const fallbackNarratives = buildFallbackNarratives(mentions);
    const fallbackFindings = buildFallbackFindings(metrics, mentions, {
      projectAudience,
      strategicContext,
      strategicFocus,
      knownCases,
    });
    const fallbackRecommendations = buildFallbackRecommendations(metrics, mentions, audiencePerspective);

    // Helpers para anti-alucinación de cifras
    const _normForMatch = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const knownProperNames: string[] = [
      ...(entityNames || []),
      ...knownCases.flatMap((c) => (c.match(/\b[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+){0,2}\b/g) || [])),
    ].filter((n) => n && n.length >= 4);

    const findVerifiedCapForText = (text: string): number | null => {
      const norm = _normForMatch(text);
      let best: { term: string; count: number } | null = null;
      for (const v of verifiedCounts) {
        const tn = _normForMatch(v.term);
        if (tn.length >= 4 && norm.includes(tn)) {
          if (!best || tn.length > _normForMatch(best.term).length) best = v;
        }
      }
      return best ? best.count : null;
    };

    const rawNarratives = Array.isArray(reportContent.narratives) ? reportContent.narratives : [];
    const totalForFallback = metrics.totalMentions || 1;
    const narrativeFallbackBase = rawNarratives.length > 0 ? Math.max(1, Math.round(totalForFallback / rawNarratives.length / 2)) : 1;
    // NOTE: sp() se define más abajo, así que para narrativas usamos directamente sanitizeMentionCounts
    const totalsForNarrative = {
      total: metrics.totalMentions,
      positive: metrics.positiveCount,
      negative: metrics.negativeCount,
      neutral: metrics.neutralCount,
    };
    const safeNarratives: NarrativeItem[] = rawNarratives
      .slice(0, 5)
      .map((n: Partial<NarrativeItem> & { mentions?: unknown }) => {
        const mNum = Number(n?.mentions);
        let safeMentions = Number.isFinite(mNum) && mNum > 0 ? Math.round(mNum) : narrativeFallbackBase;
        // Cap por conteo verificado si la narrativa nombra un término del Enfoque
        const ctx = `${n?.narrative || ""} ${n?.description || ""}`;
        const cap = findVerifiedCapForText(ctx);
        if (cap !== null && safeMentions > cap) {
          safeMentions = cap;
        }
        if (safeMentions > metrics.totalMentions) safeMentions = metrics.totalMentions;
        const sent = n?.sentiment;
        const tr = n?.trend;
        const rawDesc = String(n?.description || "");
        const ctxDesc = sanitizeContextualCounts(rawDesc, gtByPlatform, gtByDate, metrics.totalMentions) || rawDesc;
        const cleanedDesc = sanitizeMentionCounts(
          sanitizeSentimentPercents(ctxDesc, metrics) || ctxDesc,
          verifiedCounts,
          totalsForNarrative,
          knownProperNames,
          allowedExtraCounts,
        ) || rawDesc;
        return {
          narrative: String(n?.narrative || "Narrativa identificada"),
          description: cleanedDesc,
          mentions: safeMentions,
          sentiment: (sent === "positivo" || sent === "negativo" || sent === "mixto") ? sent : "mixto",
          trend: (tr === "creciente" || tr === "decreciente" || tr === "estable") ? tr : "estable",
        };
      });

    // ====== KEYWORDS CLOUD: sanitize + stopword filter + dedupe ======
    const STOPWORDS = new Set<string>([
      // ES
      "el","la","los","las","un","una","unos","unas","de","del","al","a","y","o","u","e","que","qué","como","cómo","con","sin","por","para","en","sobre","entre","hasta","desde","contra","bajo","tras","durante","mediante","según","ante","es","son","fue","fueron","ser","está","están","estar","ha","han","he","hemos","han","habrá","será","fueron","muy","más","menos","ya","aún","aun","tan","tanto","mismo","misma","esto","esta","este","estos","estas","ese","esa","esos","esas","aquel","aquella","aquellos","aquellas","cuando","mientras","donde","quien","cual","cuales","si","sí","no","ni","pero","aunque","porque","sino","tras","luego","ayer","hoy","mañana","ahora","aquí","allí","ahí","allá","acá","quizá","tal","cada","todo","toda","todos","todas","otro","otra","otros","otras","mucho","mucha","muchos","muchas","poco","poca","pocos","pocas","alguno","alguna","algún","algunos","algunas","ninguno","ninguna","ningún","mi","mis","tu","tus","su","sus","nuestro","nuestra","nuestros","nuestras","yo","tú","él","ella","ellos","ellas","nosotros","ustedes","lo","les","le","se","me","te","nos","os","esto","eso","aquello","via","vía",
      // EN
      "the","a","an","and","or","of","in","on","for","to","with","without","by","from","at","as","is","are","was","were","be","been","being","this","that","these","those","it","its","they","their","them","there","here","but","if","then","than","so","such","also","more","less","most","least","very","much","many","few","one","two","other","another","some","any","no","not","only","own","same","just","into","over","under","between","about","after","before","during","while","because","through","again","further","up","down","out","off","once","new","old","via","i","you","we","he","she","my","your","our","your","his","her","mine","ours","theirs"
    ]);
    const cleanTerm = (t: string): string =>
      t.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/^[^a-z0-9áéíóúñ]+|[^a-z0-9áéíóúñ]+$/giu, "")
        .replace(/\s+/g, " ")
        .trim();
    const isValidKeyword = (raw: string): boolean => {
      if (!raw) return false;
      const t = cleanTerm(raw);
      if (t.length < 3) return false;
      if (/^\d+$/.test(t)) return false;
      // Reject if all words are stopwords
      const words = t.split(/\s+/);
      if (words.length > 3) return false;
      const allStop = words.every(w => STOPWORDS.has(w));
      if (allStop) return false;
      return true;
    };
    const rawKeywords = Array.isArray((reportContent as { keywords?: unknown }).keywords) ? ((reportContent as { keywords: KeywordCloudItem[] }).keywords) : [];
    const seenTerms = new Set<string>();
    const safeKeywords: KeywordCloudItem[] = rawKeywords
      .filter((k) => k && typeof k.term === "string" && isValidKeyword(k.term))
      .map((k) => {
        const c = Number(k.count);
        const sentRaw = k.sentiment;
        const sent: KeywordCloudItem["sentiment"] = sentRaw === "positivo" || sentRaw === "negativo" || sentRaw === "neutral" || sentRaw === "mixto" ? sentRaw : "mixto";
        return { term: k.term.trim(), count: Number.isFinite(c) && c > 0 ? Math.round(c) : 1, sentiment: sent };
      })
      .filter((k) => {
        const key = cleanTerm(k.term);
        if (seenTerms.has(key)) return false;
        seenTerms.add(key);
        return true;
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);

    const mergedFindings = normalizeTextList([
      ...(Array.isArray(reportContent.keyFindings) ? reportContent.keyFindings.map((item) => sanitizeFindingText(String(item))) : []),
      ...fallbackFindings,
    ]).slice(0, 8);

    const aiRecommendations = Array.isArray(reportContent.recommendations) ? reportContent.recommendations : [];
    const safeAiRecommendations = audiencePerspective === "institutional"
      ? aiRecommendations
      : aiRecommendations.filter((item) => !isInstitutionalRecommendation(String(item)));
    const mergedRecommendations = normalizeTextList([
      ...safeAiRecommendations,
      ...fallbackRecommendations,
    ]).slice(0, 7);

    const totalsForSanitize = {
      total: metrics.totalMentions,
      positive: metrics.positiveCount,
      negative: metrics.negativeCount,
      neutral: metrics.neutralCount,
    };
    const sp = (t: string | undefined | null) => {
      const ctx = sanitizeContextualCounts(t, gtByPlatform, gtByDate, metrics.totalMentions);
      const a = sanitizeSentimentPercents(ctx, metrics);
      const b = sanitizeMentionCounts(a, verifiedCounts, totalsForSanitize, knownProperNames, allowedExtraCounts);
      return b || undefined;
    };
    const result: ReportContent = {
      title: reportContent.title || "Reporte Inteligente",
      summary: sp(reportContent.summary) || "",
      keyFindings: (mergedFindings.length >= 6 ? mergedFindings : fallbackFindings).map((f) => sp(f) || f),
      recommendations: (mergedRecommendations.length >= 5 ? mergedRecommendations : fallbackRecommendations).map((r) => sp(r) || r),
      conclusions: (reportContent.conclusions || []).map((c) => sp(c) || c),
      impactAssessment: sp(reportContent.impactAssessment),
      sentimentAnalysis: sp(reportContent.sentimentAnalysis),
      narratives: safeNarratives.length > 0 ? safeNarratives : fallbackNarratives,
      keywords: safeKeywords.length > 0 ? safeKeywords : undefined,
      keywordsInsight: sp((reportContent as { keywordsInsight?: string }).keywordsInsight),
      narrativesInsight: sp(reportContent.narrativesInsight),
      timelineInsight: sp(reportContent.timelineInsight),
      influencersInsight: sp(reportContent.influencersInsight),
      mediaInsight: sp(reportContent.mediaInsight),
      platformsInsight: sp(reportContent.platformsInsight),
      entityComparison: sp(reportContent.entityComparison),
      metrics,
      templates: {
        executive: sp(reportContent.templates?.executive) || sp(reportContent.summary) || fallbackFindings.join(" "),
        technical: sp(reportContent.templates?.technical) || sp(reportContent.summary) || fallbackFindings.join(" "),
        public: reportContent.templates?.public || `📊 ${reportContent.title || "Reporte Inteligente"}`,
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

