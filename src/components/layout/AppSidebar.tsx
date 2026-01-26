import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquareText,
  GitCompare,
  Bell,
  Users,
  TrendingUp,
  Database,
  FileBarChart,
  FolderOpen,
  Settings,
  ChevronLeft,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import wizrLogo from "@/assets/wizr-logo.png";
import wizrWordmark from "@/assets/wizr-wordmark.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const analysisViews = [
  { title: "Panorama", url: "/dashboard/panorama", icon: LayoutDashboard },
  { title: "Semántica", url: "/dashboard/semantica", icon: MessageSquareText },
  { title: "Comparativa", url: "/dashboard/comparativa", icon: GitCompare },
  { title: "Alertas", url: "/dashboard/alertas", icon: Bell },
  { title: "Influenciadores", url: "/dashboard/influenciadores", icon: Users },
  { title: "Tendencias", url: "/dashboard/tendencias", icon: TrendingUp },
  { title: "Fuentes", url: "/dashboard/fuentes", icon: Database },
  { title: "Reportes", url: "/dashboard/reportes", icon: FileBarChart },
];

const managementItems = [
  { title: "Proyectos", url: "/dashboard/proyectos", icon: FolderOpen },
  { title: "Configuración", url: "/dashboard/configuracion", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          <img src={wizrLogo} alt="Wizr" className="h-8 w-8" />
          {!collapsed && (
            <img src={wizrWordmark} alt="Wizr" className="h-5 w-auto" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {/* Analysis Views */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {!collapsed ? "Análisis" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisViews.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {!collapsed ? "Gestión" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        {!collapsed && (
          <p className="px-2 text-xs text-muted-foreground">
            Wizr Intelligence Platform
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
