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
  Trophy,
  Home,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import wizrIcon from "@/assets/wizr-icon-transparent.png";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

const homeItem = { 
  title: "Inicio", 
  url: "/dashboard", 
  icon: Home, 
  tourId: "nav-inicio",
  description: "Panel principal con resumen del proyecto"
};

// Reorganized for clearer workflow: Capture → Analysis → Output
const captureItems = [
  { 
    title: "Fuentes", 
    url: "/dashboard/fuentes", 
    icon: Database, 
    tourId: "nav-fuentes",
    description: "Recopilar menciones de redes sociales y noticias"
  },
];

const analysisItems = [
  { 
    title: "Panorama", 
    url: "/dashboard/panorama", 
    icon: LayoutDashboard, 
    tourId: "nav-panorama",
    description: "Vista general de actividad y sentimiento"
  },
  { 
    title: "Semántica", 
    url: "/dashboard/semantica", 
    icon: MessageSquareText, 
    tourId: "nav-semantica",
    description: "Análisis de temas y palabras clave"
  },
  { 
    title: "Comparativa", 
    url: "/dashboard/comparativa", 
    icon: GitCompare, 
    tourId: "nav-comparativa",
    description: "Comparar entidades entre sí"
  },
  { 
    title: "Influenciadores", 
    url: "/dashboard/influenciadores", 
    icon: Users, 
    tourId: "nav-influenciadores",
    description: "Fuentes con mayor impacto"
  },
  { 
    title: "Tendencias", 
    url: "/dashboard/tendencias", 
    icon: TrendingUp, 
    tourId: "nav-tendencias",
    description: "Evolución temporal de menciones"
  },
];

const outputItems = [
  { 
    title: "Alertas", 
    url: "/dashboard/alertas", 
    icon: Bell, 
    tourId: "nav-alertas",
    description: "Configurar notificaciones automáticas"
  },
  { 
    title: "Reportes", 
    url: "/dashboard/reportes", 
    icon: FileBarChart, 
    tourId: "nav-reportes",
    description: "Generar informes con IA"
  },
];

const benchmarkingItems = [
  { 
    title: "Rankings", 
    url: "/dashboard/rankings", 
    icon: Trophy, 
    tourId: "nav-rankings",
    description: "Comparar perfiles sociales"
  },
];

const managementItems = [
  { 
    title: "Proyectos", 
    url: "/dashboard/proyectos", 
    icon: FolderOpen, 
    tourId: "nav-proyectos",
    description: "Gestionar proyectos de monitoreo"
  },
  { 
    title: "Configuración", 
    url: "/dashboard/configuracion", 
    icon: Settings, 
    tourId: "nav-configuracion",
    description: "Entidades y ajustes del proyecto"
  },
];

interface NavItemProps {
  item: {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
    tourId: string;
    description: string;
  };
  collapsed: boolean;
  isActive: boolean;
}

function NavItem({ item, collapsed, isActive }: NavItemProps) {
  const content = (
    <SidebarMenuButton
      asChild
      isActive={isActive}
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
  );

  // Show tooltip with description when expanded
  if (!collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuItem data-tour={item.tourId}>
            {content}
          </SidebarMenuItem>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="text-xs">{item.description}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <SidebarMenuItem data-tour={item.tourId}>
      {content}
    </SidebarMenuItem>
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
        {/* Home / Dashboard */}
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

        {/* Data Capture */}
        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            {!collapsed ? "Captura" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {captureItems.map((item) => (
                <NavItem 
                  key={item.title} 
                  item={item} 
                  collapsed={collapsed} 
                  isActive={isActive(item.url)} 
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Analysis */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            {!collapsed ? "Análisis" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisItems.map((item) => (
                <NavItem 
                  key={item.title} 
                  item={item} 
                  collapsed={collapsed} 
                  isActive={isActive(item.url)} 
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Output */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            {!collapsed ? "Salidas" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {outputItems.map((item) => (
                <NavItem 
                  key={item.title} 
                  item={item} 
                  collapsed={collapsed} 
                  isActive={isActive(item.url)} 
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Benchmarking */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            {!collapsed ? "Benchmarking" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {benchmarkingItems.map((item) => (
                <NavItem 
                  key={item.title} 
                  item={item} 
                  collapsed={collapsed} 
                  isActive={isActive(item.url)} 
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            {!collapsed ? "Gestión" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <NavItem 
                  key={item.title} 
                  item={item} 
                  collapsed={collapsed} 
                  isActive={isActive(item.url)} 
                />
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
