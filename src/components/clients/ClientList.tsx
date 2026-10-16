import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Building2, ChevronRight, Loader2, Trash2, Users2 } from "lucide-react";
import { Client, useCreateClient, useDeleteClient } from "@/hooks/useClients";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  clients: Client[];
  isLoading: boolean;
  onSelect: (id: string) => void;
}

export function ClientList({ clients, isLoading, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientType, setClientType] = useState<"branded" | "benchmark">("branded");
  const create = useCreateClient();
  const del = useDeleteClient();

  const handleCreate = async () => {
    if (!name.trim()) return;
    const c = await create.mutateAsync({ name: name.trim(), description: description.trim(), client_type: clientType });
    setOpen(false);
    setName("");
    setDescription("");
    setClientType("branded");
    onSelect(c.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {clients.length} {clients.length === 1 ? "cliente" : "clientes"}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo cliente</DialogTitle>
              <DialogDescription>
                Crea un cliente (ej. Actinver) para agrupar perfiles propios y de competencia.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-sm font-medium">Nombre</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Actinver" />
              </div>
              <div>
                <label className="text-sm font-medium">Descripción (opcional)</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de cliente</label>
                <RadioGroup value={clientType} onValueChange={(v) => setClientType(v as "branded" | "benchmark")} className="grid grid-cols-1 gap-2">
                  <label htmlFor="ct-branded" className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${clientType === "branded" ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
                    <RadioGroupItem value="branded" id="ct-branded" className="mt-1" />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Building2 className="h-4 w-4 text-primary" /> Cliente con marca propia
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tiene marca propia y competencia. La vista separa Marca vs Benchmark.
                      </p>
                    </div>
                  </label>
                  <label htmlFor="ct-benchmark" className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${clientType === "benchmark" ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
                    <RadioGroupItem value="benchmark" id="ct-benchmark" className="mt-1" />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Users2 className="h-4 w-4 text-primary" /> Grupo de benchmark
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Solo cuentas a comparar entre sí (ej. instituciones, funcionarios). Sin marca propia.
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!name.trim() || create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">Aún no tienes clientes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crea tu primer cliente para empezar a importar datos de Performance.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0 cursor-pointer flex-1" onClick={() => onSelect(c.id)}>
                    <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{c.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar cliente "{c.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción es permanente. Los perfiles asociados perderán el vínculo con este cliente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent className="cursor-pointer" onClick={() => onSelect(c.id)}>
                {c.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.description}</p>
                )}
                <div className="flex items-center justify-between text-xs">
                  {c.client_type === "benchmark" ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Users2 className="h-3 w-3" /> Benchmark
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Building2 className="h-3 w-3" /> Marca propia
                    </span>
                  )}
                  <span className="text-primary font-medium inline-flex items-center">
                    Abrir <ChevronRight className="h-3 w-3 ml-1" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
