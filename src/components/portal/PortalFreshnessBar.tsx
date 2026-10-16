import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react";
import { usePortalFreshness, fmtDay } from "./usePortalFreshness";

/**
 * Barra de ritmo del portal: comunica cuándo se actualizó por última vez y
 * hasta qué fecha llega cada insumo. El compromiso operativo es dejar el
 * portal al día cada lunes antes de las 12:00 (hora de la Ciudad de México).
 */
export default function PortalFreshnessBar({ clientId, canEdit }: { clientId: string; canEdit?: boolean }) {
  const f = usePortalFreshness(clientId);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [press, setPress] = useState("");
  const [social, setSocial] = useState("");
  const [nar, setNar] = useState("");

  if (f.loading) return null;

  const u = f.lastUpdate;
  const alDia = !f.atrasado;

  const registrar = async () => {
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    const { error } = await supabase.from("client_portal_updates").insert({
      client_id: clientId,
      press_data_through: press || f.pressThrough,
      social_data_through: social || f.socialThrough,
      narratives_data_through: nar || f.narrativesThrough,
      notes: notes || null,
      created_by: s.session?.user.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Actualización registrada");
    setOpen(false);
    setNotes(""); setPress(""); setSocial(""); setNar("");
    f.refetch();
  };

  return (
    <div className={`glass rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 border ${alDia ? "border-border/60" : "border-amber-500/40 bg-amber-500/5"}`}>
      <div className="flex items-center gap-2 min-w-0">
        {alDia
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Ritmo de actualización</div>
          <div className="text-sm font-medium truncate">
            {u
              ? `Actualizado el ${fmtDay(u.updated_on)}`
              : "Sin actualizaciones registradas"}
            {!alDia && " · pendiente esta semana"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Fuente label="Prensa" value={u?.press_data_through ?? f.pressThrough} />
        <Fuente label="Redes" value={u?.social_data_through ?? f.socialThrough} />
        <Fuente label="Narrativas" value={u?.narratives_data_through ?? f.narrativesThrough} />
      </div>

      <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1.5">
        <CalendarClock className="w-3.5 h-3.5" />
        Corte comprometido: lunes 12:00
      </span>

      {canEdit && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant={alDia ? "outline" : "default"} className="h-8">
              Registrar actualización
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar la actualización del portal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Deja constancia de hasta qué fecha llega cada insumo. Si dejas un campo vacío se toma
                la última fecha detectada en la base.
              </p>
              <Campo label={`Prensa (detectado: ${fmtDay(f.pressThrough)})`} value={press} onChange={setPress} />
              <Campo label={`Redes (detectado: ${fmtDay(f.socialThrough)})`} value={social} onChange={setSocial} />
              <Campo label={`Narrativas (detectado: ${fmtDay(f.narrativesThrough)})`} value={nar} onChange={setNar} />
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Notas</span>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Qué quedó cargado, qué falta…" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={registrar} disabled={saving}>{saving ? "Guardando…" : "Registrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Fuente({ label, value }: { label: string; value: string | null }) {
  return (
    <Badge variant="outline" className="text-[10px] font-normal">
      {label}: <span className="ml-1 font-medium">{fmtDay(value)}</span>
    </Badge>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
