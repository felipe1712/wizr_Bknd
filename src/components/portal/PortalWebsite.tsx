import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Users, MousePointerClick, FileText, Clock, TrendingUp, TrendingDown, Sparkles, CalendarDays } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export type WebRow = {
  period_start: string; period_end: string; period_label: string | null;
  users: number | null; new_users: number | null; sessions: number | null; pageviews: number | null;
  avg_session_seconds: number | null; bounce_rate: number | null; conversions: number | null;
  channels: Record<string, { users?: number; sessions?: number; conversions?: number }> | null;
};

export const CHANNEL_LABEL: Record<string, string> = {
  Direct: "Directo", "Organic Search": "Búsqueda orgánica", "Paid Search": "Búsqueda pagada (Google Ads)",
  "Organic Social": "Redes sociales", "Paid Social": "Redes pagadas", Referral: "Otros sitios", Email: "Correo",
  "AI Assistant": "Asistentes de IA", Unassigned: "Sin clasificar", Display: "Display", "Organic Video": "Video orgánico",
};
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const nf = (v: number | null | undefined, d = 0) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("es-MX", { maximumFractionDigits: d, minimumFractionDigits: d }));
const mm = (s: string) => `${MESES[Number(s.slice(5, 7)) - 1]} ${s.slice(2, 4)}`;
export const dur = (s: number | null | undefined) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")} min`);
const delta = (c: number | null | undefined, p: number | null | undefined) => (c == null || !p ? null : (c - p) / p);

export function channelsOf(r: WebRow | undefined) {
  if (!r?.channels) return [];
  const list = Object.entries(r.channels).map(([k, v]) => ({ key: k, label: CHANNEL_LABEL[k] ?? k, sessions: v.sessions ?? 0, users: v.users ?? 0 }));
  const total = list.reduce((a, b) => a + b.sessions, 0) || 1;
  return list.filter((x) => x.sessions > 0).sort((a, b) => b.sessions - a.sessions).map((x) => ({ ...x, share: x.sessions / total }));
}

export function useWebRows(clientId: string) {
  const [rows, setRows] = useState<WebRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.from("client_portal_web_analytics").select("*").eq("client_id", clientId).order("period_start").limit(100)
      .then(({ data }) => { if (alive) setRows(((data ?? []) as any[]).filter((r) => r.period_start.endsWith("-01")) as WebRow[]); });
    return () => { alive = false; };
  }, [clientId]);
  return rows;
}

export function webReading(cur: WebRow, prev: WebRow | undefined): string[] {
  const out: string[] = [];
  const ch = channelsOf(cur);
  const du = delta(cur.users, prev?.users);
  out.push(`${nf(cur.users)} personas visitaron el sitio en ${nf(cur.sessions)} visitas y vieron ${nf(cur.pageviews)} páginas${du != null ? ` (${du >= 0 ? "+" : ""}${nf(du * 100, 0)}% vs. el mes anterior)` : ""}.`);
  if (cur.sessions && cur.pageviews) out.push(`Cada visita recorrió ${nf(cur.pageviews / cur.sessions, 1)} páginas y duró ${dur(cur.avg_session_seconds)} en promedio.`);
  if (cur.users && cur.new_users) out.push(`${nf((cur.new_users / cur.users) * 100, 0)}% fueron lectores nuevos.`);
  if (ch[0]) out.push(`La principal puerta de entrada fue ${ch[0].label.toLowerCase()}: ${nf(ch[0].share * 100, 0)}% de las visitas.`);
  const social = ch.find((c) => c.key === "Organic Social");
  if (social) out.push(`Las redes sociales trajeron ${nf(social.sessions)} visitas (${nf(social.share * 100, 0)}%).`);
  const ai = ch.find((c) => c.key === "AI Assistant");
  if (ai) out.push(`Asistentes de IA (ChatGPT y similares) ya envían tráfico: ${nf(ai.sessions)} visitas.`);
  if (cur.bounce_rate != null) out.push(`${nf(cur.bounce_rate * 100, 0)}% de las visitas salió sin interactuar con el sitio.`);
  return out;
}

