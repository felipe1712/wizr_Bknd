import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BarChart3, Globe, Megaphone, Upload, Trash2, Loader2, RefreshCw } from "lucide-react";
import {
  AD_PLATFORMS,
  NETWORK_LABELS,
  accountKeyOf,
  monthBounds,
  normalizeKey,
  parseAdsFile,
  parseSocialFile,
  parseSocialFileByMonth,
  parseMetaBusinessFiles,


  parseWebFile,
  periodLabel,
  type AdPlatform,
} from "@/lib/portalDataImport";

import MetricoolSyncCard from "./MetricoolSyncCard";

type Period = { start: string; end: string; label: string };

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [mode, setMode] = useState<"mes" | "rango">("mes");
  const [ym, setYm] = useState(currentMonth());

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Periodo</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as "mes" | "rango")}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Mes</SelectItem>
            <SelectItem value="rango">Rango</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === "mes" ? (
        <div className="space-y-1">
          <Label className="text-xs">Mes</Label>
          <Input
            type="month"
            className="h-9 w-44"
            value={ym}
            onChange={(e) => {
              setYm(e.target.value);
              if (e.target.value) onChange(monthBounds(e.target.value));
            }}
          />
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" className="h-9 w-40" value={value.start}
              onChange={(e) => onChange({ ...value, start: e.target.value, label: periodLabel(e.target.value, value.end) })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" className="h-9 w-40" value={value.end}
              onChange={(e) => onChange({ ...value, end: e.target.value, label: periodLabel(value.start, e.target.value) })} />
          </div>
        </>
      )}
      <Badge variant="outline" className="h-9 px-3 flex items-center">{value.label}</Badge>
    </div>
  );
}

