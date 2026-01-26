import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { LogOut, User, Plus } from "lucide-react";

const DashboardLayout = () => {
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
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          {/* Header */}
          <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>

            <div className="flex items-center gap-4">
              <Button size="sm" onClick={() => navigate("/nuevo-proyecto")}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Proyecto
              </Button>

              <div className="flex items-center gap-2">
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
                <span className="hidden md:inline">{user?.email}</span>
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
    </SidebarProvider>
  );
};

export default DashboardLayout;
