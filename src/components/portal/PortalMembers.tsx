import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

type Member = { id: string; user_id: string; created_at: string; email: string | null; full_name: string | null; last_sign_in_at: string | null };

/** Personas que solo pueden entrar a ESTE portal (sin acceso a Operación ni a otros clientes). */
export default function PortalMembers({ clientId, onChange }: { clientId: string; onChange?: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-portal-user", {
      body: { action: "list_members", client_id: clientId },
    });
    if (error || (data as any)?.error) toast.error((data as any)?.error ?? error?.message);
    setMembers(((data as any)?.members ?? []) as Member[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const add = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("manage-portal-user", {
      body: { action: "add_member", client_id: clientId, email, password, full_name: name },
    });
    setSaving(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? error?.message); return; }
    toast.success("Acceso creado");
    setName(""); setEmail(""); setPassword("");
    load(); onChange?.();
  };

  const revoke = async (id: string) => {
    if (!confirm("¿Quitar el acceso a este portal?")) return;
    const { error } = await supabase.from("client_access").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Acceso retirado");
    load(); onChange?.();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div>
          <Label className="text-base">Dar acceso solo a este portal</Label>
          <p className="text-xs text-muted-foreground">
            La persona entra con su correo y contraseña y solo ve este portal. No tiene acceso a Operación ni a otros clientes.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input placeholder="Nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="text" placeholder="Contraseña (mín. 8)" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button onClick={add} disabled={saving || !email || password.length < 8}>
          <UserPlus className="w-4 h-4 mr-2" /> {saving ? "Creando..." : "Dar acceso"}
        </Button>
      </Card>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Cargando...</div>
      ) : members.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Nadie tiene acceso aún.</Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.id} className="p-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">{m.full_name || m.email || m.user_id}</div>
                <div className="text-xs text-muted-foreground">
                  {m.full_name && m.email ? `${m.email} · ` : ""}
                  Desde {new Date(m.created_at).toLocaleDateString("es-MX")}
                  {m.last_sign_in_at ? ` · Último ingreso ${new Date(m.last_sign_in_at).toLocaleDateString("es-MX")}` : " · Aún no entra"}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => revoke(m.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
