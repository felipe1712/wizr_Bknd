import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PortalUpdate = {
  id: string;
  updated_on: string;
  press_data_through: string | null;
  social_data_through: string | null;
  narratives_data_through: string | null;
  notes: string | null;
  created_at: string;
};

export type Freshness = {
  loading: boolean;
  /** Última actualización registrada manualmente por el equipo. */
  lastUpdate: PortalUpdate | null;
  /** Fechas reales detectadas en la base, por fuente. */
  pressThrough: string | null;
  socialThrough: string | null;
  narrativesThrough: string | null;
  /** Lunes de la semana en curso (hora de México), en ISO. */
  mondayIso: string;
  /** true cuando ya pasó el lunes 12:00 y no hay actualización registrada esta semana. */
  atrasado: boolean;
  refetch: () => Promise<void>;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Fecha/hora actual en la Ciudad de México, como objeto Date "local". */
function nowMx() {
  const s = new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" });
  return new Date(s);
}

function mondayOf(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Estado de frescura del portal: qué tan actualizado está cada insumo y si ya
 * se registró la actualización comprometida para el lunes a las 12:00.
 */
export function usePortalFreshness(clientId: string): Freshness {
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<PortalUpdate | null>(null);
  const [pressThrough, setPressThrough] = useState<string | null>(null);
  const [socialThrough, setSocialThrough] = useState<string | null>(null);
  const [narrativesThrough, setNarrativesThrough] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [upd, press, social, nar] = await Promise.all([
      supabase.from("client_portal_updates")
        .select("id,updated_on,press_data_through,social_data_through,narratives_data_through,notes,created_at")
        .eq("client_id", clientId).order("updated_on", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("client_portal_listening_entries")
        .select("entry_date").eq("client_id", clientId).not("analyzed_at", "is", null)
        .order("entry_date", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("client_portal_benchmark_periods")
        .select("period_end").eq("client_id", clientId)
        .order("period_end", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("client_portal_benchmark_narratives")
        .select("created_at").eq("client_id", clientId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setLastUpdate((upd.data as PortalUpdate | null) ?? null);
    setPressThrough((press.data as any)?.entry_date ?? null);
    setSocialThrough((social.data as any)?.period_end ?? null);
    setNarrativesThrough(((nar.data as any)?.created_at ?? "").slice(0, 10) || null);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const mx = nowMx();
  const monday = mondayOf(mx);
  const mondayIso = iso(monday);
  const deadline = new Date(monday);
  deadline.setHours(12, 0, 0, 0);
  const atrasado = mx.getTime() > deadline.getTime()
    && (!lastUpdate || lastUpdate.updated_on < mondayIso);

  return {
    loading, lastUpdate, pressThrough, socialThrough, narrativesThrough,
    mondayIso, atrasado: !loading && atrasado, refetch: load,
  };
}

export function fmtDay(s: string | null | undefined) {
  if (!s) return "sin datos";
  return new Date(s + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}
