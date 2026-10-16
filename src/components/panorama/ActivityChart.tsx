import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { MousePointer2, Info, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

function dateKeyToLocalDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

interface ActivityChartProps {
  data: { date: string; count: number; verifiedCount?: number; lowConfidence?: boolean }[];
  onDateClick?: (date: string, label: string) => void;
}

export function ActivityChart({ data, onDateClick }: ActivityChartProps) {
  const [verifiedOnly, setVerifiedOnly] = useState(true);

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

  const formattedData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        displayCount: verifiedOnly ? (d.verifiedCount ?? 0) : d.count,
        label: dateKeyToLocalDate(d.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
      })),
    [data, verifiedOnly]
  );

  const handleClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload && onDateClick) {
      const payload = data.activePayload[0].payload;
      onDateClick(payload.date, payload.label);
    }
  };

  const hasLowConfidence = formattedData.some((d) => d.lowConfidence);
  const totalEstimated = data.reduce((acc, d) => acc + ((d.count ?? 0) - (d.verifiedCount ?? 0)), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Actividad Diaria</CardTitle>
            <CardDescription>
              {verifiedOnly
                ? "Curva real basada en fecha de publicación verificada"
                : "Incluye menciones con fecha estimada (captura)"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="verified-only" className="text-xs cursor-pointer">
                Solo fechas verificadas
              </Label>
              <Switch
                id="verified-only"
                checked={verifiedOnly}
                onCheckedChange={setVerifiedOnly}
              />
            </div>
            {onDateClick && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MousePointer2 className="h-3 w-3" />
                Clic para ver detalle
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart
            data={formattedData}
            onClick={handleClick}
            style={{ cursor: onDateClick ? "pointer" : "default" }}
          >
            <defs>
              <pattern
                id="lowConfidencePattern"
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeOpacity="0.35" />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelFormatter={(_, payload) => {
                if (payload && payload[0]) {
                  const date = dateKeyToLocalDate(payload[0].payload.date);
                  const base = date.toLocaleDateString("es-MX", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  });
                  return !verifiedOnly && payload[0].payload.lowConfidence
                    ? `${base} · fecha estimada`
                    : base;
                }
                return "";
              }}
              formatter={(value: number) => [value, verifiedOnly ? "Menciones verificadas" : "Menciones"]}
            />
            {!verifiedOnly &&
              formattedData.map((d) =>
                d.lowConfidence ? (
                  <ReferenceArea
                    key={`lc-${d.date}`}
                    x1={d.label}
                    x2={d.label}
                    fill="url(#lowConfidencePattern)"
                    fillOpacity={1}
                    ifOverflow="visible"
                  />
                ) : null
              )}
            <Area
              type="monotone"
              dataKey="displayCount"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.2)"
              strokeWidth={2}
              activeDot={{
                r: 6,
                strokeWidth: 2,
                stroke: "hsl(var(--primary))",
                fill: "hsl(var(--background))",
                cursor: onDateClick ? "pointer" : "default",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
        {verifiedOnly && totalEstimated > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>
              Se ocultan {totalEstimated} menciones sin fecha de publicación verificada (principalmente Facebook/Instagram). Desactiva el toggle para verlas como días con fecha estimada.
            </span>
          </div>
        )}
        {!verifiedOnly && hasLowConfidence && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>
              Las zonas rayadas corresponden a días con fechas estimadas (sin fecha de publicación verificada).
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
