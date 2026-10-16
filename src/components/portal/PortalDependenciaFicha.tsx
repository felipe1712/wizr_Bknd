import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Building2, User, TrendingUp, TrendingDown, Newspaper, Sparkles, ExternalLink, Trophy,
} from "lucide-react";
import {
  fmtNum, fmtPct, pctDelta, ENFOQUE_LABEL,
  type Enfoque, type Dependencia,
} from "./useGabineteData";
import { mxDay } from "@/lib/tz";

type Gab = ReturnType<typeof import("./useGabineteData").useGabineteData>;

const TONE_CLASS: Record<string, string> = {
  positivo: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  neutral: "bg-muted text-muted-foreground border-border",
  negativo: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  crisis: "bg-rose-500/15 text-rose-600 border-rose-500/40",
};

const TIPO_LABEL: Record<string, string> = {
  institucional: "Institucional",
  titular: "Titular",
  marca: "Marca / destino",
};

export default function PortalDependenciaFicha({
  gab, dep, periodLabel, enfoque, open, onOpenChange, onDescargar, ventana, ventanaLabel, mentionsOverride, postsOverride,
}: {
  gab: Gab;
  dep: Dependencia | null;
  periodLabel: string;
  enfoque: Enfoque;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDescargar?: (depId: string) => void;
  /** Corte granular (semanal/quincenal/personalizado) para publicaciones y prensa. */
  ventana?: { from: string; to: string } | null;
  ventanaLabel?: string;
  mentionsOverride?: Gab["mentions"];
  /** Publicaciones ya consultadas para la ventana (evita el sesgo del top global). */
  postsOverride?: Gab["posts"];
}) {
  const {
    periods, periodLabels, competitors, metrics, posts, narratives, mentions, aggregate, aggregateActivity,
  } = gab;

  const inWindow = (iso: string | null | undefined) => {
    if (!ventana || !iso) return !ventana;
    const d = mxDay(iso);
    return !!d && d >= ventana.from && d <= ventana.to;
  };
  const corteLabel = ventana ? (ventanaLabel || `${ventana.from} — ${ventana.to}`) : "periodo completo";
  const prensaBase = mentionsOverride ?? mentions;
  const postsBase = ventana && postsOverride ? postsOverride : posts;

  const activeIds = useMemo(
    () => periods.filter((p) => p.period_label === periodLabel).map((p) => p.id),
    [periods, periodLabel],
  );
  const prevIds = useMemo(() => {
    const idx = periodLabels.indexOf(periodLabel);
    if (idx <= 0) return [];
    return periods.filter((p) => p.period_label === periodLabels[idx - 1]).map((p) => p.id);
  }, [periods, periodLabels, periodLabel]);

  const curr = useMemo(() => aggregate(activeIds, enfoque), [aggregate, activeIds, enfoque]);
  const prev = useMemo(() => aggregate(prevIds, enfoque), [aggregate, prevIds, enfoque]);

  const depComps = useMemo(
    () => competitors.filter((c) => c.dependencia_id === dep?.id
      && (enfoque === "combinado" || (c.account_type ?? "institucional") === enfoque)),
    [competitors, dep?.id, enfoque],
  );
  const compById = useMemo(() => new Map(depComps.map((c) => [c.id, c])), [depComps]);

  const cuentas = useMemo(() => {
    const ids = new Set(activeIds);
    return metrics
      .filter((m) => ids.has(m.period_id) && compById.has(m.competitor_id))
      .map((m) => {
        const c = compById.get(m.competitor_id)!;
        return {
          perfil: c.name, red: m.network, tipo: c.account_type ?? "institucional",
          seguidores: m.followers, crecimiento: m.follower_growth_rate,
          engagement: m.engagement_rate, postsDia: m.posts_per_day,
        };
      })
      .sort((a, b) => (b.seguidores ?? 0) - (a.seguidores ?? 0));
  }, [metrics, compById, activeIds]);

  const mine = dep ? curr.get(dep.id) : undefined;
  const prevMine = dep ? prev.get(dep.id) : undefined;

  const ranking = useMemo(
    () => Array.from(curr.entries())
      .filter(([, v]) => v.engagement != null)
      .sort((a, b) => (b[1].engagement ?? 0) - (a[1].engagement ?? 0)),
    [curr],
  );
  const rank = dep ? ranking.findIndex(([id]) => id === dep.id) : -1;
  const engAvg = ranking.length
    ? ranking.reduce((a, [, v]) => a + (v.engagement ?? 0), 0) / ranking.length
    : null;
  const folAvg = curr.size
    ? Array.from(curr.values()).reduce((a, v) => a + v.followers, 0) / curr.size
    : null;

  const topPosts = useMemo(() => {
    const ids = new Set(activeIds);
    return postsBase
      .filter((p) => p.competitor_id && compById.has(p.competitor_id)
        && (ventana ? inWindow(p.posted_at) : ids.has(p.period_id)))
      .sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0))
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postsBase, compById, activeIds, ventana?.from, ventana?.to]);

  /** Actividad publicada dentro del corte granular seleccionado. */
  const actividad = useMemo(() => {
    if (!ventana || !dep) return null;
    return aggregateActivity(ventana.from, ventana.to, enfoque, postsOverride).get(dep.id) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregateActivity, ventana?.from, ventana?.to, enfoque, dep?.id, postsOverride]);

  /**
   * ¿Funcionó? Compara cada publicación destacada contra la mediana de
   * interacciones de la propia dependencia en el periodo, para saber si el
   * contenido rindió por encima de su propio estándar.
   */
  const funciono = useMemo(() => {
    const ids = new Set(activeIds);
    const mine = postsBase.filter((p) => p.competitor_id && compById.has(p.competitor_id)
      && (ventana ? inWindow(p.posted_at) : ids.has(p.period_id)));
    const vals = mine.map((p) => Number(p.interactions) || 0).sort((a, b) => a - b);
    if (vals.length < 3) return null;
    const mediana = vals[Math.floor(vals.length / 2)];
    const arriba = mine.filter((p) => (Number(p.interactions) || 0) > mediana * 1.5);
    const porRed = new Map<string, { n: number; sum: number }>();
    for (const p of arriba) {
      const e = porRed.get(p.network) ?? { n: 0, sum: 0 };
      e.n += 1; e.sum += Number(p.interactions) || 0;
      porRed.set(p.network, e);
    }
    const mejorRed = Array.from(porRed.entries()).sort((a, b) => b[1].n - a[1].n)[0];
    return {
      mediana,
      total: mine.length,
      arriba: arriba.length,
      mejorRed: mejorRed ? mejorRed[0] : null,
      top: arriba.sort((a, b) => (b.interactions ?? 0) - (a.interactions ?? 0)).slice(0, 3),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postsBase, compById, activeIds, ventana?.from, ventana?.to]);

  const axes = useMemo(() => {
    const names = new Set(depComps.map((c) => c.name.toLowerCase()));
    const out: { name: string; description?: string }[] = [];
    for (const n of narratives) {
      if (!names.has(String(n.profile_name ?? "").toLowerCase())) continue;
      for (const a of (n.narratives?.narrative_axes ?? [])) {
        if (a?.name && !out.some((x) => x.name === a.name)) out.push({ name: a.name, description: a.description });
      }
    }
    return out.slice(0, 6);
  }, [narratives, depComps]);

  const prensa = useMemo(
    () => prensaBase.filter((m) => m.dep === dep?.id && inWindow(m.fecha)).slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prensaBase, dep?.id, ventana?.from, ventana?.to],
  );
  const prensaTono = useMemo(() => {
    const rows = prensaBase.filter((m) => m.dep === dep?.id && inWindow(m.fecha));
    return {
      total: rows.length,
      positivo: rows.filter((r) => r.tono === "positivo").length,
      negativo: rows.filter((r) => r.tono === "negativo" || r.tono === "crisis").length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prensaBase, dep?.id, ventana?.from, ventana?.to]);

  // Fortalezas y brechas, siempre con el número que las sostiene.
  const lecturas = useMemo(() => {
    const fortalezas: string[] = [];
    const brechas: string[] = [];
    if (!dep || !mine) return { fortalezas, brechas };

    if (mine.engagement != null && engAvg != null) {
      if (mine.engagement >= engAvg) fortalezas.push(`Engagement de ${fmtPct(mine.engagement, 2)}, por encima del promedio del gabinete (${fmtPct(engAvg, 2)}).`);
      else brechas.push(`Engagement de ${fmtPct(mine.engagement, 2)}, por debajo del promedio del gabinete (${fmtPct(engAvg, 2)}).`);
    }
    if (folAvg != null && mine.followers) {
      if (mine.followers >= folAvg) fortalezas.push(`${fmtNum(mine.followers)} seguidores, arriba del promedio (${fmtNum(folAvg)}).`);
      else brechas.push(`${fmtNum(mine.followers)} seguidores, abajo del promedio (${fmtNum(folAvg)}).`);
    }
    const dFol = pctDelta(mine.followers, prevMine?.followers);
    if (dFol != null) {
      if (dFol >= 0) fortalezas.push(`Los seguidores crecieron ${fmtPct(dFol)} frente al periodo anterior.`);
      else brechas.push(`Los seguidores cayeron ${fmtPct(Math.abs(dFol))} frente al periodo anterior.`);
    }
    if (mine.postsDia != null && mine.postsDia < 0.5) {
      brechas.push(`Publica ${mine.postsDia.toFixed(2)} veces al día: ritmo bajo para sostener conversación.`);
    }
    if (prensaTono.total === 0) brechas.push(`Sin menciones de prensa detectadas en ${corteLabel}.`);
    else if (prensaTono.negativo > prensaTono.positivo) {
      brechas.push(`${prensaTono.negativo} de ${prensaTono.total} menciones de prensa fueron negativas.`);
    } else if (prensaTono.positivo > 0) {
      fortalezas.push(`${prensaTono.positivo} de ${prensaTono.total} menciones de prensa fueron positivas.`);
    }
    if (!depComps.length) brechas.push("No hay cuentas registradas con el enfoque seleccionado.");
    return { fortalezas, brechas };
  }, [dep, mine, prevMine, engAvg, folAvg, prensaTono, depComps.length]);

  if (!dep) return null;

  const dFol = pctDelta(mine?.followers, prevMine?.followers);
  const dEng = pctDelta(mine?.engagement, prevMine?.engagement);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] sm:max-w-4xl max-h-[88vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-start gap-3 text-left">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Building2 className="w-5 h-5 text-primary" /></div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg leading-tight break-words pr-6">{dep.nombre}</div>
              {dep.titular && (
                <div className="text-xs font-normal text-muted-foreground flex items-start gap-1 mt-1 break-words">
                  <User className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="min-w-0">{dep.titular}{dep.titular_cargo ? ` · ${dep.titular_cargo}` : ""}</span>
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-[11px] min-w-0">
          <Badge variant="outline">{periodLabel || "Sin periodo"}</Badge>
          {ventana && <Badge variant="outline">Corte {corteLabel}</Badge>}
          <Badge variant="outline">{ENFOQUE_LABEL[enfoque]}</Badge>
          <Badge variant="outline">{depComps.length} cuenta{depComps.length === 1 ? "" : "s"}</Badge>
          {onDescargar && (
            <Button size="sm" variant="outline" className="sm:ml-auto h-7 w-full sm:w-auto" onClick={() => onDescargar(dep.id)}>
              Descargar reporte
            </Button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
          <Kpi label="Seguidores" value={fmtNum(mine?.followers)} delta={dFol} />
          <Kpi label="Engagement" value={fmtPct(mine?.engagement, 2)} delta={dEng} />
          <Kpi label="Publicaciones / día" value={mine?.postsDia != null ? mine.postsDia.toFixed(2) : "—"} />
          <Kpi
            label="Posición en el gabinete"
            value={rank >= 0 ? `#${rank + 1} de ${ranking.length}` : "—"}
            hint={engAvg != null ? `Promedio ${fmtPct(engAvg, 2)}` : undefined}
          />
        </div>

        {/* Lecturas */}
        <div className="grid md:grid-cols-2 gap-3 min-w-0">
          <Panel title="Fortalezas" icon={<Trophy className="w-4 h-4 text-emerald-500" />}>
            {lecturas.fortalezas.length
              ? <ul className="space-y-1.5">{lecturas.fortalezas.map((t, i) => <li key={i} className="text-sm leading-snug">{t}</li>)}</ul>
              : <Empty text="Sin fortalezas medibles con los datos del periodo." />}
          </Panel>
          <Panel title="Brechas" icon={<TrendingDown className="w-4 h-4 text-amber-500" />}>
            {lecturas.brechas.length
              ? <ul className="space-y-1.5">{lecturas.brechas.map((t, i) => <li key={i} className="text-sm leading-snug">{t}</li>)}</ul>
              : <Empty text="Sin brechas detectadas en este periodo." />}
          </Panel>
        </div>

        {/* Actividad del corte granular */}
        {ventana && (
          <Panel title={`Actividad del corte · ${corteLabel}`} icon={<TrendingUp className="w-4 h-4 text-primary" />}>
            {actividad ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Publicaciones" value={fmtNum(actividad.publicaciones)} />
                <Kpi label="Interacciones" value={fmtNum(actividad.interacciones)} />
                <Kpi label="Promedio por post" value={fmtNum(actividad.promedio)} />
                <Kpi label="Publicaciones / día" value={actividad.porDia != null ? actividad.porDia.toFixed(2) : "—"} />
              </div>
            ) : <Empty text="Sin publicaciones fechadas dentro del corte seleccionado." />}
          </Panel>
        )}

        {/* Cuentas */}
        <Panel title="Cuentas" icon={<Sparkles className="w-4 h-4 text-primary" />}>
          {cuentas.length ? (
            <>
              {/* Móvil: tarjetas apiladas, sin scroll lateral */}
              <div className="space-y-2 md:hidden">
                {cuentas.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border/60 p-2.5">
                    <div className="text-xs font-medium break-words">{c.perfil}</div>
                    <div className="text-[11px] text-muted-foreground capitalize mb-1.5">
                      {c.red} · {TIPO_LABEL[c.tipo] ?? "Institucional"}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <div className="text-muted-foreground">Seguidores</div>
                        <div className="font-medium">{fmtNum(c.seguidores)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Engagement</div>
                        <div className="font-medium">{fmtPct(c.engagement, 2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Posts/día</div>
                        <div className="font-medium">{c.postsDia != null ? Number(c.postsDia).toFixed(2) : "—"}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <table className="hidden md:table w-full table-fixed text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1.5 pr-3 font-medium w-[34%]">Perfil</th>
                    <th className="py-1.5 pr-3 font-medium w-[13%]">Red</th>
                    <th className="py-1.5 pr-3 font-medium w-[15%]">Tipo</th>
                    <th className="py-1.5 pr-3 font-medium text-right w-[14%]">Seguidores</th>
                    <th className="py-1.5 pr-3 font-medium text-right w-[13%]">Engag.</th>
                    <th className="py-1.5 font-medium text-right w-[11%]">Posts/día</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((c, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="py-1.5 pr-3 break-words">{c.perfil}</td>
                      <td className="py-1.5 pr-3 capitalize">{c.red}</td>
                      <td className="py-1.5 pr-3">{TIPO_LABEL[c.tipo] ?? "Institucional"}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtNum(c.seguidores)}</td>
                      <td className="py-1.5 pr-3 text-right">{fmtPct(c.engagement, 2)}</td>
                      <td className="py-1.5 text-right">{c.postsDia != null ? Number(c.postsDia).toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : <Empty text="No hay cuentas para el enfoque seleccionado." />}
        </Panel>

        {/* Publicaciones */}
        <Panel title={`Publicaciones con más interacción · ${corteLabel}`} icon={<TrendingUp className="w-4 h-4 text-primary" />}>
          {topPosts.length ? (
            <div className="space-y-2">
              {topPosts.map((p, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mb-1">
                    <span className="font-medium text-foreground truncate max-w-[180px]">{p.profile_name}</span>
                    <span className="capitalize">· {p.network}</span>
                    {p.posted_at && <span>· {new Date(p.posted_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>}
                    <span className="ml-auto shrink-0">{fmtNum(p.interactions)} interacciones</span>
                  </div>
                  <p className="text-xs leading-snug line-clamp-3">{p.message || "(sin texto)"}</p>
                </div>
              ))}
            </div>
          ) : <Empty text="Sin publicaciones registradas en el corte." />}
        </Panel>

        {/* ¿Funcionó? */}
        <Panel title="¿Funcionó?" icon={<TrendingUp className="w-4 h-4 text-primary" />}>
          {funciono ? (
            <div className="space-y-2">
              <p className="text-xs leading-relaxed">
                {funciono.arriba} de {funciono.total} publicaciones superaron en más de 50% la mediana de la
                dependencia ({fmtNum(funciono.mediana)} interacciones).
                {funciono.mejorRed && ` La red donde más veces despegó el contenido fue ${funciono.mejorRed}.`}
              </p>
              {funciono.top.map((p, i) => (
                <div key={i} className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span className="capitalize">{p.network}</span>
                    <span className="ml-auto text-emerald-600">
                      {fmtNum(p.interactions)} · {Math.round(((Number(p.interactions) || 0) / (funciono.mediana || 1)) * 100)}% de la mediana
                    </span>
                  </div>
                  <p className="text-xs leading-snug line-clamp-2 mt-1">{p.message || "(sin texto)"}</p>
                </div>
              ))}
            </div>
          ) : <Empty text="Se necesitan al menos 3 publicaciones en el periodo para evaluar qué funcionó." />}
        </Panel>

        {/* Narrativas */}
        <Panel title="Narrativas dominantes" icon={<Sparkles className="w-4 h-4 text-primary" />}>
          {axes.length ? (
            <div className="space-y-2">
              {axes.map((a, i) => (
                <div key={i}>
                  <div className="text-sm font-medium">{a.name}</div>
                  {a.description && <p className="text-xs text-muted-foreground leading-snug">{a.description}</p>}
                </div>
              ))}
            </div>
          ) : <Empty text="Aún no se ha generado el análisis de narrativas para estas cuentas." />}
        </Panel>

        {/* Prensa */}
        <Panel title={`Prensa (${corteLabel} · ${prensaTono.total} menciones)`} icon={<Newspaper className="w-4 h-4 text-primary" />}>
          {prensa.length ? (
            <div className="space-y-1.5">
              {prensa.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge variant="outline" className={`shrink-0 text-[10px] ${TONE_CLASS[m.tono] ?? TONE_CLASS.neutral}`}>{m.tono}</Badge>
                  <div className="min-w-0">
                    <div className="truncate">{m.titular || m.cita.slice(0, 100)}</div>
                    <div className="text-muted-foreground">{m.medio} · {m.fecha}</div>
                  </div>
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noreferrer" className="ml-auto text-muted-foreground hover:text-primary shrink-0">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : <Empty text="Sin menciones de prensa resueltas a esta dependencia en el corte." />}
        </Panel>

        <Separator />
        <p className="text-[11px] text-muted-foreground">
          Seguidores y engagement corresponden al periodo <b>{periodLabel || "—"}</b> con el enfoque <b>{ENFOQUE_LABEL[enfoque].toLowerCase()}</b>,
          porque la fuente entrega esas métricas por mes. Publicaciones, interacciones y prensa usan el corte <b>{corteLabel}</b>.
          Las menciones de prensa se resuelven por coincidencia de nombre de la dependencia o de su titular.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, value, delta, hint }: { label: string; value: string; delta?: number | null; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-xl font-display font-bold mt-0.5">{value}</div>
      {delta != null && (
        <div className={`text-[11px] mt-0.5 ${delta >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
          {delta >= 0 ? "+" : "−"}{fmtPct(Math.abs(delta))} vs periodo previo
        </div>
      )}
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-4 space-y-2 min-w-0 break-words">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground italic">{text}</p>;
}
