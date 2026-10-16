import { useMemo, useState } from "react";
import { format as formatDate, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, History, Building2, Users2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { FKProfile, FKProfileKPI } from "@/hooks/useFanpageKarma";
import { getFKProfileSeriesLabel } from "@/lib/fkProfileUtils";

interface Props {
  profiles: FKProfile[];
  allKpis: FKProfileKPI[];
  isLoading: boolean;
  brandCount: number;
  compCount: number;
}

type Metric = "followers" | "engagement_rate" | "page_performance_index" | "follower_growth_percent" | "posts_per_day";

const METRIC_OPTIONS: { value: Metric; label: string; format: (v: number) => string }[] = [
  { value: "followers", label: "Seguidores", format: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}` },
  { value: "engagement_rate", label: "Engagement Rate", format: (v) => `${v.toFixed(2)}%` },
  { value: "page_performance_index", label: "Page Performance Index", format: (v) => v.toFixed(1) },
  { value: "follower_growth_percent", label: "Crecimiento de seguidores", format: (v) => `${v.toFixed(2)}%` },
  { value: "posts_per_day", label: "Posts por día", format: (v) => v.toFixed(2) },
];

const COLORS = [
  "hsl(var(--primary))",
  "#f97316",
  "#22c55e",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#eab308",
];

export function ClientEvolutionTab({ profiles, allKpis, isLoading, brandCount, compCount }: Props) {
  const [metric, setMetric] = useState<Metric>("followers");

  const periodCount = useMemo(() => {
    const set = new Set(allKpis.map((k) => `${k.period_start}__${k.period_end}`));
    return set.size;
  }, [allKpis]);

  const chartData = useMemo(() => {
    if (allKpis.length === 0 || profiles.length === 0) return [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    // Group by period_end (one point per period)
    const byPeriod = new Map<string, Record<string, any>>();

    for (const kpi of allKpis) {
      const profile = profileById.get(kpi.fk_profile_id);
      if (!profile) continue;
      const value = (kpi as any)[metric] as number | null | undefined;
      if (value == null) continue;

      const key = kpi.period_end;
      if (!byPeriod.has(key)) {
        byPeriod.set(key, {
          period: key,
          periodLabel: formatDate(parseISO(key), "MMM yyyy", { locale: es }),
        });
      }
      const row = byPeriod.get(key)!;
      const profileKey = getFKProfileSeriesLabel(profile);
      row[profileKey] = value;
    }

    return Array.from(byPeriod.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [allKpis, profiles, metric]);

  const profileKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of chartData) {
      Object.keys(row).forEach((k) => {
        if (k !== "period" && k !== "periodLabel") keys.add(k);
      });
    }
    return Array.from(keys).slice(0, 8);
  }, [chartData]);

  const currentMetric = METRIC_OPTIONS.find((m) => m.value === metric)!;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-primary" />
                Evolución histórica
              </CardTitle>
              <CardDescription>
                Compara la evolución de cada perfil entre todos los períodos importados. Cada punto representa un período distinto.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Building2 className="h-3 w-3" /> {brandCount} marca
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Users2 className="h-3 w-3" /> {compCount} competencia
              </Badge>
              <Badge variant="outline">{periodCount} período(s)</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {periodCount === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">Aún no hay histórico</p>
              <p className="text-xs mt-1">Importa al menos un Excel de KPIs para empezar a ver la evolución.</p>
            </div>
          ) : periodCount === 1 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">Solo tienes un período importado</p>
              <p className="text-xs mt-1">Importa otro Excel de KPIs con un período distinto para ver la evolución.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm text-muted-foreground">Métrica:</span>
                <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
                  <SelectTrigger className="w-64 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => currentMetric.format(v)} />
                  <Tooltip
                    formatter={(value: any) => currentMetric.format(Number(value))}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {profileKeys.map((key, idx) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {profileKeys.length > 8 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Mostrando los primeros 8 perfiles. Filtra desde la pestaña Configuración.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
