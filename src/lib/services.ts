// Catálogo de servicios que KiMedia presta por cliente.
// Se usa para que Operación y los portales muestren SOLO los módulos que aplican.

export type ServiceKey = "analisis" | "estrategia" | "ads" | "audiovisual";

export type ServiceMeta = {
  key: ServiceKey;
  label: string;
  short: string;
  description: string;
  /** Clases de badge (tokens semánticos, sin colores hardcodeados de tema) */
  badgeClass: string;
  /** Módulos de portal que habilita este servicio */
  portalModules: string[];
};

export const SERVICES: ServiceMeta[] = [
  {
    key: "analisis",
    label: "Análisis",
    short: "Análisis",
    description: "Social listening / prensa, performance y benchmark competitivo.",
    badgeClass: "bg-cyan/15 text-cyan border-cyan/30",
    portalModules: ["listening", "benchmark", "reportes"],
  },
  {
    key: "estrategia",
    label: "Estrategia digital",
    short: "Estrategia",
    description: "Funnel, gestión de activos digitales y community management (parrilla).",
    badgeClass: "bg-electric/15 text-electric border-electric/30",
    portalModules: ["parrilla", "activos", "reportes"],
  },
  {
    key: "ads",
    label: "Ads",
    short: "Ads",
    description: "Campañas pagadas: inversión, resultados y aprendizajes. Incluye su propio análisis de performance.",
    badgeClass: "bg-coral/15 text-coral border-coral/30",
    portalModules: ["ads", "reportes"],
  },
  {
    key: "audiovisual",
    label: "Producción audiovisual",
    short: "Audiovisual",
    description: "Piezas, rodajes y entregables de video/foto.",
    badgeClass: "bg-magenta/15 text-magenta border-magenta/30",
    portalModules: ["audiovisual"],
  },
];

export const SERVICE_MAP: Record<string, ServiceMeta> = Object.fromEntries(
  SERVICES.map((s) => [s.key, s])
);

export const SERVICE_KEYS = SERVICES.map((s) => s.key);

export function serviceLabel(key: string) {
  return SERVICE_MAP[key]?.label ?? key;
}

/** Módulos de portal habilitados según los servicios contratados. */
export function portalModulesFor(services: string[] = []): string[] {
  const set = new Set<string>();
  services.forEach((s) => SERVICE_MAP[s]?.portalModules.forEach((m) => set.add(m)));
  return [...set];
}

export function hasService(services: string[] | null | undefined, key: ServiceKey) {
  return (services || []).includes(key);
}
