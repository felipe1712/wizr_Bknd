import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EFEMERIDES_2026 } from "@/data/efemerides2026";

export type Efemeride = { date: string; name: string; key: string; affinity: "afin" | "masiva" | null; reason?: string };
export type Decision = { efemeride_date: string; efemeride_name: string; decision: "si" | "no"; note: string | null };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Afinidad por cliente: palabras clave según su territorio de contenido.
const AFFINITY: Record<string, { label: string; kw: string[] }> = {
  "e982a96c-123f-43f7-b8b0-cf788c2980ab": { label: "fe, familia y bienestar", kw: ["fe", "familia", "paz", "oracion", "virgen", "santo", "san ", "madre", "padre", "amor", "amistad", "salud mental", "depresion", "felicidad", "gratitud", "perdon", "meditacion", "yoga", "nino", "abuel", "vida", "solidaridad", "esperanza", "navidad", "nochebuena", "reyes", "pascua", "muertos", "bondad", "voluntari", "suicidio", "silencio", "juventud", "ancian", "mujer"] },
  "8e48b515-2b96-4d19-aed8-f11bb17cfa83": { label: "cultura, ideas y pensamiento crítico", kw: ["libro", "lectura", "lector", "periodis", "prensa", "libertad", "democracia", "derechos", "mujer", "poesia", "cultura", "filosofia", "ciencia", "memoria", "justicia", "arte", "cine", "teatro", "escritor", "idioma", "lengua", "radio", "internet", "migrant", "indigena", "revolucion", "independencia", "paz", "educacion", "maestro", "biblioteca", "musica", "fotograf", "historia", "tolerancia"] },
  "63fac67f-50e9-4086-8258-5f0d8a49d341": { label: "construcción, diseño y ciudad", kw: ["arquitect", "construc", "ingenier", "vivienda", "habitat", "ciudad", "medio ambiente", "tierra", "agua", "arbol", "energia", "diseno", "madera", "seguridad", "trabajo", "albanil", "santa cruz", "planeta", "reciclaje", "urban", "hogar"] },
  "7369630f-9706-430a-a80a-6b35437acb40": { label: "comunicación, liderazgo y reputación", kw: ["comunicacion", "relaciones publicas", "periodis", "prensa", "lider", "emprend", "marketing", "redes sociales", "internet", "mujer", "trabajo", "democracia", "empresa", "innovacion", "publicidad", "creativ", "pyme", "negocio", "etica", "transparencia"] },
  "21c1595b-988f-47d0-bd97-02021aaf7147": { label: "salud y medicina", kw: ["salud", "medic", "cancer", "corazon", "diabetes", "enfermer", "obesidad", "rinon", "donacion", "donante", "vacun", "sida", "hepatitis", "alzheimer", "autismo", "hipertension", "sangre", "nutricion", "alimentacion", "higiene", "lavado de manos", "tabaco", "cerebro", "vista", "audicion", "enfermedad"] },
};
const MASIVAS = ["ano nuevo", "reyes", "amor y la amistad", "san valentin", "dia de la madre", "dia del padre", "dia del nino", "independencia", "muertos", "navidad", "nochebuena", "nochevieja", "dia de la mujer", "revolucion", "guadalupe", "halloween", "candelaria", "bandera", "inocentes"];

export function affinityLabel(clientId: string) { return AFFINITY[clientId]?.label; }

export function efemeridesFor(clientId: string): Efemeride[] {
  const kw = AFFINITY[clientId]?.kw ?? [];
  return EFEMERIDES_2026.map(([date, name]) => {
    const n = ` ${norm(name)} `;
    const hit = kw.find((k) => n.includes(k.length <= 3 ? ` ${k.trim()} ` : k));
    const masiva = MASIVAS.some((m) => n.includes(m));
    return { date, name, key: `${date}|${name}`, affinity: hit ? "afin" : masiva ? "masiva" : null, reason: hit ? AFFINITY[clientId]?.label : masiva ? "fecha de conversación masiva" : undefined };
  });
}

export function useEfemerideDecisions(clientId: string) {
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [canEdit, setCanEdit] = useState(false);
  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("client_efemeride_decisions").select("efemeride_date,efemeride_name,decision,note").eq("client_id", clientId);
    setDecisions(new Map((data ?? []).map((d: Decision) => [`${d.efemeride_date}|${d.efemeride_name}`, d])));
  }, [clientId]);
  useEffect(() => {
    load();
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setCanEdit((data ?? []).some((r: any) => r.role === "admin" || r.role === "editor"));
    })();
  }, [load]);
  const decide = useCallback(async (e: Efemeride, decision: "si" | "no" | null) => {
    const next = new Map(decisions);
    if (decision === null) next.delete(e.key); else next.set(e.key, { efemeride_date: e.date, efemeride_name: e.name, decision, note: null });
    setDecisions(next); // optimista
    const t = (supabase as any).from("client_efemeride_decisions");
    const { error } = decision === null
      ? await t.delete().eq("client_id", clientId).eq("efemeride_date", e.date).eq("efemeride_name", e.name)
      : await t.upsert({ client_id: clientId, efemeride_date: e.date, efemeride_name: e.name, decision, decided_by: (await supabase.auth.getUser()).data.user?.id }, { onConflict: "client_id,efemeride_date,efemeride_name" });
    if (error) load();
  }, [clientId, decisions, load]);
  return { decisions, decide, canEdit };
}

export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const daysUntil = (iso: string) => Math.round((Date.parse(iso + "T00:00:00") - Date.parse(todayIso() + "T00:00:00")) / 86400000);
