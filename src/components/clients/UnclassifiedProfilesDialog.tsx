import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Building2, Users2, HelpCircle, Loader2 } from "lucide-react";
import {
  ClientFKProfile,
  ProfileClassification,
  useUpdateProfileClassifications,
} from "@/hooks/useClients";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: ClientFKProfile[];
  /** Si true, también muestra los ya clasificados para permitir re-clasificar. */
  showAll?: boolean;
}

/**
 * Modal de clasificación masiva de perfiles FK como "Mi marca" o "Competencia".
 * Por defecto se enfoca en perfiles `unclassified`, pero con `showAll` permite
 * re-clasificar perfiles existentes desde Configuración.
 */
export function UnclassifiedProfilesDialog({ open, onOpenChange, profiles, showAll = false }: Props) {
  const update = useUpdateProfileClassifications();
  const [selections, setSelections] = useState<Record<string, ProfileClassification>>({});

  const targets = useMemo(
    () => (showAll ? profiles : profiles.filter((p) => p.classification_status === "unclassified")),
    [profiles, showAll],
  );

  // Reinicia selecciones cuando se abre o cambian los targets
  useEffect(() => {
    if (!open) return;
    const init: Record<string, ProfileClassification> = {};
    targets.forEach((p) => {
      init[p.id] = p.classification_status;
    });
    setSelections(init);
  }, [open, targets]);

  const setAll = (value: ProfileClassification) => {
    const next: Record<string, ProfileClassification> = {};
    targets.forEach((p) => {
      next[p.id] = value;
    });
    setSelections(next);
  };

  const pendingCount = targets.filter((p) => selections[p.id] === "unclassified").length;
  const changedCount = targets.filter((p) => selections[p.id] !== p.classification_status).length;

  const handleSave = async () => {
    const updates = targets
      .filter((p) => selections[p.id] && selections[p.id] !== p.classification_status)
      .map((p) => ({ id: p.id, classification: selections[p.id] }));
    if (updates.length === 0) {
      onOpenChange(false);
      return;
    }
    try {
      await update.mutateAsync(updates);
      onOpenChange(false);
    } catch {
      /* toast handled in hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Clasificar perfiles</DialogTitle>
          <DialogDescription>
            Marca cada perfil como <strong>Mi marca</strong> o <strong>Competencia</strong>. Esta clasificación
            controla qué se muestra en la vista &ldquo;Marca&rdquo; vs &ldquo;Benchmark&rdquo; y se aplica a todas
            las importaciones futuras.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 py-2 border-y">
          <div className="text-xs text-muted-foreground">
            {targets.length} {targets.length === 1 ? "perfil" : "perfiles"} ·{" "}
            {pendingCount > 0 ? (
              <span className="text-wizr-orange font-medium">{pendingCount} sin clasificar</span>
            ) : (
              <span className="text-primary font-medium">Todos clasificados</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Aplicar a todos:</span>
            <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setAll("brand")}>
              <Building2 className="h-3 w-3" /> Mi marca
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setAll("competitor")}>
              <Users2 className="h-3 w-3" /> Competencia
            </Button>
          </div>
        </div>

        <div className="overflow-auto flex-1 -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Perfil</TableHead>
                <TableHead>Red</TableHead>
                <TableHead className="w-[280px] text-right">Clasificación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                    No hay perfiles para clasificar.
                  </TableCell>
                </TableRow>
              ) : (
                targets.map((p) => {
                  const value = selections[p.id] ?? p.classification_status;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {p.canonical_name || p.display_name || p.profile_id}
                          </span>
                          {p.canonical_name && p.display_name && p.canonical_name !== p.display_name && (
                            <span className="text-xs text-muted-foreground">{p.display_name}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{p.network}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ToggleGroup
                          type="single"
                          value={value}
                          onValueChange={(v) =>
                            v && setSelections((prev) => ({ ...prev, [p.id]: v as ProfileClassification }))
                          }
                          className="justify-end"
                        >
                          <ToggleGroupItem value="brand" size="sm" className="h-8 px-2 gap-1 text-xs">
                            <Building2 className="h-3 w-3" /> Marca
                          </ToggleGroupItem>
                          <ToggleGroupItem value="competitor" size="sm" className="h-8 px-2 gap-1 text-xs">
                            <Users2 className="h-3 w-3" /> Competencia
                          </ToggleGroupItem>
                          <ToggleGroupItem value="unclassified" size="sm" className="h-8 px-2 gap-1 text-xs">
                            <HelpCircle className="h-3 w-3" /> Pendiente
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={update.isPending || changedCount === 0}>
            {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar {changedCount > 0 ? `(${changedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
