import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import wizrLogo from "@/assets/wizr-logo.png";
import { LogOut, User, LayoutDashboard, FileText, Bell, Settings, Plus } from "lucide-react";

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

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            icon={<LayoutDashboard className="h-6 w-6" />}
            title="Panorama General"
            description="Vista consolidada de todas las fuentes"
            color="primary"
          />
          <DashboardCard
            icon={<FileText className="h-6 w-6" />}
            title="Proyectos"
            description="Gestiona tus proyectos de análisis"
            color="secondary"
          />
          <DashboardCard
            icon={<Bell className="h-6 w-6" />}
            title="Alertas"
            description="Notificaciones y eventos críticos"
            color="accent"
          />
          <DashboardCard
            icon={<Settings className="h-6 w-6" />}
            title="Configuración"
            description="Ajustes de cuenta y sistema"
            color="muted"
          />
        </div>

        {/* Placeholder for future content */}
        <div className="mt-8 rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-lg text-muted-foreground">
            Próximamente: Project Spec Builder y Vistas de Análisis
          </p>
        </div>
      </main>
    </div>
  );
};

interface DashboardCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: "primary" | "secondary" | "accent" | "muted";
}

const DashboardCard = ({ icon, title, description, color }: DashboardCardProps) => {
  const bgColors = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary text-secondary-foreground",
    accent: "bg-accent/10 text-accent",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <div className="group cursor-pointer rounded-lg border border-border bg-card p-6 transition-colors hover:bg-muted/50">
      <div className={`mb-4 inline-flex rounded-lg p-3 ${bgColors[color]}`}>
        {icon}
      </div>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
};

export default Dashboard;
