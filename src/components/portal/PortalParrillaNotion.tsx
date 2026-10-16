import { useEffect, useMemo, useState } from "react";
import { efemeridesFor, useEfemerideDecisions } from "@/lib/efemerides";
import { EfemerideRow } from "@/components/portal/EfemeridesRadar";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight, Download, ExternalLink, RefreshCw, LayoutGrid, List, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export type NotionItem = {
  id: string; notion_page_id: string; account: string | null; title: string | null; scheduled_date: string | null;
  theme: string | null; objective: string | null; format: string | null; network: string | null; status: string | null;
  responsible: string | null; notion_url: string | null;
};
type Pub = { date: string; network: string; interactions: number; url?: string; text?: string };

const NETS = [
  { k: "instagram", label: "Instagram", color: "hsl(330 85% 60%)" },
  { k: "facebook", label: "Facebook", color: "hsl(220 85% 60%)" },
  { k: "tiktok", label: "TikTok", color: "hsl(185 85% 50%)" },
  { k: "youtube", label: "YouTube", color: "hsl(0 85% 55%)" },
  { k: "x", label: "X", color: "hsl(0 0% 60%)" },
];
const netsOf = (s: string | null) => NETS.filter((n) => (s ?? "").toLowerCase().includes(n.label.toLowerCase()));
const cleanNet = (s: string | null) => netsOf(s).map((n) => n.label).join(" · ") || (s ?? "").replace(/[^\p{L}\s,·]/gu, "").trim();

