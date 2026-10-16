import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarHeart, Check, X, Undo2, Sparkles } from "lucide-react";
import { efemeridesFor, useEfemerideDecisions, daysUntil, todayIso, affinityLabel, type Efemeride } from "@/lib/efemerides";

const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });

export default function EfemeridesRadar({ clientId }: { clientId: string }) {
  const [range, setRange] = useState<14 | 30 | 60>(30);
  const [filter, setFilter] = useState<"sugeridas" | "todas" | "si">("sugeridas");
  const [planned, setPlanned] = useState<Set<string>>(new Set());
  const { decisions, decide, canEdit } = useEfemerideDecisions(clientId);
  const all = useMemo(() => efemeridesFor(clientId), [clientId]);

  useEffect(() => {
    supabase.from("notion_parrilla_items").select("scheduled_date").eq("client_id", clientId).gte("scheduled_date", todayIso())
      .then(({ data }) => setPlanned(new Set((data ?? []).map((r: any) => r.scheduled_date))));
  }, [clientId]);

  const list = useMemo(() => all.filter((e) => {
    const d = daysUntil(e.date); if (d < 0 || d > range) return false;
    const dec = decisions.get(e.key)?.decision;
    if (filter === "si") return dec === "si";
    if (filter === "sugeridas") return dec !== "no" && (!!e.affinity || dec === "si");
    return true;
  }), [all, range, filter, decisions]);

  const accepted = all.filter((e) => decisions.get(e.key)?.decision === "si" && daysUntil(e.date) >= 0).length;
  const Chip = ({ on, onClick, children }: any) => (
    <button onClick={onClick} className={`px-3 h-7 rounded-full text-xs border transition-colors ${on ? "border-coral bg-coral/10 text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>{children}</button>
  );

  return (
    <Card className="glass border-border/50 p-4 mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 font-display font-semibold"><CalendarHeart className="w-4 h-4 text-coral" /> Efemérides para subirnos</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fechas próximas cruzadas con la parrilla{affinityLabel(clientId) ? `; sugerimos las afines a ${affinityLabel(clientId)}` : ""}.
            {accepted ? ` ${accepted} ya confirmadas.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Chip on={filter === "sugeridas"} onClick={() => setFilter("sugeridas")}>Sugeridas</Chip>
          <Chip on={filter === "si"} onClick={() => setFilter("si")}>Confirmadas</Chip>
          <Chip on={filter === "todas"} onClick={() => setFilter("todas")}>Todas</Chip>
          <span className="w-px bg-border mx-1" />
          {([14, 30, 60] as const).map((r) => <Chip key={r} on={range === r} onClick={() => setRange(r)}>{r} días</Chip>)}
        </div>
      </div>
      {list.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[340px] overflow-y-auto pr-1">
          {list.map((e) => <EfemerideRow key={e.key} e={e} dec={decisions.get(e.key)?.decision} hasPost={planned.has(e.date)} canEdit={canEdit} decide={decide} />)}
        </div>
      ) : <div className="text-sm text-muted-foreground py-6 text-center">No hay efemérides {filter === "si" ? "confirmadas" : "sugeridas"} en los próximos {range} días.</div>}
    </Card>
  );
}

export function EfemerideRow({ e, dec, hasPost, canEdit, decide }: { e: Efemeride; dec?: "si" | "no"; hasPost?: boolean; canEdit: boolean; decide: (e: Efemeride, d: "si" | "no" | null) => void }) {
  const d = daysUntil(e.date);
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 ${dec === "si" ? "border-emerald-500/50 bg-emerald-500/5" : dec === "no" ? "border-border/40 opacity-60" : "border-border/60 bg-card/40"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium leading-tight">{e.name}</div>
          <div className="text-[11px] text-muted-foreground capitalize mt-0.5">{fmt(e.date)} · {d === 0 ? "hoy" : d > 0 ? `en ${d} días` : `hace ${-d} días`}</div>
        </div>
        {e.affinity && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-coral/10 text-coral shrink-0 inline-flex items-center gap-1"><Sparkles className="w-3 h-3" />{e.affinity === "afin" ? "Afín" : "Masiva"}</span>}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {dec === "si" ? (hasPost ? "Confirmada · ya hay pieza ese día en la parrilla" : "Confirmada · falta agregar la pieza en la parrilla")
          : hasPost ? "Ese día ya hay una pieza planeada" : "Ese día está libre en la parrilla"}
      </div>
      {canEdit && (
        <div className="flex gap-1">
          {dec ? <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => decide(e, null)}><Undo2 className="w-3.5 h-3.5 mr-1" />Deshacer</Button> : <>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => decide(e, "si")}><Check className="w-3.5 h-3.5 mr-1" />Nos subimos</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => decide(e, "no")}><X className="w-3.5 h-3.5 mr-1" />Descartar</Button>
          </>}
        </div>
      )}
    </div>
  );
}
