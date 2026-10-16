import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'google/gemini-3.1-flash-lite';
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const SYSTEM = `Eres analista de contenido social. A partir de una muestra de posts publicados por UNA marca en UNA red social, identificas su territorio narrativo. Devuelves SIEMPRE JSON estricto con esta forma:
{
  "narrative_axes": [{ "name": string, "description": string, "share_pct": number }],  // 2-4 ejes; suma aproximada 100
  "dominant_tone": { "label": string, "evidence": string },
  "winning_formats": [string],  // ej: "reel","carrusel","foto","texto","live","noticia","promo","educativo"
  "differential_vs_client": string  // 1-2 frases: qué hace esta marca que el cliente NO. Si es el propio cliente, describe su firma distintiva.
}
REGLAS:
- Basa TODO en los posts provistos. No inventes campañas, cifras, ni marcas.
- Los "ejes narrativos" son territorios temáticos (ej: "Educación financiera", "Cultura corporativa", "Producto/promociones", "Coyuntura económica").
- Los formatos se infieren del texto y del contexto de la red.
- Español, tono directo, sin relleno.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

type BrandKey = { profile_name: string; network: string; competitor_id: string | null; is_client: boolean };

async function analyzeOne(brand: BrandKey, posts: any[], clientName: string) {
  const sample = posts
    .slice()
    .sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0))
    .slice(0, 15)
    .map((p) => ({
      fecha: p.posted_at ? String(p.posted_at).slice(0, 10) : null,
      texto: (p.message ?? '').slice(0, 400),
      likes: p.likes ?? 0,
      comentarios: p.comments ?? 0,
      interacciones: p.interactions ?? 0,
    }));

  const userPrompt = [
    `MARCA: ${brand.profile_name} (${brand.network})`,
    brand.is_client ? `Esta marca ES el cliente (${clientName}).` : `Cliente de referencia: ${clientName}. Esta marca es un COMPETIDOR.`,
    `Muestra de ${sample.length} posts (los más interactuados del periodo):`,
    JSON.stringify(sample),
  ].join('\n');

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gateway ${resp.status}: ${text}`);
  }
  const j = await resp.json();
  const parsed = JSON.parse(j?.choices?.[0]?.message?.content ?? '{}');
  return {
    narrative_axes: Array.isArray(parsed.narrative_axes) ? parsed.narrative_axes.slice(0, 4) : [],
    dominant_tone: parsed.dominant_tone ?? null,
    winning_formats: Array.isArray(parsed.winning_formats) ? parsed.winning_formats.slice(0, 6) : [],
    differential_vs_client: parsed.differential_vs_client ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { client_id, range_start, range_end, network_filter, force } = await req.json();
    if (!client_id || !range_start || !range_end) return json({ error: 'client_id, range_start y range_end requeridos' }, 400);

    // Load competitors and periods within range
    const [{ data: competitors }, { data: periods }] = await Promise.all([
      admin.from('client_portal_benchmark_competitors').select('id,name,is_client,active').eq('client_id', client_id).eq('active', true),
      admin.from('client_portal_benchmark_periods').select('id,period_start,period_end').eq('client_id', client_id).gte('period_end', range_start).lte('period_start', range_end),
    ]);
    if (!periods || periods.length === 0) return json({ error: 'Sin periodos en el rango' }, 400);
    const periodIds = periods.map((p) => p.id);
    let postsQuery = admin.from('client_portal_benchmark_posts').select('*').in('period_id', periodIds);
    const { data: posts, error: postsErr } = await postsQuery;
    if (postsErr) throw postsErr;
    if (!posts || posts.length === 0) return json({ error: 'Sin posts en el rango' }, 400);

    const clientCompIds = new Set((competitors ?? []).filter((c: any) => c.is_client).map((c: any) => c.id));
    const compMap = new Map((competitors ?? []).map((c: any) => [c.id, c]));
    const clientNames = new Set((competitors ?? []).filter((c: any) => c.is_client).map((c: any) => (c.name ?? '').toLowerCase()));

    // Group posts by profile_name+network
    const groups = new Map<string, { key: BrandKey; posts: any[] }>();
    for (const p of posts as any[]) {
      if (network_filter && network_filter !== 'all' && p.network !== network_filter) continue;
      const profile_name = p.profile_name ?? compMap.get(p.competitor_id)?.name ?? '(desconocido)';
      const network = p.network ?? 'unknown';
      const gk = `${profile_name}||${network}`;
      const isClient = p.competitor_id ? clientCompIds.has(p.competitor_id) : clientNames.has(String(profile_name).toLowerCase());
      if (!groups.has(gk)) {
        groups.set(gk, { key: { profile_name, network, competitor_id: p.competitor_id ?? null, is_client: isClient }, posts: [] });
      }
      groups.get(gk)!.posts.push(p);
    }

    const clientRow = (competitors ?? []).find((c: any) => c.is_client);
    const clientName = clientRow?.name ?? 'Cliente';

    const results: any[] = [];
    // Check cache first per group
    const { data: cached } = await admin
      .from('client_portal_benchmark_narratives')
      .select('*')
      .eq('client_id', client_id)
      .eq('range_start', range_start)
      .eq('range_end', range_end);
    const cacheMap = new Map((cached ?? []).map((r: any) => [`${r.profile_name}||${r.network}`, r]));

    for (const [gk, g] of groups) {
      if (g.posts.length < 3) continue;
      const cachedRow = cacheMap.get(gk);
      if (cachedRow && !force) { results.push(cachedRow); continue; }
      try {
        const narratives = await analyzeOne(g.key, g.posts, clientName);
        const row = {
          client_id,
          competitor_id: g.key.competitor_id,
          profile_name: g.key.profile_name,
          network: g.key.network,
          range_start,
          range_end,
          narratives,
          posts_sampled: Math.min(g.posts.length, 15),
          model: MODEL,
          generated_at: new Date().toISOString(),
        };
        const { data: saved, error: upErr } = await admin
          .from('client_portal_benchmark_narratives')
          .upsert(row, { onConflict: 'client_id,profile_name,network,range_start,range_end' })
          .select().single();
        if (upErr) throw upErr;
        results.push(saved);
      } catch (e: any) {
        results.push({ ...g.key, error: e?.message ?? String(e) });
      }
    }

    // Sort client first, then by posts sampled desc
    results.sort((a: any, b: any) => {
      const aClient = clientCompIds.has(a.competitor_id) || clientNames.has(String(a.profile_name ?? '').toLowerCase());
      const bClient = clientCompIds.has(b.competitor_id) || clientNames.has(String(b.profile_name ?? '').toLowerCase());
      if (aClient !== bClient) return aClient ? -1 : 1;
      return (b.posts_sampled ?? 0) - (a.posts_sampled ?? 0);
    });

    return json({ narratives: results, model: MODEL, range_start, range_end });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});