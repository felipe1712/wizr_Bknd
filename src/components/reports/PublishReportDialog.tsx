import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Copy, Check, Loader2, ExternalLink, Globe } from "lucide-react";
import { useCreateSharedReport, type SharedReport, type SharedReportKind } from "@/hooks/useSharedReports";
import { useToast } from "@/hooks/use-toast";

interface PublishReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // New API: owner can be a project (Listening) or a client (Performance)
  ownerKind?: "project" | "client";
  ownerId?: string;
  ownerName?: string;
  reportKind?: SharedReportKind;
  // Legacy props (Listening) — still supported
  projectId?: string;
  projectName?: string;
  report: any;
  dateRange: { start: string; end: string; label: string };
}

const EXPIRY_OPTIONS = [
  { value: "never", label: "No caduca", days: null },
  { value: "7", label: "7 días", days: 7 },
  { value: "30", label: "30 días", days: 30 },
  { value: "90", label: "90 días", days: 90 },
];

export function PublishReportDialog({
  open,
  onOpenChange,
  ownerKind,
  ownerId,
  ownerName,
  reportKind,
  projectId,
  projectName,
  report,
  dateRange,
}: PublishReportDialogProps) {
  const resolvedOwnerKind: "project" | "client" = ownerKind ?? "project";
  const resolvedOwnerId = ownerId ?? projectId ?? "";
  const resolvedOwnerName = ownerName ?? projectName ?? "";
  const resolvedKind: SharedReportKind = reportKind ?? "listening";

  const [title, setTitle] = useState(report.title || `Reporte ${resolvedOwnerName}`);
  const [expiry, setExpiry] = useState("30");
  const [created, setCreated] = useState<SharedReport | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useCreateSharedReport();
  const { toast } = useToast();

  const publicUrl = created
    ? `${window.location.origin}/r/${created.public_token}`
    : "";

  const handlePublish = async () => {
    const days = EXPIRY_OPTIONS.find((o) => o.value === expiry)?.days ?? null;
    const result = await create.mutateAsync({
      owner_kind: resolvedOwnerKind,
      owner_id: resolvedOwnerId,
      owner_name: resolvedOwnerName,
      report_kind: resolvedKind,
      title,
      content: report,
      date_range: dateRange,
      expires_in_days: days,
    });
    setCreated(result);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast({ title: "Link copiado al portapapeles" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setCreated(null);
    setCopied(false);
    setTitle(report.title || `Reporte ${resolvedOwnerName}`);
    setExpiry("30");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {created ? "Reporte publicado" : "Publicar reporte como link"}
          </DialogTitle>
          <DialogDescription>
            {created
              ? "Comparte este link con tu cliente. No requiere login."
              : "Genera un link público compartible para enviar este reporte por correo o enlace directo."}
          </DialogDescription>
        </DialogHeader>

        {!created ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Reporte mensual..."
              />
            </div>

            <div className="space-y-2">
              <Label>Caducidad del link</Label>
              <RadioGroup value={expiry} onValueChange={setExpiry} className="grid grid-cols-2 gap-2">
                {EXPIRY_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2 rounded-md border p-2">
                    <RadioGroupItem value={opt.value} id={`exp-${opt.value}`} />
                    <Label htmlFor={`exp-${opt.value}`} className="cursor-pointer text-sm font-normal">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Podrás revocarlo manualmente cuando quieras desde la lista de reportes publicados.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Link público</Label>
              <div className="flex gap-2">
                <Input value={publicUrl} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
              <p>• Cualquiera con este link podrá ver el reporte (sin login)</p>
              <p>• El reporte queda guardado y puedes revocarlo cuando quieras</p>
              {created.expires_at && (
                <p>
                  • Expira el {new Date(created.expires_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {!created ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handlePublish} disabled={create.isPending || !title.trim()}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                Publicar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cerrar
              </Button>
              <Button asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Ver
                </a>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

