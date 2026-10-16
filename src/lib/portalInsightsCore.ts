// Núcleo de cálculo del portal de insights (Metricool): periodos, normalización y agregados.

export type Social = {
  id: string; network: string; account_name: string; period_start: string; period_end: string; period_label: string | null;
  followers: number | null; follower_growth: number | null; posts: number | null; interactions: number | null;
  reach: number | null; impressions: number | null; engagement_rate: number | null; raw: any;
};
export type Ad = {
  id: string; platform: string; campaign_key: string; campaign_name: string; objective: string | null;
  period_start: string; period_end: string; period_label: string | null; spend: number | null; impressions: number | null;
  reach: number | null; clicks: number | null; ctr: number | null; cpc: number | null; cpm: number | null;
  results: number | null; result_type: string | null; cost_per_result: number | null; raw: any;
};
export type Post = {
  network: string; url?: string; text?: string; date?: string; image?: string; format?: string;
  likes?: number; comments?: number; shares?: number; saves?: number; interactions: number; reach: number; views?: number;
  /** Fecha en hora de Ciudad de México (YYYY-MM-DD) */ day: string; /** 0=dom */ dow: number; hour: number;
  /** Rendimiento relativo al promedio histórico de su red (1 = promedio) */ idx: number;
};
export type Win = {
  key: string; label: string; kind: "month" | "week" | "multi"; from: string; to: string;
  prev: { from: string; to: string; label: string } | null; months: string[];
};

export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const NET_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn", x: "X" };
/** Redes donde Metricool sí entrega guardados por publicación. */
export const SAVES_NETWORKS = new Set(["instagram"]);

const MX_OFFSET_H = -6; // México no usa horario de verano desde 2022
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const monthLabel = (k: string) => `${MESES[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`;
export const dayLabel = (s: string) => `${Number(s.slice(8, 10))} ${MESES[Number(s.slice(5, 7)) - 1]}`;
const lastOfMonth = (m: string) => { const [y, mm] = m.split("-").map(Number); return `${m}-${String(new Date(Date.UTC(y, mm, 0)).getUTCDate()).padStart(2, "0")}`; };

/** Las fechas sin zona vienen en hora de CDMX (se piden así a Metricool); las que traen zona se convierten. */
export function mxParts(date?: string) {
  if (!date) return null;
  const s = String(date).trim();
  const hasTz = /([+-]\d{2}:?\d{2}|Z)$/.test(s);
  let t: number;
  if (hasTz) t = new Date(s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")).getTime();
  else t = new Date(`${s.slice(0, 19)}Z`).getTime() - MX_OFFSET_H * 3600_000;
  if (Number.isNaN(t)) return null;
  const local = new Date(t + MX_OFFSET_H * 3600_000);
  return { day: iso(local), dow: local.getUTCDay(), hour: local.getUTCHours() };
}

export const isMonthly = (r: { period_start: string; period_end: string; raw?: any }) =>
  r.raw?.granularity !== "week" && r.period_start.endsWith("-01") && r.period_end.slice(0, 7) === r.period_start.slice(0, 7) && Number(r.period_end.slice(8, 10)) >= 28;
export const isWeekly = (r: { raw?: any }) => r.raw?.granularity === "week";

const median = (xs: number[]) => { if (!xs.length) return 0; const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Publicaciones únicas con hora local y su índice vs. el promedio de su red. */
export function buildPosts(social: Social[]): Post[] {
  const seen = new Set<string>();
  const out: Omit<Post, "idx">[] = [];
  social.filter(isMonthly).forEach((r) => ((r.raw?.posts ?? []) as any[]).forEach((p) => {
    const k = `${r.network}|${p.url ?? p.date}`;
    if (seen.has(k)) return; seen.add(k);
    const mp = mxParts(p.date); if (!mp) return;
    out.push({ ...p, network: r.network, interactions: Number(p.interactions) || 0, reach: Number(p.reach) || 0, ...mp });
  }));
  const netAvg: Record<string, number> = {};
  for (const n of new Set(out.map((p) => p.network))) netAvg[n] = avg(out.filter((p) => p.network === n).map((p) => p.interactions)) || 1;
  return out.map((p) => ({ ...p, idx: p.interactions / netAvg[p.network] })).sort((a, b) => (a.day < b.day ? 1 : -1));
}

/** Serie diaria de seguidores por red (combina todos los cortes cargados). */
export function buildFollowers(social: Social[]) {
  const m = new Map<string, Map<string, number>>();
  social.forEach((r) => {
    const s = m.get(r.network) ?? new Map<string, number>();
    ((r.raw?.followers_daily ?? []) as { d: string; v: number }[]).forEach((x) => { if (x.v > 0) s.set(x.d, x.v); });
    m.set(r.network, s);
  });
  const out: Record<string, { d: string; v: number }[]> = {};
  m.forEach((s, n) => { out[n] = [...s.entries()].map(([d, v]) => ({ d, v })).sort((a, b) => (a.d < b.d ? -1 : 1)); });
  return out;
}

/** Seguidores al cierre (dato ≤ fecha, con máximo 10 días de antigüedad) y crecimiento dentro de la ventana. */
export function followersIn(series: { d: string; v: number }[] | undefined, from: string, to: string) {
  if (!series?.length) return { followers: null as number | null, growth: null as number | null, asOf: null as string | null };
  const upto = series.filter((x) => x.d <= to);
  const last = upto[upto.length - 1];
  const followers = last && last.d >= addDays(to, -10) ? last.v : null;
  const inWin = series.filter((x) => x.d >= addDays(from, -1) && x.d <= to);
  const growth = inWin.length >= 2 ? inWin[inWin.length - 1].v - inWin[0].v : null;
  return { followers, growth, asOf: followers != null ? last.d : null };
}

const mondayOf = (s: string) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); };

