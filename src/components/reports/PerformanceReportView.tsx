import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend,
} from "recharts";
import { Target, Sparkles, Lightbulb, Trophy, TrendingUp, Users2, FileText } from "lucide-react";
import type { PerformanceReportContent } from "@/hooks/usePerformanceReport";
import { EditableText } from "./EditableText";

interface PerformanceReportViewProps {
  report: PerformanceReportContent;
  editing?: boolean;
  onUpdate?: (patch: Partial<PerformanceReportContent>) => void;
  dateLabel: string;
}

// Paleta consistente por marca (no gris). Marca propia siempre = primary (violeta Wizr).
const BRAND_PALETTE = [
  "#4338ca", // indigo
  "#f97316", // orange
  "#22c55e", // green
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#eab308", // amber
  "#ef4444", // red
  "#0ea5e9", // sky
  "#14b8a6", // teal
  "#a855f7", // purple
  "#f59e0b", // amber-500
];

// Color por red social (consistente con badges de la app)
const NETWORK_COLOR: Record<string, string> = {
  facebook: "#1877F2",
  instagram: "#E1306C",
  youtube: "#FF0000",
  twitter: "#1DA1F2",
  x: "#1DA1F2",
  tiktok: "#000000",
  linkedin: "#0A66C2",
};

function colorForBrand(brand: string, isOwn: boolean, brandsList: string[]): string {
  if (isOwn) return "hsl(var(--primary))";
  const idx = brandsList.findIndex((b) => b === brand);
  return BRAND_PALETTE[(idx + 1) % BRAND_PALETTE.length];
}

function colorForNetwork(network: string): string {
  return NETWORK_COLOR[network.toLowerCase()] || "hsl(var(--primary))";
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function ReportNetworkPill({ network }: { network: string }) {
  const key = (network || "").toLowerCase().trim();
  const labelMap: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    youtube: "YouTube",
    twitter: "X",
    x: "X",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
  };

  return (
    <span
      data-report-network-pill
      data-network-badge={key || "unknown"}
      className="inline-flex items-center whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold leading-none text-foreground"
    >
      {labelMap[key] || network}
    </span>
  );
}

