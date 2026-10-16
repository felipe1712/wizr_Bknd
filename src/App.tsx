import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import RecuperarContrasena from "./pages/RecuperarContrasena";
import RestablecerContrasena from "./pages/RestablecerContrasena";
import SolicitarAcceso from "./pages/SolicitarAcceso";
import ProjectWizard from "./pages/ProjectWizard";
import ProjectSpecBuilder from "./pages/ProjectSpecBuilder";
import NotFound from "./pages/NotFound";
import PublicReportPage from "./pages/PublicReportPage";

// Dashboard pages (Wizr Core + Unified Views)
import InsightsPage from "./pages/dashboard/InsightsPage";
import SemanticaPage from "./pages/dashboard/SemanticaPage";
import ComparativaPage from "./pages/dashboard/ComparativaPage";
import InfluenciadoresPage from "./pages/dashboard/InfluenciadoresPage";
import FuentesPage from "./pages/dashboard/FuentesPage";
import ReportesPage from "./pages/dashboard/ReportesPage";
import ProjectsPage from "./pages/dashboard/ProjectsPage";
import ConfiguracionPage from "./pages/dashboard/ConfiguracionPage";
import RankingsPage from "./pages/dashboard/RankingsPage";
import PerformancePage from "./pages/dashboard/PerformancePage";
import DashboardHomePage from "./pages/dashboard/DashboardHomePage";
import AnalisisPage from "./pages/dashboard/AnalisisPage";

// Portal Ejecutivo Multi-Cliente y Administración
import PortalRouter from "./pages/portal/PortalRouter";
import ClientPortalAdmin from "./pages/admin/ClientPortalAdmin";
import { detectClientPortal } from "./lib/clientPortal";

import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const portal = detectClientPortal();

  if (portal) {
    return <PortalRouter portal={portal} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route
        path="/login"
        element={
          <AuthRoute>
            <Login />
          </AuthRoute>
        }
      />
      <Route
        path="/registro"
        element={
          <AuthRoute>
            <Registro />
          </AuthRoute>
        }
      />
      <Route
        path="/recuperar-contrasena"
        element={
          <AuthRoute>
            <RecuperarContrasena />
          </AuthRoute>
        }
      />
      <Route
        path="/restablecer-contrasena"
        element={<RestablecerContrasena />}
      />
      <Route
        path="/solicitar-acceso"
        element={
          <AuthRoute>
            <SolicitarAcceso />
          </AuthRoute>
        }
      />
      <Route
        path="/nuevo-proyecto"
        element={
          <ProtectedRoute>
            <ProjectWizard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proyecto/:id/editar"
        element={
          <ProtectedRoute>
            <ProjectSpecBuilder />
          </ProtectedRoute>
        }
      />

      {/* Portal Ejecutivo Multi-Cliente (acceso por ruta /portal/:slug) */}
      <Route path="/portal/:slug/*" element={<PortalRouter />} />

      {/* Administración del Portal Ejecutivo por Cliente */}
      <Route
        path="/admin/cliente/:clientId/portal"
        element={
          <ProtectedRoute>
            <ClientPortalAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/clientes/:clientId/portal"
        element={
          <ProtectedRoute>
            <ClientPortalAdmin />
          </ProtectedRoute>
        }
      />

      {/* Dashboard routes with layout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHomePage />} />
        <Route path="inicio" element={<DashboardHomePage />} />
        <Route path="analizar" element={<AnalisisPage />} />
        <Route path="panorama" element={<Navigate to="/dashboard/analizar?v=panorama" replace />} />
        <Route path="semantica" element={<Navigate to="/dashboard/analizar?v=semantica" replace />} />
        <Route path="comparativa" element={<Navigate to="/dashboard/analizar?v=comparativa" replace />} />
        <Route path="influenciadores" element={<Navigate to="/dashboard/analizar?v=influenciadores" replace />} />
        <Route path="rankings" element={<Navigate to="/dashboard/performance" replace />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="fuentes" element={<FuentesPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="proyectos" element={<ProjectsPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
        <Route path="tendencias" element={<Navigate to="/dashboard/analizar" replace />} />
        <Route path="alertas" element={<Navigate to="/dashboard/analizar" replace />} />
      </Route>

      {/* Public shared report (no auth) */}
      <Route path="/r/:token" element={<PublicReportPage />} />

      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