export function buildWindows(social: Social[], ads: Ad[], posts: Post[]): Win[] {
  const today = iso(new Date(Date.now() + MX_OFFSET_H * 3600_000));
  const months = [...new Set([...social, ...ads].filter(isMonthly).map((r) => r.period_start.slice(0, 7)))].sort();
  if (!months.length) return [];
  const monthWin = (m: string, i: number): Win => {
    const pm = months[i - 1];
    return {
      key: `m:${m}`, label: `${monthLabel(m)} (mes)`, kind: "month", from: `${m}-01`, to: lastOfMonth(m) > today ? today : lastOfMonth(m), months: [m],
      prev: pm ? { from: `${pm}-01`, to: lastOfMonth(pm), label: monthLabel(pm) } : null,
    };
  };
  const mw = months.map(monthWin).reverse();

  // Semanas lunes–domingo desde la primera publicación
  const first = posts.length ? posts[posts.length - 1].day : `${months[0]}-01`;
  const weeks: Win[] = [];
  for (let w = mondayOf(first); w <= today; w = addDays(w, 7)) {
    const to = addDays(w, 6);
    weeks.push({
      key: `w:${w}`, label: `Semana ${dayLabel(w)} – ${dayLabel(to)}`, kind: "week", from: w, to: to > today ? today : to,
      months: [...new Set([w.slice(0, 7), to.slice(0, 7)])],
      prev: { from: addDays(w, -7), to: addDays(w, -1), label: `semana del ${dayLabel(addDays(w, -7))}` },
    });
  }
  const year = months[months.length - 1].slice(0, 4);
  const q = months.slice(-3); const pq = months.slice(-6, -3);
  const ytd = months.filter((m) => m.startsWith(year));
  const multi: Win[] = [
    { key: "q", label: "Últimos 3 meses", kind: "multi", from: `${q[0]}-01`, to: lastOfMonth(q[q.length - 1]) > today ? today : lastOfMonth(q[q.length - 1]), months: q,
      prev: pq.length === 3 ? { from: `${pq[0]}-01`, to: lastOfMonth(pq[2]), label: `${monthLabel(pq[0])} – ${monthLabel(pq[2])}` } : null },
    { key: "ytd", label: `Año ${year} a la fecha`, kind: "multi", from: `${ytd[0]}-01`, to: today, months: ytd, prev: null },
  ];
  return [...mw, ...weeks.reverse().slice(0, 26), ...multi];
}

