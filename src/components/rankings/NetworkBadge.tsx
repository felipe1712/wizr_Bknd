import { Badge } from "@/components/ui/badge";
import { Facebook, Instagram, Twitter, Youtube, Linkedin, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Badge visual de red social. Se usa junto al nombre del perfil para que
 * el usuario sepa SIEMPRE en qué red social está leyendo el dato, sin
 * tener que inferirlo del contexto de la pantalla.
 */
interface NetworkBadgeProps {
  network: string;
  size?: "xs" | "sm";
  className?: string;
}

const NETWORK_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; classes: string }> = {
  facebook: {
    label: "Facebook",
    icon: Facebook,
    classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  },
  instagram: {
    label: "Instagram",
    icon: Instagram,
    classes: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-900",
  },
  twitter: {
    label: "X",
    icon: Twitter,
    classes: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700",
  },
  x: {
    label: "X",
    icon: Twitter,
    classes: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700",
  },
  youtube: {
    label: "YouTube",
    icon: Youtube,
    classes: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  },
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    classes: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  },
  tiktok: {
    label: "TikTok",
    icon: Hash,
    classes: "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800/60 dark:text-zinc-100 dark:border-zinc-700",
  },
};

export function NetworkBadge({ network, size = "xs", className }: NetworkBadgeProps) {
  const key = (network || "").toLowerCase().trim();
  const meta = NETWORK_META[key] ?? {
    label: network ? network.charAt(0).toUpperCase() + network.slice(1) : "Red",
    icon: Hash,
    classes: "bg-muted text-muted-foreground border-border",
  };
  const Icon = meta.icon;
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-[10px] px-1.5 py-0.5";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <Badge
      variant="outline"
      data-network-badge={key || "unknown"}
      className={cn("inline-flex items-center gap-1 font-medium border", meta.classes, sizeClasses, className)}
    >
      <Icon className={iconSize} />
      <span>{meta.label}</span>
    </Badge>
  );
}
