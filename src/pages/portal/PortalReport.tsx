import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Calendar, Download, Paperclip } from "lucide-react";
import type { ClientPortalConfig } from "@/lib/clientPortal";

type Report = {
  id: string;
  report_date: string;
  title: string;
  type: string;
  summary_md: string | null;
  client_id: string;
};

type Attachment = {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
};

const TYPE_LABEL: Record<string, string> = {
  daily: "Análisis diario",
  weekly: "Reporte semanal",
  benchmark: "Benchmark",
  other: "Otro",
};

export default function PortalReport({ portal }: { portal: ClientPortalConfig }) {
  const { reportId } = useParams<{ reportId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reportId) return;
    (async () => {
      setLoading(true);
      const { data: r, error } = await supabase
        .from("client_portal_reports")
        .select("id, report_date, title, type, summary_md, client_id")
        .eq("id", reportId)
        .maybeSingle();
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      if (!r || r.client_id !== portal.clientId) {
        setReport(null);
        setLoading(false);
        return;
      }
      setReport(r as Report);
      const { data: att } = await supabase
        .from("client_portal_attachments")
        .select("id, file_name, storage_path, mime_type, size_bytes")
        .eq("report_id", reportId)
        .order("created_at", { ascending: true });
      setAttachments((att ?? []) as Attachment[]);
      setLoading(false);
    })();
  }, [reportId, portal.clientId]);

  const download = async (a: Attachment) => {
    const { data, error } = await supabase.storage
      .from("client-reports")
      .createSignedUrl(a.storage_path, 60);
    if (error || !data) {
      toast.error("No se pudo generar el enlace");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-mesh opacity-30 pointer-events-none" />
      <header className="relative border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative max-w-3xl mx-auto px-6 py-10">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Cargando...</div>
        ) : !report ? (
          <div className="text-center py-16 text-muted-foreground">
            Reporte no encontrado o sin acceso.
          </div>
        ) : (
          <article className="space-y-6">
            <header className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{TYPE_LABEL[report.type] ?? report.type}</Badge>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(report.report_date + "T00:00:00").toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <h1 className="text-3xl font-display font-bold text-foreground">{report.title}</h1>
            </header>

            {report.summary_md && (
              <div className="prose prose-invert max-w-none prose-headings:font-display prose-a:text-coral">
                <ReactMarkdown>{report.summary_md}</ReactMarkdown>
              </div>
            )}

            {attachments.length > 0 && (
              <section className="glass rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Adjuntos ({attachments.length})
                </h2>
                <ul className="space-y-2">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 p-2 rounded hover:bg-muted/50">
                      <span className="text-sm truncate">{a.file_name}</span>
                      <Button size="sm" variant="ghost" onClick={() => download(a)}>
                        <Download className="w-4 h-4 mr-1" /> Descargar
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        )}
      </main>

      <footer className="relative py-8 text-center text-xs text-muted-foreground/60">
        powered by KiMedia
      </footer>
    </div>
  );
}