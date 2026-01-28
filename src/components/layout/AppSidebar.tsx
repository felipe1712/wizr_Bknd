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
  FileText,
  FolderOpen,
  Settings,
  Trophy,
  Target,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import wizrIcon from "@/assets/wizr-icon-transparent.png";

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
  { title: "Fuentes", url: "/dashboard/fuentes", icon: Database, tourId: "nav-fuentes" },
  { title: "Panorama", url: "/dashboard/panorama", icon: LayoutDashboard, tourId: "nav-panorama" },
  { title: "Semántica", url: "/dashboard/semantica", icon: MessageSquareText, tourId: "nav-semantica" },
  { title: "Comparativa", url: "/dashboard/comparativa", icon: GitCompare, tourId: "nav-comparativa" },
  { title: "Alertas", url: "/dashboard/alertas", icon: Bell, tourId: "nav-alertas" },
  { title: "Influenciadores", url: "/dashboard/influenciadores", icon: Users, tourId: "nav-influenciadores" },
  { title: "Tendencias", url: "/dashboard/tendencias", icon: TrendingUp, tourId: "nav-tendencias" },
  { title: "Reportes", url: "/dashboard/reportes", icon: FileBarChart, tourId: "nav-reportes" },
];

const benchmarkingItems = [
  { title: "Rankings", url: "/dashboard/rankings", icon: Trophy, tourId: "nav-rankings" },
];

const managementItems = [
  { title: "Proyectos", url: "/dashboard/proyectos", icon: FolderOpen, tourId: "nav-proyectos" },
  { title: "Configuración", url: "/dashboard/configuracion", icon: Settings, tourId: "nav-configuracion" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/90 p-1.5 flex items-center justify-center">
            <img 
              src={wizrIcon} 
              alt="Wizr" 
              className="h-full w-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
                WIZR
              </span>
              <span className="text-[10px] text-sidebar-foreground/70 uppercase tracking-widest">
                Análisis Estratégico
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {/* Analysis Views */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            {!collapsed ? "Análisis" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisViews.map((item) => (
                <SidebarMenuItem key={item.title} data-tour={item.tourId}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
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

        {/* Benchmarking */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            {!collapsed ? "Benchmarking" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {benchmarkingItems.map((item) => (
                <SidebarMenuItem key={item.title} data-tour={item.tourId}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
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
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            {!collapsed ? "Gestión" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title} data-tour={item.tourId}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
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

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <p className="px-2 text-xs text-sidebar-foreground/50">
            Wizr Intelligence Platform
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
