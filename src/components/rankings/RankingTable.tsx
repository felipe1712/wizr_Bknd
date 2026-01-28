import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Trophy, TrendingUp, TrendingDown, Minus, BarChart3, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { FKProfile, FKProfileKPI, FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";
import { NetworkFilter } from "./NetworkFilter";

type SortMetric = "followers" | "engagement_rate" | "follower_growth_percent" | "posts_per_day";
type SortDirection = "asc" | "desc";

interface RankingTableProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  isLoading: boolean;
  sortBy?: SortMetric;
  filterNetwork?: FKNetwork | "all";
  onNetworkChange?: (network: FKNetwork | "all") => void;
}

const MEDAL_COLORS = ["🥇", "🥈", "🥉"];

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const formatPercent = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "-";
  return `${num.toFixed(2)}%`;
};

const GrowthIndicator = ({ value }: { value: number | null | undefined }) => {
  if (value === null || value === undefined) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

export function RankingTable({ 
  profiles, 
  kpis, 
  isLoading, 
  sortBy: initialSortBy = "engagement_rate",
  filterNetwork: externalFilterNetwork = "all",
  onNetworkChange
}: RankingTableProps) {
  const [sortMetric, setSortMetric] = useState<SortMetric>(initialSortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [internalFilterNetwork, setInternalFilterNetwork] = useState<FKNetwork | "all">(externalFilterNetwork);
  
  const filterNetwork = onNetworkChange ? externalFilterNetwork : internalFilterNetwork;
  const setFilterNetwork = onNetworkChange || setInternalFilterNetwork;

  const handleSort = (metric: SortMetric) => {
    if (sortMetric === metric) {
      setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortMetric(metric);
      setSortDirection("desc");
    }
  };

  const SortableHeader = ({ metric, children }: { metric: SortMetric; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => handleSort(metric)}
    >
      {children}
      {sortMetric === metric ? (
        sortDirection === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUp className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );

  const rankedData = useMemo(() => {
    // Create a map of profile ID to latest KPIs
    const kpiMap = new Map<string, FKProfileKPI>();
    kpis.forEach((kpi) => {
      const existing = kpiMap.get(kpi.fk_profile_id);
      if (!existing || new Date(kpi.fetched_at) > new Date(existing.fetched_at)) {
        kpiMap.set(kpi.fk_profile_id, kpi);
      }
    });

    // Filter and combine profiles with KPIs
    let data = profiles
      .filter((p) => filterNetwork === "all" || p.network === filterNetwork)
      .map((profile) => ({
        profile,
        kpi: kpiMap.get(profile.id) || null,
      }));

    // Sort by the selected metric
    data.sort((a, b) => {
      const aVal = a.kpi?.[sortMetric] ?? -Infinity;
      const bVal = b.kpi?.[sortMetric] ?? -Infinity;
      const comparison = (bVal as number) - (aVal as number);
      return sortDirection === "desc" ? comparison : -comparison;
    });

    return data;
  }, [profiles, kpis, sortMetric, sortDirection, filterNetwork]);

  const profileNetworks = profiles.map(p => p.network as FKNetwork);

  // Calculate max values for relative bars
  const maxEngagement = useMemo(() => {
    const values = rankedData.map((d) => d.kpi?.engagement_rate ?? 0);
    return Math.max(...values, 0.01);
  }, [rankedData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (rankedData.length === 0) {
    return (
      <Card className="py-12">
        <CardContent className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sin datos de ranking</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Sincroniza los perfiles para obtener sus métricas y generar el ranking.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Ranking de Perfiles
            </CardTitle>
            <CardDescription className="mt-1">
              {rankedData.length} perfiles · Ordenado por {sortMetric === "engagement_rate" ? "Engagement" : 
                sortMetric === "followers" ? "Seguidores" :
                sortMetric === "follower_growth_percent" ? "Crecimiento" : "Posts/día"}
            </CardDescription>
          </div>
          <NetworkFilter
            networks={profileNetworks}
            selected={filterNetwork}
            onChange={setFilterNetwork}
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Red</TableHead>
              <TableHead className="text-right">
                <SortableHeader metric="followers">Seguidores</SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader metric="follower_growth_percent">Crecimiento</SortableHeader>
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader metric="engagement_rate">Engagement</SortableHeader>
              </TableHead>
              <TableHead className="w-32">Relativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankedData.map((item, index) => {
              const { profile, kpi } = item;
              const network = profile.network as FKNetwork;
              const engagementPercent = kpi?.engagement_rate 
                ? (kpi.engagement_rate / maxEngagement) * 100 
                : 0;

              return (
                <TableRow key={profile.id}>
                  <TableCell className="font-bold text-lg">
                    {index < 3 ? MEDAL_COLORS[index] : index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">@{profile.profile_id}</div>
                    {profile.display_name && profile.display_name !== profile.profile_id && (
                      <div className="text-sm text-muted-foreground">{profile.display_name}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getNetworkLabel(network)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(kpi?.followers)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <GrowthIndicator value={kpi?.follower_growth_percent} />
                      <span className={kpi?.follower_growth_percent && kpi.follower_growth_percent > 0 ? "text-green-600" : kpi?.follower_growth_percent && kpi.follower_growth_percent < 0 ? "text-red-600" : ""}>
                        {formatPercent(kpi?.follower_growth_percent)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPercent(kpi?.engagement_rate)}
                  </TableCell>
                  <TableCell>
                    <Progress value={engagementPercent} className="h-2" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
