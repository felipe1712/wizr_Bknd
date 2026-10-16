import PortalMembers from "@/components/portal/PortalMembers";
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Paperclip, Upload, X, Users, FileText, Lightbulb, KeyRound, Save, MessageSquare, Sparkles, BarChart3, Target } from "lucide-react";
import { toast } from "sonner";
import { parseBitacoraTxt } from "@/lib/bitacoraParser";
import { CLIENT_PORTALS } from "@/lib/clientPortal";
import BenchmarkAdmin from "@/components/portal/BenchmarkAdmin";
import PortalDataAdmin from "@/components/portal/PortalDataAdmin";

type Report = {
  id: string;
  report_date: string;
  title: string;
  type: string;
  summary_md: string | null;
  created_at: string;
};

type Attachment = {
  id: string;
  file_name: string;
  storage_path: string;
};

type AccessRow = {
  id: string;
  user_id: string;
  created_at: string;
  email?: string | null;
};

type WeeklyRec = {
  id: string;
  week_start: string;
  for_client_md: string | null;
  for_team_md: string | null;
  priority: string;
};

type Credentials = {
  id?: string;
  portal_email: string | null;
  notes: string | null;
  portal_user_id?: string | null;
};

type ListeningEntry = {
  id: string;
  entry_date: string;
  content_md: string;
  source: string;
  sentiment?: string | null;
  urgency?: string | null;
  topics?: string[] | null;
  summary?: string | null;
  analyzed_at?: string | null;
};

const TYPE_OPTIONS = [
  { value: "daily", label: "Análisis diario" },
  { value: "weekly", label: "Reporte semanal" },
  { value: "benchmark", label: "Benchmark" },
  { value: "other", label: "Otro" },
];

