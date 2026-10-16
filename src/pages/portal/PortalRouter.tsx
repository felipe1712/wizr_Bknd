import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CLIENT_PORTALS, type ClientPortalConfig } from "@/lib/clientPortal";
import PortalLogin from "./PortalLogin";
import PortalHome from "./PortalHome";
import PortalCreative from "./PortalCreative";
import PortalReport from "./PortalReport";
import ResetPassword from "@/pages/ResetPassword";

export default function PortalRouter({ portal: initialPortal }: { portal?: ClientPortalConfig }) {
  const { slug } = useParams<{ slug?: string }>();
  const [resolvedPortal, setResolvedPortal] = useState<ClientPortalConfig | null>(
    initialPortal ?? (slug && CLIENT_PORTALS[slug] ? CLIENT_PORTALS[slug] : null)
  );
  const [session, setSession] = useState<any | null>(null);
  const [ready, setReady] = useState(false);
  const [services, setServices] = useState<string[] | null>(null);

  useEffect(() => {
    if (initialPortal) {
      setResolvedPortal(initialPortal);
      return;
    }
    if (!slug) return;
    if (CLIENT_PORTALS[slug]) {
      setResolvedPortal(CLIENT_PORTALS[slug]);
      return;
    }
    supabase
      .from("clients")
      .select("id, name, description, logo_url")
      .eq("id", slug)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setResolvedPortal({
            slug: data.id,
            clientId: data.id,
            clientName: data.name,
            displayName: data.name,
            tagline: data.description || "Portal privado de análisis ejecutivo",
            logoUrl: data.logo_url || undefined,
          });
        }
      });
  }, [initialPortal, slug]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e: any, s: any) => setSession(s));
    supabase.auth.getSession().then(({ data }: any) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id ?? null;
  useEffect(() => {
    if (!ready || !resolvedPortal) return;
    if (!uid) {
      setServices([]);
      return;
    }
    setServices(null);
    supabase
      .from("clients")
      .select("services")
      .eq("id", resolvedPortal.clientId)
      .maybeSingle()
      .then(({ data }: any) => setServices(((data as any)?.services ?? []) as string[]));
  }, [resolvedPortal, uid, ready]);

  if (!ready || !resolvedPortal || (uid && services === null)) {
    return <div className="min-h-screen bg-background" />;
  }

  // Clientes con Análisis (o sin filtro explícito) usan el portal analítico (PortalHome).
  const Home = (services ?? []).length === 0 || (services ?? []).includes("analisis") ? PortalHome : PortalCreative;

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      {!session ? (
        <>
          <Route path="/" element={<PortalLogin portal={resolvedPortal} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <>
          <Route path="/" element={<Home portal={resolvedPortal} />} />
          <Route path="/reporte/:reportId" element={<PortalReport portal={resolvedPortal} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}