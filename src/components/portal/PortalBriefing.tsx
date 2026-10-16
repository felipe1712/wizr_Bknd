import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  AlertTriangle, ArrowRight, Building2, Copy, Newspaper, Search, TrendingDown, TrendingUp, Target, Sun,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGabineteData, ENFOQUE_LABEL, fmtNum, fmtPct, pctDelta,
  type Enfoque, type Dependencia,
} from "./useGabineteData";
import { mxDay } from "@/lib/tz";
import PortalDependenciaFicha from "./PortalDependenciaFicha";

const isoToday = () => new Date().toISOString().slice(0, 10);
const shiftIso = (d: string, n: number) =>
  new Date(new Date(d + "T00:00:00").getTime() + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) =>
  Math.max(1, Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000) + 1);
const fmtDia = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

/** Última semana completa lunes→domingo relativa a una fecha ancla. */
function ultimaSemanaCompleta(anchorIso: string) {
  const hoy = new Date(anchorIso + "T00:00:00");
  const dow = hoy.getDay();
  const domingo = new Date(hoy); domingo.setDate(hoy.getDate() - (dow === 0 ? 0 : dow));
  const lunes = new Date(domingo); lunes.setDate(domingo.getDate() - 6);
  return { from: lunes.toISOString().slice(0, 10), to: domingo.toISOString().slice(0, 10) };
}

/** Últimas dos semanas completas lunes→domingo (quincena cerrada). */
function ultimaQuincenaCompleta(anchorIso: string) {
  const s = ultimaSemanaCompleta(anchorIso);
  return { from: shiftIso(s.from, -7), to: s.to };
}

