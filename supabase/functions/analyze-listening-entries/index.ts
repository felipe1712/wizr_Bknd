import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'google/gemini-2.5-flash';

type Entry = { id: string; entry_date: string; content_md: string };

const SYSTEM = `Eres un analista senior de social listening y reputación. Analizas bitácoras diarias (notas manuales) sobre lo que se dice del cliente en medios, redes y grupos.

Tu trabajo es CONVERTIR texto libre en datos ESTRUCTURADOS para un dashboard ejecutivo. Sé literal, no inventes, no rellenes.

Devuelve SIEMPRE JSON estricto con estas claves:
{
  "sentiment": "positivo" | "neutral" | "negativo" | "crisis",
  "sentiment_score": number entre -1 y 1,
  "urgency": "baja" | "media" | "alta" | "critica",
  "topics": string[] (3-6 temas cortos, en minúsculas, en español),
  "mentions": [{ "name": string, "type": "persona"|"marca"|"medio"|"institucion"|"otro" }],
  "actors": string[] (nombres del equipo que reportan/participan, si se detectan),
  "summary": string (2-3 oraciones ejecutivas, sin adornos),

  "total_mentions": number (cantidad TOTAL de menciones individuales sobre el cliente encontradas en la bitácora del día — no cuentes el día como 1; cuenta cada tuit, nota, video, post, comentario, columna, mensaje que hable del cliente por separado),
  "sentiment_counts": { "positivo": number, "neutral": number, "negativo": number, "crisis": number } (cuenta cuántas de esas menciones individuales caen en cada sentimiento; la suma debe ser <= total_mentions),
  "channels": [{ "name": "medios digitales"|"x"|"facebook"|"instagram"|"youtube"|"tiktok"|"reddit"|"linkedin", "count": number }],
  "entities": [{ "name": string, "type": "persona"|"marca"|"medio"|"institucion"|"politico"|"influencer"|"otro", "sentiment": "positivo"|"neutral"|"negativo"|"crisis", "count": number }],
  "events": [{ "title": string, "kind": "crisis"|"lanzamiento"|"comunicado"|"declaracion"|"nota"|"campaña"|"evento"|"otro", "impact": "bajo"|"medio"|"alto", "detail": string }],
  "key_quotes": [{ "text": string, "author": string, "source": string, "sentiment": "positivo"|"neutral"|"negativo"|"crisis" }],
  "competitors": [{ "name": string, "count": number, "sentiment": "positivo"|"neutral"|"negativo"|"crisis" }]
  ,
  "media_mentions": [{
    "outlet": string,           // Nombre del medio o portal (ej: "El Universal", "Enfoque Noticias", "Forbes México")
    "url": string | null,        // URL directa a la nota si aparece en la bitácora, si no null
    "type": "prensa"|"radio"|"tv"|"portal"|"blog"|"podcast"|"otro",
    "topic": string,             // Tema o ángulo de la nota (corto, minúsculas)
    "headline": string | null,   // Titular o descripción breve de la cobertura
    "quote": string | null,      // Cita textual breve si la hay (máx 240 chars)
    "sentiment": "positivo"|"neutral"|"negativo"|"crisis"
  }],
  "social_mentions": [{
    "profile": string,           // Nombre visible del perfil (ej: "Carlos Loret de Mola")
    "handle": string | null,     // @usuario si aparece, si no null
    "platform": "x"|"facebook"|"instagram"|"youtube"|"tiktok"|"reddit"|"linkedin",
    "url": string | null,        // URL del post si aparece
    "topic": string,             // Tema del post (corto, minúsculas)
    "quote": string | null,      // Fragmento o cita del post (máx 240 chars)
    "sentiment": "positivo"|"neutral"|"negativo"|"crisis"
  }],
  "scope_counts": { "local": number, "nacional_impacto": number, "nacional_contexto": number, "otra_entidad": number },
  "national_context": [{ "title": string, "scope": "nacional_contexto"|"otra_entidad", "detail": string, "why_excluded": string }]
}

REGLA DE ÁMBITO (LA MÁS IMPORTANTE):
La bitácora diaria mezcla agenda NACIONAL, agenda de OTRAS ENTIDADES y agenda LOCAL del cliente.
Clasifica CADA ítem (nota, tuit, video, columna) en uno de estos cuatro ámbitos y agrégale el campo
"scope" dentro de media_mentions y social_mentions, más "scope_reason" (una frase):
  * "local": habla directamente del cliente, su gobierno, sus dependencias, sus funcionarios o hechos ocurridos en su territorio.
  * "nacional_impacto": tema nacional o de otro estado que SÍ toca al cliente de forma explícita y verificable en el texto
    (lo menciona, afecta su presupuesto, sus programas, a sus funcionarios o a su territorio). Si el texto no lo evidencia, NO uses este ámbito.
  * "nacional_contexto": agenda nacional sin vínculo con el cliente (política federal, declaraciones presidenciales, economía nacional…).
  * "otra_entidad": hechos de otro estado o municipio ajeno al cliente (por ejemplo la detención de un exgobernador de otro estado).

Consecuencias obligatorias:
- "total_mentions", "sentiment_counts", "sentiment", "sentiment_score", "urgency", "entities", "events",
  "competitors", "key_quotes" y "summary" se calculan SOLO con los ítems "local" y "nacional_impacto".
  NUNCA dejes que un tema nacional o de otro estado mueva el sentimiento o la urgencia del cliente.
- Los ítems "nacional_contexto" y "otra_entidad" van en "national_context" (máx 12), explicando en "why_excluded"
  por qué no afectan al cliente. También se conservan en media_mentions/social_mentions con su "scope".
- "scope_counts" cuenta los ítems de cada ámbito y debe cuadrar con la clasificación anterior.
- Ante la duda de si un tema nacional golpea al cliente, elige "nacional_contexto". Preferimos subestimar el impacto antes que inventarlo.
- "summary": primero lo local; si hay contexto nacional relevante, ciérralo con una frase separada que lo marque como contexto.

Reglas duras:
- Devuelve arrays vacíos si no hay datos, NUNCA inventes nombres, canales ni citas.
- "total_mentions" y "sentiment_counts" son OBLIGATORIOS y críticos: cuenta con rigor cada ítem individual (un tuit = 1, una nota de prensa = 1, un video = 1). Si el equipo dice "10 tuits negativos y 3 notas positivas", devuelve total_mentions=13 y sentiment_counts={positivo:3, negativo:10, neutral:0, crisis:0}. NO devuelvas 0 si el texto tiene contenido.
- "sentiment" (el campo global del día) refleja el TONO PREDOMINANTE del día, no lo confundas con el conteo.
- "channels": SOLO puedes usar estas 8 categorías, en minúsculas y con la ortografía EXACTA: "medios digitales", "x", "facebook", "instagram", "youtube", "tiktok", "reddit", "linkedin". NO existe "otro" ni "prensa" ni "radio" ni "tv" ni "blog" ni "telegram" ni "podcast" ni "foro" — mapea así:
  * URLs de x.com / twitter.com / t.co, tuits, "@usuario" de Twitter/X → "x"
  * URLs de facebook.com / fb.com / fb.watch → "facebook"
  * URLs de instagram.com / instagr.am, "reel de IG", stories → "instagram"
  * URLs de youtube.com / youtu.be, videos de YouTube → "youtube"
  * URLs de tiktok.com, "tiktok de @…" → "tiktok"
  * URLs de reddit.com, subreddits (r/…) → "reddit"
  * URLs de linkedin.com / lnkd.in, publicaciones de LinkedIn → "linkedin"
  * Notas de prensa digital, columnas, portales, blogs, sitios de medios (eluniversal.com.mx, reforma.com, milenio.com, expansion.mx, forbes.com.mx, bloomberg, reuters, etc.), boletines, radio online, TV online, podcasts, cualquier otro sitio web informativo → "medios digitales"
  Cuenta con RIGOR cuántas menciones individuales caen en cada categoría. Si el texto dice "5 tuits" cuenta 5 en "x", no 1. Recorre URL por URL y menciona por mención. Si una categoría no aparece, NO la incluyas.
- "entities": personas/marcas/instituciones citadas junto al cliente. Reglas de conteo y nombre:
  * Usa SIEMPRE el nombre COMPLETO y consistente del actor tal como aparece de forma más específica en la bitácora (ej. "Francisco Lira Mariel", no "Lira" ni "Francisco Lira" un día y otro distinto).
  * Deduplica variantes del mismo actor en UN solo ítem y SUMA sus conteos.
  * "count" = número de menciones individuales (tuits, notas, videos, posts, columnas) donde ese actor aparece ese día. Recorre el texto ítem por ítem; no reportes 1 si hay varias.
  * Nunca dejes count en 0 para un actor que sí aparece.
- "events": hitos concretos con impacto reputacional (crisis, lanzamientos, comunicados, declaraciones). No listes conversaciones triviales.
- "key_quotes": frases textuales entrecomilladas o parafraseadas breves (máx 240 caracteres) que valga la pena citar en el reporte. Si no hay citas claras, devuelve [].
- "competitors": otras marcas/organizaciones del mismo sector citadas de forma comparativa. Solo si el texto lo evidencia.
- "crisis" solo si hay riesgo reputacional o legal claro. Ignora saludos, stickers, "🙂🙏", "ok" y ruido.`;
// ↑ Reglas adicionales para las nuevas claves:
// - "media_mentions": UN ítem por cobertura mediática identificable. Extrae el nombre del outlet
//   tal cual aparece (El Universal, Milenio, Reforma, Enfoque Noticias, Forbes México, ADN40, etc).
//   Si hay URL en la bitácora, cópiala EXACTA. Si dos coberturas son del mismo outlet pero
//   distintos ángulos, crea dos ítems (uno por nota). No inventes URLs ni titulares.
// - "social_mentions": UN ítem por post/tuit/video/reel identificable en redes.
//   platform debe ser una de las 7 sociales permitidas. Extrae @handle si aparece.
//   Si solo dice "5 tuits negativos" sin identificar perfiles, NO generes ítems inventados —
//   déjalos fuera (el conteo agregado ya vive en "channels").
// - Para AMBAS listas: prefiere calidad sobre cantidad. Máximo 40 media_mentions y
//   40 social_mentions por día. Si el texto es puramente resumen agregado sin
//   detalle por medio/perfil, devuelve [].

