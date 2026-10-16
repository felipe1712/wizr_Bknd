import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'google/gemini-3.7-flash';
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const SYSTEM = `Eres asesor de comunicación social para gobierno. Escribes para servidores públicos que no son especialistas en marketing digital.

Recibes el corte de datos de UNA dependencia (y/o su titular): qué cambió frente al periodo anterior, sus mejores publicaciones, sus temas recurrentes y su posición frente al resto del gabinete.

Devuelve SIEMPRE JSON estricto:
{
  "lectura": string,
  "recomendaciones": [
    { "accion": string, "porque": string, "prioridad": "alta"|"media" }
  ]
}

REGLAS DURAS:
- 3 a 5 recomendaciones. Cada "accion" es una instrucción concreta y ejecutable en las próximas semanas (qué publicar, en qué red, con qué frecuencia, sobre qué tema, con qué formato). Máximo 200 caracteres.
- Cada "porque" cita un dato concreto del corte: una cifra, una fecha, un medio, una publicación o un tema. Máximo 200 caracteres.
- Está PROHIBIDO inventar cifras, medios, eventos o publicaciones. Si un dato no viene en el insumo, no lo menciones.
- Nada de tecnicismos ni anglicismos (no uses "engagement", "insight", "awareness", "storytelling", "KPI"). Di "interacción", "hallazgo", "alcance", "narrar", "indicador".
- Lenguaje de crisis SOLO si hay menciones negativas concretas en el insumo. Si no las hay, habla de "tema a monitorear" u "oportunidad".
- "lectura" es un párrafo de máximo 3 líneas que resume en lenguaje llano cómo le fue en el periodo.
- Español de México, tono institucional, directo, sin adjetivos grandilocuentes.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const { client_id, dependencia_id, range_start, range_end, enfoque, contexto, force } = body ?? {};
    if (!client_id || !dependencia_id || !range_start || !range_end || !enfoque) {
      return json({ error: 'client_id, dependencia_id, range_start, range_end y enfoque son requeridos' }, 400);
    }

    if (!force) {
      const { data: cached } = await admin
        .from('client_portal_dep_recommendations')
        .select('*')
        .eq('client_id', client_id)
        .eq('dependencia_id', dependencia_id)
        .eq('range_start', range_start)
        .eq('range_end', range_end)
        .eq('enfoque', enfoque)
        .maybeSingle();
      if (cached) return json({ payload: cached.payload, cached: true });
    }

    const userPrompt = [
      'CORTE DE LA DEPENDENCIA (usa solo estos datos):',
      JSON.stringify(contexto ?? {}, null, 2),
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
      if (resp.status === 429) return json({ error: 'El servicio de IA está saturado. Intenta en unos minutos.' }, 429);
      if (resp.status === 402) return json({ error: 'Se agotaron los créditos de IA del espacio de trabajo.' }, 402);
      return json({ error: `Gateway ${resp.status}: ${text}` }, resp.status);
    }
    const j = await resp.json();
    const parsed = JSON.parse(j?.choices?.[0]?.message?.content ?? '{}');

    await admin.from('client_portal_dep_recommendations').upsert({
      client_id, dependencia_id, range_start, range_end, enfoque,
      payload: parsed, model: MODEL, generated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,dependencia_id,range_start,range_end,enfoque' });

    return json({ payload: parsed, cached: false });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