export default function PortalDataAdmin({ clientId }: { clientId: string }) {
  const [period, setPeriod] = useState<Period>(() => monthBounds(currentMonth()));
  const [busy, setBusy] = useState<string | null>(null);
  const [social, setSocial] = useState<any[]>([]);
  const [web, setWeb] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [network, setNetwork] = useState("linkedin");
  const [accountName, setAccountName] = useState("");
  const [platform, setPlatform] = useState<AdPlatform>("meta");
  const [autoMonths, setAutoMonths] = useState(true);
  const [metaNetwork, setMetaNetwork] = useState("facebook");
  const [metaAccount, setMetaAccount] = useState("");
  const [gaProps, setGaProps] = useState<any[]>([]);
  const [gaId, setGaId] = useState("");
  const [gaLabel, setGaLabel] = useState("");
  const [gaFrom, setGaFrom] = useState("2025-01");
  const [gaProgress, setGaProgress] = useState<string | null>(null);
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [adId, setAdId] = useState("");
  const [adLabel, setAdLabel] = useState("");
  const [adFrom, setAdFrom] = useState("2025-01");
  const [adProgress, setAdProgress] = useState<string | null>(null);



  const socialRef = useRef<HTMLInputElement>(null);
  const webRef = useRef<HTMLInputElement>(null);
  const adsRef = useRef<HTMLInputElement>(null);
  const metaRef = useRef<HTMLInputElement>(null);


  const load = useCallback(async () => {
    const [s, w, a, g, ga] = await Promise.all([
      supabase.from("client_portal_social_metrics").select("*").eq("client_id", clientId).order("period_end", { ascending: false }).limit(200),
      supabase.from("client_portal_web_analytics").select("*").eq("client_id", clientId).order("period_end", { ascending: false }).limit(60),
      supabase.from("client_portal_ads_metrics").select("*").eq("client_id", clientId).order("period_end", { ascending: false }).limit(200),
      supabase.from("client_ga4_properties").select("*").eq("client_id", clientId).order("created_at", { ascending: true }),
      supabase.from("client_google_ads_accounts").select("*").eq("client_id", clientId).order("created_at", { ascending: true }),
    ]);
    setSocial(s.data ?? []);
    setWeb(w.data ?? []);
    setAds(a.data ?? []);
    setGaProps(g.data ?? []);
    setAdAccounts(ga.data ?? []);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  /** Guarda la propiedad de Analytics a la que el cliente nos dio acceso de lectura. */
  const addGaProperty = async () => {
    const propertyId = gaId.trim().replace(/^properties\//, "");
    if (!/^\d{6,}$/.test(propertyId)) { toast.error("El identificador de la propiedad son solo números (ej. 481234567)"); return; }
    setBusy("ga-prop");
    const { error } = await supabase.from("client_ga4_properties").insert({
      client_id: clientId,
      property_id: propertyId,
      label: gaLabel.trim() || null,
      created_by: uid.current,
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setGaId(""); setGaLabel("");
    toast.success("Propiedad guardada");
    load();
  };

  const removeGaProperty = async (id: string) => {
    const { error } = await supabase.from("client_ga4_properties").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  /** Lee las métricas del periodo directo de Analytics y las guarda en el portal. */
  const syncGa = async () => {
    setBusy("ga-sync");
    try {
      const { data, error } = await supabase.functions.invoke("ga4-sync", {
        body: { client_id: clientId, period_start: period.start, period_end: period.end, period_label: period.label },
      });
      if (error) {
        const detail = (error as any)?.context?.text ? await (error as any).context.text() : error.message;
        let msg = detail;
        try { msg = JSON.parse(detail)?.error ?? detail; } catch { /* texto plano */ }
        throw new Error(msg);
      }
      toast.success(`Analytics actualizado: ${Number(data?.sessions ?? 0).toLocaleString("es-MX")} sesiones en ${period.label}`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo leer Analytics");
    } finally {
      setBusy(null);
    }
  };

  /** Trae mes por mes el histórico de Analytics, desde el mes elegido hasta el mes pasado. */
  const syncGaHistory = async () => {
    const from = gaFrom.trim();
    if (!/^\d{4}-\d{2}$/.test(from)) { toast.error("Elige el mes de inicio del histórico"); return; }
    const months: string[] = [];
    const [fy, fm] = from.split("-").map(Number);
    const cursor = new Date(Date.UTC(fy, fm - 1, 1));
    const now = new Date();
    const limit = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    while (cursor < limit && months.length < 48) {
      months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    if (!months.length) { toast.error("Ese mes de inicio no deja meses completos por traer"); return; }

    setBusy("ga-history");
    setGaProgress(`0 de ${months.length}`);
    let ok = 0;
    const fails: string[] = [];
    for (let i = 0; i < months.length; i++) {
      const p = monthBounds(months[i]);
      setGaProgress(`${i + 1} de ${months.length} · ${p.label}`);
      try {
        const { error } = await supabase.functions.invoke("ga4-sync", {
          body: { client_id: clientId, period_start: p.start, period_end: p.end, period_label: p.label },
        });
        if (error) throw error;
        ok++;
      } catch {
        fails.push(p.label);
      }
    }
    setGaProgress(null);
    setBusy(null);
    if (ok) toast.success(`Histórico listo: ${ok} meses cargados`);
    if (fails.length) toast.error(`Sin datos o con error: ${fails.slice(0, 4).join(", ")}${fails.length > 4 ? "…" : ""}`);
    load();
  };

  /** Guarda la cuenta de anuncios de Google del cliente. */
  const addAdAccount = async () => {
    const customerId = adId.trim().replace(/[^\d]/g, "");
    if (!/^\d{8,}$/.test(customerId)) { toast.error("El número de cuenta son solo dígitos (ej. 1196579909)"); return; }
    setBusy("ad-acc");
    const { error } = await supabase.from("client_google_ads_accounts").insert({
      client_id: clientId,
      customer_id: customerId,
      label: adLabel.trim() || null,
      created_by: uid.current,
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    setAdId(""); setAdLabel("");
    toast.success("Cuenta guardada");
    load();
  };

  const removeAdAccount = async (id: string) => {
    const { error } = await supabase.from("client_google_ads_accounts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  /** Trae del periodo elegido los resultados por campaña de Google Ads. */
  const syncAds = async () => {
    setBusy("ad-sync");
    try {
      const { data, error } = await supabase.functions.invoke("google-ads-sync", {
        body: { client_id: clientId, period_start: period.start, period_end: period.end, period_label: period.label },
      });
      if (error) {
        const detail = (error as any)?.context?.text ? await (error as any).context.text() : error.message;
        let msg = detail;
        try { msg = JSON.parse(detail)?.error ?? detail; } catch { /* texto plano */ }
        throw new Error(msg);
      }
      toast.success(`Google Ads actualizado: ${Number(data?.campaigns ?? 0)} campañas en ${period.label}`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo leer Google Ads");
    } finally {
      setBusy(null);
    }
  };

  /** Trae de una sola vez el histórico mensual de campañas, desde el mes elegido hasta hoy. */
  const syncAdsHistory = async () => {
    const from = adFrom.trim();
    if (!/^\d{4}-\d{2}$/.test(from)) { toast.error("Elige el mes de inicio del histórico"); return; }
    const startDate = `${from}-01`;
    const today = new Date().toISOString().slice(0, 10);
    if (startDate > today) { toast.error("Ese mes de inicio es posterior a hoy"); return; }

    setBusy("ad-history");
    setAdProgress("Consultando Google Ads…");
    try {
      const { data, error } = await supabase.functions.invoke("google-ads-sync", {
        body: { client_id: clientId, mode: "history", period_start: startDate, period_end: today },
      });
      if (error) {
        const detail = (error as any)?.context?.text ? await (error as any).context.text() : error.message;
        let msg = detail;
        try { msg = JSON.parse(detail)?.error ?? detail; } catch { /* texto plano */ }
        throw new Error(msg);
      }
      toast.success(`Histórico listo: ${Number(data?.campaigns ?? 0)} registros de campaña por mes`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo leer el histórico de Google Ads");
    } finally {
      setAdProgress(null);
      setBusy(null);
    }
  };




  const uid = useRef<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { uid.current = data.user?.id ?? null; }); }, []);

  const handleSocial = async (file: File) => {
    setBusy("social");
    try {
      const groups = autoMonths
        ? await parseSocialFileByMonth(file, network, accountName || undefined)
        : [{ ym: null as string | null, rows: await parseSocialFile(file, network, accountName || undefined) }];
      const usable = groups.filter((g) => g.rows.length);
      if (!usable.length) { toast.error("No encontré filas con cuentas en ese archivo"); return; }

      let total = 0;
      const labels: string[] = [];
      for (const g of usable) {
        const p = g.ym ? monthBounds(g.ym) : period;
        labels.push(p.label);
        const payload = g.rows.map((r) => ({
          client_id: clientId,
          network: r.network,
          account_key: accountKeyOf(r.account_name, r.account_handle),
          account_name: r.account_name,
          account_handle: r.account_handle,
          period_start: p.start,
          period_end: p.end,
          period_label: p.label,
          source: r.network === "linkedin" ? "linkedin" : "fanpage_karma",
          followers: r.followers,
          follower_growth: r.follower_growth,
          follower_growth_rate: r.follower_growth_rate,
          posts: r.posts,
          interactions: r.interactions,
          engagement_rate: r.engagement_rate,
          impressions: r.impressions,
          reach: r.reach,
          performance_index: r.performance_index,
          raw: r.raw as any,
          created_by: uid.current,
        }));
        const { error } = await supabase
          .from("client_portal_social_metrics")
          .upsert(payload, { onConflict: "client_id,network,account_key,period_start,period_end" });
        if (error) throw error;
        total += payload.length;
      }
      toast.success(
        usable.length > 1
          ? `${total} registros en ${usable.length} periodos: ${labels.join(", ")}`
          : `${total} cuentas actualizadas · ${labels[0]}`
      );
      load();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo importar");
    } finally {
      setBusy(null);
      if (socialRef.current) socialRef.current.value = "";
    }
  };

  const handleMeta = async (files: File[]) => {
    const account = metaAccount.trim() || accountName.trim();
    if (!account) { toast.error("Escribe el nombre de la cuenta antes de subir"); if (metaRef.current) metaRef.current.value = ""; return; }
    setBusy("meta");
    try {
      const parsed = await parseMetaBusinessFiles(files, metaNetwork);
      if (!parsed.months.length && !parsed.audience) {
        toast.error("No reconocí ningún export de Meta en esos archivos");
        return;
      }
      const network = parsed.network;
      const account_key = accountKeyOf(account);

      const { data: existing } = await supabase
        .from("client_portal_social_metrics")
        .select("period_start,period_end,followers,posts,raw")
        .eq("client_id", clientId)
        .eq("network", network)
        .eq("account_key", account_key);

      const payload = parsed.months.map((m) => {
        const p = monthBounds(m.ym);
        const prev = (existing ?? []).find((r: any) => r.period_start === p.start && r.period_end === p.end);
        const engagement =
          m.interactions != null && m.impressions ? Number(((m.interactions / m.impressions) * 100).toFixed(2)) : null;
        return {
          client_id: clientId,
          network,
          account_key,
          account_name: account,
          period_start: p.start,
          period_end: p.end,
          period_label: p.label,
          source: "meta_business",
          followers: prev?.followers ?? null,
          follower_growth: m.follower_growth,
          follower_growth_rate: null,
          posts: prev?.posts ?? null,
          interactions: m.interactions,
          engagement_rate: engagement,
          impressions: m.impressions,
          reach: m.reach,
          raw: {
            ...(prev?.raw as any ?? {}),
            meta_business: {
              days: m.days,
              visits: m.visits,
              link_clicks: m.link_clicks,
              audience: parsed.audience,
            },
          } as any,
          created_by: uid.current,
        };
      });

      if (payload.length) {
        const { error } = await supabase
          .from("client_portal_social_metrics")
          .upsert(payload, { onConflict: "client_id,network,account_key,period_start,period_end" });
        if (error) throw error;
      }
      const ignoredNote = parsed.ignored.length ? ` · sin usar: ${parsed.ignored.join(", ")}` : "";
      toast.success(`${payload.length} meses actualizados de ${account} (${NETWORK_LABELS[network] ?? network})${ignoredNote}`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo importar");
    } finally {
      setBusy(null);
      if (metaRef.current) metaRef.current.value = "";
    }
  };


  const handleWeb = async (file: File) => {
    setBusy("web");
    try {
      const t = await parseWebFile(file);
      if (t.sessions == null && t.users == null) { toast.error("No reconocí métricas de GA4 en el archivo"); return; }
      const { error } = await supabase.from("client_portal_web_analytics").upsert(
        {
          client_id: clientId,
          period_start: period.start,
          period_end: period.end,
          period_label: period.label,
          users: t.users,
          new_users: t.new_users,
          sessions: t.sessions,
          pageviews: t.pageviews,
          avg_session_seconds: t.avg_session_seconds,
          bounce_rate: t.bounce_rate,
          conversions: t.conversions,
          channels: t.channels as any,
          created_by: uid.current,
        },
        { onConflict: "client_id,period_start,period_end" }
      );
      if (error) throw error;
      toast.success("Analítica web actualizada");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo importar");
    } finally {
      setBusy(null);
      if (webRef.current) webRef.current.value = "";
    }
  };

  const handleAds = async (file: File) => {
    setBusy("ads");
    try {
      const { platform: detected, rows } = await parseAdsFile(file);
      if (!rows.length) { toast.error("No encontré campañas en el archivo"); return; }
      const plat = detected ?? platform;
      const payload = rows.map((r) => ({
        client_id: clientId,
        platform: plat,
        campaign_key: normalizeKey(r.campaign_name).replace(/\s+/g, "-").slice(0, 120),
        campaign_name: r.campaign_name,
        objective: r.objective,
        period_start: period.start,
        period_end: period.end,
        period_label: period.label,
        spend: r.spend,
        impressions: r.impressions,
        reach: r.reach,
        clicks: r.clicks,
        ctr: r.ctr,
        cpc: r.cpc,
        cpm: r.cpm,
        results: r.results,
        result_type: r.result_type,
        cost_per_result: r.cost_per_result,
        conversions: r.conversions,
        raw: r.raw as any,
        created_by: uid.current,
      }));
      const { error } = await supabase
        .from("client_portal_ads_metrics")
        .upsert(payload, { onConflict: "client_id,platform,campaign_key,period_start,period_end" });
      if (error) throw error;
      toast.success(`${payload.length} campañas de ${plat} actualizadas`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo importar");
    } finally {
      setBusy(null);
      if (adsRef.current) adsRef.current.value = "";
    }
  };

  const removeRow = async (table: "client_portal_social_metrics" | "client_portal_web_analytics" | "client_portal_ads_metrics", id: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const socialGrouped = useMemo(() => {
    const m = new Map<string, any[]>();
    social.forEach((r) => {
      const k = `${r.period_label ?? r.period_end}`;
      m.set(k, [...(m.get(k) ?? []), r]);
    });
    return [...m.entries()];
  }, [social]);

  return (
    <div className="space-y-5">
      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Periodo de la carga</div>
        <p className="text-xs text-muted-foreground">
          Todo lo que subas abajo se guarda en este periodo. Si vuelves a subir el mismo periodo, se actualiza en vez de duplicarse.
        </p>
        <PeriodPicker value={period} onChange={setPeriod} />
      </Card>

      <Tabs defaultValue="redes" className="space-y-4">
        <TabsList className="h-auto p-1 flex-wrap">
          <TabsTrigger value="redes" className="gap-2"><BarChart3 className="w-4 h-4" /> Redes</TabsTrigger>
          <TabsTrigger value="web" className="gap-2"><Globe className="w-4 h-4" /> Web (GA4)</TabsTrigger>
          <TabsTrigger value="ads" className="gap-2"><Megaphone className="w-4 h-4" /> Ads</TabsTrigger>
        </TabsList>

        {/* -------- Redes -------- */}
        <TabsContent value="redes" className="mt-0 space-y-4">
          <MetricoolSyncCard clientId={clientId} onDone={load} />
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Subir performance de redes</div>
            <p className="text-xs text-muted-foreground">
              Acepta el comparativo de FanpageKarma (detecta red y cuenta solo) o el export de LinkedIn. Formatos: XLSX o CSV.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Red por defecto (si el archivo no la trae)</Label>
                <Select value={network} onValueChange={setNetwork}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(NETWORK_LABELS).filter(([k]) => k !== "x").map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cuenta por defecto (opcional)</Label>
                <Input className="h-9" placeholder="Ej. Falcon" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Switch id="auto-months" checked={autoMonths} onCheckedChange={setAutoMonths} />
              <div className="space-y-0.5">
                <Label htmlFor="auto-months" className="text-xs font-medium">Detectar meses dentro del archivo</Label>
                <p className="text-[11px] text-muted-foreground">
                  Si el export trae varios meses (columnas tipo “Seguidores 06/2026” o una columna de fecha), crea un corte por
                  cada mes automáticamente. Si se apaga, todo se guarda en el periodo seleccionado arriba.
                </p>
              </div>
            </div>

            <input ref={socialRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSocial(f); }} />
            <Button size="sm" onClick={() => socialRef.current?.click()} disabled={busy === "social"}>
              {busy === "social" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Subir archivo
            </Button>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Estadísticas de Meta Business (Facebook / Instagram)</div>
            <p className="text-xs text-muted-foreground">
              Sube de golpe los CSV diarios que exporta Meta (Seguidores, Visualizaciones, Interacciones, Visitas, Clics,
              Espectadores y Público). Se suman por mes y se guardan como cortes mensuales de la cuenta que indiques.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Red (si el archivo no la indica)</Label>
                <Select value={metaNetwork} onValueChange={setMetaNetwork}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nombre de la cuenta</Label>
                <Input className="h-9" placeholder="Ej. El Diluvio" value={metaAccount} onChange={(e) => setMetaAccount(e.target.value)} />
              </div>
            </div>
            <input ref={metaRef} type="file" accept=".csv" multiple className="hidden"
              onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) handleMeta(fs); }} />
            <Button size="sm" variant="outline" onClick={() => metaRef.current?.click()} disabled={busy === "meta"}>
              {busy === "meta" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Subir CSV de Meta
            </Button>
          </Card>


          {socialGrouped.map(([label, rows]) => (
            <Card key={label} className="p-4 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3 text-sm border-b border-border/40 last:border-0 py-1.5">
                  <Badge variant="outline" className="text-[10px]">{NETWORK_LABELS[r.network] ?? r.network}</Badge>
                  <span className="font-medium truncate">{r.account_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {r.followers != null ? `${Number(r.followers).toLocaleString("es-MX")} seg.` : "—"}
                    {r.engagement_rate != null ? ` · ${Number(r.engagement_rate).toFixed(2)}% int.` : ""}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow("client_portal_social_metrics", r.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </Card>
          ))}
        </TabsContent>

        {/* -------- Web -------- */}
        <TabsContent value="web" className="mt-0 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Lectura automática de Analytics
            </div>
            <p className="text-xs text-muted-foreground">
              Pide al cliente que agregue nuestra cuenta de lectura a su propiedad de Analytics y captura aquí el
              identificador de la propiedad (solo números, aparece en la configuración de su cuenta). Después, con un
              clic se traen los datos del periodo elegido arriba.
            </p>

            {gaProps.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm">
                <Badge variant="outline">{p.property_id}</Badge>
                <span className="font-medium">{p.label ?? "Propiedad de Analytics"}</span>
                <span className="text-xs text-muted-foreground">
                  {p.last_sync_error
                    ? `Falló: ${p.last_sync_error}`
                    : p.last_synced_at
                      ? `Última lectura: ${new Date(p.last_synced_at).toLocaleString("es-MX")}`
                      : "Sin leer todavía"}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => removeGaProperty(p.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Identificador de la propiedad</Label>
                <Input className="h-9 w-48" placeholder="481234567" value={gaId} onChange={(e) => setGaId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nombre (opcional)</Label>
                <Input className="h-9 w-56" placeholder="Sitio principal" value={gaLabel} onChange={(e) => setGaLabel(e.target.value)} />
              </div>
              <Button size="sm" variant="outline" onClick={addGaProperty} disabled={busy === "ga-prop"}>
                {busy === "ga-prop" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Guardar propiedad
              </Button>
              <Button size="sm" onClick={syncGa} disabled={busy === "ga-sync" || !gaProps.length}>
                {busy === "ga-sync" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Traer datos de {period.label}
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t pt-3">
              <div className="space-y-1">
                <Label className="text-xs">Histórico desde</Label>
                <Input type="month" className="h-9 w-44" value={gaFrom} onChange={(e) => setGaFrom(e.target.value)} />
              </div>
              <Button size="sm" variant="outline" onClick={syncGaHistory} disabled={busy === "ga-history" || !gaProps.length}>
                {busy === "ga-history" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Traer todo el histórico
              </Button>
              <span className="text-xs text-muted-foreground pb-2">
                {gaProgress ? `Cargando ${gaProgress}` : "Trae mes por mes, desde ese mes hasta el mes pasado."}
              </span>
            </div>

          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Subir analítica web (Google Analytics 4)</div>
            <p className="text-xs text-muted-foreground">
              Exporta de GA4 el informe de adquisición por canal (CSV) y súbelo. Se suman sesiones, usuarios, vistas y conversiones del periodo.
            </p>
            <input ref={webRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleWeb(f); }} />
            <Button size="sm" onClick={() => webRef.current?.click()} disabled={busy === "web"}>
              {busy === "web" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Subir CSV de GA4
            </Button>
          </Card>

          {web.map((r) => (
            <Card key={r.id} className="p-4 flex items-center gap-4 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{r.period_label ?? `${r.period_start} → ${r.period_end}`}</div>
                <div className="text-xs text-muted-foreground">
                  {Number(r.sessions ?? 0).toLocaleString("es-MX")} sesiones · {Number(r.users ?? 0).toLocaleString("es-MX")} usuarios
                  {r.conversions ? ` · ${Number(r.conversions).toLocaleString("es-MX")} conversiones` : ""}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => removeRow("client_portal_web_analytics", r.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </Card>
          ))}
        </TabsContent>

        {/* -------- Ads -------- */}
        <TabsContent value="ads" className="mt-0 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Lectura automática de Google Ads
            </div>
            <p className="text-xs text-muted-foreground">
              Captura el número de la cuenta de anuncios del cliente (solo dígitos, sin guiones). Después, con un clic
              se traen los resultados por campaña del periodo elegido arriba.
            </p>

            {adAccounts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm">
                <Badge variant="outline">{a.customer_id}</Badge>
                <span className="font-medium">{a.label ?? "Cuenta de anuncios"}</span>
                <span className="text-xs text-muted-foreground">
                  {a.last_sync_error
                    ? `Falló: ${a.last_sync_error}`
                    : a.last_synced_at
                      ? `Última lectura: ${new Date(a.last_synced_at).toLocaleString("es-MX")}`
                      : "Sin leer todavía"}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => removeAdAccount(a.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Número de cuenta</Label>
                <Input className="h-9 w-48" placeholder="1196579909" value={adId} onChange={(e) => setAdId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nombre (opcional)</Label>
                <Input className="h-9 w-56" placeholder="Cuenta principal" value={adLabel} onChange={(e) => setAdLabel(e.target.value)} />
              </div>
              <Button size="sm" variant="outline" onClick={addAdAccount} disabled={busy === "ad-acc"}>
                {busy === "ad-acc" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Guardar cuenta
              </Button>
              <Button size="sm" onClick={syncAds} disabled={busy === "ad-sync" || !adAccounts.length}>
                {busy === "ad-sync" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Traer datos de {period.label}
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t pt-3">
              <div className="space-y-1">
                <Label className="text-xs">Histórico desde</Label>
                <Input type="month" className="h-9 w-44" value={adFrom} onChange={(e) => setAdFrom(e.target.value)} />
              </div>
              <Button size="sm" variant="outline" onClick={syncAdsHistory} disabled={busy === "ad-history" || !adAccounts.length}>
                {busy === "ad-history" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Traer todo el histórico
              </Button>
              <span className="text-xs text-muted-foreground pb-2">
                {adProgress ? `Cargando ${adProgress}` : "Trae mes por mes, desde ese mes hasta el mes pasado."}
              </span>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm font-semibold">Subir resultados de campañas</div>
            <p className="text-xs text-muted-foreground">
              Export por campaña de Meta, Google, TikTok o X. Si no logro detectar la plataforma, uso la que elijas aquí.
            </p>
            <div className="space-y-1 max-w-xs">
              <Label className="text-xs">Plataforma por defecto</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as AdPlatform)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AD_PLATFORMS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <input ref={adsRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAds(f); }} />
            <Button size="sm" onClick={() => adsRef.current?.click()} disabled={busy === "ads"}>
              {busy === "ads" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Subir archivo
            </Button>
          </Card>

          {ads.map((r) => (
            <Card key={r.id} className="p-3 flex items-center gap-3 text-sm">
              <Badge variant="outline" className="text-[10px]">{AD_PLATFORMS.find((p) => p.key === r.platform)?.label ?? r.platform}</Badge>
              <span className="font-medium truncate">{r.campaign_name}</span>
              <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                {r.period_label} · ${Number(r.spend ?? 0).toLocaleString("es-MX")}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow("client_portal_ads_metrics", r.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
