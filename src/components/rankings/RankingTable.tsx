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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy, TrendingUp, TrendingDown, Minus, BarChart3, ArrowUpDown, ArrowUp, ArrowDown, Clock, AlertTriangle, ExternalLink, FileText } from "lucide-react";
import { FKProfile, FKProfileKPI, FKNetwork, FKPeriodPostMetrics, getNetworkLabel } from "@/hooks/useFanpageKarma";
import { NetworkFilter } from "./NetworkFilter";
import { format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";

function shouldReplaceKpi(candidate: FKProfileKPI, existing: FKProfileKPI) {
  const candidateEnd = new Date(`${candidate.period_end}T00:00:00Z`).getTime();
  const existingEnd = new Date(`${existing.period_end}T00:00:00Z`).getTime();

  if (candidateEnd !== existingEnd) return candidateEnd > existingEnd;
  if (!!candidate.isFallback !== !!existing.isFallback) return !candidate.isFallback;

  const candidateFetched = new Date(candidate.fetched_at).getTime();
  const existingFetched = new Date(existing.fetched_at).getTime();
  return candidateFetched > existingFetched;
}

function formatPeriod(start: string, end: string): string {
  try {
    const s = parseISO(start);
    const e = parseISO(end);
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    if (sameMonth) {
      return `${format(s, "d", { locale: es })}–${format(e, "d MMM", { locale: es })}`;
    }
    return `${format(s, "d MMM", { locale: es })} – ${format(e, "d MMM", { locale: es })}`;
  } catch {
    return `${start} – ${end}`;
  }
}

interface FallbackBadgeProps {
  periodStart: string;
  periodEnd: string;
}

function FallbackBadge({ periodStart, periodEnd }: FallbackBadgeProps) {
  const ageDays = (() => {
    try {
      return differenceInDays(new Date(), parseISO(periodEnd));
    } catch {
      return 0;
    }
  })();
  const isStale = ageDays > 90;

  // Only show the badge when the snapshot is actually stale (>90 days).
  // For normal fallbacks within the selected range, the badge would just
  // repeat the global period filter on every row, which is redundant noise.
  if (!isStale) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="ml-2 gap-1 border-destructive/40 bg-destructive/10 text-destructive text-[10px] px-1.5 py-0"
          >
            <AlertTriangle className="h-2.5 w-2.5" />
            {formatPeriod(periodStart, periodEnd)}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {`Dato desactualizado (${ageDays} días). Mostrando el snapshot importado ${formatPeriod(periodStart, periodEnd)} porque no hay un corte más reciente para el rango seleccionado.`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type SortMetric =
  | "followers"
  | "engagement_rate"
  | "follower_growth_percent"
  | "posts_per_day"
  | "period_avg_engagement";
type SortDirection = "asc" | "desc";

interface RankingTableProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  isLoading: boolean;
  sortBy?: SortMetric;
  filterNetwork?: FKNetwork | "all";
  onNetworkChange?: (network: FKNetwork | "all") => void;
  /** Period-derived metrics computed from fk_posts.published_at within the active filter. */
  periodMetrics?: Map<string, FKPeriodPostMetrics>;
  /** Loading state for periodMetrics (shown as inline placeholder). */
  isLoadingPeriodMetrics?: boolean;
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

const getSortLabel = (metric: SortMetric) => {
  switch (metric) {
    case "followers":
      return "Seguidores";
    case "follower_growth_percent":
      return "Crecimiento";
    case "posts_per_day":
      return "Posts/día";
    case "period_avg_engagement":
      return "Eng. promedio (período)";
    case "engagement_rate":
    default:
      return "Engagement";
  }
};

export function RankingTable({ 
  profiles, 
  kpis, 
  isLoading, 
  sortBy: initialSortBy = "engagement_rate",
  filterNetwork: externalFilterNetwork = "all",
  onNetworkChange,
  periodMetrics,
  isLoadingPeriodMetrics = false,
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
    const kpiMap = new Map<string, FKProfileKPI>();
    kpis.forEach((kpi) => {
      const existing = kpiMap.get(kpi.fk_profile_id);
      if (!existing || shouldReplaceKpi(kpi, existing)) {
        kpiMap.set(kpi.fk_profile_id, kpi);
      }
    });

    const data = profiles
      .filter((p) => filterNetwork === "all" || p.network === filterNetwork)
      .map((profile) => ({
        profile,
        kpi: kpiMap.get(profile.id) || null,
        periodMetric: periodMetrics?.get(profile.id),
      }));

    data.sort((a, b) => {
      const aVal =
        sortMetric === "period_avg_engagement"
          ? a.periodMetric?.avgEngagement ?? -Infinity
          : (a.kpi?.[sortMetric] ?? -Infinity);
      const bVal =
        sortMetric === "period_avg_engagement"
          ? b.periodMetric?.avgEngagement ?? -Infinity
          : (b.kpi?.[sortMetric] ?? -Infinity);
      const comparison = (bVal as number) - (aVal as number);
      return sortDirection === "desc" ? comparison : -comparison;
    });

    return data;
  }, [profiles, kpis, sortMetric, sortDirection, filterNetwork, periodMetrics]);

  const hasAnyKpi = useMemo(() => rankedData.some((item) => item.kpi !== null), [rankedData]);

  const fallbackSummary = useMemo(() => {
    const fallbackRows = rankedData.filter((item) => item.kpi?.isFallback);
    if (fallbackRows.length === 0) return null;

    const uniquePeriods = Array.from(
      new Set(fallbackRows.map((item) => `${item.kpi?.period_start}|${item.kpi?.period_end}`)),
    );

    if (fallbackRows.length === rankedData.length && uniquePeriods.length === 1) {
      const [periodStart, periodEnd] = uniquePeriods[0].split("|");
      return `Todos los perfiles usan el snapshot importado ${formatPeriod(periodStart, periodEnd)}. Seguidores y crecimiento permanecen fijos hasta que existan otros cortes KPI para ese período.`;
    }

    return `${fallbackRows.length} perfil${fallbackRows.length === 1 ? "" : "es"} muestran el snapshot importado más cercano porque no hay un corte exacto en el rango aplicado.`;
  }, [rankedData]);

  const profileNetworks = profiles.map(p => p.network as FKNetwork);

  const maxEngagement = useMemo(() => {
    const values = rankedData.map((d) => d.periodMetric?.avgEngagement ?? d.kpi?.engagement_rate ?? 0);
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

  if (rankedData.length === 0 || !hasAnyKpi) {
    return (
      <Card className="py-12">
        <CardContent className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sin datos de ranking</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            {profiles.length > 0
              ? "Hay perfiles cargados, pero todavía no existen snapshots KPI importados o sincronizados para este conjunto."
              : "Sincroniza los perfiles para obtener sus métricas y generar el ranking."}
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
              {rankedData.length} perfiles · Ordenado por {getSortLabel(sortMetric)}
            </CardDescription>
            {fallbackSummary && (
              <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{fallbackSummary}</span>
              </p>
            )}
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
              {periodMetrics && (
                <>
                  <TableHead className="text-right">
                    <span className="text-xs">Posts <span className="text-muted-foreground font-normal">(período)</span></span>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader metric="period_avg_engagement">
                      <span className="text-xs">Eng. promedio <span className="text-muted-foreground font-normal">(período)</span></span>
                    </SortableHeader>
                  </TableHead>
                  <TableHead>
                    <span className="text-xs">Top post <span className="text-muted-foreground font-normal">(período)</span></span>
                  </TableHead>
                </>
              )}
              <TableHead className="w-32">Relativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankedData.map((item, index) => {
              const { profile, kpi, periodMetric } = item;
              const network = profile.network as FKNetwork;
              const relativeValue = periodMetric?.avgEngagement ?? kpi?.engagement_rate ?? 0;
              const engagementPercent = relativeValue > 0
                ? (relativeValue / maxEngagement) * 100
                : 0;

              return (
                <TableRow key={profile.id}>
                  <TableCell className="font-bold text-lg">
                    {index < 3 ? MEDAL_COLORS[index] : index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center flex-wrap gap-1">
                      <span className="font-medium" title={profile.profile_id}>
                        {profile.display_name || profile.profile_id}
                      </span>
                      {kpi?.isFallback && (
                        <FallbackBadge periodStart={kpi.period_start} periodEnd={kpi.period_end} />
                      )}
                    </div>
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
                  {periodMetrics && (() => {
                    const pm = periodMetrics.get(profile.id);
                    if (isLoadingPeriodMetrics && !pm) {
                      return (
                        <>
                          <TableCell className="text-right"><Skeleton className="h-4 w-10 ml-auto" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-4 w-14 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        </>
                      );
                    }
                    if (!pm || pm.postCount === 0) {
                      return (
                        <>
                          <TableCell className="text-right text-muted-foreground">0</TableCell>
                          <TableCell className="text-right text-muted-foreground">—</TableCell>
                          <TableCell className="text-muted-foreground text-xs italic">Sin posts en el período</TableCell>
                        </>
                      );
                    }
                    const snippet = pm.topPost?.message
                      ? pm.topPost.message.slice(0, 60) + (pm.topPost.message.length > 60 ? "…" : "")
                      : "(sin texto)";
                    return (
                      <>
                        <TableCell className="text-right font-medium">{pm.postCount}</TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(pm.avgEngagement)}</TableCell>
                        <TableCell className="max-w-xs">
                          {pm.topPost ? (
                            <div className="flex items-start gap-1.5 text-xs">
                              <FileText className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate" title={pm.topPost.message ?? ""}>
                                  {snippet}
                                </p>
                                <p className="text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <span>{formatNumber(pm.topPost.engagement)} eng.</span>
                                  {pm.topPost.link && (
                                    <a
                                      href={pm.topPost.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center hover:text-primary"
                                      aria-label="Abrir post"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </>
                    );
                  })()}
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
