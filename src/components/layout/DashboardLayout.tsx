import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import ProjectSelector from "@/components/layout/ProjectSelector";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";
import { TourGuide } from "@/components/onboarding/TourGuide";
import { WorkflowProgressBar } from "@/components/workflow/WorkflowProgressBar";
import { LogOut, User, Plus } from "lucide-react";

const DashboardContent = () => {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

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
              <div data-tour="project-selector">
                <ProjectSelector />
              </div>
              <div className="hidden md:block">
                <div className="h-6 w-px bg-border" />
              </div>
              <div className="hidden md:block" data-tour="workflow-progress">
                <WorkflowProgressBar compact />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button size="sm" onClick={() => navigate("/nuevo-proyecto")}>
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Nuevo Proyecto</span>
              </Button>

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

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6">
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