export function PerformanceReportView({
  report, editing = false, onUpdate, dateLabel,
}: PerformanceReportViewProps) {
  const isBrand = report.reportMode === "brand";
  const update = (patch: Partial<PerformanceReportContent>) => onUpdate?.(patch);

  const updateArrayItem = (key: "keyFindings" | "recommendations", index: number, value: string) => {
    const arr = [...(report[key] || [])];
    arr[index] = value;
    update({ [key]: arr } as Partial<PerformanceReportContent>);
  };

  const networkLabel = (n: string) => {
    const map: Record<string, string> = {
      facebook: "Facebook", instagram: "Instagram", youtube: "YouTube",
      twitter: "X", x: "X", tiktok: "TikTok", linkedin: "LinkedIn",
    };
    return map[n.toLowerCase()] || n;
  };

  // Brand list ordering for stable color assignment
  const brandsList = (report.analytics?.brandEngagement ?? []).map((b) => b.brand);

  // Custom Y-axis tick: marca arriba, red abajo
  const TwoLineTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) => {
    if (!payload?.value) return null;
    const [line1, line2] = payload.value.split("|");
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={-8} y={-2} textAnchor="end" fontSize={10} fontWeight={600} fill="hsl(var(--foreground))">{line1}</text>
        {line2 && <text x={-8} y={10} textAnchor="end" fontSize={9} fill="hsl(var(--muted-foreground))">{line2}</text>}
      </g>
    );
  };

  const rankingValid = (report.analytics?.rankingByEngagement ?? []).filter((r) => r.hasData !== false && r.avgInteractionsPerPost > 0);
  const rankingChartData = rankingValid.slice(0, 10).map((r) => ({
    name: `${r.name}|${networkLabel(r.network)}`,
    fullName: r.name,
    network: r.network,
    value: r.avgInteractionsPerPost,
    posts: r.postsCount,
    fill: colorForNetwork(r.network),
    isOwn: r.isOwn,
  }));

  // Share of voice — garantiza inclusión de TODAS las marcas propias + completa con competencia hasta llegar al top
  const sovAll = (report.analytics?.shareOfVoice ?? []).filter((s) => s.interactionsShare > 0);
  const sovOwn = sovAll.filter((s) => s.isOwn);
  const sovComp = sovAll.filter((s) => !s.isOwn).sort((a, b) => b.interactionsShare - a.interactionsShare);
  const SOV_TARGET = 12;
  const sovCombined = [...sovOwn, ...sovComp.slice(0, Math.max(SOV_TARGET - sovOwn.length, 6))]
    .sort((a, b) => b.interactionsShare - a.interactionsShare);
  const sovChartData = sovCombined.map((s) => ({
    name: s.name,
    network: s.network,
    value: s.interactionsShare,
    isOwn: s.isOwn,
    fill: colorForNetwork(s.network),
  }));

  return (
    <div className="space-y-8">
      {/* ── Editorial header (Listening identity) ── */}
      <div
        className="rounded-xl px-8 py-7 text-white shadow-md"
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)",
        }}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold tracking-[0.2em] px-2.5 py-1 rounded"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#c7d2fe" }}
            >
              {isBrand ? "PERFORMANCE · MARCA" : "PERFORMANCE · BENCHMARK"}
            </span>
            <span className="text-[10px] font-medium tracking-wider px-2.5 py-1 rounded bg-white/10 text-white/90">
              {report.clientName}
            </span>
          </div>
          <span className="text-[11px] font-semibold tracking-wider px-3 py-1.5 rounded-full bg-white/10 text-white/90 inline-flex items-center gap-1.5">
            {isBrand ? <Target className="h-3 w-3" /> : <Users2 className="h-3 w-3" />}
            {dateLabel}
          </span>
        </div>
        <EditableText
          editing={editing}
          value={report.title}
          onChange={(v) => update({ title: v })}
          className="text-3xl font-bold block leading-tight mb-3 text-white"
          placeholder="Título del reporte"
        />
        <div className="h-px bg-white/15 my-3" />
        <EditableText
          editing={editing}
          value={report.summary}
          onChange={(v) => update({ summary: v })}
          multiline
          minRows={3}
          className="block text-[13.5px] leading-[1.7] text-white/85"
          placeholder="Resumen ejecutivo"
        />
      </div>

      {/* ── KPI Cards (4, accionables, con unidad + contexto) ── */}
      {(report.highlights?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {report.highlights!.slice(0, 4).map((h, i) => (
            <Card key={i} className="border-l-4 border-l-primary/60 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
              <CardContent className="p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">
                  {h.label}
                </div>
                <div className="text-[22px] font-bold text-primary leading-tight break-words">
                  {h.value}
                </div>
                <div className="text-xs text-muted-foreground leading-snug">{h.context}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Brecha vs líder (benchmark only) — interacciones promedio por post ── */}
      {!isBrand && report.analytics.ownBrandGap && (
        <Card className="bg-gradient-to-r from-orange-500/5 to-transparent border-orange-500/30">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-500/15 p-2"><TrendingUp className="h-4 w-4 text-orange-600" /></div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-orange-600">Brecha competitiva · interacciones por publicación</div>
                <div className="text-sm font-medium">
                  {report.clientName} promedia <strong>{formatNumber(report.analytics.ownBrandGap.ownAvg)}</strong> interacciones por publicación
                  · líder <strong>{report.analytics.ownBrandGap.leaderName}</strong> con <strong>{formatNumber(report.analytics.ownBrandGap.leaderAvg)}</strong>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-orange-600">{report.analytics.ownBrandGap.multiple}×</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Por debajo</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Engagement promedio por marca (interacciones promedio por post) — solo BENCHMARK ── */}
      {!isBrand && report.analytics.brandEngagement.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Interacciones promedio por publicación · por marca
            </CardTitle>
            <CardDescription className="text-xs">
              Volumen real de reacciones por contenido publicado · todas las marcas del set
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.analytics.brandEngagement.slice(0, 12).map((b) => {
                    const netLabel = b.networks && b.networks.length > 0
                      ? (b.networks.length === 1 ? networkLabel(b.networks[0]) : `${b.networks.length} redes`)
                      : "";
                    const truncated = b.brand.length > 18 ? `${b.brand.substring(0, 16)}…` : b.brand;
                    return {
                      name: `${truncated}|${netLabel}`,
                      fullName: b.brand,
                      networks: b.networks,
                      value: b.avgInteractionsPerPost,
                      posts: b.postsCount,
                      profiles: b.profiles,
                      fill: colorForBrand(b.brand, b.isOwn, brandsList),
                    };
                  })}
                  layout="vertical"
                  margin={{ top: 8, right: 60, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                  <YAxis type="category" dataKey="name" tick={(props) => <TwoLineTick {...props} />} width={170} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      const netStr = (p.networks && p.networks.length > 0)
                        ? p.networks.map((n: string) => networkLabel(n)).join(", ")
                        : "—";
                      return (
                        <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                          <div className="font-semibold">{p.fullName}</div>
                          <div className="text-muted-foreground">{netStr}</div>
                          <div className="text-muted-foreground">{formatNumber(p.value)} interacciones promedio · {p.posts} posts · {p.profiles} perfil(es)</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {report.analytics.brandEngagement.slice(0, 12).map((b, i) => (
                      <Cell key={i} fill={colorForBrand(b.brand, b.isOwn, brandsList)} />
                    ))}
                    <LabelList dataKey="value" position="right" formatter={(v: number) => formatNumber(v)} fontSize={10} fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Lectura: cada barra es el promedio de reacciones (likes + comentarios + compartidos) por publicación de la marca, agregando todas sus redes activas (indicadas debajo del nombre). Iguala marcas de tamaños distintos: revela cuánta conversación moviliza cada pieza, no la audiencia. {report.clientName} se identifica con el color principal.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Ranking por engagement (perfiles individuales) — solo cuando hay >1 perfil ── */}
      {rankingChartData.length > 1 && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            {isBrand
              ? `Interacciones promedio por publicación · perfiles de ${report.clientName}`
              : `Top perfiles por interacciones por publicación (Top ${Math.min(rankingChartData.length, 10)})`}
          </CardTitle>
          <CardDescription className="text-xs">
            {isBrand
              ? "Promedio de reacciones por contenido publicado · color por red social"
              : "Volumen real de reacciones por publicación · marca y competencia · color por red"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rankingChartData.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-center px-4">
              <Trophy className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Sin posts con interacciones en este período</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Aún no se han capturado publicaciones con engagement. Prueba un período más amplio.
              </p>
            </div>
          ) : (
            <>
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingChartData} layout="vertical" margin={{ top: 8, right: 70, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                    <YAxis type="category" dataKey="name" tick={(props) => <TwoLineTick {...props} />} width={170} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                            <div className="font-semibold">{p.fullName}</div>
                            <div className="text-muted-foreground">{networkLabel(p.network)} · {formatNumber(p.value)} interacciones promedio · {p.posts} posts</div>
                            {p.isOwn && <div className="text-primary text-[10px] uppercase mt-0.5">Marca propia</div>}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {rankingChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      <LabelList dataKey="value" position="right" formatter={(v: number) => formatNumber(v)} fontSize={10} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                Lectura: ranking de perfiles por reacciones promedio (likes + comentarios + compartidos) por publicación. Esta métrica iguala marcas grandes y pequeñas porque mide cuánta conversación moviliza cada contenido, no la audiencia total. El color de cada barra identifica la red social del perfil.
              </p>
              {report.rankingInsight && (
                <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/40">
                  <EditableText
                    editing={editing}
                    value={report.rankingInsight}
                    onChange={(v) => update({ rankingInsight: v })}
                    multiline
                    minRows={2}
                    className="block"
                    placeholder="Lectura del ranking…"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      )}
      {report.analytics.networkGrowth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Crecimiento promedio por red social
            </CardTitle>
            <CardDescription className="text-xs">
              Promedio de growth % de seguidores por plataforma en el período
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.analytics.networkGrowth.map((n) => ({
                  name: n.network.charAt(0).toUpperCase() + n.network.slice(1),
                  value: n.avgGrowth,
                  profiles: n.profiles,
                  fill: n.avgGrowth >= 0 ? "#22c55e" : "#ef4444",
                }))} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-muted-foreground">{p.value.toFixed(2)}% · {p.profiles} perfil(es)</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {report.analytics.networkGrowth.map((n, i) => (
                      <Cell key={i} fill={n.avgGrowth >= 0 ? "#22c55e" : "#ef4444"} />
                    ))}
                    <LabelList dataKey="value" position="top" formatter={(v: number) => `${v.toFixed(2)}%`} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {isBrand
                ? `Lectura: cada barra muestra cómo evolucionó el número de seguidores de ${report.clientName} en cada red durante el período. Verde indica ganancia neta de audiencia; rojo, pérdida.`
                : "Lectura: promedio del crecimiento de seguidores agregado por red en todo el set (marca + competencia). Permite ver qué plataforma está sumando audiencia en el sector y cuál se contrae."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Share of voice por perfil (benchmark only) — interacciones absolutas, color por red ── */}
      {!isBrand && sovChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users2 className="h-4 w-4 text-primary" />
              Share of voice · participación en interacciones (Top 10)
            </CardTitle>
            <CardDescription className="text-xs">
              Porcentaje del total de interacciones del sector capturado por cada perfil · color por red social
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sovChartData.map((d) => ({ ...d, label: `${d.name}|${networkLabel(d.network)}` }))}
                  layout="vertical"
                  margin={{ top: 8, right: 50, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="label" tick={(props) => <TwoLineTick {...props} />} width={170} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-muted-foreground">{networkLabel(p.network)} · {p.value.toFixed(1)}% del total de interacciones</div>
                          {p.isOwn && <div className="text-primary text-[10px] uppercase mt-0.5">Marca propia</div>}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {sovChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    <LabelList dataKey="value" position="right" formatter={(v: number) => `${v.toFixed(1)}%`} fontSize={10} fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Lectura: cada barra muestra qué porción de toda la conversación del sector capturó ese perfil en el período. A diferencia del engagement por perfil, esta vista revela la concentración: si pocos perfiles acumulan la mayor parte, hay un líder claro de visibilidad. Para {report.clientName} indica cuánto espacio de conversación está ganando frente a la competencia.
            </p>
            {report.sovInsight && (
              <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/40">
                <EditableText
                  editing={editing}
                  value={report.sovInsight}
                  onChange={(v) => update({ sovInsight: v })}
                  multiline
                  minRows={2}
                  className="block"
                  placeholder="Lectura del share of voice…"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Seguidores por perfil — incluye TODOS los propios + completa hasta 15 ── */}
      {!isBrand && report.analytics.followersByProfile?.length > 0 && (() => {
        const allFollowers = report.analytics.followersByProfile;
        const ownFollowers = allFollowers.filter((f) => f.isOwn);
        const compFollowers = allFollowers.filter((f) => !f.isOwn).sort((a, b) => b.followers - a.followers);
        const TARGET = 15;
        const followersData = [...ownFollowers, ...compFollowers.slice(0, Math.max(TARGET - ownFollowers.length, 6))]
          .sort((a, b) => b.followers - a.followers);
        return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users2 className="h-4 w-4 text-primary" />
              Perfiles con más seguidores (Top {followersData.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Tamaño de audiencia por perfil · incluye todos los perfiles de {report.clientName} · color por red social
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={followersData.map((f) => ({
                    name: `${f.name.length > 14 ? f.name.substring(0, 12) + "…" : f.name}|${networkLabel(f.network)}`,
                    fullName: f.name,
                    network: f.network,
                    value: f.followers,
                    isOwn: f.isOwn,
                  }))}
                  margin={{ top: 16, right: 16, left: 0, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    height={80}
                    tick={(props) => {
                      const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
                      const [n1, n2] = (payload?.value || "").split("|");
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={10} textAnchor="middle" fontSize={9} fontWeight={600} fill="hsl(var(--foreground))">{n1}</text>
                          <text x={0} y={22} textAnchor="middle" fontSize={8} fill="hsl(var(--muted-foreground))">{n2}</text>
                        </g>
                      );
                    }}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                          <div className="font-semibold">{p.fullName}</div>
                          <div className="text-muted-foreground">{networkLabel(p.network)} · {formatNumber(p.value)} seguidores</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {followersData.map((f, i) => (
                      <Cell key={i} fill={f.isOwn ? "hsl(var(--primary))" : colorForNetwork(f.network)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Lectura: dimensiona la brecha de alcance potencial entre {report.clientName} (resaltado en violeta) y la competencia. Los perfiles propios siempre aparecen para permitir comparación directa, aunque no estén en el top puro de tamaño. Una audiencia más grande no garantiza más interacción, pero sí amplifica la entrega orgánica de cualquier contenido publicado.
            </p>
          </CardContent>
        </Card>
        );
      })()}

      {/* ── Interacciones por red social (modo MARCA usa absolutas; benchmark usa tasa) ── */}
      {isBrand && (report.analytics.networkInteractions?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Interacciones por red social
            </CardTitle>
            <CardDescription className="text-xs">
              ¿En qué red está logrando {report.clientName} más interacciones absolutas (likes + comentarios + compartidos) sobre el contenido top del período?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.analytics.networkInteractions.map((n) => ({
                  name: networkLabel(n.network),
                  network: n.network,
                  value: n.totalInteractions,
                  profiles: n.profiles,
                }))} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-muted-foreground">{formatNumber(p.value)} interacciones · {p.profiles} perfil(es)</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {report.analytics.networkInteractions.map((n, i) => (
                      <Cell key={i} fill={colorForNetwork(n.network)} />
                    ))}
                    <LabelList dataKey="value" position="top" formatter={(v: number) => formatNumber(v)} fontSize={10} fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Lectura: cada barra suma las interacciones absolutas (likes + comentarios + compartidos) que el contenido top de {report.clientName} obtuvo en cada red. A diferencia de la tasa de engagement —que tiende a ser muy baja en cuentas grandes— este indicador muestra el volumen real de conversación que la marca está generando por canal.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Interacciones promedio por publicación · por red social (BENCHMARK) ── */}
      {!isBrand && (report.analytics.networkEngagement?.length ?? 0) > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Interacciones promedio por publicación · por red social
            </CardTitle>
            <CardDescription className="text-xs">
              ¿En qué plataforma cada contenido publicado moviliza más conversación en el sector?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.analytics.networkEngagement.map((n) => ({
                  name: networkLabel(n.network),
                  network: n.network,
                  value: n.avgInteractionsPerPost,
                  posts: n.postsCount,
                  profiles: n.profiles,
                }))} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-muted-foreground">{formatNumber(p.value)} interacciones promedio · {p.posts} posts · {p.profiles} perfil(es)</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {report.analytics.networkEngagement.map((n, i) => (
                      <Cell key={i} fill={colorForNetwork(n.network)} />
                    ))}
                    <LabelList dataKey="value" position="top" formatter={(v: number) => formatNumber(v)} fontSize={10} fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Lectura: cada barra promedia las reacciones absolutas que cada publicación obtiene en esa red, sumando a todas las marcas del set. Como referencia, el promedio del sector es ≈{formatNumber(report.analytics.avgInteractionsPerPost)} interacciones/post — barras por encima señalan redes donde la audiencia es más activa por contenido. Para {report.clientName} esto orienta dónde concentrar producción.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Donut A: Cuota de interacciones AGREGADA por marca (todas las redes sumadas) ── */}
      {!isBrand && report.analytics.brandEngagement.length > 0 && (() => {
        const withInter = report.analytics.brandEngagement.filter((b) => b.totalInteractions > 0);
        if (withInter.length === 0) return null;
        const total = withInter.reduce((s, b) => s + b.totalInteractions, 0) || 1;
        const donutData = withInter
          .sort((a, b) => b.totalInteractions - a.totalInteractions)
          .map((b) => ({
            name: b.brand,
            brand: b.brand,
            networks: b.networks,
            value: Math.round((b.totalInteractions / total) * 1000) / 10,
            absolute: b.totalInteractions,
            isOwn: b.isOwn,
            fill: colorForBrand(b.brand, b.isOwn, brandsList),
          }));
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users2 className="h-4 w-4 text-primary" />
                Cuota de interacciones por marca · agregado ({donutData.length} marcas)
              </CardTitle>
              <CardDescription className="text-xs">
                Suma de interacciones de TODAS las redes sociales por marca · una porción = una marca
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={2}
                      label={({ name, value }) => `${name} · ${value}%`}
                      labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                    >
                      {donutData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        const netStr = (p.networks && p.networks.length > 0)
                          ? p.networks.map((n: string) => networkLabel(n)).join(", ")
                          : "—";
                        return (
                          <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                            <div className="font-semibold">{p.brand}</div>
                            <div className="text-muted-foreground">Redes: {netStr}</div>
                            <div className="text-muted-foreground">{formatNumber(p.absolute)} interacciones · {p.value}% del total</div>
                            {p.isOwn && <div className="text-primary text-[10px] uppercase mt-0.5">Marca propia</div>}
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                Lectura: cada porción agrega las interacciones de TODAS las redes sociales por marca. Solo aparecen las marcas con interacciones registradas en el período — entran por mérito según volumen real, sin inclusión forzada.
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Donut B: Cuota de interacciones por PERFIL (marca + red específica) ── */}
      {!isBrand && (report.analytics.shareOfVoice?.length ?? 0) > 0 && (() => {
        const withInter = (report.analytics.shareOfVoice ?? []).filter((s) => s.interactionsShare > 0);
        if (withInter.length === 0) return null;
        const selected = [...withInter]
          .sort((a, b) => b.interactionsShare - a.interactionsShare)
          .slice(0, 10);
        const donutData = selected.map((s) => ({
          name: `${s.name} · ${networkLabel(s.network)}`,
          profile: s.name,
          network: s.network,
          value: s.interactionsShare,
          isOwn: s.isOwn,
          fill: colorForNetwork(s.network),
        }));
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users2 className="h-4 w-4 text-primary" />
                Cuota de interacciones por perfil · marca + red (Top {donutData.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Granularidad por canal · cada porción = un perfil específico de una marca en una red
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={2}
                      label={({ name, value }) => `${name} · ${value}%`}
                      labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                    >
                      {donutData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                            <div className="font-semibold">{p.profile}</div>
                            <div className="text-muted-foreground">{networkLabel(p.network)}</div>
                            <div className="text-muted-foreground">{p.value}% del total de interacciones</div>
                            {p.isOwn && <div className="text-primary text-[10px] uppercase mt-0.5">Marca propia</div>}
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                Lectura: identifica qué perfil específico (marca + red) lidera la conversación. Permite ver, por ejemplo, si Banorte concentra interacciones en Facebook o en TikTok. Color por red social.
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Tabla compacta de perfiles ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3Icon />
            {isBrand
              ? `Perfiles de ${report.clientName} · detalle`
              : `Top ${Math.min(report.profiles?.length ?? 0, 10)} perfiles por engagement`}
          </CardTitle>
          <CardDescription className="text-xs">
            Tabla resumen · ordenada por engagement rate
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Perfil</th>
                  <th className="px-4 py-2 font-medium">Red</th>
                  {!isBrand && <th className="px-4 py-2 font-medium">Tipo</th>}
                  <th className="px-4 py-2 font-medium text-right">Seguidores</th>
                  <th className="px-4 py-2 font-medium text-right">Crecimiento</th>
                  <th className="px-4 py-2 font-medium text-right">Engagement</th>
                  <th className="px-4 py-2 font-medium text-right">Posts/día</th>
                </tr>
              </thead>
              <tbody>
                {[...(report.profiles ?? [])]
                  .sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))
                  .slice(0, 10)
                  .map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      <td className="px-4 py-2"><ReportNetworkPill network={p.network} /></td>
                      {!isBrand && (
                        <td className="px-4 py-2">
                          <Badge variant={p.isCompetitor ? "outline" : "default"} className="text-[10px]">
                            {p.isCompetitor ? "Competencia" : "Marca"}
                          </Badge>
                        </td>
                      )}
                      <td className="px-4 py-2 text-right">{p.followers != null ? formatNumber(p.followers) : "—"}</td>
                      <td className={`px-4 py-2 text-right ${p.growthPercent != null && p.growthPercent < 0 ? "text-destructive" : p.growthPercent != null && p.growthPercent > 0 ? "text-green-600" : ""}`}>
                        {p.growthPercent != null ? `${p.growthPercent > 0 ? "+" : ""}${p.growthPercent.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{p.engagementRate != null ? `${p.engagementRate.toFixed(2)}%` : "—"}</td>
                      <td className="px-4 py-2 text-right">{p.postsPerDay != null ? p.postsPerDay.toFixed(2) : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {(report.profiles?.length ?? 0) > 10 && (
            <div className="p-3 text-xs text-muted-foreground text-center border-t bg-muted/20">
              Mostrando 10 de {report.profiles.length} perfiles. El detalle completo está en el PDF descargable.
            </div>
          )}
          {report.profilesInsight && (
            <div className="m-4 rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/40">
              <EditableText
                editing={editing}
                value={report.profilesInsight}
                onChange={(v) => update({ profilesInsight: v })}
                multiline
                minRows={2}
                className="block"
                placeholder="Lectura de los perfiles…"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top content — Top 10 en 2 columnas */}
      {(report.topPosts?.length ?? 0) > 0 && (
        <Card>
          <CardHeader data-pdf-capture-item>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Mejores contenidos del período
            </CardTitle>
            <CardDescription className="text-xs">
              Top {Math.min(report.topPosts!.length, 10)} posts por interacciones absolutas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div data-pdf-capture-grid="top-posts" className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.topPosts.slice(0, 10).map((p, i) => (
                <div key={i} data-pdf-capture-item className="rounded-md border p-3 space-y-2">
                  <div data-top-content-header className="flex items-center gap-2 flex-wrap text-xs">
                    <span data-numbered-bullet className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground font-bold text-[10px]">{i + 1}</span>
                    <span className="font-medium break-words">{p.authorName}</span>
                    <ReportNetworkPill network={p.network} />
                    <span className="text-muted-foreground">· {p.postDate}</span>
                  </div>
                  {p.postContent && (
                    <p data-top-content-body className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">{p.postContent}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Interacciones: <strong className="text-foreground">{formatNumber(p.engagement)}</strong></span>
                    <span>Likes: {formatNumber(p.likes)}</span>
                    <span>Comentarios: {formatNumber(p.comments)}</span>
                    {p.shares > 0 && <span>Compartidos: {formatNumber(p.shares)}</span>}
                    {p.views > 0 && <span>Vistas: {formatNumber(p.views)}</span>}
                  </div>
                  {p.postUrl && (
                    <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      Ver publicación →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          {report.topContentInsight && (
            <CardContent data-pdf-capture-item className="pt-0">
              <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm">
                <EditableText
                  editing={editing}
                  value={report.topContentInsight}
                  onChange={(v) => update({ topContentInsight: v })}
                  multiline
                  minRows={2}
                  className="block text-muted-foreground"
                  placeholder="Análisis del contenido top"
                />
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Competitive insight (benchmark only) */}
      {!isBrand && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Posicionamiento competitivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EditableText
              editing={editing}
              value={report.competitiveInsight}
              onChange={(v) => update({ competitiveInsight: v })}
              multiline
              minRows={3}
              className="block text-sm text-muted-foreground"
              placeholder="Análisis de posicionamiento competitivo"
            />
          </CardContent>
        </Card>
      )}

      {/* ── Hallazgos clave (editorial) ── */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
              Sección 01
            </span>
          </div>
          <CardTitle className="text-xl font-bold mt-1">Hallazgos clave</CardTitle>
          <CardDescription className="text-xs">
            Lectura crítica del período · {report.clientName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-5">
            {(report.keyFindings ?? []).map((f, i) => (
              <li key={i} className="flex gap-4 pb-5 border-b last:border-0 last:pb-0">
                <span className="flex-shrink-0 text-3xl font-bold text-primary leading-none tabular-nums w-10">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <EditableText
                  editing={editing}
                  value={f}
                  onChange={(v) => updateArrayItem("keyFindings", i, v)}
                  multiline
                  minRows={2}
                  className="flex-1 block text-[13.5px] leading-[1.7] text-foreground"
                />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ── Recomendaciones (editorial) ── */}
      <Card className="border-l-4" style={{ borderLeftColor: "#f97316" }}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" style={{ color: "#f97316" }} />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "#f97316" }}>
              Sección 02
            </span>
          </div>
          <CardTitle className="text-xl font-bold mt-1">Recomendaciones</CardTitle>
          <CardDescription className="text-xs">
            Decisiones accionables · ámbito digital
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-5">
            {(report.recommendations ?? []).map((r, i) => (
              <li key={i} className="flex gap-4 pb-5 border-b last:border-0 last:pb-0">
                <span
                  className="flex-shrink-0 text-3xl font-bold leading-none tabular-nums w-10"
                  style={{ color: "#f97316" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <EditableText
                  editing={editing}
                  value={r}
                  onChange={(v) => updateArrayItem("recommendations", i, v)}
                  multiline
                  minRows={2}
                  className="flex-1 block text-[13.5px] leading-[1.7] text-foreground"
                />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ── Conclusión (editorial closing) ── */}
      {report.conclusion && (
        <div
          className="rounded-xl px-8 py-7 text-white shadow-md"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4" style={{ color: "#c7d2fe" }} />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "#c7d2fe" }}>
              Conclusión ejecutiva
            </span>
          </div>
          <EditableText
            editing={editing}
            value={report.conclusion}
            onChange={(v) => update({ conclusion: v })}
            multiline
            minRows={2}
            className="block text-[14px] leading-[1.75] text-white/90"
            placeholder="Conclusión ejecutiva"
          />
        </div>
      )}
    </div>
  );
}

// inline icon to avoid extra import
function BarChart3Icon() {
  return (
    <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 16V8" /><path d="M12 16v-5" /><path d="M17 16v-3" />
    </svg>
  );
}