export default function PortalBriefing({
  clientId, focusDepId, onFocusChange, onGoTo,
}: {
  clientId: string;
  focusDepId: string | null;
  onFocusChange: (depId: string | null) => void;
  onGoTo?: (tab: string) => void;
}) {
  const gab = useGabineteData(clientId);
  const {
    loading, pressLoading, dependencias, depById, periods, periodLabels, mentions, aggregate,
    posts, depOfCompetitor, lastPressDate, lastPostDate,
  } = gab;

  const [enfoque, setEnfoque] = useState<Enfoque>("combinado");
  const [periodLabel, setPeriodLabel] = useState("");
  const [fichaDep, setFichaDep] = useState<Dependencia | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Ventana de prensa: presets o rango personalizado.
  const [pressPreset, setPressPreset] = useState<"7" | "14" | "30" | "semana" | "quincena" | "custom">("7");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  /**
   * Los cortes se anclan al último día con información cargada (publicaciones,
   * periodo de benchmark o bitácora de prensa). Si se anclaran a "hoy", los
   * cortes semanales y quincenales saldrían vacíos mientras la carga va atrasada.
   */
  const anchor = useMemo(() => {
    const hoy = isoToday();
    const post = lastPostDate && lastPostDate <= hoy ? lastPostDate : null;
    const press = lastPressDate && lastPressDate <= hoy ? lastPressDate : null;
    // El día más reciente con ambos insumos, para que el corte no salga vacío.
    if (post && press) return post < press ? post : press;
    return post ?? press ?? hoy;
  }, [lastPostDate, lastPressDate]);

  const anchorIsToday = anchor === isoToday();

  useEffect(() => {
    if (!customFrom && !customTo && anchor) {
      setCustomFrom(shiftIso(anchor, -13));
      setCustomTo(anchor);
    }
  }, [anchor, customFrom, customTo]);

  const win = useMemo(() => {
    if (pressPreset === "custom" && customFrom && customTo) {
      const [from, to] = customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
      return { from, to };
    }
    if (pressPreset === "semana") return ultimaSemanaCompleta(anchor);
    if (pressPreset === "quincena") return ultimaQuincenaCompleta(anchor);
    const n = Number(pressPreset) || 7;
    return { from: shiftIso(anchor, -(n - 1)), to: anchor };
  }, [pressPreset, customFrom, customTo, anchor]);

  const winDays = daysBetween(win.from, win.to);
  const prevFrom = shiftIso(win.from, -winDays);
  const prevTo = shiftIso(win.from, -1);
  const rangoLabel = (pressPreset === "7" || pressPreset === "14" || pressPreset === "30") && anchorIsToday
    ? `últimos ${winDays} días`
    : `${fmtDia(win.from)} — ${fmtDia(win.to)}`;

  const [winMentions, setWinMentions] = useState<typeof mentions>([]);
  const [winLoading, setWinLoading] = useState(true);
  const [winPosts, setWinPosts] = useState<typeof posts>([]);
  const [prevPosts, setPrevPosts] = useState<typeof posts>([]);

  useEffect(() => {
    if (!periods.length) return;
    let cancelled = false;
    (async () => {
      const [a, b] = await Promise.all([
        gab.fetchPostsWindow(win.from, win.to),
        gab.fetchPostsWindow(prevFrom, prevTo),
      ]);
      if (cancelled) return;
      setWinPosts(a); setPrevPosts(b);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods.length, gab.fetchPostsWindow, win.from, win.to, prevFrom, prevTo]);

  useEffect(() => {
    if (!dependencias.length) return;
    let cancelled = false;
    (async () => {
      setWinLoading(true);
      const rows = await gab.fetchMentions(prevFrom, win.to);
      if (cancelled) return;
      setWinMentions(rows);
      setWinLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependencias.length, gab.fetchMentions, prevFrom, win.to]);

  useEffect(() => {
    if (!periodLabel && periodLabels.length) setPeriodLabel(periodLabels[periodLabels.length - 1]);
  }, [periodLabels, periodLabel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setSearchOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  // Actividad publicada dentro de la ventana granular (semana / quincena / rango).
  const actNow = useMemo(
    () => gab.aggregateActivity(win.from, win.to, enfoque, winPosts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gab.aggregateActivity, win.from, win.to, enfoque, winPosts],
  );
  const actPrev = useMemo(
    () => gab.aggregateActivity(prevFrom, prevTo, enfoque, prevPosts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gab.aggregateActivity, prevFrom, prevTo, enfoque, prevPosts],
  );

  const actividad = useMemo(() => {
    const sum = (m: Map<string, { publicaciones: number; interacciones: number }>) => {
      let pub = 0, inter = 0;
      m.forEach((v, id) => {
        if (focusDepId && id !== focusDepId) return;
        pub += v.publicaciones; inter += v.interacciones;
      });
      return { pub, inter };
    };
    const a = sum(actNow); const b = sum(actPrev);
    const top = Array.from(actNow.entries())
      .filter(([id]) => !focusDepId || id === focusDepId)
      .sort((x, y) => y[1].interacciones - x[1].interacciones)[0];
    return {
      pub: a.pub, inter: a.inter,
      dPub: pctDelta(a.pub, b.pub || null),
      dInter: pctDelta(a.inter, b.inter || null),
      porDia: a.pub / winDays,
      top: top ? { nombre: depById.get(top[0])?.nombre ?? "—", ...top[1] } : null,
    };
  }, [actNow, actPrev, focusDepId, winDays, depById]);

  const focusDep = focusDepId ? depById.get(focusDepId) ?? null : null;

  // ---------- Prensa: ventana seleccionada vs ventana previa equivalente ----------
  const press = useMemo(() => {
    const scope = (r: typeof mentions[number]) => !focusDepId || r.dep === focusDepId;
    const last7 = winMentions.filter((r) => r.fecha >= win.from && r.fecha <= win.to && scope(r));
    const prev7 = winMentions.filter((r) => r.fecha >= prevFrom && r.fecha <= prevTo && scope(r));
    const neg = (rows: typeof mentions) => rows.filter((r) => r.tono === "negativo" || r.tono === "crisis").length;
    const pos = (rows: typeof mentions) => rows.filter((r) => r.tono === "positivo").length;
    const byDep = new Map<string, { total: number; neg: number }>();
    for (const r of last7) {
      if (!r.dep) continue;
      const e = byDep.get(r.dep) ?? { total: 0, neg: 0 };
      e.total += 1;
      if (r.tono === "negativo" || r.tono === "crisis") e.neg += 1;
      byDep.set(r.dep, e);
    }
    const byMedio = new Map<string, number>();
    for (const r of last7) byMedio.set(r.medio, (byMedio.get(r.medio) ?? 0) + 1);
    return {
      total: last7.length,
      prevTotal: prev7.length,
      neg: neg(last7),
      prevNeg: neg(prev7),
      pos: pos(last7),
      byDep,
      topMedios: Array.from(byMedio.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3),
      ultimaFecha: last7[0]?.fecha ?? winMentions[0]?.fecha ?? null,
    };
  }, [winMentions, focusDepId, win.from, win.to, prevFrom, prevTo]);

  // ---------- Ranking y movimientos ----------
  const ranking = useMemo(
    () => Array.from(curr.entries())
      .filter(([, v]) => v.engagement != null)
      .sort((a, b) => (b[1].engagement ?? 0) - (a[1].engagement ?? 0)),
    [curr],
  );
  const engAvg = ranking.length
    ? ranking.reduce((a, [, v]) => a + (v.engagement ?? 0), 0) / ranking.length
    : null;

  const movers = useMemo(() => {
    const rows: { id: string; nombre: string; delta: number }[] = [];
    curr.forEach((v, id) => {
      const p = prev.get(id);
      const d = pctDelta(v.followers, p?.followers);
      if (d == null) return;
      rows.push({ id, nombre: depById.get(id)?.nombre ?? "—", delta: d });
    });
    return {
      suben: rows.slice().sort((a, b) => b.delta - a.delta).filter((r) => r.delta > 0).slice(0, 3),
      bajan: rows.slice().sort((a, b) => a.delta - b.delta).filter((r) => r.delta < 0).slice(0, 3),
      total: rows.length,
    };
  }, [curr, prev, depById]);

  const focusRank = focusDepId ? ranking.findIndex(([id]) => id === focusDepId) : -1;

  // ---------- Titular del día ----------
  const titular = useMemo(() => {
    if (winLoading) return null;
    const partes: string[] = [];
    const sujeto = focusDep ? focusDep.nombre : "El gabinete";
    if (press.total) {
      const dTot = press.prevTotal ? Math.round(((press.total - press.prevTotal) / press.prevTotal) * 100) : null;
      partes.push(
        `${sujeto} registró ${press.total} menciones de prensa en ${rangoLabel === `últimos ${winDays} días` ? rangoLabel : `el periodo ${rangoLabel}`}` +
        (dTot != null ? ` (${dTot >= 0 ? "+" : ""}${dTot}% frente a los 7 previos)` : "") +
        `, ${press.neg} de ellas con tono negativo o de crisis.`,
      );
    } else {
      partes.push(`No se detectaron menciones de prensa para ${sujeto.toLowerCase()} en ${rangoLabel}.`);
    }
    if (press.topMedios.length) {
      partes.push(`Los medios con más cobertura fueron ${press.topMedios.map(([m, n]) => `${m} (${n})`).join(", ")}.`);
    }
    if (focusDep) {
      if (focusRank >= 0) partes.push(`En redes ocupa la posición #${focusRank + 1} de ${ranking.length} del gabinete por engagement en ${periodLabel}.`);
    } else if (ranking.length) {
      partes.push(`En redes, ${depById.get(ranking[0][0])?.nombre ?? "—"} lidera el engagement del periodo ${periodLabel} con ${fmtPct(ranking[0][1].engagement, 2)}.`);
    }
    return partes.join(" ");
  }, [winLoading, press, focusDep, focusRank, ranking, depById, periodLabel, rangoLabel, winDays]);

  // ---------- Alertas ----------
  const alertas = useMemo(() => {
    const out: { nivel: "alta" | "media" | "baja"; titulo: string; dato: string; depId?: string; tab?: string }[] = [];

    // 1) Prensa negativa concentrada
    const negDeps = Array.from(press.byDep.entries())
      .filter(([, v]) => v.neg >= 2 && v.neg / Math.max(1, v.total) >= 0.4)
      .sort((a, b) => b[1].neg - a[1].neg)
      .slice(0, 3);
    for (const [id, v] of negDeps) {
      out.push({
        nivel: v.neg >= 4 ? "alta" : "media",
        titulo: `Prensa negativa en ${depById.get(id)?.nombre ?? "—"}`,
        dato: `${v.neg} de ${v.total} menciones de ${rangoLabel} con tono negativo o de crisis.`,
        depId: id,
      });
    }
    if (press.prevNeg > 0 && press.neg > press.prevNeg * 1.5 && press.neg >= 3) {
      out.push({
        nivel: "media",
        titulo: "Repunte de cobertura negativa",
        dato: `${press.neg} menciones negativas en ${rangoLabel} contra ${press.prevNeg} del periodo previo equivalente.`,
      });
    }

    // 2) Caídas de desempeño en redes
    curr.forEach((v, id) => {
      const p = prev.get(id);
      const dEng = pctDelta(v.engagement, p?.engagement);
      if (dEng != null && dEng <= -0.25) {
        out.push({
          nivel: dEng <= -0.5 ? "alta" : "media",
          titulo: `Caída de engagement en ${depById.get(id)?.nombre ?? "—"}`,
          dato: `Pasó de ${fmtPct(p?.engagement, 2)} a ${fmtPct(v.engagement, 2)} entre periodos.`,
          depId: id,
        });
      }
    });

    // 3) Cobertura: dependencias sin datos del periodo
    const sinDatos = dependencias.filter((d) => !curr.has(d.id));
    if (sinDatos.length) {
      out.push({
        nivel: "baja",
        titulo: "Dependencias sin datos en el periodo",
        dato: `${sinDatos.length} de ${dependencias.length} no tienen métricas registradas en ${periodLabel || "el periodo"} con el enfoque activo: ${sinDatos.slice(0, 4).map((d) => d.nombre).join(", ")}${sinDatos.length > 4 ? "…" : ""}.`,
      });
    }

    const rank = { alta: 0, media: 1, baja: 2 } as const;
    const filtered = focusDepId ? out.filter((a) => !a.depId || a.depId === focusDepId) : out;
    return filtered.sort((a, b) => rank[a.nivel] - rank[b.nivel]).slice(0, 6);
  }, [press, curr, prev, depById, dependencias, periodLabel, focusDepId, rangoLabel]);

  // ---------- Acciones sugeridas ----------
  const acciones = useMemo(() => {
    const out: { accion: string; evidencia: string }[] = [];
    const negTop = Array.from(press.byDep.entries()).sort((a, b) => b[1].neg - a[1].neg)[0];
    if (negTop && negTop[1].neg >= 2) {
      out.push({
        accion: `Preparar respuesta pública y agenda propia para ${depById.get(negTop[0])?.nombre ?? "la dependencia"}.`,
        evidencia: `${negTop[1].neg} menciones negativas de ${negTop[1].total} en ${rangoLabel}.`,
      });
    }
    const below = Array.from(curr.entries())
      .filter(([, v]) => engAvg != null && v.engagement != null && v.engagement < engAvg * 0.6)
      .sort((a, b) => (a[1].engagement ?? 0) - (b[1].engagement ?? 0))[0];
    if (below && engAvg != null) {
      out.push({
        accion: `Revisar formato y frecuencia de contenido en ${depById.get(below[0])?.nombre ?? "la dependencia"}.`,
        evidencia: `Engagement de ${fmtPct(below[1].engagement, 2)} contra ${fmtPct(engAvg, 2)} de promedio del gabinete.`,
      });
    }
    const leader = ranking[0];
    if (leader) {
      out.push({
        accion: `Replicar el patrón de contenido de ${depById.get(leader[0])?.nombre ?? "—"} en dependencias con menor desempeño.`,
        evidencia: `Lidera el engagement del periodo con ${fmtPct(leader[1].engagement, 2)}.`,
      });
    }
    const bajaFrec = Array.from(curr.entries()).filter(([, v]) => v.postsDia != null && v.postsDia < 0.4);
    if (bajaFrec.length >= 3) {
      out.push({
        accion: "Establecer un mínimo de publicación diaria en las dependencias con menor ritmo.",
        evidencia: `${bajaFrec.length} dependencias publican menos de 0.4 veces al día en ${periodLabel || "el periodo"}.`,
      });
    }
    const filtered = focusDepId
      ? out.filter((a) => !focusDep || a.accion.includes(focusDep.nombre) || a.accion.startsWith("Establecer"))
      : out;
    return (filtered.length ? filtered : out).slice(0, 3);
  }, [press, curr, engAvg, ranking, depById, periodLabel, focusDepId, focusDep, rangoLabel]);

  // ---------- Temas de prensa sin respuesta ----------
  // Una mención negativa se considera "sin respuesta" cuando la dependencia no
  // publicó nada en sus cuentas dentro de las 48 horas siguientes a la nota.
  const postDatesByDep = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of posts) {
      if (!p.posted_at || !p.competitor_id) continue;
      const dep = depOfCompetitor.get(p.competitor_id);
      if (!dep) continue;
      const arr = m.get(dep) ?? [];
      const dia = mxDay(p.posted_at);
      if (!dia) continue;
      arr.push(dia);
      m.set(dep, arr);
    }
    return m;
  }, [posts, depOfCompetitor]);

  const sinRespuesta = useMemo(() => {
    const from = win.from;
    const plusDays = (d: string, n: number) =>
      new Date(new Date(d + "T00:00:00").getTime() + n * 86_400_000).toISOString().slice(0, 10);
    return winMentions
      .filter((r) =>
        r.fecha >= from && r.fecha <= win.to && r.dep &&
        (r.tono === "negativo" || r.tono === "crisis") &&
        (!focusDepId || r.dep === focusDepId))
      .filter((r) => {
        const fechas = postDatesByDep.get(r.dep!) ?? [];
        const limite = plusDays(r.fecha, 2);
        return !fechas.some((f) => f >= r.fecha && f <= limite);
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 6);
  }, [winMentions, postDatesByDep, focusDepId, win.from, win.to]);

  // ---------- Resúmenes por dependencia, listos para enviar ----------
  // Se arma con lo que sí está medido: prensa del corte, redes del periodo con su
  // comparativo, actividad publicada y los temas abiertos. Sin frases de relleno.
  const bloques = useMemo(() => {
    const objetivo = focusDepId
      ? dependencias.filter((d) => d.id === focusDepId)
      : Array.from(press.byDep.entries())
          .sort((a, b) => b[1].neg - a[1].neg || b[1].total - a[1].total)
          .slice(0, 3)
          .map(([id]) => depById.get(id))
          .filter(Boolean) as Dependencia[];

    return objetivo.map((d) => {
      const pr = press.byDep.get(d.id) ?? { total: 0, neg: 0 };
      const v = curr.get(d.id);
      const p = prev.get(d.id);
      const act = actNow.get(d.id);
      const actAnt = actPrev.get(d.id);
      const pendientes = sinRespuesta.filter((r) => r.dep === d.id);
      const pos = ranking.findIndex(([id]) => id === d.id);
      const dFol = pctDelta(v?.followers, p?.followers);
      const dInt = pctDelta(act?.interacciones ?? null, actAnt?.interacciones || null);
      const medios = Array.from(
        winMentions
          .filter((r) => r.dep === d.id && r.fecha >= win.from && r.fecha <= win.to)
          .reduce((m, r) => m.set(r.medio, (m.get(r.medio) ?? 0) + 1), new Map<string, number>())
          .entries(),
      ).sort((a, b) => b[1] - a[1]).slice(0, 3);

      const L: string[] = [];
      L.push(`${d.nombre}${d.titular ? ` · ${d.titular}` : ""}`);
      L.push(`Corte ${rangoLabel}`);
      L.push("");

      L.push("PRENSA");
      if (pr.total) {
        L.push(`· ${pr.total} menciones, ${pr.neg} con tono negativo o de crisis (${Math.round((pr.neg / pr.total) * 100)}%).`);
        if (medios.length) L.push(`· Medios con más cobertura: ${medios.map(([m, n]) => `${m} (${n})`).join(", ")}.`);
      } else {
        L.push("· Sin menciones registradas en el corte.");
      }

      L.push("");
      L.push(`REDES (${periodLabel || "periodo actual"})`);
      if (v) {
        L.push(
          `· ${fmtNum(v.followers)} seguidores${dFol != null ? ` (${dFol >= 0 ? "+" : "−"}${fmtPct(Math.abs(dFol))} vs periodo previo)` : ""} en ${v.cuentas} cuenta${v.cuentas === 1 ? "" : "s"}.`,
        );
        L.push(
          `· Engagement ${fmtPct(v.engagement, 2)}${engAvg != null ? ` contra ${fmtPct(engAvg, 2)} del gabinete` : ""}` +
          `${pos >= 0 ? ` · posición #${pos + 1} de ${ranking.length}` : ""}.`,
        );
      } else {
        L.push("· Sin métricas de cuenta cargadas para este periodo.");
      }
      if (act?.publicaciones) {
        L.push(
          `· ${act.publicaciones} publicaciones y ${fmtNum(act.interacciones)} interacciones en el corte` +
          `${dInt != null ? ` (${dInt >= 0 ? "+" : "−"}${fmtPct(Math.abs(dInt))} vs corte previo)` : ""}.`,
        );
        if (act.mejor?.message) {
          L.push(`· Mejor publicación (${fmtNum(act.mejor.interactions)} interacciones): "${act.mejor.message.replace(/\s+/g, " ").slice(0, 140)}".`);
        }
      } else {
        L.push("· Sin publicaciones fechadas dentro del corte.");
      }

      if (pendientes.length) {
        L.push("");
        L.push("TEMAS ABIERTOS (sin publicación propia en 48 h)");
        pendientes.slice(0, 4).forEach((r) => L.push(`· ${fmtDia(r.fecha)} · ${r.medio}: ${r.titular}`));
      }

      L.push("");
      L.push("PRIORIDAD SUGERIDA");
      if (pendientes.length) {
        L.push(`· Responder o fijar agenda propia sobre ${pendientes.length} tema${pendientes.length === 1 ? "" : "s"} abierto${pendientes.length === 1 ? "" : "s"}, empezando por ${pendientes[0].medio}.`);
      } else if (pr.neg >= 2) {
        L.push("· Sostener mensajes propios: la cobertura negativa se concentró sin tema abierto pendiente.");
      } else if (engAvg != null && v?.engagement != null && v.engagement < engAvg) {
        L.push(`· Subir el desempeño en redes: está ${fmtPct((engAvg - v.engagement) / engAvg)} por debajo del promedio del gabinete.`);
      } else if (!act?.publicaciones) {
        L.push("· Recuperar ritmo de publicación: no hubo contenido propio en el corte.");
      } else {
        L.push("· Mantener el ritmo actual; no hay señales de riesgo en el corte.");
      }
      L.push("");
      L.push("KiMedia · Inteligencia digital");

      return { dep: d, texto: L.join("\n"), pendientes: pendientes.length, negativas: pr.neg };
    });
  }, [
    focusDepId, dependencias, press, depById, curr, prev, actNow, actPrev, engAvg,
    periodLabel, sinRespuesta, rangoLabel, ranking, winMentions, win.from, win.to,
  ]);

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Resumen copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barra de contexto */}
      <Card className="p-4 flex flex-wrap items-start gap-x-3 gap-y-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Estoy viendo como</span>
          <Select value={focusDepId ?? "gabinete"} onValueChange={(v) => onFocusChange(v === "gabinete" ? null : v)}>
            <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="gabinete">Gabinete completo</SelectItem>
              {dependencias.map((d) => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Periodo de redes</span>
          <Select value={periodLabel} onValueChange={setPeriodLabel}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Periodo" /></SelectTrigger>
            <SelectContent>
              {periodLabels.slice().reverse().map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Cuentas</span>
          <Select value={enfoque} onValueChange={(v) => setEnfoque(v as Enfoque)}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="combinado">Dependencia + titular + marca</SelectItem>
              <SelectItem value="institucional">Solo institucional</SelectItem>
              <SelectItem value="titular">Solo titular</SelectItem>
              <SelectItem value="marca">Solo marca / destino</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Corte de análisis</span>
          <Select value={pressPreset} onValueChange={(v) => setPressPreset(v as typeof pressPreset)}>
            <SelectTrigger className="w-[210px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Semanal (7 días)</SelectItem>
              <SelectItem value="14">Quincenal (14 días)</SelectItem>
              <SelectItem value="30">Mensual (30 días)</SelectItem>
              <SelectItem value="semana">Última semana completa (L–D)</SelectItem>
              <SelectItem value="quincena">Última quincena completa (L–D)</SelectItem>
              <SelectItem value="custom">Rango personalizado</SelectItem>
            </SelectContent>
          </Select>
          <span className="block text-[10px] text-muted-foreground">
            {fmtDia(win.from)} — {fmtDia(win.to)}
            {!anchorIsToday && ` · anclado al último dato (${fmtDia(anchor)})`}
          </span>
        </div>
        {pressPreset === "custom" && (
          <>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Desde</span>
              <Input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-[150px]" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Hasta</span>
              <Input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-[150px]" />
            </div>
          </>
        )}
        <Button variant="outline" size="sm" className="h-9 ml-auto mt-[22px]" onClick={() => setSearchOpen(true)}>
          <Search className="w-4 h-4 mr-2" /> Buscar dependencia
          <kbd className="ml-2 text-[10px] text-muted-foreground border border-border rounded px-1">⌘K</kbd>
        </Button>
        {focusDep && (
          <Button size="sm" className="h-9 mt-[22px]" onClick={() => setFichaDep(focusDep)}>
            Ver ficha completa <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </Card>

      {/* Titular del día */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-primary" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Briefing {press.ultimaFecha ? `· última bitácora ${press.ultimaFecha}` : ""}
          </span>
        </div>
        {winLoading ? <Skeleton className="h-12 w-full" /> : (
          <p className="text-[15px] leading-relaxed">{titular}</p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <Mini label={`Menciones (${rangoLabel})`} value={fmtNum(press.total)} delta={press.prevTotal ? (press.total - press.prevTotal) / press.prevTotal : null} />
          <Mini label={`Negativas (${rangoLabel})`} value={fmtNum(press.neg)} invert delta={press.prevNeg ? (press.neg - press.prevNeg) / press.prevNeg : null} />
          <Mini label={`Positivas (${rangoLabel})`} value={fmtNum(press.pos)} />
          <Mini
            label={focusDep ? "Posición en el gabinete" : "Promedio de engagement"}
            value={focusDep ? (focusRank >= 0 ? `#${focusRank + 1} de ${ranking.length}` : "—") : fmtPct(engAvg, 2)}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Prensa: {rangoLabel}. Redes: periodo <b>{periodLabel || "—"}</b> · {ENFOQUE_LABEL[enfoque].toLowerCase()}.
          {focusDep ? ` Filtrado a ${focusDep.nombre}.` : " Gabinete completo."}
        </p>
      </Card>

      {/* Actividad en redes dentro del corte granular */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Actividad en redes · {rangoLabel}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Mini label="Publicaciones" value={fmtNum(actividad.pub)} delta={actividad.dPub} />
          <Mini label="Interacciones" value={fmtNum(actividad.inter)} delta={actividad.dInter} />
          <Mini label="Publicaciones / día" value={actividad.porDia ? actividad.porDia.toFixed(2) : "—"} />
          <Mini
            label={focusDep ? "Interacciones del corte" : "Dependencia más activa"}
            value={actividad.top ? (focusDep ? fmtNum(actividad.top.interacciones) : actividad.top.nombre) : "—"}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Cuenta las publicaciones fechadas dentro del corte, así que sí responde a cortes semanales o quincenales.
          Seguidores y engagement siguen viniendo del periodo <b>{periodLabel || "—"}</b> porque la fuente los entrega por mes.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Alertas */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Semáforo de alertas</span>
          </div>
          {alertas.length ? alertas.map((a, i) => (
            <button
              key={i}
              onClick={() => a.depId ? setFichaDep(depById.get(a.depId) ?? null) : onGoTo?.("benchmark")}
              className="w-full text-left rounded-xl border border-border/60 p-3 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className={
                    a.nivel === "alta" ? "text-[10px] bg-rose-500/10 text-rose-600 border-rose-500/30"
                      : a.nivel === "media" ? "text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30"
                        : "text-[10px]"
                  }
                >{a.nivel}</Badge>
                <span className="text-sm font-semibold">{a.titulo}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{a.dato}</p>
            </button>
          )) : (
            <p className="text-xs text-muted-foreground italic">
              Sin alertas con los datos disponibles. Se revisan prensa negativa concentrada, caídas de engagement mayores a 25% y dependencias sin métricas del periodo.
            </p>
          )}
        </Card>

        {/* Movimientos */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Movimientos vs periodo anterior
            </span>
          </div>
          {movers.total ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="text-[11px] text-emerald-600 font-medium">Quién sube</div>
                {movers.suben.length ? movers.suben.map((m) => (
                  <button key={m.id} onClick={() => setFichaDep(depById.get(m.id) ?? null)} className="w-full text-left text-xs hover:text-primary">
                    <span className="truncate block">{m.nombre}</span>
                    <span className="text-emerald-600">+{fmtPct(m.delta)}</span>
                  </button>
                )) : <p className="text-xs text-muted-foreground italic">Nadie creció en seguidores.</p>}
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] text-rose-600 font-medium flex items-center gap-1"><TrendingDown className="w-3 h-3" />Quién baja</div>
                {movers.bajan.length ? movers.bajan.map((m) => (
                  <button key={m.id} onClick={() => setFichaDep(depById.get(m.id) ?? null)} className="w-full text-left text-xs hover:text-primary">
                    <span className="truncate block">{m.nombre}</span>
                    <span className="text-rose-600">−{fmtPct(Math.abs(m.delta))}</span>
                  </button>
                )) : <p className="text-xs text-muted-foreground italic">Nadie cayó en seguidores.</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No hay un periodo anterior comparable para {periodLabel || "este periodo"}.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Comparación de seguidores entre {periodLabel || "—"} y el periodo previo, sobre {movers.total} dependencias con datos en ambos.
          </p>
        </Card>
      </div>

      {/* Acciones */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Qué hacer hoy</span>
        </div>
        {acciones.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {acciones.map((a, i) => (
              <div key={i} className="rounded-xl border border-border/60 p-4 space-y-2">
                <div className="text-sm font-semibold leading-snug">{a.accion}</div>
                <div className="text-[11px] text-muted-foreground leading-snug">
                  <span className="uppercase tracking-widest">Evidencia</span> · {a.evidencia}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Sin acciones sugeridas: no hay señales suficientes en el periodo.</p>
        )}
      </Card>

      {/* Temas de prensa sin respuesta */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-amber-500" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Temas abiertos en la conversación · {rangoLabel}
          </span>
        </div>
        {winLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : sinRespuesta.length ? (
          <div className="space-y-2">
            {sinRespuesta.map((r, i) => (
              <div key={`${r.url}-${i}`} className="rounded-xl border border-border/60 p-3 flex items-start gap-3">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-1 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-snug">{r.titular}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {r.fecha} · {r.medio} · {depById.get(r.dep!)?.nombre ?? "sin dependencia"} · tono {r.tono}
                  </div>
                </div>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-primary shrink-0">
                    Abrir
                  </a>
                )}
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground italic">
              Criterio: nota con tono negativo o de crisis sin ninguna publicación de la dependencia en las 48 horas siguientes.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Sin temas abiertos: cada nota negativa del corte tuvo publicación de la dependencia dentro de 48 horas.
          </p>
        )}
      </Card>

      {/* Bloques listos para enviar */}
      {bloques.length > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-primary" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Resúmenes por dependencia · listos para enviar
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {focusDepId ? "Dependencia en foco" : "Las 3 con más señales del corte"}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {bloques.map((b) => (
              <div key={b.dep.id} className="rounded-xl border border-border/60 p-3 space-y-2 flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold truncate">{b.dep.nombre}</span>
                  {b.negativas > 0 && (
                    <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-600 border-rose-500/30 shrink-0">
                      {b.negativas} neg.
                    </Badge>
                  )}
                </div>
                <pre className="text-[10px] leading-snug text-muted-foreground whitespace-pre-wrap max-h-56 overflow-y-auto font-sans flex-1">
                  {b.texto}
                </pre>
                <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={() => copiar(b.texto)}>
                  <Copy className="w-3 h-3 mr-1.5" /> Copiar resumen
                  {b.pendientes > 0 && <span className="ml-1 text-amber-500">({b.pendientes} pendientes)</span>}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Directorio rápido */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Directorio · {dependencias.length} dependencias
          </span>
          <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => onGoTo?.("benchmark")}>
            Ver benchmark completo <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {dependencias.map((d) => {
            const v = curr.get(d.id);
            const pos = ranking.findIndex(([id]) => id === d.id);
            return (
              <button
                key={d.id}
                onClick={() => setFichaDep(d)}
                className={`text-left rounded-xl border p-3 transition-colors hover:border-primary/50 ${d.id === focusDepId ? "border-primary/60 bg-primary/5" : "border-border/60"}`}
              >
                <div className="text-xs font-semibold truncate">{d.nombre}</div>
                <div className="text-[11px] text-muted-foreground truncate">{d.titular ?? "Sin titular registrado"}</div>
                <div className="text-[11px] mt-1 flex items-center gap-2">
                  <span>{fmtNum(v?.followers)} seg.</span>
                  <span>· {fmtPct(v?.engagement, 2)}</span>
                  {pos >= 0 && <span className="ml-auto text-muted-foreground">#{pos + 1}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Busca una dependencia o titular…" />
        <CommandList>
          <CommandEmpty>Sin coincidencias.</CommandEmpty>
          <CommandGroup heading="Dependencias">
            {dependencias.map((d) => (
              <CommandItem
                key={d.id}
                value={`${d.nombre} ${d.titular ?? ""}`}
                onSelect={() => { setSearchOpen(false); setFichaDep(d); }}
              >
                <Building2 className="w-4 h-4 mr-2" />
                <span className="truncate">{d.nombre}</span>
                {d.titular && <span className="ml-2 text-xs text-muted-foreground truncate">{d.titular}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Acciones">
            <CommandItem value="gabinete completo" onSelect={() => { setSearchOpen(false); onFocusChange(null); }}>
              <Newspaper className="w-4 h-4 mr-2" /> Ver el gabinete completo
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <PortalDependenciaFicha
        gab={gab}
        dep={fichaDep}
        periodLabel={periodLabel}
        enfoque={enfoque}
        ventana={win}
        ventanaLabel={rangoLabel}
        mentionsOverride={winMentions}
        postsOverride={winPosts}
        open={!!fichaDep}
        onOpenChange={(v) => { if (!v) setFichaDep(null); }}
        onDescargar={() => onGoTo?.("descargas")}
      />
    </div>
  );
}

function Mini({ label, value, delta, invert }: { label: string; value: string; delta?: number | null; invert?: boolean }) {
  const good = delta == null ? null : invert ? delta <= 0 : delta >= 0;
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-2xl font-display font-bold mt-0.5">{value}</div>
      {delta != null && Number.isFinite(delta) && (
        <div className={`text-[11px] mt-0.5 ${good ? "text-emerald-500" : "text-rose-500"}`}>
          {delta >= 0 ? "+" : "−"}{fmtPct(Math.abs(delta), 0)} vs periodo previo
        </div>
      )}
    </div>
  );
}
