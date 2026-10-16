import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";
import { FKProfile, FKProfileKPI, FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";
import { getFKProfileDisplayName } from "@/lib/fkProfileUtils";

function shouldReplaceKpi(candidate: FKProfileKPI, existing: FKProfileKPI) {
  const candidateEnd = new Date(`${candidate.period_end}T00:00:00Z`).getTime();
  const existingEnd = new Date(`${existing.period_end}T00:00:00Z`).getTime();

  if (candidateEnd !== existingEnd) return candidateEnd > existingEnd;
  if (!!candidate.isFallback !== !!existing.isFallback) return !candidate.isFallback;

  return new Date(candidate.fetched_at).getTime() > new Date(existing.fetched_at).getTime();
}

interface RankingChartProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  isLoading: boolean;
  filterNetwork?: FKNetwork | "all";
  metric?: "engagement_rate" | "followers" | "follower_growth_percent";
}

const NETWORK_SHORT: Record<FKNetwork, string> = {
  facebook: "FB",
  instagram: "IG",
  youtube: "YT",
  linkedin: "LI",
  tiktok: "TT",
  threads: "TH",
  twitter: "X",
};

const NETWORK_COLORS: Record<FKNetwork, string> = {
  facebook: "#1877F2",
  instagram: "#E4405F",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
  tiktok: "#000000",
  threads: "#000000",
  twitter: "#1DA1F2",
};

const METRIC_LABELS: Record<string, string> = {
  engagement_rate: "Engagement Rate",
  followers: "Seguidores",
  follower_growth_percent: "Crecimiento (%)",
};

export function RankingChart({ 
  profiles, 
  kpis, 
  isLoading, 
  filterNetwork = "all",
  metric = "engagement_rate"
}: RankingChartProps) {
  
  const chartData = useMemo(() => {
    // Create a map of profile ID to latest KPIs
    const kpiMap = new Map<string, FKProfileKPI>();
    kpis.forEach((kpi) => {
      const existing = kpiMap.get(kpi.fk_profile_id);
      if (!existing || shouldReplaceKpi(kpi, existing)) {
        kpiMap.set(kpi.fk_profile_id, kpi);
      }
    });

    // Filter and combine profiles with KPIs
    let data = profiles
      .filter((p) => filterNetwork === "all" || p.network === filterNetwork)
      .map((profile) => {
        const kpi = kpiMap.get(profile.id);
        let value = 0;
        
        if (metric === "engagement_rate") {
          value = (kpi?.engagement_rate || 0) * 100; // Convert to percentage
        } else if (metric === "followers") {
          value = kpi?.followers || 0;
        } else if (metric === "follower_growth_percent") {
          value = kpi?.follower_growth_percent || 0;
        }
        
        const baseName = getFKProfileDisplayName(profile);
        const net = profile.network as FKNetwork;
        const short = NETWORK_SHORT[net] ?? net.slice(0, 2).toUpperCase();
        return {
          name: `${baseName} · ${short}`,
          fullName: baseName,
          value,
          network: net,
          displayValue: metric === "followers" 
            ? (value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString())
            : `${value.toFixed(2)}%`,
        };
      })
      .filter(d => d.value > 0 || metric === "follower_growth_percent");

    // Sort by value descending
    data.sort((a, b) => b.value - a.value);

    // Take top 10 for readability
    return data.slice(0, 10);
  }, [profiles, kpis, filterNetwork, metric]);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  if (chartData.length === 0) {
    return null;
  }

  const networkLabel = filterNetwork === "all" ? "Todas las redes" : getNetworkLabel(filterNetwork);
  const primaryColor = filterNetwork === "all" ? "hsl(var(--primary))" : NETWORK_COLORS[filterNetwork];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {METRIC_LABELS[metric]}
        </CardTitle>
        <CardDescription className="text-xs">
          Top {chartData.length} perfiles · {networkLabel}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart 
            data={chartData} 
            layout="vertical"
            margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              type="number" 
              tickFormatter={(v) => metric === "followers" 
                ? (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString())
                : `${v.toFixed(1)}%`
              }
              fontSize={11}
            />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={90}
              fontSize={10}
              tickFormatter={(v) => {
                const parts = String(v).split(" · ");
                const base = parts[0] ?? "";
                const suffix = parts[1] ? ` · ${parts[1]}` : "";
                const trimmed = base.length > 12 ? `${base.slice(0, 12)}…` : base;
                return `${trimmed}${suffix}`;
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [
                metric === "followers" 
                  ? value.toLocaleString()
                  : `${value.toFixed(3)}%`,
                METRIC_LABELS[metric]
              ]}
            />
            <Bar 
              dataKey="value" 
              radius={[0, 4, 4, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={filterNetwork === "all" ? NETWORK_COLORS[entry.network] : primaryColor}
                  opacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