export const postsIn = (posts: Post[], from: string, to: string) => posts.filter((p) => p.day >= from && p.day <= to);

/** Filas de publicidad para una ventana: semanales para semanas, mensuales para meses. */
export function adsIn(ads: Ad[], w: { from: string; to: string }, kind: Win["kind"]) {
  if (kind === "week") return ads.filter((r) => isWeekly(r) && r.period_start === w.from);
  return ads.filter((r) => isMonthly(r) && r.period_start >= w.from && r.period_start <= w.to);
}

export function aggregate(posts: Post[], followers: Record<string, { d: string; v: number }[]>, networks: string[], from: string, to: string) {
  const ps = postsIn(posts, from, to);
  const byNet = networks.map((n) => {
    const xs = ps.filter((p) => p.network === n);
    const f = followersIn(followers[n], from, to);
    const s = (k: keyof Post) => xs.reduce((a, p) => a + (Number(p[k]) || 0), 0);
    return {
      n, posts: xs.length, inter: s("interactions"), reach: s("reach"), views: s("views"), likes: s("likes"),
      comments: s("comments"), shares: s("shares"), saves: SAVES_NETWORKS.has(n) ? s("saves") : null,
      followers: f.followers, growth: f.growth, asOf: f.asOf,
      perPost: xs.length ? s("interactions") / xs.length : null,
      rate: s("reach") ? s("interactions") / s("reach") : null,
    };
  });
  const withF = byNet.filter((x) => x.followers != null);
  return {
    posts: ps, byNet,
    followers: withF.length ? withF.reduce((a, x) => a + (x.followers ?? 0), 0) : null,
    followersNets: withF.map((x) => x.n),
    growth: byNet.some((x) => x.growth != null) ? byNet.reduce((a, x) => a + (x.growth ?? 0), 0) : null,
    nPosts: ps.length,
    interactions: byNet.reduce((a, x) => a + x.inter, 0),
    reach: byNet.reduce((a, x) => a + x.reach, 0),
    views: byNet.reduce((a, x) => a + x.views, 0),
  };
}

export function sumAds(rows: Ad[]) {
  const t = { spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0, actions: {} as Record<string, number> };
  rows.forEach((r) => {
    t.spend += Number(r.spend) || 0; t.impressions += Number(r.impressions) || 0; t.reach += Number(r.reach) || 0;
    t.clicks += Number(r.clicks) || 0; t.results += Number(r.results) || 0;
    Object.entries(r.raw?.actions ?? {}).forEach(([k, v]) => { t.actions[k] = (t.actions[k] ?? 0) + (Number(v) || 0); });
  });
  return t;
}