export default function PortalWebsite({ clientId }: { clientId: string }) {
  const rows = useWebRows(clientId);
  const [key, setKey] = useState<string>("");
  useEffect(() => { if (rows?.length && !key) setKey(rows[rows.length - 1].period_start); }, [rows, key]);
  const i = rows?.findIndex((r) => r.period_start === key) ?? -1;
  const cur = i >= 0 ? rows![i] : undefined, prev = i > 0 ? rows![i - 1] : undefined;
  const trend = useMemo(() => (rows ?? []).slice(-12).map((r) => ({ mes: mm(r.period_start), visitas: r.sessions ?? 0, personas: r.users ?? 0, paginas: r.pageviews ?? 0 })), [rows]);
  const ch = channelsOf(cur);

  if (!rows) return <div className="grid gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>;
  if (!cur) return <Card className="glass p-12 text-center text-sm text-muted-foreground">Aún no hay datos del sitio web.</Card>;
  if (rows.every((r: any) => !Number(r.sessions))) return (
    <Card className="glass p-12 text-center text-sm text-muted-foreground space-y-1">
      <p className="font-medium text-foreground">Google Analytics aún no registra visitas en este sitio.</p>
      <p>La medición está conectada; en cuanto el sitio empiece a enviar datos aparecerán aquí automáticamente (se actualiza cada día).</p>
    </Card>
  );

  const kpis = [
    { icon: Users, label: "Personas", v: nf(cur.users), d: delta(cur.users, prev?.users) },
    { icon: MousePointerClick, label: "Visitas", v: nf(cur.sessions), d: delta(cur.sessions, prev?.sessions) },
    { icon: FileText, label: "Páginas vistas", v: nf(cur.pageviews), d: delta(cur.pageviews, prev?.pageviews) },
    { icon: Clock, label: "Tiempo por visita", v: dur(cur.avg_session_seconds), d: delta(cur.avg_session_seconds, prev?.avg_session_seconds) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={key} onValueChange={setKey}>
          <SelectTrigger className="h-9 w-56"><CalendarDays className="w-4 h-4 mr-2 text-coral" /><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-80">
            {[...rows].reverse().map((r) => <SelectItem key={r.period_start} value={r.period_start}>{r.period_label ?? mm(r.period_start)}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">Datos de Google Analytics · cortes mensuales{prev ? ` · comparado con ${prev.period_label ?? mm(prev.period_start)}` : ""}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="glass p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground"><k.icon className="w-3.5 h-3.5 text-coral" />{k.label}</div>
            <div className="text-2xl font-display font-bold mt-1">{k.v}</div>
            {k.d != null && (
              <div className={`text-xs mt-1 flex items-center gap-1 ${k.d >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                {k.d >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{nf(Math.abs(k.d) * 100, 1)}% vs. mes anterior
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="glass p-5 lg:col-span-3">
          <div className="flex items-center gap-2 font-semibold mb-3"><Sparkles className="w-4 h-4 text-coral" />Lectura del mes</div>
          <ul className="space-y-2 text-sm">
            {webReading(cur, prev).map((t, i) => <li key={i} className="flex gap-2"><span className="text-coral">•</span><span>{t}</span></li>)}
          </ul>
        </Card>
        <Card className="glass p-5 lg:col-span-2">
          <div className="flex items-center gap-2 font-semibold mb-3"><Globe className="w-4 h-4 text-coral" />De dónde llegan</div>
          <div className="space-y-2.5">
            {ch.slice(0, 7).map((c) => (
              <div key={c.key}>
                <div className="flex justify-between text-xs mb-1"><span>{c.label}</span><span className="text-muted-foreground tabular-nums">{nf(c.sessions)} · {nf(c.share * 100, 0)}%</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-coral to-primary" style={{ width: `${Math.max(2, c.share * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="glass p-5">
        <div className="font-semibold mb-3">Visitas y personas por mes</div>
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="visitas" name="Visitas" fill="hsl(var(--coral))" radius={[4, 4, 0, 0]} />
              <Line dataKey="personas" name="Personas" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