const STATUS = (s: string | null) => {
  const v = (s ?? "").toLowerCase();
  if (v.includes("public")) return { label: "Publicación", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
  if (v.includes("program")) return { label: "Programada", cls: "bg-cyan/15 text-cyan border-cyan/30" };
  if (v.includes("aprob")) return { label: "Aprobada", cls: "bg-electric/15 text-electric border-electric/30" };
  if (v.includes("revis")) return { label: "En revisión", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" };
  if (v.includes("pend")) return { label: "Pendiente", cls: "bg-coral/15 text-coral border-coral/30" };
  return { label: s ?? "Sin estado", cls: "bg-muted text-muted-foreground border-border" };
};
const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const longDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

export default function PortalParrillaNotion({ clientId, clientName, canSync }: { clientId: string; clientName: string; canSync?: boolean }) {
  const [items, setItems] = useState<NotionItem[]>([]);
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [mode, setMode] = useState<"mes" | "lista">("mes");
  const [net, setNet] = useState<string>("all");
  const [cursor, setCursor] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [day, setDay] = useState<string | null>(null);
  const [open, setOpen] = useState<NotionItem | null>(null);
  const [showEf, setShowEf] = useState(true);
  const efs = useMemo(() => efemeridesFor(clientId), [clientId]);
  const efByDay = useMemo(() => { const m = new Map<string, typeof efs>(); for (const e of efs) m.set(e.date, [...(m.get(e.date) ?? []), e]); return m; }, [efs]);
  const { decisions, decide, canEdit: canDecide } = useEfemerideDecisions(clientId);

  const load = async () => {
    const [{ data }, { data: s }] = await Promise.all([
      supabase.from("notion_parrilla_items")
        .select("id, notion_page_id, account, title, scheduled_date, theme, objective, format, network, status, responsible, notion_url")
        .eq("client_id", clientId).order("scheduled_date", { ascending: true }),
      supabase.from("client_portal_social_metrics").select("network, period_start, raw").eq("client_id", clientId).limit(1000),
    ]);
    setItems((data ?? []) as NotionItem[]);
    setPubs(((s ?? []) as any[]).filter((r) => String(r.period_start).endsWith("-01")).flatMap((r) => ((r.raw?.posts ?? []) as any[]).map((p) => ({ date: String(p.date ?? "").slice(0, 10), network: r.network, interactions: p.interactions ?? 0, url: p.url, text: p.text }))));
    setLoading(false);
  };
  useEffect(() => { setLoading(true); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId]);

  // Arrancar en el mes con contenido más cercano a hoy
  useEffect(() => {
    if (!items.length) return;
    const today = iso(new Date()).slice(0, 7);
    const ms = [...new Set(items.map((i) => i.scheduled_date?.slice(0, 7)).filter(Boolean) as string[])].sort();
    if (!ms.includes(today)) { const k = ms.filter((m) => m <= today).pop() ?? ms[0]; setCursor(new Date(k + "-01T00:00:00")); }
  }, [items]);

  const sync = async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("notion-sync-parrilla", { body: { clientId } });
    setSyncing(false);
    if (error) { toast.error("No se pudo sincronizar con Notion"); return; }
    const total = ((data as any)?.report ?? []).reduce((a: number, r: any) => a + (r.imported ?? 0), 0);
    toast.success(`Notion sincronizado · ${total} piezas`);
    load();
  };

  const monthK = iso(cursor).slice(0, 7);
  const filtered = useMemo(() => items.filter((i) => net === "all" || netsOf(i.network).some((n) => n.k === net)), [items, net]);
  const monthItems = filtered.filter((i) => i.scheduled_date?.startsWith(monthK));
  const byDay = useMemo(() => { const m = new Map<string, NotionItem[]>(); monthItems.forEach((i) => m.set(i.scheduled_date!, [...(m.get(i.scheduled_date!) ?? []), i])); return m; }, [monthItems]);
  const pubByDay = useMemo(() => { const m = new Map<string, Pub[]>(); pubs.forEach((p) => m.set(p.date, [...(m.get(p.date) ?? []), p])); return m; }, [pubs]);

  const today = iso(new Date());
  const past = monthItems.filter((i) => i.scheduled_date! < today);
  const delivered = past.filter((i) => (pubByDay.get(i.scheduled_date!) ?? []).length > 0).length;
  const approved = monthItems.filter((i) => /public|program|aprob/i.test(i.status ?? "")).length;
  const pending = monthItems.filter((i) => /pend|revis/i.test(i.status ?? "")).length;
  const nextUp = filtered.filter((i) => i.scheduled_date && i.scheduled_date >= today).slice(0, 1)[0];

  const cells = useMemo(() => {
    const first = new Date(cursor); const offset = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; })
      .filter((d, i) => i < 35 || d.getMonth() === cursor.getMonth());
  }, [cursor]);

  const move = (n: number) => { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1)); setDay(null); };
  const monthName = cursor.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  const exportCsv = () => {
    const rows = [["Fecha", "Tema", "Objetivo", "Formato", "Plataforma", "Estado", "Responsable"],
      ...monthItems.map((i) => [i.scheduled_date ?? "", i.title ?? i.theme ?? "", i.objective ?? "", i.format ?? "", cleanNet(i.network), STATUS(i.status).label, i.responsible ?? ""])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `parrilla-${clientName.toLowerCase().replace(/\s+/g, "-")}-${monthK}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <Skeleton className="h-[600px] rounded-2xl" />;

  const dayList = day ? byDay.get(day) ?? [] : [];

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <Card className="glass border-border/50 p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => move(-1)} aria-label="Mes anterior"><ChevronLeft className="w-4 h-4" /></Button>
          <div className="min-w-[150px] text-center font-display font-semibold capitalize">{monthName}</div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => move(1)} aria-label="Mes siguiente"><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" className="ml-1" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setDay(null); }}>Hoy</Button>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {[{ k: "all", label: "Todas", color: "" }, ...NETS.filter((n) => items.some((i) => netsOf(i.network).some((x) => x.k === n.k)))].map((n) => (
            <button key={n.k} onClick={() => setNet(n.k)}
              className={`px-3 h-8 rounded-full text-xs border transition-colors inline-flex items-center gap-1.5 ${net === n.k ? "border-coral bg-coral/10 text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
              {n.color && <span className="w-2 h-2 rounded-full" style={{ background: n.color }} />}{n.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="flex rounded-lg border border-border/60 p-0.5">
            <Button variant={mode === "mes" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setMode("mes")}><LayoutGrid className="w-4 h-4" /></Button>
            <Button variant={mode === "lista" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setMode("lista")}><List className="w-4 h-4" /></Button>
          </div>
          <Button variant={showEf ? "secondary" : "ghost"} size="sm" className="h-8 text-xs" onClick={() => setShowEf(!showEf)} title="Mostrar efemérides">★ Efemérides</Button>
          <Button variant="ghost" size="sm" onClick={exportCsv}><Download className="w-4 h-4" /></Button>
          {canSync && <Button variant="ghost" size="sm" onClick={sync} disabled={syncing}><RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /></Button>}
        </div>
      </Card>

      {/* Resumen del mes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mini label="Piezas del mes" value={monthItems.length} />
        <Mini label="Aprobadas o programadas" value={`${approved}`} hint={pending ? `${pending} pendientes de aprobar` : "Todo aprobado"} />
        <Mini label="Días cumplidos" value={past.length ? `${delivered}/${past.length}` : "—"} hint="Planeado vs. publicado (Metricool)" />
        <Mini label="Próxima pieza" value={nextUp ? new Date(nextUp.scheduled_date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "—"} hint={nextUp?.title ?? undefined} />
      </div>

      {mode === "mes" ? (
        <Card className="glass border-border/50 p-3 overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              {DOW.map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d) => {
                const k = iso(d); const list = byDay.get(k) ?? []; const inMonth = d.getMonth() === cursor.getMonth();
                const published = (pubByDay.get(k) ?? []).length > 0;
                const dayEf = showEf ? (efByDay.get(k) ?? []).filter((e) => decisions.get(e.key)?.decision !== "no") : [];
                const efTop = dayEf.find((e) => decisions.get(e.key)?.decision === "si") ?? dayEf.find((e) => e.affinity) ?? dayEf[0];
                return (
                  <button key={k} onClick={() => (list.length || dayEf.length) && setDay(k)}
                    className={`min-h-[112px] rounded-xl border p-1.5 text-left flex flex-col gap-1 transition-colors ${inMonth ? "border-border/50 bg-card/40" : "border-transparent opacity-40"} ${k === today ? "ring-1 ring-coral" : ""} ${list.length || dayEf.length ? "hover:border-coral/50 cursor-pointer" : "cursor-default"}`}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className={k === today ? "font-bold text-coral" : "text-muted-foreground"}>{d.getDate()}</span>
                      {list.length > 0 && k < today && (published ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />)}
                    </div>
                    {efTop && inMonth && (
                      <div className={`rounded-md px-1.5 py-0.5 text-[10px] leading-tight border border-dashed line-clamp-2 ${decisions.get(efTop.key)?.decision === "si" ? "border-emerald-500/60 text-emerald-600 dark:text-emerald-400" : efTop.affinity ? "border-coral/60 text-coral" : "border-border text-muted-foreground"}`} title={dayEf.map((e) => e.name).join(" · ")}>
                        ★ {efTop.name}{dayEf.length > 1 ? ` +${dayEf.length - 1}` : ""}
                      </div>
                    )}
                    {list.slice(0, 3).map((i) => (
                      <div key={i.id} className="rounded-md px-1.5 py-1 text-[11px] leading-tight bg-muted/50 border-l-2" style={{ borderColor: netsOf(i.network)[0]?.color ?? "hsl(var(--coral))" }}>
                        <div className="line-clamp-2 font-medium">{i.title ?? i.theme}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{i.format}</div>
                      </div>
                    ))}
                    {list.length > 3 && <div className="text-[10px] text-coral">+{list.length - 3} más</div>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground px-1 pt-3">
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Hubo publicación ese día</span>
            <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Sin publicación registrada</span>
            {showEf && <span className="inline-flex items-center gap-1 text-coral">★ Efeméride sugerida (clic en el día para decidir)</span>}
          </div>
        </Card>
      ) : (
        <Card className="glass border-border/50 divide-y divide-border/50">
          {monthItems.length ? monthItems.map((i) => (
            <button key={i.id} onClick={() => setOpen(i)} className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
              <div className="w-14 text-center shrink-0">
                <div className="text-lg font-display font-bold leading-none">{Number(i.scheduled_date!.slice(8, 10))}</div>
                <div className="text-[10px] uppercase text-muted-foreground">{new Date(i.scheduled_date + "T00:00:00").toLocaleDateString("es-MX", { weekday: "short" })}</div>
              </div>
              <div className="w-1 self-stretch rounded-full" style={{ background: netsOf(i.network)[0]?.color ?? "hsl(var(--coral))" }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{i.title ?? i.theme}</div>
                <div className="text-[11px] text-muted-foreground truncate">{cleanNet(i.network)} · {i.format}{i.objective ? ` · ${i.objective}` : ""}</div>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${STATUS(i.status).cls}`}>{STATUS(i.status).label}</span>
            </button>
          )) : <div className="p-10 text-center text-sm text-muted-foreground">No hay piezas planeadas este mes.</div>}
        </Card>
      )}

      {/* Detalle del día */}
      <Sheet open={!!day || !!open} onOpenChange={(o) => { if (!o) { setDay(null); setOpen(null); } }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle className="capitalize">{open ? longDate(open.scheduled_date!) : day ? longDate(day) : ""}</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-3">
            {!open && day && (efByDay.get(day) ?? []).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">Efemérides de este día</div>
                {(efByDay.get(day) ?? []).map((e) => <EfemerideRow key={e.key} e={e} dec={decisions.get(e.key)?.decision} hasPost={dayList.length > 0} canEdit={canDecide} decide={decide} />)}
              </div>
            )}
            {(open ? [open] : dayList).map((i) => (
              <div key={i.id} className="rounded-xl border border-border/60 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm">{i.title ?? i.theme}</div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 ${STATUS(i.status).cls}`}>{STATUS(i.status).label}</span>
                </div>
                <Field k="Redes" v={cleanNet(i.network)} />
                <Field k="Formato" v={i.format} />
                <Field k="Objetivo" v={i.objective} />
                {i.theme && i.theme !== i.title && <Field k="Tema" v={i.theme} />}
                <Field k="Responsable" v={i.responsible} />
                {i.notion_url && <a href={i.notion_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-coral">Abrir en Notion <ExternalLink className="w-3 h-3" /></a>}
              </div>
            ))}
            {(() => { const k = open?.scheduled_date ?? day; const ps = k ? pubByDay.get(k) ?? [] : []; return ps.length ? (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-muted-foreground">Lo que se publicó ese día</div>
                {ps.map((p, idx) => (
                  <a key={idx} href={p.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-border/50 p-2.5 text-xs hover:border-coral/40">
                    <div className="text-muted-foreground">{NETS.find((n) => n.k === p.network)?.label} · {p.interactions.toLocaleString("es-MX")} interacciones</div>
                    <div className="line-clamp-2">{p.text}</div>
                  </a>
                ))}
              </div>
            ) : null; })()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: any; hint?: string }) {
  return (
    <Card className="glass border-border/50 p-3.5 space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-display font-bold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
    </Card>
  );
}
function Field({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return <div className="text-xs"><span className="text-muted-foreground">{k}: </span>{v}</div>;
}
