import { useLocation } from "react-router-dom";
import {
  Database,
  FileBarChart,
  Settings,
  Trophy,
  Home,
  Eye,
  FolderOpen,
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

interface NavItemDef {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Número de paso en el ciclo de trabajo */
  step?: number;
}

const homeItem: NavItemDef = {
  title: "Inicio",
  url: "/dashboard",
  icon: Home,
};

// Ciclo real de trabajo: Definir -> Capturar -> Analizar -> Reportar
const listeningItems: NavItemDef[] = [
  { title: "Definir", url: "/dashboard/configuracion", icon: Settings, step: 1 },
  { title: "Capturar", url: "/dashboard/fuentes", icon: Database, step: 2 },
  { title: "Analizar", url: "/dashboard/analizar", icon: Eye, step: 3 },
  { title: "Reportar", url: "/dashboard/reportes", icon: FileBarChart, step: 4 },
];

const listeningExtras: NavItemDef[] = [
  { title: "Proyectos", url: "/dashboard/proyectos", icon: FolderOpen },
];

const benchmarkingItems: NavItemDef[] = [
  { title: "Clientes", url: "/dashboard/performance", icon: Trophy },
];

function NavItem({ item, collapsed, isActive }: { item: NavItemDef; collapsed: boolean; isActive: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={collapsed ? item.title : undefined}>
        <NavLink
          to={item.url}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
        >
          <item.icon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{item.title}</span>}
          {!collapsed && item.step !== undefined && (
            <span className="ml-auto text-[10px] font-semibold text-sidebar-foreground/40">
              {item.step}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavGroup({ label, items, collapsed, isActive }: { label: string; items: NavItemDef[]; collapsed: boolean; isActive: (url: string) => boolean }) {
  return (
    <SidebarGroup className="mt-3">
      {!collapsed && (
        <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <NavItem key={item.url} item={item} collapsed={collapsed} isActive={isActive(item.url)} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

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
            <img src={wizrIcon} alt="Wizr" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground tracking-tight">WIZR</span>
              <span className="text-[10px] text-sidebar-foreground/70 uppercase tracking-widest">
                Análisis Estratégico
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* Home */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem
                item={homeItem}
                collapsed={collapsed}
                isActive={location.pathname === "/dashboard" || location.pathname === "/dashboard/inicio"}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <NavGroup label="Flujo de listening" items={listeningItems} collapsed={collapsed} isActive={isActive} />
        <NavGroup label="Proyectos" items={listeningExtras} collapsed={collapsed} isActive={isActive} />
        <NavGroup label="Benchmarking" items={benchmarkingItems} collapsed={collapsed} isActive={isActive} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <p className="px-2 text-[10px] text-sidebar-foreground/40 uppercase tracking-wider">Wizr Intelligence</p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
