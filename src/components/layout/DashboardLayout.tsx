import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import ProjectSelector from "@/components/layout/ProjectSelector";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { TourGuide } from "@/components/onboarding/TourGuide";
import { WorkflowFlowBar } from "@/components/workflow/WorkflowFlowBar";
import { LogOut, User, Plus, Trophy, Building2 } from "lucide-react";

const DashboardContent = () => {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Routes that are independent of projects (use clients or are global)
  const isRankingsPage = location.pathname.startsWith("/dashboard/rankings");
  const isPerformancePage = location.pathname.startsWith("/dashboard/performance");
  const isProjectIndependent = isRankingsPage || isPerformancePage;
  // Inicio es el lugar donde se elige el proyecto: no duplicamos selector ni barra de flujo
  const isHomePage = location.pathname === "/dashboard" || location.pathname === "/dashboard/";


  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-primary text-primary-foreground";
      case "director":
        return "bg-accent text-accent-foreground";
      case "analista":
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          {/* Header */}
          <header className="flex h-14 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-foreground" />
              <div className="h-6 w-px bg-border" />
              
              {/* Show context indicator OR project selector depending on route */}
              {isRankingsPage ? (
                <div className="flex items-center gap-2 text-sm font-medium">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15">
                    <Trophy className="h-4 w-4 text-accent" />
                  </div>
                  <span className="text-foreground">Benchmarking Competitivo</span>
                </div>
              ) : isPerformancePage ? (
                <div className="flex items-center gap-2 text-sm font-medium">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-foreground">Performance por Cliente</span>
                </div>
              ) : isHomePage ? (

                <span className="text-sm font-medium text-foreground">Inicio</span>
              ) : (
                <div data-tour="project-selector">
                  <ProjectSelector />
                </div>
              )}
            </div>


            <div className="flex items-center gap-4">
              {!isProjectIndependent && (
                <Button size="sm" onClick={() => navigate("/nuevo-proyecto")}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Nuevo Proyecto</span>
                </Button>
              )}

              <div className="hidden items-center gap-2 md:flex">
                {roles.map((role) => (
                  <span
                    key={role}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getRoleBadgeColor(role)}`}
                  >
                    {role}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User size={14} />
                <span className="hidden lg:inline">{user?.email}</span>
              </div>

              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut size={16} />
              </Button>
            </div>
          </header>

          {/* Barra de flujo: Definir -> Capturar -> Analizar -> Reportar */}
          {!isProjectIndependent && !isHomePage && (

            <div className="sticky top-14 z-10" data-tour="workflow-progress">
              <WorkflowFlowBar />
            </div>
          )}

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>

      {/* Onboarding Components */}
      <WelcomeModal />
      <TourGuide />
    </SidebarProvider>
  );
};

const DashboardLayout = () => {
  return (
    <ProjectProvider>
      <DashboardContent />
    </ProjectProvider>
  );
};

export default DashboardLayout;
