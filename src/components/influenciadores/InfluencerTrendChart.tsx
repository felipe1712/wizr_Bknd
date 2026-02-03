import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DailyInfluencerData } from "@/hooks/useInfluencersData";

interface InfluencerTrendChartProps {
  data: DailyInfluencerData[];
  domains: string[];
  labels?: Record<string, string>;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function InfluencerTrendChart({ data, domains, labels }: InfluencerTrendChartProps) {
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
    <Card>
      <CardHeader>
        <CardTitle>Tendencia de Fuentes</CardTitle>
        <CardDescription>
          Evolución temporal de las {domains.length} fuentes principales
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
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
