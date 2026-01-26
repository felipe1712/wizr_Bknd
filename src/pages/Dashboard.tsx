import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import wizrLogo from "@/assets/wizr-logo.png";
import { LogOut, User, LayoutDashboard, FileText, Bell, Settings, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProjectList from "@/components/projects/ProjectList";

const Dashboard = () => {
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={wizrLogo} alt="Wizr" className="h-10 w-auto" />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {roles.map((role) => (
                <span
                  key={role}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${getRoleBadgeColor(role)}`}
                >
                  {role}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User size={16} />
              <span>{user?.email}</span>
            </div>

            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl p-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bienvenido a Wizr</h1>
            <p className="text-muted-foreground">
              Sistema de inteligencia estratégica para análisis de conversación pública
            </p>
          </div>
          <Button onClick={() => navigate("/nuevo-proyecto")}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Proyecto
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Panorama
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FileText className="h-4 w-4" />
              Proyectos
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              Alertas
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuración
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-lg text-muted-foreground">
                Próximamente: Vista panorámica consolidada
              </p>
            </div>
          </TabsContent>

          <TabsContent value="projects">
            <ProjectList />
          </TabsContent>

          <TabsContent value="alerts">
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-lg text-muted-foreground">
                Próximamente: Sistema de alertas y notificaciones
              </p>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-lg text-muted-foreground">
                Próximamente: Configuración de cuenta y preferencias
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