export default function ClientPortalAdmin() {
  const { clientId: rawClientId } = useParams<{ clientId: string }>();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const clientId = rawClientId && UUID_RE.test(rawClientId)
    ? rawClientId
    : (rawClientId ? CLIENT_PORTALS[rawClientId]?.clientId : undefined);
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [clientName, setClientName] = useState("");
  const [portalModules, setPortalModules] = useState<Record<string, boolean>>({});
  const [services, setServices] = useState<string[]>([]);
  const [tab, setTab] = useState<string>("datos");
  const [reports, setReports] = useState<Report[]>([]);
  const [access, setAccess] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<WeeklyRec[]>([]);
  const [creds, setCreds] = useState<Credentials>({ portal_email: "", notes: "" });

  // Create-report dialog state
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    report_date: new Date().toISOString().slice(0, 10),
    title: "",
    type: "daily",
    summary_md: "",
  });
  const [files, setFiles] = useState<File[]>([]);

  // Grant-access state
  const [newUserId, setNewUserId] = useState("");

  // Weekly rec editor state
  const [recForm, setRecForm] = useState<WeeklyRec>({
    id: "", week_start: new Date().toISOString().slice(0, 10),
    for_client_md: "", for_team_md: "", priority: "media",
  });
  const [recSaving, setRecSaving] = useState(false);

  // Listening state
  const [listening, setListening] = useState<ListeningEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{ date: string; chars: number; kinds: string[]; dated: boolean }[] | null>(null);
  const [importText, setImportText] = useState<string>("");
  const [importFileName, setImportFileName] = useState<string>("");

  // Paste-text state
  const [pasteText, setPasteText] = useState("");
  const [pasteDate, setPasteDate] = useState(new Date().toISOString().slice(0, 10));
  const [pasteMode, setPasteMode] = useState<"append" | "replace">("append");
  const [pasting, setPasting] = useState(false);

  // AI analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [weeklyDate, setWeeklyDate] = useState(() => {
    const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().slice(0, 10);
  });
  const [genSummary, setGenSummary] = useState(false);

  const analyzeEntries = async (opts: { forceAll?: boolean } = {}) => {
    if (!clientId) return;
    if (opts.forceAll && !confirm("Reprocesar TODAS las entradas (incluidas las ya analizadas) para extraer canales, entidades, eventos y citas. ¿Continuar?")) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-listening-entries", {
        body: {
          client_id: clientId,
          only_unanalyzed: !opts.forceAll,
          limit: opts.forceAll ? 500 : 100,
          background: true,
        },
      });
      if (error) throw error;
      if (data?.background) {
        toast.success(`Procesando ${data.total} entradas en segundo plano. Recarga en 1-3 min.`);
      } else {
        toast.success(`Analizadas ${data?.processed ?? 0} entradas`);
      }
      setTimeout(() => load(), 3000);
    } catch (e: any) {
      toast.error(e.message ?? "Error al analizar");
    } finally { setAnalyzing(false); }
  };
  const analyzePending = () => analyzeEntries();
  const reprocessAll = () => analyzeEntries({ forceAll: true });

  const generateWeeklySummary = async () => {
    if (!clientId || !weeklyDate) return;
    setGenSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-listening-weekly-summary", {
        body: { client_id: clientId, week_start: weeklyDate },
      });
      if (error) throw error;
      toast.success("Resumen semanal generado. Visible en el portal del cliente en la pestaña Análisis.");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo generar el resumen");
    } finally { setGenSummary(false); }
  };

  const SENTIMENT_STYLES: Record<string, string> = {
    positivo: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    neutral: "bg-muted text-muted-foreground",
    negativo: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    crisis: "bg-red-500/15 text-red-700 border-red-500/30",
  };
  const URGENCY_STYLES: Record<string, string> = {
    baja: "bg-muted text-muted-foreground",
    media: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    alta: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    critica: "bg-red-500/15 text-red-700 border-red-500/30",
  };

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { navigate("/login"); return; }
      setChecking(false);
    })();
  }, [navigate]);

  useEffect(() => {
    if (checking || !clientId) return;
    load();
  }, [checking, clientId]);

  const hasAnalisis = services.length === 0 || services.includes("analisis");

  useEffect(() => {
    if (!hasAnalisis && ["listening", "benchmark", "reportes", "recs"].includes(tab)) setTab("datos");
  }, [hasAnalisis, tab]);

  const load = async () => {
    setLoading(true);
    const [c, r, a, w, cr, ls] = await Promise.all([
      supabase.from("clients").select("name, portal_modules, services").eq("id", clientId).maybeSingle(),
      supabase
        .from("client_portal_reports")
        .select("id, report_date, title, type, summary_md, created_at")
        .eq("client_id", clientId)
        .order("report_date", { ascending: false }),
      supabase
        .from("client_access")
        .select("id, user_id, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_portal_weekly_recommendations")
        .select("id, week_start, for_client_md, for_team_md, priority")
        .eq("client_id", clientId)
        .order("week_start", { ascending: false }),
      supabase
        .from("client_portal_credentials")
        .select("id, portal_email, notes, portal_user_id")
        .eq("client_id", clientId)
        .maybeSingle(),
      supabase
        .from("client_portal_listening_entries")
        .select("id, entry_date, content_md, source, sentiment, urgency, topics, summary, analyzed_at")
        .eq("client_id", clientId)
        .order("entry_date", { ascending: false })
        .limit(500),
    ]);
    setClientName(c.data?.name ?? "");
    setPortalModules((((c.data as any)?.portal_modules) ?? {}) as Record<string, boolean>);
    setServices((((c.data as any)?.services) ?? []) as string[]);
    setReports((r.data ?? []) as Report[]);
    setAccess((a.data ?? []) as AccessRow[]);
    setRecs((w.data ?? []) as WeeklyRec[]);
    if (cr.data) setCreds(cr.data as Credentials);
    else setCreds({ portal_email: "", notes: "" });
    setListening((ls.data ?? []) as ListeningEntry[]);
    setLoading(false);
  };

  const createReport = async () => {
    if (!clientId) return;
    if (!form.title.trim()) { toast.error("El título es obligatorio"); return; }
    setSaving(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const { data: created, error } = await supabase
        .from("client_portal_reports")
        .insert({
          client_id: clientId,
          report_date: form.report_date,
          title: form.title.trim(),
          type: form.type,
          summary_md: form.summary_md.trim() || null,
          created_by: s.session?.user.id,
        })
        .select()
        .single();
      if (error) throw error;

      for (const f of files) {
        const path = `${clientId}/${created.id}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("client-reports")
          .upload(path, f, { upsert: false });
        if (upErr) { toast.error(`Adjunto ${f.name}: ${upErr.message}`); continue; }
        await supabase.from("client_portal_attachments").insert({
          report_id: created.id,
          file_name: f.name,
          storage_path: path,
          mime_type: f.type,
          size_bytes: f.size,
        });
      }

      toast.success("Reporte publicado");
      setForm({ report_date: new Date().toISOString().slice(0, 10), title: "", type: "daily", summary_md: "" });
      setFiles([]);
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm("¿Eliminar este reporte?")) return;
    const { data: atts } = await supabase
      .from("client_portal_attachments")
      .select("storage_path")
      .eq("report_id", id);
    if (atts && atts.length) {
      await supabase.storage.from("client-reports").remove(atts.map((a) => a.storage_path));
    }
    const { error } = await supabase.from("client_portal_reports").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminado");
    load();
  };

  const grantAccess = async () => {
    if (!clientId || !newUserId.trim()) return;
    const { error } = await supabase
      .from("client_access")
      .insert({ user_id: newUserId.trim(), client_id: clientId });
    if (error) { toast.error(error.message); return; }
    toast.success("Acceso otorgado");
    setNewUserId("");
    load();
  };

  const revokeAccess = async (id: string) => {
    if (!confirm("¿Revocar acceso?")) return;
    const { error } = await supabase.from("client_access").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Acceso revocado");
    load();
  };

  const saveRec = async () => {
    if (!clientId) return;
    setRecSaving(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const payload = {
        client_id: clientId,
        week_start: recForm.week_start,
        for_client_md: recForm.for_client_md?.trim() || null,
        for_team_md: recForm.for_team_md?.trim() || null,
        priority: recForm.priority,
        created_by: s.session?.user.id,
      };
      const { error } = await supabase
        .from("client_portal_weekly_recommendations")
        .upsert(payload, { onConflict: "client_id,week_start" });
      if (error) throw error;
      toast.success("Recomendación guardada");
      setRecForm({ id: "", week_start: new Date().toISOString().slice(0, 10), for_client_md: "", for_team_md: "", priority: "media" });
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setRecSaving(false); }
  };

  const editRec = (w: WeeklyRec) => {
    setRecForm({
      id: w.id, week_start: w.week_start,
      for_client_md: w.for_client_md ?? "", for_team_md: w.for_team_md ?? "",
      priority: w.priority,
    });
  };

  const deleteRec = async (id: string) => {
    if (!confirm("¿Eliminar esta recomendación?")) return;
    const { error } = await supabase.from("client_portal_weekly_recommendations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminada"); load();
  };

  const saveCreds = async () => {
    if (!clientId) return;
    const { data: s } = await supabase.auth.getSession();
    const { error } = await supabase.from("client_portal_credentials").upsert({
      client_id: clientId,
      portal_email: creds.portal_email?.trim() || null,
      notes: creds.notes?.trim() || null,
      created_by: s.session?.user.id,
    }, { onConflict: "client_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Credenciales guardadas");
    load();
  };

  // Portal user auth management
  const [newPassword, setNewPassword] = useState("");
  const [portalBusy, setPortalBusy] = useState(false);

  const createOrUpdatePortalUser = async () => {
    if (!clientId) return;
    const email = (creds.portal_email ?? "").trim();
    if (!email) { toast.error("Escribe un email primero"); return; }
    if (newPassword.length < 8) { toast.error("Contraseña mínima 8 caracteres"); return; }
    setPortalBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-portal-user", {
        body: { action: "create", client_id: clientId, email, password: newPassword },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Usuario portal creado/actualizado y acceso otorgado");
      setNewPassword("");
      load();
    } catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setPortalBusy(false); }
  };

  const resetPortalPassword = async () => {
    if (!clientId) return;
    if (newPassword.length < 8) { toast.error("Contraseña mínima 8 caracteres"); return; }
    setPortalBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-portal-user", {
        body: { action: "set_password", client_id: clientId, password: newPassword },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Contraseña actualizada");
      setNewPassword("");
    } catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setPortalBusy(false); }
  };

  const deletePortalUser = async () => {
    if (!clientId) return;
    if (!confirm("¿Eliminar el usuario portal y revocar su acceso?")) return;
    setPortalBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-portal-user", {
        body: { action: "delete", client_id: clientId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Usuario portal eliminado");
      setCreds({ portal_email: "", notes: "", portal_user_id: null });
      load();
    } catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setPortalBusy(false); }
  };

  const handleTxtFile = async (file: File) => {
    setImportFileName(file.name);
    const text = await file.text();
    setImportText(text);
    const parsed = parseBitacoraTxt(text);
    setImportPreview(parsed.map((p) => ({
      date: p.entry_date, chars: p.content_md.length, kinds: p.kinds, dated: p.dated,
    })));
  };

  const importBitacora = async (mode: "upsert" | "skip") => {
    if (!clientId || !importText) return;
    setImporting(true);
    try {
      const parsed = parseBitacoraTxt(importText);
      if (parsed.length === 0) { toast.error("No se detectaron entradas"); return; }
      const { data: s } = await supabase.auth.getSession();
      const rows = parsed.map((p) => ({
        client_id: clientId,
        entry_date: p.entry_date,
        content_md: p.content_md,
        source: "bitacora_txt",
        raw_source_ref: importFileName || null,
        created_by: s.session?.user.id,
      }));
      if (mode === "skip") {
        const dates = rows.map((r) => r.entry_date);
        const { data: existing } = await supabase
          .from("client_portal_listening_entries")
          .select("entry_date")
          .eq("client_id", clientId)
          .in("entry_date", dates);
        const existingSet = new Set((existing ?? []).map((e: any) => e.entry_date));
        const toInsert = rows.filter((r) => !existingSet.has(r.entry_date));
        if (toInsert.length === 0) { toast.info("Nada nuevo que importar"); return; }
        const chunk = 200;
        for (let i = 0; i < toInsert.length; i += chunk) {
          const { error } = await supabase.from("client_portal_listening_entries").insert(toInsert.slice(i, i + chunk));
          if (error) throw error;
        }
        toast.success(`Importadas ${toInsert.length} entradas nuevas`);
      } else {
        // Upsert: reemplaza por (client_id, entry_date) — requiere borrar previas del mismo día
        const dates = Array.from(new Set(rows.map((r) => r.entry_date)));
        await supabase.from("client_portal_listening_entries")
          .delete().eq("client_id", clientId).in("entry_date", dates);
        const chunk = 200;
        for (let i = 0; i < rows.length; i += chunk) {
          const { error } = await supabase.from("client_portal_listening_entries").insert(rows.slice(i, i + chunk));
          if (error) throw error;
        }
        toast.success(`Reemplazadas ${rows.length} entradas`);
      }
      setImportPreview(null); setImportText(""); setImportFileName("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  const deleteListening = async (id: string) => {
    if (!confirm("¿Eliminar esta entrada?")) return;
    const { error } = await supabase.from("client_portal_listening_entries").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminada"); load();
  };

  const importPaste = async () => {
    if (!clientId || !pasteText.trim()) return;
    setPasting(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const hasHeaders = /\[\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}/.test(pasteText);
      let rows: any[] = [];
      if (hasHeaders) {
        const parsed = parseBitacoraTxt(pasteText);
        if (parsed.length === 0) { toast.error("No se detectaron entradas con formato de bitácora"); return; }
        rows = parsed.map((p) => ({
          client_id: clientId,
          entry_date: p.entry_date,
          content_md: p.content_md,
          source: "bitacora_txt",
          created_by: s.session?.user.id,
        }));
      } else {
        rows = [{
          client_id: clientId,
          entry_date: pasteDate,
          content_md: pasteText.trim(),
          source: "manual",
          created_by: s.session?.user.id,
        }];
      }
      const dates = Array.from(new Set(rows.map((r) => r.entry_date)));
      if (pasteMode === "replace") {
        await supabase.from("client_portal_listening_entries")
          .delete().eq("client_id", clientId).in("entry_date", dates);
        const { error } = await supabase.from("client_portal_listening_entries").insert(rows);
        if (error) throw error;
        toast.success(`Reemplazadas ${rows.length} entradas (${dates.length} fecha${dates.length > 1 ? "s" : ""})`);
      } else {
        const { error } = await supabase.from("client_portal_listening_entries").insert(rows);
        if (error) throw error;
        toast.success(`Agregada${rows.length > 1 ? "s" : ""} ${rows.length} entrada${rows.length > 1 ? "s" : ""}`);
      }
      setPasteText("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPasting(false);
    }
  };

  if (checking) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/performance">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" /> Clientes / Performance</Button>
            </Link>
            <div>
              <h1 className="text-2xl font-display font-bold">Portal Ejecutivo · {clientName}</h1>
              <p className="text-sm text-muted-foreground">Datos multicanal, gabinete, benchmark, reportes publicados y accesos autorizados.</p>
            </div>
          </div>
          {clientId && (
            <Link to={`/portal/${Object.values(CLIENT_PORTALS).find((p) => p.clientId === clientId)?.slug ?? clientId}`}>
              <Button variant="outline" size="sm">
                <Sparkles className="w-4 h-4 mr-2" /> Ver Portal Ejecutivo
              </Button>
            </Link>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="datos"><BarChart3 className="w-4 h-4 mr-2" /> Datos del portal</TabsTrigger>
            {hasAnalisis && <TabsTrigger value="listening"><MessageSquare className="w-4 h-4 mr-2" /> Listening</TabsTrigger>}
            {hasAnalisis && <TabsTrigger value="benchmark"><Target className="w-4 h-4 mr-2" /> Benchmark</TabsTrigger>}
            {hasAnalisis && <TabsTrigger value="reportes"><FileText className="w-4 h-4 mr-2" /> Reportes</TabsTrigger>}
            {hasAnalisis && <TabsTrigger value="recs"><Lightbulb className="w-4 h-4 mr-2" /> Recomendaciones</TabsTrigger>}
            <TabsTrigger value="creds"><KeyRound className="w-4 h-4 mr-2" /> Credenciales</TabsTrigger>
            <TabsTrigger value="accesos"><Users className="w-4 h-4 mr-2" /> Usuarios del portal</TabsTrigger>
          </TabsList>


          <TabsContent value="datos" className="space-y-4">
            {clientId && <PortalDataAdmin clientId={clientId} />}
          </TabsContent>


          <TabsContent value="reportes" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" /> Nuevo reporte</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Nuevo reporte</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Fecha</Label>
                        <Input type="date" value={form.report_date} onChange={(e) => setForm({ ...form, report_date: e.target.value })} />
                      </div>
                      <div>
                        <Label>Tipo</Label>
                        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Título</Label>
                      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Análisis del 9 de julio" />
                    </div>
                    <div>
                      <Label>Resumen (Markdown)</Label>
                      <Textarea rows={10} value={form.summary_md} onChange={(e) => setForm({ ...form, summary_md: e.target.value })} placeholder="## Resumen&#10;- Punto 1&#10;- Punto 2" />
                    </div>
                    <div>
                      <Label>Adjuntos</Label>
                      <div className="border-2 border-dashed rounded-lg p-4 text-center">
                        <input
                          id="file-input"
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                        />
                        <label htmlFor="file-input" className="cursor-pointer inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                          <Upload className="w-4 h-4" /> Selecciona archivos
                        </label>
                        {files.length > 0 && (
                          <ul className="mt-3 text-left text-sm space-y-1">
                            {files.map((f, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <Paperclip className="w-3 h-3" /> {f.name}
                                <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="ml-auto text-muted-foreground hover:text-destructive">
                                  <X className="w-3 h-3" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                      <Button disabled={saving} onClick={createReport}>{saving ? "Guardando..." : "Publicar"}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {loading ? (
              <div className="text-center py-10 text-muted-foreground">Cargando...</div>
            ) : reports.length === 0 ? (
              <Card className="p-10 text-center text-muted-foreground">Sin reportes aún.</Card>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <Card key={r.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary">{TYPE_OPTIONS.find((t) => t.value === r.type)?.label ?? r.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.report_date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <div className="font-medium truncate">{r.title}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteReport(r.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recs" className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Nueva o editar recomendación semanal</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Inicio de semana (lunes)</Label>
                  <Input type="date" value={recForm.week_start}
                    onChange={(e) => setRecForm({ ...recForm, week_start: e.target.value })} />
                </div>
                <div>
                  <Label>Prioridad</Label>
                  <Select value={recForm.priority} onValueChange={(v) => setRecForm({ ...recForm, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="baja">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Para el cliente (visible) · Markdown</Label>
                <Textarea rows={6} value={recForm.for_client_md ?? ""}
                  onChange={(e) => setRecForm({ ...recForm, for_client_md: e.target.value })}
                  placeholder="- Publicar reel sobre X&#10;- Reforzar bloque de story sobre Y" />
              </div>
              <div>
                <Label>Para el equipo KiMedia (interno · NO se muestra al cliente)</Label>
                <Textarea rows={6} value={recForm.for_team_md ?? ""}
                  onChange={(e) => setRecForm({ ...recForm, for_team_md: e.target.value })}
                  placeholder="- Renegociar pauta con Meta&#10;- Ajustar KPI de alcance" />
              </div>
              <div className="flex justify-end gap-2">
                {recForm.id && (
                  <Button variant="ghost" onClick={() => setRecForm({ id: "", week_start: new Date().toISOString().slice(0, 10), for_client_md: "", for_team_md: "", priority: "media" })}>
                    Cancelar edición
                  </Button>
                )}
                <Button onClick={saveRec} disabled={recSaving}>
                  <Save className="w-4 h-4 mr-2" /> {recSaving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </Card>

            {loading ? (
              <div className="text-center py-10 text-muted-foreground">Cargando...</div>
            ) : recs.length === 0 ? (
              <Card className="p-10 text-center text-muted-foreground">Sin recomendaciones aún.</Card>
            ) : (
              <div className="space-y-2">
                {recs.map((w) => (
                  <Card key={w.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Semana {w.week_start}</Badge>
                        <Badge>Prioridad {w.priority}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => editRec(w)}>Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteRec(w.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {w.for_client_md && (
                      <div className="text-sm">
                        <div className="text-xs text-muted-foreground mb-1">Cliente:</div>
                        <div className="whitespace-pre-wrap">{w.for_client_md}</div>
                      </div>
                    )}
                    {w.for_team_md && (
                      <div className="text-sm border-l-2 border-coral pl-3">
                        <div className="text-xs text-coral mb-1">Interno (equipo):</div>
                        <div className="whitespace-pre-wrap">{w.for_team_md}</div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="creds" className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Cuenta portal del cliente</h3>
              <p className="text-xs text-muted-foreground">
                Crea o actualiza el usuario que el cliente usará para entrar a su portal privado.
                Al crearlo se le da acceso automáticamente a este cliente.
              </p>
              <div>
                <Label>Email del usuario portal</Label>
                <Input value={creds.portal_email ?? ""}
                  onChange={(e) => setCreds({ ...creds, portal_email: e.target.value })}
                  placeholder={`portal+${(clientName || "cliente").toLowerCase().replace(/\s+/g,"")}@kimedia.mx`} />
                <p className="text-xs text-muted-foreground mt-1">
                  Sugerencia para Actinver: <code>portalactinver@kimedia.mx</code>
                </p>
              </div>
              <div>
                <Label>Contraseña (mín 8 caracteres)</Label>
                <Input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Genera una contraseña fuerte y compártela por canal seguro"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Se guarda solo en la cuenta auth del portal — nunca en texto plano en la base.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={createOrUpdatePortalUser} disabled={portalBusy}>
                  {creds.portal_user_id ? "Actualizar usuario + contraseña" : "Crear usuario portal"}
                </Button>
                {creds.portal_user_id && (
                  <>
                    <Button variant="outline" onClick={resetPortalPassword} disabled={portalBusy}>
                      Solo cambiar contraseña
                    </Button>
                    <Button variant="ghost" className="text-destructive" onClick={deletePortalUser} disabled={portalBusy}>
                      <Trash2 className="w-4 h-4 mr-1" /> Eliminar usuario
                    </Button>
                  </>
                )}
              </div>
              {creds.portal_user_id && (
                <div className="text-xs bg-emerald-500/10 border border-emerald-500/30 rounded p-2">
                  ✓ Usuario portal activo · <code>{creds.portal_email}</code>
                </div>
              )}
              <div>
                <Label>Notas internas</Label>
                <Textarea rows={3} value={creds.notes ?? ""}
                  onChange={(e) => setCreds({ ...creds, notes: e.target.value })}
                  placeholder="A quién se le envió el acceso, cuándo, etc." />
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={saveCreds}><Save className="w-4 h-4 mr-2" /> Guardar notas</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="listening" className="space-y-4">
            <Card className="p-4 space-y-3 border-coral/30">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-coral shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Análisis IA del listening</h3>
                  <p className="text-xs text-muted-foreground">
                    Enriquece cada entrada con sentimiento, urgencia, temas y menciones. Genera un resumen ejecutivo semanal
                    (visible en el portal del cliente, en la pestaña Análisis).
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-muted-foreground">
                  <strong>{listening.filter(e => e.analyzed_at).length}</strong> / {listening.length} entradas analizadas
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" onClick={analyzePending} disabled={analyzing}>
                    <Sparkles className="w-4 h-4 mr-1" /> {analyzing ? "Analizando..." : "Analizar pendientes (30)"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={reprocessAll} disabled={analyzing} title="Reprocesa TODO para extraer canales, entidades, eventos y citas">
                    <Sparkles className="w-4 h-4 mr-1" /> Reprocesar todo (v2)
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-border/50">
                <div>
                  <Label className="text-xs">Semana (lunes)</Label>
                  <Input type="date" value={weeklyDate} onChange={(e) => setWeeklyDate(e.target.value)} className="w-40" />
                </div>
                <Button size="sm" variant="outline" onClick={generateWeeklySummary} disabled={genSummary}>
                  <BarChart3 className="w-4 h-4 mr-1" /> {genSummary ? "Generando..." : "Generar resumen semanal"}
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Pegar texto (día actual o varios días)</h3>
              <p className="text-xs text-muted-foreground">
                Pega texto plano para la fecha elegida, o pega directamente el bloque de bitácora — si detecta
                encabezados <code>[DD/MM/AA, hh:mm]</code> los agrupa automáticamente por día.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fecha (si es texto plano)</Label>
                  <Input type="date" value={pasteDate} onChange={(e) => setPasteDate(e.target.value)} />
                </div>
                <div>
                  <Label>Modo</Label>
                  <Select value={pasteMode} onValueChange={(v: any) => setPasteMode(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="append">Agregar como nueva entrada</SelectItem>
                      <SelectItem value="replace">Reemplazar días existentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Contenido</Label>
                <Textarea
                  rows={10}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Pega aquí el análisis del día, o el bloque de bitácora copiado tal cual."
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={importPaste} disabled={pasting || !pasteText.trim()}>
                  <Save className="w-4 h-4 mr-2" /> {pasting ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Importar histórico de bitácora (.txt)</h3>
              <p className="text-xs text-muted-foreground">
                Sube el archivo <code>.txt</code> de bitácoras. Se agrupa por día y se guarda como bitácora de escucha.
              </p>
              <input
                type="file"
                accept=".txt,text/plain"
                onChange={(e) => {
                  const f = e.target.files?.[0]; if (f) handleTxtFile(f);
                }}
                className="text-sm"
              />
              {importPreview && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Detectadas <strong>{importPreview.length}</strong> fechas · rango{" "}
                    {importPreview[importPreview.length - 1]?.date} → {importPreview[0]?.date}
                  </div>
                  <div className="max-h-56 overflow-auto rounded border divide-y">
                    {importPreview.map((p) => (
                      <div key={p.date} className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
                        <span className="font-medium">{p.date}</span>
                        <span className="text-muted-foreground">
                          {p.kinds.map((k) => k === "listening" ? "Escucha" : k === "medios" ? "Medios" : "Nota").join(" + ")}
                          {" · "}{p.chars.toLocaleString("es-MX")} car.
                          {p.dated ? "" : " · fecha de envío"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={importing} onClick={() => importBitacora("skip")}>
                      {importing ? "Importando..." : "Importar solo fechas nuevas"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={importing} onClick={() => importBitacora("upsert")}>
                      Reemplazar días existentes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setImportPreview(null); setImportText(""); setImportFileName(""); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {loading ? (
              <div className="text-center py-10 text-muted-foreground">Cargando...</div>
            ) : listening.length === 0 ? (
              <Card className="p-10 text-center text-muted-foreground">Sin entradas de escucha aún.</Card>
            ) : (
              <div className="space-y-2">
                {listening.map((e) => (
                  <Card key={e.id} className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{e.entry_date}</Badge>
                        <Badge variant="outline" className="text-xs">{e.source}</Badge>
                        {e.sentiment && (
                          <Badge className={`text-xs border ${SENTIMENT_STYLES[e.sentiment] ?? ""}`}>
                            {e.sentiment}
                          </Badge>
                        )}
                        {e.urgency && e.urgency !== "baja" && (
                          <Badge className={`text-xs border ${URGENCY_STYLES[e.urgency] ?? ""}`}>
                            urgencia {e.urgency}
                          </Badge>
                        )}
                        {!e.analyzed_at && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">sin analizar</Badge>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => deleteListening(e.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    {e.summary && (
                      <p className="text-xs mb-2 leading-relaxed">{e.summary}</p>
                    )}
                    {e.topics && e.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {e.topics.slice(0, 6).map((t, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                      {e.content_md.slice(0, 300)}{e.content_md.length > 300 ? "..." : ""}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="benchmark" className="space-y-4">
            {clientId && (
              (portalModules.benchmark_funcionarios || portalModules.benchmark_instituciones) ? (
                <Tabs defaultValue={portalModules.benchmark_funcionarios ? "funcionarios" : "instituciones"}>
                  <TabsList>
                    {portalModules.benchmark_funcionarios && <TabsTrigger value="funcionarios">Funcionarios</TabsTrigger>}
                    {portalModules.benchmark_instituciones && <TabsTrigger value="instituciones">Instituciones</TabsTrigger>}
                  </TabsList>
                  {portalModules.benchmark_funcionarios && (
                    <TabsContent value="funcionarios" className="mt-4">
                      <BenchmarkAdmin clientId={clientId} clientName={clientName} scope="funcionarios" />
                    </TabsContent>
                  )}
                  {portalModules.benchmark_instituciones && (
                    <TabsContent value="instituciones" className="mt-4">
                      <BenchmarkAdmin clientId={clientId} clientName={clientName} scope="instituciones" />
                    </TabsContent>
                  )}
                </Tabs>
              ) : (
                <BenchmarkAdmin clientId={clientId} clientName={clientName} />
              )
            )}
          </TabsContent>

          <TabsContent value="accesos" className="space-y-4">
            <PortalMembers clientId={clientId!} onChange={load} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}