// Taxonomía canónica de plataformas (fuente de verdad, única)
const CANONICAL_CHANNELS = ['medios digitales','x','facebook','instagram','youtube','tiktok','reddit','linkedin'] as const;
type Channel = typeof CANONICAL_CHANNELS[number];

function normalizeChannelName(raw: string): Channel {
  const s = (raw || '').toLowerCase().trim();
  if (!s) return 'medios digitales';
  if (s === 'x' || s === 'twitter' || s === 'x (twitter)' || s.includes('twitter')) return 'x';
  if (s.startsWith('facebook') || s === 'fb') return 'facebook';
  if (s.startsWith('instagram') || s === 'ig') return 'instagram';
  if (s.startsWith('youtube') || s === 'yt') return 'youtube';
  if (s.startsWith('tiktok') || s === 'tt') return 'tiktok';
  if (s.startsWith('reddit')) return 'reddit';
  if (s.startsWith('linkedin')) return 'linkedin';
  // Todo lo demás (prensa, radio, tv, blog, podcast, telegram, foro, spotify, otro, medios, portal...) → medios digitales
  return 'medios digitales';
}

// Cuenta URLs por dominio en el texto — evidencia dura, complemento del LLM
function countChannelsFromText(md: string): Record<Channel, number> {
  const counts: Record<Channel, number> = {
    'medios digitales': 0, 'x': 0, 'facebook': 0, 'instagram': 0,
    'youtube': 0, 'tiktok': 0, 'reddit': 0, 'linkedin': 0,
  };
  const urlRe = /https?:\/\/([^\s)\]\}>"']+)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(md)) !== null) {
    const host = m[1].toLowerCase().split('/')[0];
    if (/(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)t\.co$/.test(host)) counts.x++;
    else if (/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.watch$/.test(host)) counts.facebook++;
    else if (/(^|\.)instagram\.com$|(^|\.)instagr\.am$/.test(host)) counts.instagram++;
    else if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) counts.youtube++;
    else if (/(^|\.)tiktok\.com$/.test(host)) counts.tiktok++;
    else if (/(^|\.)reddit\.com$|(^|\.)redd\.it$/.test(host)) counts.reddit++;
    else if (/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/.test(host)) counts.linkedin++;
    else counts['medios digitales']++;
  }
  return counts;
}

