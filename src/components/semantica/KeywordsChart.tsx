import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from "recharts";
import type { KeywordAnalysis } from "@/hooks/useSemanticAnalysis";

interface KeywordsChartProps {
  keywords: KeywordAnalysis[];
  maxKeywords?: number;
}

const sentimentColors = {
  positivo: "hsl(142, 76%, 36%)",
  neutral: "hsl(221, 83%, 53%)",
  negativo: "hsl(0, 84%, 60%)",
};

const chartConfig: ChartConfig = {
  frequency: {
    label: "Frecuencia",
  },
  positivo: {
    label: "Positivo",
    color: sentimentColors.positivo,
  },
  neutral: {
    label: "Neutral",
    color: sentimentColors.neutral,
  },
  negativo: {
    label: "Negativo",
    color: sentimentColors.negativo,
  },
};

export function KeywordsChart({ keywords, maxKeywords = 12 }: KeywordsChartProps) {
  const displayKeywords = keywords.slice(0, maxKeywords);

  if (displayKeywords.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No hay palabras clave disponibles
      </div>
    );
  }

  const data = displayKeywords.map((kw) => ({
    word: kw.word,
    frequency: kw.frequency,
    sentiment: kw.sentiment,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="word"
            width={100}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            content={<ChartTooltipContent />}
            formatter={(value, name, props) => [
              `${value} menciones`,
              props.payload.sentiment,
            ]}
          />
          <Bar dataKey="frequency" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={sentimentColors[entry.sentiment]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
