import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SentimentOverviewProps {
  data: {
    positivo: number;
    neutral: number;
    negativo: number;
    sinAnalizar: number;
  };
}

const SENTIMENT_CONFIG = [
  { key: "positivo", label: "Positivo", color: "#22c55e" },
  { key: "neutral", label: "Neutral", color: "#3b82f6" },
  { key: "negativo", label: "Negativo", color: "#ef4444" },
  { key: "sinAnalizar", label: "Sin analizar", color: "#9ca3af" },
];

export function SentimentOverview({ data }: SentimentOverviewProps) {
  const chartData = SENTIMENT_CONFIG.map((s) => ({
    name: s.label,
    value: data[s.key as keyof typeof data],
    color: s.color,
  })).filter((d) => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sentimiento</CardTitle>
          <CardDescription>Distribución del sentimiento</CardDescription>
        </CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center">
          <p className="text-muted-foreground">Sin datos de sentimiento</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sentimiento</CardTitle>
        <CardDescription>Distribución del sentimiento en menciones</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              formatter={(value: number) => [value, "Menciones"]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
