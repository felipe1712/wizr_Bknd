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
import ProjectSpecBuilder from "./pages/ProjectSpecBuilder";
import NotFound from "./pages/NotFound";

// Dashboard pages
import PanoramaPage from "./pages/dashboard/PanoramaPage";
import SemanticaPage from "./pages/dashboard/SemanticaPage";
import ComparativaPage from "./pages/dashboard/ComparativaPage";
import AlertasPage from "./pages/dashboard/AlertasPage";
import InfluenciadoresPage from "./pages/dashboard/InfluenciadoresPage";
import TendenciasPage from "./pages/dashboard/TendenciasPage";
import FuentesPage from "./pages/dashboard/FuentesPage";
import ReportesPage from "./pages/dashboard/ReportesPage";
import ProjectsPage from "./pages/dashboard/ProjectsPage";
import ConfiguracionPage from "./pages/dashboard/ConfiguracionPage";
import RankingsPage from "./pages/dashboard/RankingsPage";
import DashboardHomePage from "./pages/dashboard/DashboardHomePage";

import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Redirect authenticated users away from auth pages
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
            <ProjectSpecBuilder />
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
        <Route path="panorama" element={<PanoramaPage />} />
        <Route path="semantica" element={<SemanticaPage />} />
        <Route path="comparativa" element={<ComparativaPage />} />
        <Route path="alertas" element={<AlertasPage />} />
        <Route path="influenciadores" element={<InfluenciadoresPage />} />
        <Route path="tendencias" element={<TendenciasPage />} />
        <Route path="rankings" element={<RankingsPage />} />
        <Route path="fuentes" element={<FuentesPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="proyectos" element={<ProjectsPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
      </Route>

      {/* Legacy dashboard redirect */}
      <Route path="/dashboard" element={<Navigate to="/dashboard/panorama" replace />} />

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