// ---------- Temas ----------
const STOP_WORDS = `de la que el en y a los del se las por un para con no una su al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos que unos yo otro otras otra el tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mis tu te ti tus ellas nosotras vosotros os mio mia tuyo suyo nuestro nuestra es son fue ser hoy dia dias vez veces cada tiene tienen hace hacen puede pueden solo asi bien como cual todas estas estan tan sea aqui ahi aunque tarde entrega nuevo nueva nuestros nuestras siempre hacer tener sentir mismo misma mismos puedes quieres queremos vamos parte gracias ahora luego despues mejor mayor menos cosas cosa manera forma momento momentos favor solamente todavia ademas incluso mientras hacia traves embargo grande grandes pequeno pequena pequenos reales real seguro segura dejate deja dejar dejarte quiere quieren necesitas necesita necesitamos buscar busca puedo podemos podria debemos debe deben sabes saber sabemos cuanto cuanta cuantos alguien nadie ningun ninguna mucha muchas otro aquel aquella aquellos gran bueno buena buenos buenas nunca jamas tanta tantos tantas dentro fuera cerca lejos arriba abajo mismo casi quiza quizas tal tales toda entonces pues hecho hecha hemos habia haber estoy estamos estaba estuvo eres somos seria sido siendo tengo tenemos tenia van voy vas dice dicen decir digo pasa pasar dar dame damos doy vemos veces verdad sobre ultimo ultima primera primero segundo semana semanas mundo vida vidas persona personas gente todos algunos alguna quien quienes cualquier demas ella ellos usted ustedes aqui alla asi mismo realmente simplemente cuenta cuentas lugar tiempo tiempos camino hablar hablamos pensar creer creo cree decia decir dijo dificil facil haces hacemos hago hizo firme verdadero verdadera valor personal transforme transformar conversacion importante posible necesario claro clara pequenas propia propio sola solos juntos juntas lleno llena mejores peores medio siguiente distintos distintas diferente diferentes nueva nuevos nuevas cierto cierta hablo sientes sentimos quieras puedas vuelve volver empezar comienza sigue seguir pide pedir llega llegar mira mirar miramos basta viene vienen dejamos automatico automatica`;
const STOP = new Set(STOP_WORDS.split(/\s+/));
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Temas con evidencia (mediana, resistente a virales): palabra en ≥5 piezas, ≥2 meses, no presente en >30% de las piezas; rendimiento normalizado por red. */
export function themes(all: Post[], exclude: string[] = []) {
  const ex = new Set(exclude.map(norm));
  const words = new Map<string, { idx: number[]; months: Set<string>; nets: Set<string> }>();
  all.forEach((p) => {
    const raw = norm(p.text ?? "");
    const tags = (raw.match(/#([a-z0-9ñ_]{4,})/g) ?? []).map((t) => t.slice(1));
    const ws = (raw.replace(/#[a-z0-9ñ_]+/g, " ").match(/[a-zñ]{5,}/g) ?? [])
      .filter((w) => !STOP.has(w) && !ex.has(w) && !/(mente|ando|iendo|ndote|ndose|arte|erte|irte)$/.test(w));
    new Set([...ws, ...tags]).forEach((w) => {
      const x = words.get(w) ?? { idx: [], months: new Set(), nets: new Set() };
      x.idx.push(p.idx); x.months.add(p.day.slice(0, 7)); x.nets.add(p.network); words.set(w, x);
    });
  });
  const maxN = Math.max(4, all.length * 0.3);
  // Fusiona singular/plural (virgen/virgenes, santo/santos)
  const merged = new Map<string, { idx: number[]; months: Set<string>; nets: Set<string> }>();
  [...words.entries()].sort((a, b) => a[0].length - b[0].length).forEach(([w, x]) => {
    const base = [...merged.keys()].find((k) => w === `${k}s` || w === `${k}es`);
    if (base) { const y = merged.get(base)!; y.idx.push(...x.idx); x.months.forEach((m) => y.months.add(m)); x.nets.forEach((m) => y.nets.add(m)); }
    else merged.set(w, { idx: [...x.idx], months: new Set(x.months), nets: new Set(x.nets) });
  });
  return [...merged.entries()]
    .filter(([, x]) => x.idx.length >= 5 && x.idx.length <= maxN && x.months.size >= 2)
    .map(([w, x]) => ({ w, n: x.idx.length, lift: median(x.idx), nets: [...x.nets], sample: themeSample(all, w, x.idx) }))
    .sort((a, b) => b.lift - a.lift);
}

/** Frase real donde aparece el tema (en la pieza más representativa), para que "pablo" se lea "…la conversión de San Pablo…". */
function themeSample(all: Post[], w: string, idxs: number[]): string | null {
  const target = median(idxs);
  const cands = all.filter((p) => {
    const t = norm(p.text ?? "");
    return t.includes(w);
  }).sort((a, b) => Math.abs(a.idx - target) - Math.abs(b.idx - target));
  for (const p of cands) {
    const tokens = (p.text ?? "").replace(/\s+/g, " ").split(" ");
    const i = tokens.findIndex((t) => { const n = norm(t).replace(/[^a-z0-9ñ#]/g, "").replace(/^#/, ""); return n === w || n === `${w}s` || n === `${w}es`; });
    if (i < 0) continue;
    const a = Math.max(0, i - 5), b = Math.min(tokens.length, i + 7);
    return `${a > 0 ? "…" : ""}${tokens.slice(a, b).join(" ")}${b < tokens.length ? "…" : ""}`;
  }
  return null;
}