// Extrae totales declarados EXPLÍCITAMENTE en la bitácora.
// Ej: "Total: 119 menciones", "119 menciones únicas", "se identificaron 119 menciones"
function extractDeclaredTotals(md: string): { total?: number; counts?: Record<string, number> } {
  const text = md.replace(/[\*_`~]/g, ' ').replace(/\s+/g, ' ');
  const out: { total?: number; counts?: Record<string, number> } = {};

  const totalPatterns = [
    /total\s*(?:general|de\s+menciones)?\s*[:\-–]?\s*(\d{1,5})\s*menciones/i,
    /(\d{1,5})\s*menciones\s*(?:únicas|unicas|totales|en\s+total)/i,
    /se\s+identificaron\s+(\d{1,5})\s*menciones/i,
  ];
  let bestTotal = 0;
  for (const re of totalPatterns) {
    const m = text.match(re);
    if (m) { const n = parseInt(m[1], 10); if (Number.isFinite(n) && n > bestTotal) bestTotal = n; }
  }
  if (bestTotal > 0) out.total = bestTotal;

  const grab = (labels: string[]): number | undefined => {
    for (const label of labels) {
      // "label ... ( N menciones )" — conteo explícito entre paréntesis
      const re1 = new RegExp(`\\b${label}\\b[^()]{0,40}\\(\\s*~?\\s*(\\d{1,5})\\s*menciones?\\s*\\)`, 'i');
      const m1 = text.match(re1);
      if (m1) return parseInt(m1[1], 10);
      // "label: N menciones" — directo tras dos puntos o guión, sin porcentaje
      const re2 = new RegExp(`\\b${label}\\b\\s*[:\\-]\\s*(\\d{1,5})\\s*menciones?`, 'i');
      const m2 = text.match(re2);
      if (m2) return parseInt(m2[1], 10);
    }
    return undefined;
  };
  const positivo = grab(['positivo', 'positivas']);
  const neutral  = grab(['neutral', 'neutrales', 'neutro']);
  const negativo = grab(['negativo', 'negativas']);
  const crisis   = grab(['crisis']);
  if (positivo || neutral || negativo || crisis) {
    out.counts = {
      positivo: positivo ?? 0,
      neutral: neutral ?? 0,
      negativo: negativo ?? 0,
      crisis: crisis ?? 0,
    };
  }
  return out;
}

async function analyzeOne(entry: Entry) {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Lovable-API-Key': LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Fecha: ${entry.entry_date}\n\nBitácora:\n${entry.content_md.slice(0, 28000)}` },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Gateway ${resp.status}: ${t}`);
  }
  const j = await resp.json();
  const raw = j?.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw);

  // Ámbito: normaliza los scopes por ítem y recalcula scope_counts de forma determinista
  const SCOPES = ['local', 'nacional_impacto', 'nacional_contexto', 'otra_entidad'] as const;
  const normScope = (s: any) => {
    const v = String(s ?? '').toLowerCase().trim();
    return (SCOPES as readonly string[]).includes(v) ? v : 'local';
  };
  const scopeCounts: Record<string, number> = { local: 0, nacional_impacto: 0, nacional_contexto: 0, otra_entidad: 0 };
  let classified = 0;
  for (const key of ['media_mentions', 'social_mentions']) {
    if (!Array.isArray(parsed[key])) continue;
    parsed[key] = parsed[key].map((it: any) => {
      const hadScope = typeof it?.scope === 'string';
      const scope = normScope(it?.scope);
      if (hadScope) classified++;
      scopeCounts[scope]++;
      return { ...it, scope };
    });
  }
  parsed.scope_counts = classified > 0 ? scopeCounts : (parsed.scope_counts ?? {});
  parsed.national_context = Array.isArray(parsed.national_context)
    ? parsed.national_context.slice(0, 12).map((n: any) => ({ ...n, scope: normScope(n?.scope) }))
    : [];

  // Si el análisis distinguió ámbitos, los totales del cliente NO se sobrescriben con los
  // totales declarados en la bitácora (esos incluyen la agenda nacional completa).
  const scopeAware = classified > 0 && (scopeCounts.nacional_contexto + scopeCounts.otra_entidad) > 0;
  const declared = scopeAware ? {} as any : extractDeclaredTotals(entry.content_md);
  if (declared.total && declared.total > (Number(parsed.total_mentions) || 0)) {
    parsed.total_mentions = declared.total;
  }
  if (declared.counts) {
    const sum = declared.counts.positivo + declared.counts.neutral + declared.counts.negativo + declared.counts.crisis;
    const currentSum = ['positivo','neutral','negativo','crisis'].reduce((a,k)=>a+(Number(parsed?.sentiment_counts?.[k])||0),0);
    if (sum > currentSum) parsed.sentiment_counts = declared.counts;
  }
  // Si tenemos total declarado pero los sentiment_counts no lo alcanzan, escálalos proporcionalmente
  if (parsed.total_mentions && parsed.sentiment_counts) {
    const sc = parsed.sentiment_counts;
    const sum = (Number(sc.positivo)||0)+(Number(sc.neutral)||0)+(Number(sc.negativo)||0)+(Number(sc.crisis)||0);
    if (sum > 0 && sum < parsed.total_mentions) {
      const k = parsed.total_mentions / sum;
      parsed.sentiment_counts = {
        positivo: Math.round((Number(sc.positivo)||0) * k),
        neutral:  Math.round((Number(sc.neutral)||0) * k),
        negativo: Math.round((Number(sc.negativo)||0) * k),
        crisis:   Math.round((Number(sc.crisis)||0) * k),
      };
    }
  }

  // Normaliza channels a la taxonomía canónica y fusiona con el conteo de URLs
  const merged: Record<Channel, number> = {
    'medios digitales': 0, 'x': 0, 'facebook': 0, 'instagram': 0,
    'youtube': 0, 'tiktok': 0, 'reddit': 0, 'linkedin': 0,
  };
  if (Array.isArray(parsed.channels)) {
    for (const ch of parsed.channels) {
      const name = normalizeChannelName(typeof ch === 'string' ? ch : ch?.name);
      const n = typeof ch?.count === 'number' ? ch.count : 1;
      merged[name] += n;
    }
  }
  const fromText = countChannelsFromText(entry.content_md);
  // Toma el MÁXIMO entre LLM y evidencia dura de URLs (no sumar para no duplicar).
  // Con clasificación de ámbito, las URLs del texto incluyen agenda nacional, así que
  // no sirven como piso: se respeta el conteo del análisis.
  if (!scopeAware) {
    for (const k of CANONICAL_CHANNELS) merged[k] = Math.max(merged[k], fromText[k]);
  }
  parsed.channels = CANONICAL_CHANNELS
    .filter(k => merged[k] > 0)
    .map(k => ({ name: k, count: merged[k] }));

  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { client_id, entry_ids, only_unanalyzed = true, limit = 10, background = false, from_date, to_date } = await req.json();
    if (!client_id) throw new Error('client_id requerido');

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let query = admin.from('client_portal_listening_entries')
      .select('id, entry_date, content_md, analyzed_at')
      .eq('client_id', client_id)
      .order('entry_date', { ascending: false })
      .limit(limit);
    if (entry_ids && Array.isArray(entry_ids) && entry_ids.length > 0) {
      query = admin.from('client_portal_listening_entries')
        .select('id, entry_date, content_md, analyzed_at')
        .in('id', entry_ids);
    } else {
      if (only_unanalyzed) query = query.is('analyzed_at', null);
      if (from_date) query = query.gte('entry_date', from_date);
      if (to_date) query = query.lte('entry_date', to_date);
    }
    const { data: entries, error } = await query;
    if (error) throw error;
    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No hay entradas para analizar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const buildUpdate = (a: any) => ({
      sentiment: a.sentiment ?? null,
      sentiment_score: typeof a.sentiment_score === 'number' ? a.sentiment_score : null,
      urgency: a.urgency ?? null,
      topics: Array.isArray(a.topics) ? a.topics.slice(0, 8) : [],
      mentions: Array.isArray(a.mentions) ? a.mentions.slice(0, 20) : [],
      actors: Array.isArray(a.actors) ? a.actors.slice(0, 15) : [],
      summary: typeof a.summary === 'string' ? a.summary : null,
      channels: Array.isArray(a.channels) ? a.channels.slice(0, 15) : [],
      entities: Array.isArray(a.entities) ? a.entities.slice(0, 30) : [],
      events: Array.isArray(a.events) ? a.events.slice(0, 10) : [],
      key_quotes: Array.isArray(a.key_quotes) ? a.key_quotes.slice(0, 10) : [],
      competitors: Array.isArray(a.competitors) ? a.competitors.slice(0, 15) : [],
      total_mentions: typeof a.total_mentions === 'number' ? a.total_mentions : 0,
      sentiment_counts: (a.sentiment_counts && typeof a.sentiment_counts === 'object') ? a.sentiment_counts : {},
      media_mentions: Array.isArray(a.media_mentions) ? a.media_mentions.slice(0, 40) : [],
      social_mentions: Array.isArray(a.social_mentions) ? a.social_mentions.slice(0, 40) : [],
      scope_counts: (a.scope_counts && typeof a.scope_counts === 'object') ? a.scope_counts : {},
      national_context: Array.isArray(a.national_context) ? a.national_context.slice(0, 12) : [],
      analyzed_at: new Date().toISOString(),
    });

    const processAll = async () => {
      let ok = 0;
      for (const e of entries) {
        try {
          const a = await analyzeOne(e as Entry);
          await admin.from('client_portal_listening_entries').update(buildUpdate(a)).eq('id', e.id);
          ok++;
        } catch (err: any) {
          console.error('analyze error', e.id, err.message);
        }
      }
      console.log(`analyzed ${ok}/${entries.length}`);
    };

    if (background) {
      // @ts-ignore EdgeRuntime is available in Supabase functions
      EdgeRuntime.waitUntil(processAll());
      return new Response(JSON.stringify({ started: true, total: entries.length, background: true }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Foreground: process sequentially but with small limit to stay under 150s
    let ok = 0; const errors: any[] = [];
    for (const e of entries) {
      try {
        const a = await analyzeOne(e as Entry);
        const { error: upErr } = await admin.from('client_portal_listening_entries').update(buildUpdate(a)).eq('id', e.id);
        if (upErr) throw upErr;
        ok++;
      } catch (err: any) {
        errors.push({ id: e.id, error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: ok, total: entries.length, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
