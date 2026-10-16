import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Upload, Save, X, FileSpreadsheet, Users, TrendingUp, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  parseComparativa, parseSeguidores, parsePosts, detectType,
  type ComparativaRow, type FollowerDailyRow, type PostRow, type PeriodInfo,
} from "@/lib/fanpageKarmaParser";
import { benchmarkAccountKey } from "@/lib/benchmarkAccountIdentity";

type Competitor = {
  id: string;
  client_id: string;
  name: string;
  network: string;
  handle: string | null;
  profile_external_id: string | null;
  brand_color: string;
  image_url: string | null;
  external_url: string | null;
  active: boolean;
  is_client: boolean;
  is_default: boolean;
  sort_order: number;
  scope: string;
  dependencia_id: string | null;
  account_type: string | null;
};

type Dependencia = { id: string; nombre: string; sort_order: number | null };

type Period = {
  id: string;
  period_type: string;
  period_label: string;
  period_start: string;
  period_end: string;
  notes: string | null;
  created_at: string;
  scope?: string;
};

type UploadRow = {
  id: string;
  period_id: string;
  upload_type: "comparativa" | "seguidores" | "posts";
  file_name: string;
  row_count: number;
  created_at: string;
};

type FileType = "comparativa" | "seguidores" | "posts";

const NETWORKS = ["facebook", "instagram", "tiktok", "youtube", "x", "linkedin", "multi", "unknown"];
const PALETTE = ["#ef4444","#f59e0b","#10b981","#8b5cf6","#ec4899","#06b6d4","#eab308","#f97316","#14b8a6","#a855f7","#f43f5e","#6366f1"];

const TYPE_META: Record<FileType, { label: string; icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  comparativa: { label: "Comparativa (Resumen de métricas)", icon: FileSpreadsheet, desc: "Snapshot agregado del periodo por perfil+red" },
  seguidores: { label: "Seguidores (Crecimiento diario)", icon: TrendingUp, desc: "Delta diario de seguidores por perfil+red" },
  posts: { label: "Posts (Top publicaciones)", icon: Newspaper, desc: "Publicaciones individuales del periodo" },
};

type BenchmarkScope = "general" | "funcionarios" | "instituciones";

const SCOPE_LABELS: Record<BenchmarkScope, string> = {
  general: "General",
  funcionarios: "Funcionarios",
  instituciones: "Instituciones",
};

