import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";
import { cn } from "@/lib/utils";

interface NetworkFilterProps {
  networks: FKNetwork[];
  selected: FKNetwork | "all";
  onChange: (network: FKNetwork | "all") => void;
  counts?: Record<string, number>;
}

const NETWORK_COLORS: Record<FKNetwork, string> = {
  facebook: "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300",
  instagram: "bg-pink-100 text-pink-700 hover:bg-pink-200 border-pink-300",
  youtube: "bg-red-100 text-red-700 hover:bg-red-200 border-red-300",
  linkedin: "bg-sky-100 text-sky-700 hover:bg-sky-200 border-sky-300",
  tiktok: "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300",
  threads: "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300",
  twitter: "bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border-cyan-300",
};

const NETWORK_ACTIVE: Record<FKNetwork, string> = {
  facebook: "bg-blue-600 text-white hover:bg-blue-700",
  instagram: "bg-pink-600 text-white hover:bg-pink-700",
  youtube: "bg-red-600 text-white hover:bg-red-700",
  linkedin: "bg-sky-600 text-white hover:bg-sky-700",
  tiktok: "bg-slate-800 text-white hover:bg-slate-900",
  threads: "bg-gray-800 text-white hover:bg-gray-900",
  twitter: "bg-cyan-600 text-white hover:bg-cyan-700",
};

export function NetworkFilter({ networks, selected, onChange, counts }: NetworkFilterProps) {
  const uniqueNetworks = Array.from(new Set(networks));

  if (uniqueNetworks.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground mr-1">Red:</span>
      
      <Button
        variant={selected === "all" ? "default" : "outline"}
        size="sm"
        className="h-8"
        onClick={() => onChange("all")}
      >
        Todas
        {counts && (
          <Badge variant="secondary" className="ml-2 h-5 text-xs">
            {networks.length}
          </Badge>
        )}
      </Button>

      {uniqueNetworks.map((network) => {
        const isActive = selected === network;
        const count = counts?.[network] || networks.filter(n => n === network).length;
        
        return (
          <Button
            key={network}
            variant="outline"
            size="sm"
            className={cn(
              "h-8 border",
              isActive ? NETWORK_ACTIVE[network] : NETWORK_COLORS[network]
            )}
            onClick={() => onChange(network)}
          >
            {getNetworkLabel(network)}
            <Badge 
              variant="secondary" 
              className={cn(
                "ml-2 h-5 text-xs",
                isActive && "bg-white/20 text-white"
              )}
            >
              {count}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
}
