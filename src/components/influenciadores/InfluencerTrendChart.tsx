import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DailyInfluencerData } from "@/hooks/useInfluencersData";
import { TrendMentionsDrawer } from "./TrendMentionsDrawer";

interface Mention {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  source_domain: string | null;
  sentiment: string | null;
  created_at: string;
  matched_keywords: string[];
}

interface InfluencerTrendChartProps {
  data: DailyInfluencerData[];
  domains: string[];
  labels?: Record<string, string>;
  mentions?: Mention[];
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface ClickData {
  date: string;
  domain: string;
  domainLabel: string;
}

export function InfluencerTrendChart({ data, domains, labels, mentions = [] }: InfluencerTrendChartProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [clickData, setClickData] = useState<ClickData | null>(null);

  // Handle click on a specific dot - this is the correct way to identify which source was clicked
  const handleDotClick = (domain: string, payload: any) => {
    if (payload?.date) {
      const domainLabel = labels?.[domain] ?? domain;
      setClickData({ date: payload.date, domain, domainLabel });
      setDrawerOpen(true);
    }
  };

  if (data.length === 0 || domains.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Fuentes</CardTitle>
          <CardDescription>Evolución temporal de menciones por fuente</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">No hay datos suficientes para mostrar tendencias</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Fuentes</CardTitle>
          <CardDescription>
            Evolución temporal de las {domains.length} fuentes principales
            <span className="text-primary ml-2 text-xs">(clic en un punto para ver menciones)</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
                className="text-muted-foreground"
              />
              <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelFormatter={(value) => {
                  const date = new Date(value as string);
                  return date.toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "long",
                  });
                }}
              />
              <Legend />
              {domains.map((domain, index) => (
                <Line
                  key={domain}
                  type="monotone"
                  dataKey={domain}
                  name={labels?.[domain] ?? domain}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4, cursor: "pointer", strokeWidth: 2 }}
                  activeDot={{
                    r: 7,
                    cursor: "pointer",
                    strokeWidth: 2,
                    onClick: (_: any, event: any) => {
                      handleDotClick(domain, event?.payload);
                    },
                  }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <TrendMentionsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        date={clickData?.date || null}
        sourceDomain={clickData?.domain || null}
        sourceLabel={clickData?.domainLabel || null}
        mentions={mentions}
      />
    </>
  );
}