export default function BenchmarkAdmin({ clientId, clientName, scope = "general" }: { clientId: string; clientName: string; scope?: BenchmarkScope }) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [dependencias, setDependencias] = useState<Dependencia[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Uploader state
  const [file, setFile] = useState<File | null>(null);
  const [detectedType, setDetectedType] = useState<FileType | null>(null);
  const [parsedPreview, setParsedPreview] = useState<null | {
    type: FileType;
    period: PeriodInfo;
    label: string;
    comparativa?: ComparativaRow[];
    seguidores?: FollowerDailyRow[];
    posts?: PostRow[];
    profileKeys: Array<{ profile: string; network: string; externalId: string | null; externalUrl: string | null; imageUrl: string | null; isNew: boolean }>;
  }>(null);
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [c, p, u, d] = await Promise.all([
      supabase.from("client_portal_benchmark_competitors").select("*").eq("client_id", clientId).eq("scope", scope).order("sort_order").order("name"),
      supabase.from("client_portal_benchmark_periods").select("*").eq("client_id", clientId).eq("scope", scope).order("period_start", { ascending: false }),
      supabase.from("client_portal_benchmark_uploads").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("client_portal_dependencias").select("id, nombre, sort_order").eq("client_id", clientId).order("sort_order"),
    ]);
    setCompetitors((c.data ?? []) as Competitor[]);
    setPeriods((p.data ?? []) as Period[]);
    setUploads((u.data ?? []) as UploadRow[]);
    setDependencias((d.data ?? []) as Dependencia[]);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [clientId, scope]);

  async function updateCompetitor(id: string, patch: Partial<Competitor>) {
    const { error } = await supabase.from("client_portal_benchmark_competitors").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setCompetitors((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } as Competitor : c)));
  }
  async function deleteCompetitor(id: string) {
    if (!confirm("Eliminar este perfil y todas sus métricas asociadas?")) return;
    const { error } = await supabase.from("client_portal_benchmark_competitors").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    loadAll();
  }

  // ---------- Parsing ----------
  async function handleFileChosen(f: File | null) {
    setFile(f);
    setParsedPreview(null);
    setDetectedType(null);
    if (!f) return;
    try {
      const t = await detectType(f);
      if (!t) {
        toast.error("No se pudo detectar el tipo de archivo. ¿Estás seguro que es un export de FanpageKarma?");
        return;
      }
      setDetectedType(t);
    } catch (e: any) {
      toast.error(`Error al leer el archivo: ${e.message}`);
    }
  }

  async function handleParse() {
    if (!file || !detectedType) return;
    try {
      let profileKeys: Map<string, { profile: string; network: string; externalId: string | null; externalUrl: string | null; imageUrl: string | null }> = new Map();
      const addKey = (profile: string, network: string, externalId: string | null, externalUrl: string | null, imageUrl: string | null) => {
        const k = `${profile.toLowerCase()}|${network.toLowerCase()}`;
        if (!profileKeys.has(k)) profileKeys.set(k, { profile, network, externalId, externalUrl, imageUrl });
      };
      let preview: any = { type: detectedType };
      if (detectedType === "comparativa") {
        const p = await parseComparativa(file);
        preview = { ...preview, period: p.period, comparativa: p.rows };
        p.rows.forEach((r) => addKey(r.profile, r.network, r.profileExternalId, r.externalUrl, r.imageUrl));
      } else if (detectedType === "seguidores") {
        const p = await parseSeguidores(file);
        preview = { ...preview, period: p.period, seguidores: p.rows };
        p.rows.forEach((r) => addKey(r.profile, r.network, r.profileExternalId, r.externalUrl, r.imageUrl));
      } else {
        const p = await parsePosts(file);
        preview = { ...preview, period: p.period, posts: p.rows };
        p.rows.forEach((r) => addKey(r.profile, r.network, r.profileExternalId, null, null));
      }
      // A profile is globally unique per client+network, regardless of the current scope.
      // Older imports may have left Guanajuato profiles under "general"; include those
      // here so the preview does not incorrectly mark them as new.
      const { data: allClientCompetitors, error: competitorsError } = await supabase
        .from("client_portal_benchmark_competitors")
        .select("id,name,network,profile_external_id,external_url")
        .eq("client_id", clientId);
      if (competitorsError) throw competitorsError;
      const existingKeys = new Set(
        (allClientCompetitors ?? []).flatMap((c) => [
          `${c.name.toLowerCase()}|${c.network.toLowerCase()}`,
          benchmarkAccountKey(c),
        ])
      );
      preview.profileKeys = Array.from(profileKeys.values()).map((k) => ({
        ...k,
        isNew: !existingKeys.has(`${k.profile.toLowerCase()}|${k.network.toLowerCase()}`)
          && !existingKeys.has(benchmarkAccountKey({ id: "preview", name: k.profile, network: k.network, profile_external_id: k.externalId, external_url: k.externalUrl })),
      }));
      preview.label = defaultLabelForPeriod(preview.period);
      setParsedPreview(preview);
      toast.success(`Archivo procesado: ${preview.profileKeys.length} perfiles detectados`);
    } catch (e: any) {
      toast.error(`Error al procesar: ${e.message}`);
    }
  }

  function defaultLabelForPeriod(p: PeriodInfo): string {
    // "1 ene 2026 – 31 ene 2026" -> "Enero 2026"
    const d = new Date(p.start + "T00:00:00");
    const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }

  // ---------- Save ----------
  async function handleSave() {
    if (!parsedPreview || !file) return;
    setSaving(true);
    try {
      // 1) upsert period
      const { data: periodRow, error: pErr } = await supabase
        .from("client_portal_benchmark_periods")
        .upsert(
          {
            client_id: clientId,
            period_type: "monthly",
            period_label: parsedPreview.label,
            period_start: parsedPreview.period.start,
            period_end: parsedPreview.period.end,
            scope,
          },
          { onConflict: "client_id,period_start,period_end,scope" }
        )
        .select()
        .single();
      if (pErr) throw pErr;

      // 2) auto-register competitors. Recheck every client scope at save time so a
      // stale preview or a legacy "general" profile cannot cause a duplicate insert.
      const { data: allExisting, error: existingError } = await supabase
        .from("client_portal_benchmark_competitors")
        .select("*")
        .eq("client_id", clientId);
      if (existingError) throw existingError;
      const allExistingMap = new Map<string, any>();
      (allExisting ?? []).forEach((c: any) => {
        allExistingMap.set(`${c.name.toLowerCase()}|${c.network.toLowerCase()}`, c);
        allExistingMap.set(benchmarkAccountKey(c), c);
      });
      const existingFor = (k: { profile: string; network: string; externalId: string | null; externalUrl: string | null }) =>
        allExistingMap.get(benchmarkAccountKey({ id: "incoming", name: k.profile, network: k.network, profile_external_id: k.externalId, external_url: k.externalUrl }))
        ?? allExistingMap.get(`${k.profile.toLowerCase()}|${k.network.toLowerCase()}`);
      const toCreate = parsedPreview.profileKeys.filter(
        (k) => !existingFor(k)
      );
      let nextColor = competitors.length;
      if (toCreate.length > 0) {
        const rows = toCreate.map((k, i) => ({
          client_id: clientId,
          name: k.profile,
          network: k.network,
          handle: null as string | null,
          profile_external_id: k.externalId,
          external_url: k.externalUrl,
          image_url: k.imageUrl,
          brand_color: PALETTE[(nextColor + i) % PALETTE.length],
          platform: k.network,
          is_default: false,
          active: true,
          is_client: k.profile.toLowerCase().includes(clientName.toLowerCase()),
          sort_order: competitors.length + i + 1,
          scope,
        }));
        const { error: cErr } = await supabase.from("client_portal_benchmark_competitors").insert(rows);
        if (cErr) throw cErr;
      }

      const legacyIds = parsedPreview.profileKeys
        .map(existingFor)
        .filter((c: any) => c && c.scope !== scope)
        .map((c: any) => c.id as string);
      if (legacyIds.length > 0) {
        const { error: scopeError } = await supabase
          .from("client_portal_benchmark_competitors")
          .update({ scope })
          .in("id", legacyIds);
        if (scopeError) throw scopeError;
      }

      // reload competitors to get IDs
      const { data: refreshed } = await supabase
        .from("client_portal_benchmark_competitors")
        .select("*")
        .eq("client_id", clientId)
        .eq("scope", scope);
      const compMap = new Map<string, string>();
      (refreshed ?? []).forEach((c: any) => {
        compMap.set(`${c.name.toLowerCase()}|${c.network.toLowerCase()}`, c.id as string);
        compMap.set(benchmarkAccountKey(c), c.id as string);
      });

      const findCompId = (profile: string, network: string, externalId?: string | null, externalUrl?: string | null) =>
        compMap.get(benchmarkAccountKey({ id: "incoming", name: profile, network, profile_external_id: externalId ?? null, external_url: externalUrl ?? null }))
        ?? compMap.get(`${profile.toLowerCase()}|${network.toLowerCase()}`)
        ?? null;

      // 3) upsert upload registry (delete previous of same type)
      await supabase.from("client_portal_benchmark_uploads")
        .delete()
        .eq("period_id", periodRow.id)
        .eq("upload_type", parsedPreview.type);

      const rowCount =
        parsedPreview.type === "comparativa" ? parsedPreview.comparativa!.length :
        parsedPreview.type === "seguidores" ? parsedPreview.seguidores!.length :
        parsedPreview.posts!.length;

      const { data: userRes } = await supabase.auth.getUser();
      await supabase.from("client_portal_benchmark_uploads").insert({
        client_id: clientId,
        period_id: periodRow.id,
        upload_type: parsedPreview.type,
        file_name: file.name,
        row_count: rowCount,
        uploaded_by: userRes.user?.id ?? null,
      });

      // 4) Replace data for this period + type
      if (parsedPreview.type === "comparativa") {
        await supabase.from("client_portal_benchmark_metrics").delete().eq("period_id", periodRow.id);
        const rows = parsedPreview.comparativa!
          .map((r) => {
            const cid = findCompId(r.profile, r.network, r.profileExternalId, r.externalUrl);
            if (!cid) return null;
            return {
              client_id: clientId,
              period_id: periodRow.id,
              competitor_id: cid,
              network: r.network,
              performance_index: r.performanceIndex,
              followers: r.followers,
              follower_growth_rate: r.followerGrowthRate,
              engagement_rate: r.engagementRate,
              posts_per_day: r.postsPerDay,
              reach_per_day: r.reachPerDay,
              interaction_per_impression: r.interactionPerImpression,
              raw: r.raw as any,
            };
          })
          .filter(Boolean) as any[];
        if (rows.length) {
          const { error } = await supabase.from("client_portal_benchmark_metrics").insert(rows);
          if (error) throw error;
        }
      } else if (parsedPreview.type === "seguidores") {
        await supabase.from("client_portal_benchmark_follower_daily").delete().eq("period_id", periodRow.id);
        const rowMap = new Map<string, any>();
        for (const r of parsedPreview.seguidores!) {
            const cid = findCompId(r.profile, r.network, r.profileExternalId, r.externalUrl);
          if (!cid) continue;
          for (const d of r.days) {
            rowMap.set(`${cid}|${r.network}|${d.date}`, {
              client_id: clientId,
              period_id: periodRow.id,
              competitor_id: cid,
              network: r.network,
              day: d.date,
              delta: d.delta,
            });
          }
        }
        const rows = Array.from(rowMap.values());
        // Chunk upserts to avoid payload limits; la llave única es (competitor_id, network, day)
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const { error } = await supabase
            .from("client_portal_benchmark_follower_daily")
            .upsert(rows.slice(i, i + CHUNK), { onConflict: "competitor_id,network,day" });
          if (error) throw error;
        }
      } else {
        await supabase.from("client_portal_benchmark_posts").delete().eq("period_id", periodRow.id);
        const rows = parsedPreview.posts!.map((r) => ({
          client_id: clientId,
          period_id: periodRow.id,
          competitor_id: findCompId(r.profile, r.network, r.profileExternalId),
          network: r.network,
          profile_name: r.profile,
          message_external_id: r.messageExternalId,
          posted_at: r.postedAt,
          message: r.message,
          likes: r.likes,
          comments: r.comments,
          interactions: r.interactions,
          engagement_rate: r.engagementRate,
          reach: r.reach,
          interaction_per_impression: r.interactionPerImpression,
          link: r.link,
          image_link: r.imageLink,
          raw: r.raw as any,
        }));
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const { error } = await supabase.from("client_portal_benchmark_posts").insert(rows.slice(i, i + CHUNK));
          if (error) throw error;
        }
      }

      toast.success(`Guardado: ${parsedPreview.label} — ${rowCount} filas (${parsedPreview.type})`);
      setFile(null);
      setParsedPreview(null);
      setDetectedType(null);
      loadAll();
    } catch (e: any) {
      toast.error(`Error al guardar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function deletePeriod(id: string) {
    if (!confirm("Eliminar este periodo y TODAS sus métricas, posts y follower daily?")) return;
    const { error } = await supabase.from("client_portal_benchmark_periods").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    loadAll();
  }

  const uploadsByPeriod = useMemo(() => {
    const m = new Map<string, UploadRow[]>();
    for (const u of uploads) {
      if (!m.has(u.period_id)) m.set(u.period_id, []);
      m.get(u.period_id)!.push(u);
    }
    return m;
  }, [uploads]);

  const sinAsignar = competitors.filter((c) => !c.dependencia_id);

  return (
    <div className="space-y-6">
      {/* Uploader */}
      <Card className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <Upload className="w-5 h-5 text-primary mt-1" />
          <div>
            <h3 className="font-display font-bold text-lg">Cargar archivo FanpageKarma</h3>
            <p className="text-xs text-muted-foreground">
              Sube uno de los tres exports (Comparativa, Seguidores o Posts). El sistema detecta el tipo, el periodo y los perfiles automáticamente.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="border-2 border-dashed border-border/60 rounded-lg p-4">
            <input
              id="fpk-file"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileChosen(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="fpk-file" className="cursor-pointer inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Upload className="w-4 h-4" />{file ? file.name : "Seleccionar archivo XLSX"}
            </label>
            {detectedType && (
              <p className="text-xs mt-2">
                Tipo detectado: <span className="font-semibold text-primary">{TYPE_META[detectedType].label}</span>
              </p>
            )}
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={handleParse} disabled={!file || !detectedType} variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-1" />Analizar
            </Button>
            {parsedPreview && (
              <>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />{saving ? "Guardando…" : "Guardar"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setParsedPreview(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {parsedPreview && (
          <div className="mt-5 space-y-3">
            <div className="grid gap-3 md:grid-cols-3 text-xs">
              <div className="rounded border border-border/40 p-3">
                <div className="text-muted-foreground uppercase text-[10px] tracking-widest">Tipo</div>
                <div className="font-semibold">{TYPE_META[parsedPreview.type].label}</div>
              </div>
              <div className="rounded border border-border/40 p-3">
                <div className="text-muted-foreground uppercase text-[10px] tracking-widest">Periodo detectado</div>
                <div className="font-semibold">{parsedPreview.period.start} → {parsedPreview.period.end}</div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Etiqueta del periodo</Label>
                <Input
                  value={parsedPreview.label}
                  onChange={(e) => setParsedPreview({ ...parsedPreview!, label: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>

            <div className="rounded border border-border/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold">Perfiles detectados ({parsedPreview.profileKeys.length})</span>
                {parsedPreview.profileKeys.some((k) => k.isNew) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    {parsedPreview.profileKeys.filter((k) => k.isNew).length} nuevos se registrarán automáticamente
                  </span>
                )}
              </div>
              <div className="max-h-48 overflow-auto text-xs grid grid-cols-2 md:grid-cols-3 gap-1">
                {parsedPreview.profileKeys.map((k) => (
                  <div key={`${k.profile}|${k.network}`} className={`px-2 py-1 rounded border ${k.isNew ? "border-amber-500/40 bg-amber-500/5" : "border-border/40"}`}>
                    <span className="font-medium">{k.profile}</span>
                    <span className="text-muted-foreground"> · {k.network}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Periods & uploads */}
      <Card className="p-5">
        <h3 className="font-display font-bold text-lg mb-1">Periodos cargados</h3>
        <p className="text-xs text-muted-foreground mb-4">Historial por periodo con los archivos procesados.</p>
        {periods.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aún no hay periodos. Sube el primer XLSX arriba.</p>
        ) : (
          <div className="grid gap-2">
            {periods.map((p) => {
              const list = uploadsByPeriod.get(p.id) ?? [];
              return (
                <div key={p.id} className="border border-border/40 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{p.period_label}</div>
                      <div className="text-xs text-muted-foreground">{p.period_start} → {p.period_end}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deletePeriod(p.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(["comparativa","seguidores","posts"] as FileType[]).map((t) => {
                      const u = list.find((x) => x.upload_type === t);
                      const Icon = TYPE_META[t].icon;
                      return (
                        <span
                          key={t}
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${u ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
                          title={u ? `${u.file_name} · ${u.row_count} filas` : `Sin archivo ${t}`}
                        >
                          <Icon className="w-3 h-3" />
                          {t}{u ? ` (${u.row_count})` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Cuentas sin dependencia: se crean solas al subir un XLSX y el análisis
          las ignora hasta que se ligan a una dependencia. */}
      {dependencias.length > 0 && sinAsignar.length > 0 && (
        <Card className="p-5 border-amber-500/40 bg-amber-500/5">
          <h3 className="font-display font-bold text-lg">
            {sinAsignar.length} cuenta{sinAsignar.length === 1 ? "" : "s"} sin dependencia
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Estas cuentas ya tienen datos cargados pero no aparecen en el análisis ni en los reportes.
            Asígnalas a su dependencia e indica de qué tipo son.
          </p>
          <div className="space-y-2">
            {sinAsignar.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background p-2">
                <span className="text-xs font-medium flex-1 min-w-[160px] break-words">{c.name}</span>
                <span className="text-[11px] text-muted-foreground capitalize w-[70px]">{c.network}</span>
                <Select
                  value={c.dependencia_id ?? "none"}
                  onValueChange={(v) => updateCompetitor(c.id, { dependencia_id: v === "none" ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs w-[230px]"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {dependencias.map((d) => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={c.account_type ?? "institucional"}
                  onValueChange={(v) => updateCompetitor(c.id, { account_type: v })}
                >
                  <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institucional">Institucional</SelectItem>
                    <SelectItem value="titular">Titular</SelectItem>
                    <SelectItem value="marca">Marca / destino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Competitor catalog */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display font-bold text-lg">Catálogo de perfiles</h3>
            <p className="text-xs text-muted-foreground">
              Marca "Cliente" para identificar los perfiles propios de {clientName}. Se auto-registran al procesar cada XLSX.
              {dependencias.length > 0 && " Asigna cada perfil a su dependencia e indica si es la cuenta institucional, la del titular o una cuenta de marca o destino."}
            </p>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground italic">Cargando…</p>
        ) : competitors.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin perfiles. Sube tu primer XLSX y se crearán automáticamente.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="text-left">
                  <th className="p-2">Color</th>
                  <th className="p-2">Perfil</th>
                  <th className="p-2">Red</th>
                  {dependencias.length > 0 && <th className="p-2">Dependencia</th>}
                  {dependencias.length > 0 && <th className="p-2">Cuenta</th>}
                  <th className="p-2 text-center">Cliente</th>
                  <th className="p-2 text-center">Activo</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((c) => (
                  <tr key={c.id} className="border-t border-border/30">
                    <td className="p-2">
                      <input
                        type="color"
                        value={c.brand_color}
                        onChange={(e) => updateCompetitor(c.id, { brand_color: e.target.value })}
                        className="w-6 h-6 rounded border border-border/40 cursor-pointer"
                      />
                    </td>
                    <td className="p-2">
                      <Input value={c.name} onChange={(e) => updateCompetitor(c.id, { name: e.target.value })} className="h-7 text-xs" />
                    </td>
                    <td className="p-2">
                      <Select value={c.network} onValueChange={(v) => updateCompetitor(c.id, { network: v })}>
                        <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{NETWORKS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    {dependencias.length > 0 && (
                      <td className="p-2">
                        <Select
                          value={c.dependencia_id ?? "none"}
                          onValueChange={(v) => updateCompetitor(c.id, { dependencia_id: v === "none" ? null : v })}
                        >
                          <SelectTrigger className="h-7 text-xs w-[230px]"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {dependencias.map((d) => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    {dependencias.length > 0 && (
                      <td className="p-2">
                        <Select
                          value={c.account_type ?? "institucional"}
                          onValueChange={(v) => updateCompetitor(c.id, { account_type: v })}
                        >
                          <SelectTrigger className="h-7 text-xs w-[130px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="institucional">Institucional</SelectItem>
                            <SelectItem value="titular">Titular</SelectItem>
                            <SelectItem value="marca">Marca / destino</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={c.is_client} onChange={(e) => updateCompetitor(c.id, { is_client: e.target.checked })} />
                    </td>
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={c.active} onChange={(e) => updateCompetitor(c.id, { active: e.target.checked })} />
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => deleteCompetitor(c.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
