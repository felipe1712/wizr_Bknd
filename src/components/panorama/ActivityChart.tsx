import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MousePointer2 } from "lucide-react";

interface ActivityChartProps {
  data: { date: string; count: number }[];
  onDateClick?: (date: string, label: string) => void;
}

export function ActivityChart({ data, onDateClick }: ActivityChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actividad Diaria</CardTitle>
          <CardDescription>Volumen de menciones por día</CardDescription>
        </CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center">
          <p className="text-muted-foreground">Sin datos de actividad</p>
        </CardContent>
      </Card>
    );
  }

  const formattedData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
  }));

  const handleClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload && onDateClick) {
      const payload = data.activePayload[0].payload;
      onDateClick(payload.date, payload.label);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Actividad Diaria</CardTitle>
            <CardDescription>Volumen de menciones por día</CardDescription>
          </div>
          {onDateClick && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MousePointer2 className="h-3 w-3" />
              Clic para ver detalle
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart 
            data={formattedData}
            onClick={handleClick}
            style={{ cursor: onDateClick ? "pointer" : "default" }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelFormatter={(_, payload) => {
                if (payload && payload[0]) {
                  const date = new Date(payload[0].payload.date);
                  return date.toLocaleDateString("es-MX", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  });
                }
                return "";
              }}
              formatter={(value: number) => [value, "Menciones"]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.2)"
              strokeWidth={2}
              activeDot={{ 
                r: 6, 
                strokeWidth: 2, 
                stroke: "hsl(var(--primary))",
                fill: "hsl(var(--background))",
                cursor: onDateClick ? "pointer" : "default"
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}