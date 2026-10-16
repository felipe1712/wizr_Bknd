import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Trash2, Ban, Eye, Check, Loader2 } from "lucide-react";
import {
  useSharedReportsByProject,
  useSharedReportsByClient,
  useRevokeSharedReport,
  useDeleteSharedReport,
} from "@/hooks/useSharedReports";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface SharedReportsListProps {
  projectId?: string;
  clientId?: string;
}

export function SharedReportsList({ projectId, clientId }: SharedReportsListProps) {
  const projectQuery = useSharedReportsByProject(projectId);
  const clientQuery = useSharedReportsByClient(clientId);
  const { data: reports, isLoading } = clientId ? clientQuery : projectQuery;
  const revoke = useRevokeSharedReport();
  const remove = useDeleteSharedReport();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Aún no has publicado reportes. Genera un reporte y haz clic en "Publicar como link" para compartirlo.
      </Card>
    );
  }

  const handleCopy = async (token: string, id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/r/${token}`);
    setCopiedId(id);
    toast({ title: "Link copiado" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-2">
      {reports.map((r) => {
        const expired = r.expires_at && new Date(r.expires_at) < new Date();
        const inactive = r.is_revoked || expired;
        const url = `${window.location.origin}/r/${r.public_token}`;

        return (
          <Card key={r.id} className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium truncate">{r.title}</h4>
                {r.is_revoked && <Badge variant="destructive" className="text-[10px]">Revocado</Badge>}
                {expired && !r.is_revoked && <Badge variant="secondary" className="text-[10px]">Expirado</Badge>}
                {!inactive && <Badge variant="default" className="text-[10px] bg-green-600">Activo</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Publicado el {format(new Date(r.created_at), "d MMM yyyy", { locale: es })}
                {r.expires_at && !expired && ` · Expira ${format(new Date(r.expires_at), "d MMM yyyy", { locale: es })}`}
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {r.view_count}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(r.public_token, r.id)}
                disabled={inactive}
                title="Copiar link"
              >
                {copiedId === r.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" asChild disabled={inactive} title="Abrir">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              {!r.is_revoked && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => revoke.mutate(r.id)}
                  disabled={revoke.isPending}
                  title="Revocar"
                  className="text-orange-600 hover:text-orange-700"
                >
                  <Ban className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`¿Eliminar definitivamente "${r.title}"?`)) remove.mutate(r);
                }}
                disabled={remove.isPending}
                title="Eliminar"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
