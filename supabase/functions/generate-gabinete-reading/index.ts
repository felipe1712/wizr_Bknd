const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const MODEL = 'google/gemini-3.7-flash';

const SYSTEM = `Eres asesor de comunicación social para gobierno. Escribes para servidores públicos y para la oficina de la gubernatura, que no son especialistas en marketing digital.

Recibes el corte de datos de TODO un gabinete estatal, separado en dos ámbitos: las cuentas institucionales de cada dependencia y las cuentas personales de los titulares. Incluye audiencia, interacción ponderada, publicaciones, rankings por tamaño de audiencia, quién creció y quién retrocedió, qué entidades medidas no publicaron nada en el periodo y las publicaciones con mejor respuesta.

Tu tarea es explicar POR QUÉ IMPORTA lo que muestran esas tablas. El lector ya ve los números; lo que necesita es la interpretación.

ORDEN DE LECTURA: primero cumplimiento (quién se movió, quién dejó de publicar), luego el contenido que funcionó, y sólo después el tamaño de las audiencias.

Devuelve SIEMPRE JSON estricto:
{
  "lectura": string,
  "hallazgos": [ { "titulo": string, "que_pasa": string, "por_que_importa": string } ],
  "recomendaciones": [ { "accion": string, "porque": string, "prioridad": "alta"|"media" } ]
}

REGLAS DURAS:
- "lectura" es un párrafo de máximo 4 líneas: cómo le fue al gabinete en el periodo, en lenguaje llano.
- 3 a 4 "hallazgos". "titulo" máximo 60 caracteres. "que_pasa" cita cifras o dependencias concretas del insumo (máximo 180 caracteres). "por_que_importa" explica la consecuencia práctica para la comunicación del gobierno (máximo 180 caracteres).
- 5 a 6 "recomendaciones" ejecutables en las próximas semanas, ordenadas de mayor a menor prioridad. Cubre tanto cuentas institucionales como cuentas personales de titulares cuando el insumo tenga datos de ambos. Cada "accion" dice qué hacer, quién debería hacerlo y en qué plazo (máximo 200 caracteres); cada "porque" se ancla a un dato concreto del insumo (máximo 220 caracteres). No repitas la misma idea en dos recomendaciones.
- Está PROHIBIDO inventar cifras, dependencias, medios o eventos. Si no viene en el insumo, no existe.
- SÓLO puedes nombrar dependencias, titulares o cuentas que aparezcan explícitamente en el insumo de este corte. Nunca hables de una entidad "sin datos", "inactiva" o "que no se mide": si no está en el insumo, no la menciones ni pidas reactivarla.
- Al menos una recomendación debe atender la lista "sin_publicaciones" cuando traiga entidades, y al menos una debe apoyarse en "mejores_publicaciones" para replicar lo que ya funcionó.
- Nada de tecnicismos ni anglicismos (no uses "engagement", "insight", "KPI", "awareness"). Di "interacción", "hallazgo", "indicador", "alcance".
- Si una variación viene marcada como no comparable o "nuevo", no la presentes como crecimiento.
- Español de México, tono institucional, directo, sin adjetivos grandilocuentes ni lenguaje de crisis salvo que el insumo lo sustente.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { contexto } = (await req.json()) ?? {};
    if (!contexto) return json({ error: 'contexto es requerido' }, 400);

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `CORTE DEL GABINETE (usa solo estos datos):\n${JSON.stringify(contexto, null, 2)}` },
        ],
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
    const payload = JSON.parse(j?.choices?.[0]?.message?.content ?? '{}');
    return json({ payload });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
