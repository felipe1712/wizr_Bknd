import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { LogOut, ShieldAlert, Sun, Moon, CalendarDays, Megaphone, FileText, LayoutDashboard, Sparkles, Lightbulb, Globe } from "lucide-react";
import type { ClientPortalConfig } from "@/lib/clientPortal";
import { SERVICE_MAP, type ServiceKey } from "@/lib/services";
import PortalParrillaNotion from "@/components/portal/PortalParrillaNotion";

import PortalInsights from "@/components/portal/PortalInsights";
import EfemeridesRadar from "@/components/portal/EfemeridesRadar";
import PortalWebsite from "@/components/portal/PortalWebsite";
import { Link } from "react-router-dom";

type Report = { id: string; report_date: string; title: string; type: string; summary_md: string | null };

export default function PortalCreative({ portal }: { portal: ClientPortalConfig }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(portal.logoUrl ?? null);
  const [services, setServices] = useState<ServiceKey[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [counts, setCounts] = useState({ parrilla: 0, activos: 0, ads: 0, web: 0 });

  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    typeof window === "undefined" ? "dark" : ((localStorage.getItem("portal-theme") as "dark" | "light") || "dark")
  );

  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", theme === "light");
    localStorage.setItem("portal-theme", theme);
  }, [theme]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;

      const [{ data: client }, { data: rep }, { data: roles }, { data: access }, parrilla, activos, ads, web] =
        await Promise.all([
        supabase.from("clients").select("logo_url, services").eq("id", portal.clientId).maybeSingle(),
        supabase
          .from("client_portal_reports")
          .select("id, report_date, title, type, summary_md")
          .eq("client_id", portal.clientId)
          .order("report_date", { ascending: false })
          .limit(30),
        uid ? supabase.from("user_roles").select("role").eq("user_id", uid) : Promise.resolve({ data: [] as any[] }),
        uid
          ? supabase.from("client_access").select("id").eq("client_id", portal.clientId).eq("user_id", uid).limit(1)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("notion_parrilla_items")
          .select("id", { count: "exact", head: true })
          .eq("client_id", portal.clientId),
        supabase
          .from("client_portal_assets")
          .select("id", { count: "exact", head: true })
          .eq("client_id", portal.clientId),
        supabase
          .from("client_portal_ads_metrics")
          .select("id", { count: "exact", head: true })
          .eq("client_id", portal.clientId),
        supabase
          .from("client_portal_web_analytics")
          .select("id", { count: "exact", head: true })
          .eq("client_id", portal.clientId),
      ]);

      if (!alive) return;
      const admin = (roles ?? []).some((r: any) => r.role === "admin");
      setIsAdmin(admin);
      setDenied(!admin && !(access ?? []).length);
      setLogoUrl((client as any)?.logo_url ?? null);
      setServices((((client as any)?.services ?? []) as ServiceKey[]));
      setReports((rep ?? []) as Report[]);
      setCounts({
        parrilla: parrilla.count ?? 0,
        activos: activos.count ?? 0,
        ads: ads.count ?? 0,
        web: web.count ?? 0,
      });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [portal.clientId]);

  const tabs = useMemo(() => {
    const list: { key: string; label: string; icon: any }[] = [
      { key: "resumen", label: "Resumen", icon: LayoutDashboard },
      { key: "aprendizajes", label: "Qué funciona", icon: Lightbulb },
      { key: "contenido", label: "Contenido", icon: Sparkles },
    ];
    if (counts.ads > 0) list.push({ key: "publicidad", label: "Publicidad", icon: Megaphone });
    if (counts.web > 0) list.push({ key: "web", label: "Sitio web", icon: Globe });
    if (services.includes("estrategia") && (counts.parrilla > 0 || isAdmin)) {
      list.push({ key: "parrilla", label: "Parrilla editorial", icon: CalendarDays });
    }
    if (reports.length) list.push({ key: "reportes", label: "Reportes", icon: FileText });
    return list;
  }, [services, reports.length, counts, isAdmin]);

  const [tab, setTab] = useState<string>("resumen");
  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.key === tab)) setTab(tabs[0].key);
  }, [tabs, tab]);

  const initials = portal.displayName.slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (denied) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass rounded-xl p-10 text-center space-y-3 max-w-md">
          <ShieldAlert className="w-10 h-10 text-coral mx-auto" />
          <h2 className="text-lg font-semibold">Tu cuenta no tiene acceso a este portal</h2>
          <p className="text-sm text-muted-foreground">Solicita a KiMedia que habilite tu correo.</p>
          <Button size="sm" variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Salir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-mesh opacity-30 pointer-events-none" />

      <header className="relative border-b border-border/50 bg-background/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-coral/20 to-coral/5 border border-coral/20 flex items-center justify-center shrink-0 overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={portal.displayName} className="w-full h-full object-contain p-1.5" />
              ) : (
                <span className="font-display font-bold text-coral text-sm">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Portal de cliente</div>
              <h1 className="text-lg font-display font-bold truncate leading-tight">{portal.displayName}</h1>
            </div>
            <div className="hidden md:flex items-center gap-1.5 ml-2">
              {services.map((s) => (
                <Badge key={s} variant="outline" className={SERVICE_MAP[s]?.badgeClass}>
                  {SERVICE_MAP[s]?.short ?? s}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-6 py-6 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Tabs value={tab} onValueChange={setTab} className="space-y-5">
              <TabsList className="glass h-auto p-1 flex-wrap">
                {tabs.map((t) => (
                  <TabsTrigger key={t.key} value={t.key} className="gap-2">
                    <t.icon className="w-4 h-4" /> {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="resumen" className="mt-0">
                <EfemeridesRadar clientId={portal.clientId} />
                <PortalInsights clientId={portal.clientId} clientName={portal.displayName} view="panorama" />
              </TabsContent>
              <TabsContent value="aprendizajes" className="mt-0">
                <PortalInsights clientId={portal.clientId} clientName={portal.displayName} view="aprendizajes" />
              </TabsContent>
              <TabsContent value="contenido" className="mt-0">
                <PortalInsights clientId={portal.clientId} clientName={portal.displayName} view="contenido" />
              </TabsContent>
              <TabsContent value="publicidad" className="mt-0">
                <PortalInsights clientId={portal.clientId} clientName={portal.displayName} view="publicidad" />
              </TabsContent>

              <TabsContent value="web" className="mt-0">
                <PortalWebsite clientId={portal.clientId} />
              </TabsContent>

              {services.includes("estrategia") && (
                <>
                  <TabsContent value="parrilla" className="mt-0">
                    <PortalParrillaNotion clientId={portal.clientId} clientName={portal.clientName} canSync={isAdmin} />
                  </TabsContent>

                </>
              )}

              <TabsContent value="reportes" className="mt-0 space-y-3">
                {reports.length ? (
                  reports.map((r) => (
                    <Link key={r.id} to={`/reporte/${r.id}`}>
                      <Card className="glass border-border/50 p-4 hover:border-coral/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-coral" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{r.title}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {new Date(r.report_date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))
                ) : (
                  <Card className="glass border-border/50 p-14 text-center text-sm text-muted-foreground">
                    Todavía no hay reportes publicados.
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </main>
    </div>
  );
}
