import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3 } from "lucide-react";
import { FKProfile, FKProfileKPI } from "@/hooks/useFanpageKarma";

interface RankingReportChartsProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
}

const POSITIVE_COLOR = "hsl(142, 76%, 36%)"; // green-600
const NEGATIVE_COLOR = "hsl(0, 84%, 60%)"; // red-500
const NEUTRAL_COLOR = "hsl(var(--primary))";

export function RankingReportCharts({ profiles, kpis }: RankingReportChartsProps) {
  // Prepare engagement data
  const engagementData = useMemo(() => {
    return profiles
      .map((profile) => {
        const kpi = kpis.find((k) => k.fk_profile_id === profile.id);
        return {
          name: profile.display_name || profile.profile_id,
          shortName:
            (profile.display_name || profile.profile_id).length > 12
              ? (profile.display_name || profile.profile_id).substring(0, 10) + "..."
              : profile.display_name || profile.profile_id,
          engagement: kpi?.engagement_rate || 0,
          network: profile.network,
        };
      })
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10); // Top 10
  }, [profiles, kpis]);

  // Prepare growth data
  const growthData = useMemo(() => {
    return profiles
      .map((profile) => {
        const kpi = kpis.find((k) => k.fk_profile_id === profile.id);
        return {
          name: profile.display_name || profile.profile_id,
          shortName:
            (profile.display_name || profile.profile_id).length > 12
              ? (profile.display_name || profile.profile_id).substring(0, 10) + "..."
              : profile.display_name || profile.profile_id,
          growth: kpi?.follower_growth_percent || 0,
          network: profile.network,
        };
      })
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 10); // Top 10
  }, [profiles, kpis]);

  // Calculate averages
  const avgEngagement = useMemo(() => {
    const rates = kpis
      .map((k) => k.engagement_rate)
      .filter((e): e is number => e !== null && e !== undefined);
    return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  }, [kpis]);

  const avgGrowth = useMemo(() => {
    const rates = kpis
      .map((k) => k.follower_growth_percent)
      .filter((g): g is number => g !== null && g !== undefined);
    return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  }, [kpis]);

  if (profiles.length === 0 || kpis.length === 0) {
    return null;
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Engagement Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Engagement por Perfil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={engagementData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, "Engagement"]}
                  labelFormatter={(label) => {
                    const item = engagementData.find((d) => d.shortName === label);
                    return item?.name || label;
                  }}
                />
                <ReferenceLine
                  x={avgEngagement}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  label={{
                    value: `Prom: ${avgEngagement.toFixed(1)}%`,
                    position: "top",
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
                <Bar dataKey="engagement" radius={[0, 4, 4, 0]}>
                  {engagementData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.engagement >= avgEngagement
                          ? POSITIVE_COLOR
                          : entry.engagement >= avgEngagement * 0.7
                          ? NEUTRAL_COLOR
                          : NEGATIVE_COLOR
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Top 10 perfiles por engagement • Promedio: {avgEngagement.toFixed(2)}%
          </p>
        </CardContent>
      </Card>

      {/* Growth Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Crecimiento de Seguidores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={growthData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, "Crecimiento"]}
                  labelFormatter={(label) => {
                    const item = growthData.find((d) => d.shortName === label);
                    return item?.name || label;
                  }}
                />
                <ReferenceLine
                  x={0}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="3 3"
                />
                <ReferenceLine
                  x={avgGrowth}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="5 5"
                  label={{
                    value: `Prom: ${avgGrowth.toFixed(1)}%`,
                    position: "top",
                    fontSize: 10,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
                <Bar dataKey="growth" radius={[0, 4, 4, 0]}>
                  {growthData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.growth >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Top 10 perfiles por crecimiento • Promedio: {avgGrowth.toFixed(2)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
