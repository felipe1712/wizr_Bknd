import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import type { SentimentDistribution } from "@/hooks/useSemanticAnalysis";

interface SentimentPieChartProps {
  distribution: SentimentDistribution;
  onSentimentClick?: (sentiment: "positivo" | "neutral" | "negativo") => void;
}

const chartConfig: ChartConfig = {
  positivo: {
    label: "Positivo",
    color: "hsl(142, 76%, 36%)",
  },
  neutral: {
    label: "Neutral",
    color: "hsl(220, 9%, 46%)",
  },
  negativo: {
    label: "Negativo",
    color: "hsl(0, 84%, 60%)",
  },
};

const COLORS = [
  "hsl(142, 76%, 36%)", // positivo - green
  "hsl(220, 9%, 46%)",  // neutral - gray
  "hsl(0, 84%, 60%)",   // negativo - red
];

export function SentimentPieChart({ distribution, onSentimentClick }: SentimentPieChartProps) {
  const data = [
    { name: "Positivo", value: distribution.positivo, key: "positivo" },
    { name: "Neutral", value: distribution.neutral, key: "neutral" },
    { name: "Negativo", value: distribution.negativo, key: "negativo" },
  ].filter((item) => item.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay datos de sentimiento disponibles
      </div>
    );
  }

  const handleClick = (entry: { key: string }) => {
    if (onSentimentClick) {
      onSentimentClick(entry.key as "positivo" | "neutral" | "negativo");
    }
  };

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, value }) => `${name}: ${value}%`}
            labelLine={false}
            style={{ cursor: onSentimentClick ? "pointer" : "default" }}
            onClick={(_, index) => handleClick(data[index])}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[["positivo", "neutral", "negativo"].indexOf(entry.key)]}
                className="hover:opacity-80 transition-opacity"
              />
            ))}
          </Pie>
          <ChartTooltip
            content={<ChartTooltipContent />}
            formatter={(value) => [`${value}%`, ""]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
