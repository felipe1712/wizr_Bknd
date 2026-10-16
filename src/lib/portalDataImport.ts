import * as XLSX from "xlsx";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const AD_PLATFORMS = [
  { key: "meta", label: "Meta Ads" },
  { key: "google", label: "Google Ads" },
  { key: "tiktok", label: "TikTok Ads" },
  { key: "x", label: "X Ads" },
  { key: "linkedin", label: "LinkedIn Ads" },
  { key: "other", label: "Otra" },
] as const;

export type AdPlatform = (typeof AD_PLATFORMS)[number]["key"];

export const NETWORK_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

export function normalizeKey(s: string): string {
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Accepts "1.234,56", "1,234.56", "12%", "$1,200", "-" */
export function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s || s === "-" || s === "—" || s.toLowerCase() === "n/a") return null;
  s = s.replace(/[%$€\s]/g, "").replace(/[A-Za-z]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // comma is decimal if it has 1-2 trailing digits, else thousands
    s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Returns a rate as a percentage number (3.4 for 3.4%). */
export function rate(v: unknown): number | null {
  if (v == null) return null;
  const raw = String(v);
  const n = num(v);
  if (n == null) return null;
  // Fractional values coming from spreadsheets (0.034) become 3.4
  if (!raw.includes("%") && Math.abs(n) > 0 && Math.abs(n) < 1) return n * 100;
  return n;
}

export function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function normalizeNetwork(v: unknown): string {
  const k = normalizeKey(String(v ?? ""));
  if (!k) return "other";
  if (k.includes("insta")) return "instagram";
  if (k.includes("face")) return "facebook";
  if (k.includes("tiktok") || k.includes("tik tok")) return "tiktok";
  if (k.includes("youtube") || k.includes("you tube")) return "youtube";
  if (k.includes("linkedin") || k.includes("linked in")) return "linkedin";
  if (k === "x" || k.includes("twitter")) return "twitter";
  return k.replace(/\s+/g, "_");
}

export function accountKeyOf(name: string, handle?: string | null): string {
  return normalizeKey(handle || name).replace(/\s+/g, "");
}

/* ------------------------------------------------------------------ */
/* Generic table loading                                               */
/* ------------------------------------------------------------------ */

export type Table = { header: string[]; rows: Record<string, unknown>[]; sheetName: string };

async function readWorkbook(file: File) {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array", cellDates: false, raw: false });
}

/** Picks the header row: the first row (within the first 12) with the most non-empty text cells. */
function findHeaderIndex(matrix: unknown[][]): number {
  let best = 0;
  let bestScore = 0;
  const limit = Math.min(matrix.length, 12);
  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? [];
    const score = row.filter((c) => c != null && String(c).trim() !== "").length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export async function loadTable(file: File): Promise<Table> {
  const wb = await readWorkbook(file);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false, blankrows: false });
  // Drop GA4 comment lines ("# ----")
  const clean = matrix.filter((r) => !(r?.length === 1 && String(r[0] ?? "").startsWith("#")));
  const hi = findHeaderIndex(clean);
  const header = (clean[hi] ?? []).map((c) => (c == null ? "" : String(c).trim()));
  const rows = clean.slice(hi + 1).map((r) => {
    const o: Record<string, unknown> = {};
    header.forEach((h, i) => {
      if (h) o[h] = r?.[i] ?? null;
    });
    return o;
  });
  return { header, rows, sheetName };
}

/** Reads a value by fuzzy header alias (substring match on normalized keys). */
export function pick(row: Record<string, unknown>, aliases: string[]): unknown {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const a = normalizeKey(alias);
    const exact = entries.find(([k]) => normalizeKey(k) === a);
    if (exact && exact[1] != null && String(exact[1]).trim() !== "") return exact[1];
  }
  for (const alias of aliases) {
    const a = normalizeKey(alias);
    const partial = entries.find(([k]) => normalizeKey(k).includes(a));
    if (partial && partial[1] != null && String(partial[1]).trim() !== "") return partial[1];
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Social (FanpageKarma comparativa + LinkedIn exports)                */
/* ------------------------------------------------------------------ */

export type SocialRow = {
  network: string;
  account_name: string;
  account_handle: string | null;
  followers: number | null;
  follower_growth: number | null;
  follower_growth_rate: number | null;
  posts: number | null;
  interactions: number | null;
  engagement_rate: number | null;
  impressions: number | null;
  reach: number | null;
  performance_index: number | null;
  raw: Record<string, unknown>;
};

function socialRowFrom(
  r: Record<string, unknown>,
  fallbackNetwork?: string,
  fallbackAccount?: string
): SocialRow | null {
  const name =
    str(pick(r, ["Profile", "Perfil", "Página", "Page", "Cuenta", "Account", "Nombre"])) ??
    fallbackAccount ??
    null;
  if (!name) return null;
  const netRaw = pick(r, ["Network", "Red", "Plataforma", "Platform"]);
  const network = netRaw ? normalizeNetwork(netRaw) : normalizeNetwork(fallbackNetwork ?? "linkedin");
  return {
    network,
    account_name: name,
    account_handle: str(pick(r, ["Handle", "Usuario", "Username", "External Links", "URL"])),
    followers: num(pick(r, ["Seguidores", "Seguidor", "Followers", "Total de seguidores", "Total followers"])),
    follower_growth: num(pick(r, ["Nuevos seguidores", "New followers", "Crecimiento de seguidores absoluto"])),
    follower_growth_rate: rate(pick(r, ["Crecimiento de seguidores (en %)", "Crecimiento de seguidores", "Follower growth"])),
    posts: num(pick(r, ["Publicaciones", "Posts", "Número de publicaciones", "Publicaciones por día"])),
    interactions: num(pick(r, ["Interacciones", "Interactions", "Reacciones, Comentarios y Compartidos", "Reacciones"])),
    engagement_rate: rate(pick(r, ["Tasa de interacción", "Engagement Rate", "Tasa de participación", "Engagement rate"])),
    impressions: num(pick(r, ["Impresiones", "Impressions"])),
    reach: num(pick(r, ["Alcance", "Reach", "Alcance por día"])),
    performance_index: num(pick(r, ["Índice de Rendimiento", "Performance Index"])),
    raw: r,
  };
}

export async function parseSocialFile(
  file: File,
  fallbackNetwork?: string,
  fallbackAccount?: string
): Promise<SocialRow[]> {
  const { rows } = await loadTable(file);
  const out: SocialRow[] = [];
  for (const r of rows) {
    const s = socialRowFrom(r, fallbackNetwork, fallbackAccount);
    if (s) out.push(s);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Multi-month detection (wide exports with one column set per month)  */
/* ------------------------------------------------------------------ */

const MONTH_NAMES: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  sep: 9, sept: 9, septiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12,
};

/** Extracts a YYYY-MM token from a header/cell, plus the text with the token removed. */
export function extractMonthToken(value: unknown): { ym: string; rest: string } | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // ISO date / 2026-06 / 2026/06
  let m = raw.match(/(20\d{2})[-/.](\d{1,2})(?:[-/.]\d{1,2})?/);
  if (m) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return { ym: `${m[1]}-${String(mo).padStart(2, "0")}`, rest: raw.replace(m[0], " ").trim() };
  }
  // 06/2026 or 30/06/2026
  m = raw.match(/(?:(\d{1,2})[-/.])?(\d{1,2})[-/.](20\d{2})/);
  if (m) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return { ym: `${m[3]}-${String(mo).padStart(2, "0")}`, rest: raw.replace(m[0], " ").trim() };
  }
  // "junio 2026" / "Jun-26" / "Aug 2026"
  const norm = normalizeKey(raw);
  m = norm.match(/\b([a-z]{3,10})\b[ ]?(20\d{2}|\d{2})\b/);
  if (m && MONTH_NAMES[m[1]]) {
    const yr = m[2].length === 2 ? `20${m[2]}` : m[2];
    const token = new RegExp(`${m[1]}[a-z]*[^a-z0-9]*${m[2]}`, "i");
    return { ym: `${yr}-${String(MONTH_NAMES[m[1]]).padStart(2, "0")}`, rest: raw.replace(token, " ").trim() };
  }
  return null;
}

export type MonthGroup = { ym: string | null; rows: SocialRow[] };

function cleanBase(s: string): string {
  return s.replace(/[\s·–—:_-]+$/g, "").replace(/^[\s·–—:_-]+/g, "").replace(/\(\s*\)/g, "").trim();
}

/**
 * Splits a social export into one group per month when possible:
 *  a) a per-row date/month column ("Fecha", "Mes", "Periodo"), or
 *  b) wide columns carrying a month token ("Seguidores 06/2026").
 * Falls back to a single group with ym = null (caller uses the selected period).
 */
export async function parseSocialFileByMonth(
  file: File,
  fallbackNetwork?: string,
  fallbackAccount?: string
): Promise<MonthGroup[]> {
  const { header, rows } = await loadTable(file);
  if (!rows.length) return [];

  // (a) per-row date column
  const dateCol = header.find((h) => ["fecha", "mes", "periodo", "period", "date", "month"].includes(normalizeKey(h)));
  if (dateCol) {
    const byMonth = new Map<string, Record<string, unknown>[]>();
    let matched = 0;
    for (const r of rows) {
      const tok = extractMonthToken(r[dateCol]);
      if (!tok) continue;
      matched++;
      byMonth.set(tok.ym, [...(byMonth.get(tok.ym) ?? []), r]);
    }
    if (matched >= rows.length * 0.6 && byMonth.size > 0) {
      return [...byMonth.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([ym, rs]) => ({
          ym,
          rows: rs.map((r) => socialRowFrom(r, fallbackNetwork, fallbackAccount)).filter(Boolean) as SocialRow[],
        }))
        .filter((g) => g.rows.length > 0);
    }
  }

  // (b) wide month columns
  const monthCols = new Map<string, { col: string; base: string }[]>();
  const staticCols: string[] = [];
  for (const h of header) {
    if (!h) continue;
    const tok = extractMonthToken(h);
    const base = tok ? cleanBase(tok.rest) : "";
    if (tok && base) {
      monthCols.set(tok.ym, [...(monthCols.get(tok.ym) ?? []), { col: h, base }]);
    } else {
      staticCols.push(h);
    }
  }
  if (monthCols.size > 1) {
    return [...monthCols.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, cols]) => {
        const out: SocialRow[] = [];
        for (const r of rows) {
          const flat: Record<string, unknown> = {};
          staticCols.forEach((c) => { flat[c] = r[c]; });
          cols.forEach(({ col, base }) => { flat[base] = r[col]; });
          const s = socialRowFrom(flat, fallbackNetwork, fallbackAccount);
          if (s) out.push(s);
        }
        return { ym, rows: out };
      })
      .filter((g) => g.rows.length > 0);
  }

  // fallback: single period
  const single = rows.map((r) => socialRowFrom(r, fallbackNetwork, fallbackAccount)).filter(Boolean) as SocialRow[];
  return single.length ? [{ ym: null, rows: single }] : [];
}



/* ------------------------------------------------------------------ */
/* Web analytics (GA4)                                                 */
/* ------------------------------------------------------------------ */

export type WebChannel = { channel: string; sessions: number | null; users: number | null };
export type WebTotals = {
  users: number | null;
  new_users: number | null;
  sessions: number | null;
  pageviews: number | null;
  avg_session_seconds: number | null;
  bounce_rate: number | null;
  conversions: number | null;
  channels: WebChannel[];
};

const CHANNEL_ALIASES = [
  "Canal predeterminado",
  "Default channel group",
  "Grupo de canales",
  "Canal",
  "Session default channel group",
  "Source / medium",
  "Origen / medio",
];

export async function parseWebFile(file: File): Promise<WebTotals> {
  const { rows } = await loadTable(file);
  const channels: WebChannel[] = [];
  const totals: WebTotals = {
    users: null,
    new_users: null,
    sessions: null,
    pageviews: null,
    avg_session_seconds: null,
    bounce_rate: null,
    conversions: null,
    channels: [],
  };

  let sumSessions = 0;
  let sumUsers = 0;
  let sumNew = 0;
  let sumViews = 0;
  let sumConv = 0;
  let weightedDur = 0;
  let weightedBounce = 0;
  let n = 0;

  for (const r of rows) {
    const channel = str(pick(r, CHANNEL_ALIASES));
    const sessions = num(pick(r, ["Sesiones", "Sessions"]));
    const users = num(pick(r, ["Usuarios activos", "Usuarios totales", "Usuarios", "Active users", "Total users", "Users"]));
    const newUsers = num(pick(r, ["Usuarios nuevos", "New users"]));
    const views = num(pick(r, ["Vistas", "Vistas de página", "Views", "Page views", "Pageviews"]));
    const conv = num(pick(r, ["Conversiones", "Conversions", "Eventos clave", "Key events"]));
    const dur = num(pick(r, ["Duración media", "Duración media de la interacción", "Average session duration", "Tiempo de interacción"]));
    const bounce = rate(pick(r, ["Tasa de rebote", "Bounce rate", "Porcentaje de rebote"]));
    if (sessions == null && users == null) continue;

    n++;
    sumSessions += sessions ?? 0;
    sumUsers += users ?? 0;
    sumNew += newUsers ?? 0;
    sumViews += views ?? 0;
    sumConv += conv ?? 0;
    const w = sessions ?? users ?? 1;
    if (dur != null) weightedDur += dur * w;
    if (bounce != null) weightedBounce += bounce * w;

    if (channel) channels.push({ channel, sessions, users });
  }

  if (!n) return totals;
  const weight = sumSessions || sumUsers || n;
  totals.users = sumUsers || null;
  totals.new_users = sumNew || null;
  totals.sessions = sumSessions || null;
  totals.pageviews = sumViews || null;
  totals.conversions = sumConv || null;
  totals.avg_session_seconds = weightedDur ? Math.round(weightedDur / weight) : null;
  totals.bounce_rate = weightedBounce ? Number((weightedBounce / weight).toFixed(2)) : null;
  totals.channels = channels.sort((a, b) => (b.sessions ?? 0) - (a.sessions ?? 0)).slice(0, 12);
  return totals;
}

/* ------------------------------------------------------------------ */
/* Ads                                                                 */
/* ------------------------------------------------------------------ */

export type AdsRow = {
  campaign_name: string;
  objective: string | null;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  results: number | null;
  result_type: string | null;
  cost_per_result: number | null;
  conversions: number | null;
  raw: Record<string, unknown>;
};

export function detectAdPlatform(header: string[]): AdPlatform | null {
  const h = header.map(normalizeKey).join(" | ");
  if (h.includes("nombre del conjunto de anuncios") || h.includes("ad set name") || h.includes("entrega de la campana")) return "meta";
  if (h.includes("grupo de anuncios") || h.includes("ad group") || h.includes("nivel de optimizacion")) return "google";
  if (h.includes("nombre del grupo de anuncios tiktok") || h.includes("adgroup name")) return "tiktok";
  if (h.includes("tweet") || h.includes("engagements")) return "x";
  return null;
}

export async function parseAdsFile(file: File): Promise<{ platform: AdPlatform | null; rows: AdsRow[] }> {
  const { header, rows } = await loadTable(file);
  const platform = detectAdPlatform(header);
  const out: AdsRow[] = [];
  for (const r of rows) {
    const name = str(pick(r, ["Nombre de la campaña", "Campaign name", "Campaña", "Campaign", "Nombre"]));
    if (!name) continue;
    const spend = num(pick(r, ["Importe gastado", "Inversión", "Costo", "Cost", "Amount spent", "Gasto", "Spend"]));
    const impressions = num(pick(r, ["Impresiones", "Impressions", "Impr."]));
    const clicks = num(pick(r, ["Clics", "Clicks", "Clics en el enlace", "Link clicks"]));
    const results = num(pick(r, ["Resultados", "Results", "Conversiones", "Conversions"]));
    out.push({
      campaign_name: name,
      objective: str(pick(r, ["Objetivo", "Objective", "Tipo de campaña", "Campaign type"])),
      spend,
      impressions,
      reach: num(pick(r, ["Alcance", "Reach"])),
      clicks,
      ctr: rate(pick(r, ["CTR", "Porcentaje de clics", "Click-through rate"])),
      cpc: num(pick(r, ["CPC", "Costo por clic", "Cost per click", "Avg. CPC"])),
      cpm: num(pick(r, ["CPM", "Costo por mil impresiones"])),
      results,
      result_type: str(pick(r, ["Tipo de resultado", "Indicador de resultados", "Result type"])),
      cost_per_result: num(pick(r, ["Costo por resultado", "Cost per result"])),
      conversions: num(pick(r, ["Conversiones", "Conversions"])),
      raw: r,
    });
  }
  return { platform, rows: out };
}

/* ------------------------------------------------------------------ */
/* Meta Business Suite (exports diarios de Estadísticas)               */
/* ------------------------------------------------------------------ */

export type MetaAudience = {
  age_gender: { bucket: string; men: number | null; women: number | null }[];
  cities: { name: string; share: number | null }[];
  countries: { name: string; share: number | null }[];
};

export type MetaMonth = {
  ym: string;
  days: number;
  follower_growth: number | null;
  impressions: number | null;
  reach: number | null;
  interactions: number | null;
  visits: number | null;
  link_clicks: number | null;
};

export type MetaBusinessParse = {
  network: string;
  months: MetaMonth[];
  audience: MetaAudience | null;
  recognized: { file: string; metric: string; network: string | null }[];
  ignored: string[];
};

/** Meta exporta CSV en UTF-16 con una primera línea `sep=,`. */
async function readMetaText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const looksUtf16 =
    (bytes[0] === 0xff && bytes[1] === 0xfe) ||
    (bytes.length > 4 && bytes[1] === 0 && bytes[3] === 0);
  const text = new TextDecoder(looksUtf16 ? "utf-16le" : "utf-8").decode(bytes);
  return text.replace(/^\uFEFF/, "").replace(/^sep=.*\r?\n/i, "");
}

function parseCsvLines(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const cells: string[] = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
          else quoted = !quoted;
        } else if (ch === "," && !quoted) { cells.push(cur); cur = ""; }
        else cur += ch;
      }
      cells.push(cur);
      return cells.map((c) => c.trim());
    });
}

type MetaMetricKey = "follower_growth" | "impressions" | "reach" | "interactions" | "visits" | "link_clicks";

/** Traduce el título del export (o el nombre del archivo) a una métrica conocida. */
function metaMetricOf(title: string): MetaMetricKey | null {
  const k = normalizeKey(title);
  if (k.includes("seguidores")) return "follower_growth";
  if (k.includes("visualizaciones") || k.includes("views") || k.includes("impresiones")) return "impressions";
  if (k.includes("espectadores") || k.includes("alcance") || k.includes("personas alcanzadas") || k.includes("reach")) return "reach";
  if (k.includes("interacciones")) return "interactions";
  if (k.includes("visitas") || k.includes("visits")) return "visits";
  if (k.includes("clics")) return "link_clicks";
  return null;
}

function metaNetworkOf(title: string): string | null {
  const k = normalizeKey(title);
  if (k.includes("instagram")) return "instagram";
  if (k.includes("facebook")) return "facebook";
  return null;
}

function parseAudience(lines: string[][]): MetaAudience | null {
  const out: MetaAudience = { age_gender: [], cities: [], countries: [] };
  let section: "age" | "cities" | "countries" | null = null;
  let pendingNames: string[] | null = null;

  for (const row of lines) {
    const first = normalizeKey(row[0] ?? "");
    const isTitle = row.filter((c) => c !== "").length === 1;
    if (isTitle) {
      if (first.includes("edad")) section = "age";
      else if (first.includes("ciudades")) { section = "cities"; pendingNames = null; }
      else if (first.includes("paises")) { section = "countries"; pendingNames = null; }
      else section = null;
      continue;
    }
    if (!section || row.every((c) => c === "")) continue;

    if (section === "age") {
      if (!/\d/.test(row[0] ?? "")) continue; // fila de encabezado "", Hombres, Mujeres
      out.age_gender.push({ bucket: row[0], men: num(row[1]), women: num(row[2]) });
      continue;
    }
    const numeric = row.every((c) => c === "" || num(c) != null);
    if (!numeric) { pendingNames = row.filter((c) => c !== ""); continue; }
    if (pendingNames) {
      const values = row.filter((c) => c !== "");
      const list = pendingNames.map((name, i) => ({ name, share: num(values[i]) }));
      if (section === "cities") out.cities = list;
      else out.countries = list;
      pendingNames = null;
    }
  }
  return out.age_gender.length || out.cities.length || out.countries.length ? out : null;
}

/**
 * Lee uno o varios exports diarios de Meta Business (Seguidores, Visualizaciones,
 * Interacciones, Visitas, Clics, Espectadores, Público) y los agrega por mes.
 */
export async function parseMetaBusinessFiles(
  files: File[],
  fallbackNetwork = "facebook"
): Promise<MetaBusinessParse> {
  const byMonth = new Map<string, MetaMonth>();
  const recognized: MetaBusinessParse["recognized"] = [];
  const ignored: string[] = [];
  let audience: MetaAudience | null = null;
  let network: string | null = null;

  for (const file of files) {
    const lines = parseCsvLines(await readMetaText(file)).filter((r) => r.some((c) => c !== ""));
    if (!lines.length) { ignored.push(file.name); continue; }

    const title = lines[0]?.[0] ?? "";
    const isSeries = lines.some((r) => /^20\d{2}-\d{2}-\d{2}/.test(r[0] ?? ""));

    if (!isSeries) {
      const aud = parseAudience(lines);
      if (aud) { audience = aud; recognized.push({ file: file.name, metric: "Público", network: null }); }
      else ignored.push(file.name);
      continue;
    }

    const metric = metaMetricOf(title) ?? metaMetricOf(file.name);
    if (!metric) { ignored.push(file.name); continue; }
    network = network ?? metaNetworkOf(title) ?? metaNetworkOf(file.name);

    for (const row of lines) {
      const m = (row[0] ?? "").match(/^(20\d{2})-(\d{2})-\d{2}/);
      if (!m) continue;
      const value = num(row[1]);
      if (value == null) continue;
      const ym = `${m[1]}-${m[2]}`;
      const bucket =
        byMonth.get(ym) ??
        { ym, days: 0, follower_growth: null, impressions: null, reach: null, interactions: null, visits: null, link_clicks: null };
      bucket[metric] = (bucket[metric] ?? 0) + value;
      if (metric === "impressions") bucket.days += 1;
      byMonth.set(ym, bucket);
    }
    recognized.push({ file: file.name, metric: title || file.name, network: metaNetworkOf(title) });
  }

  return {
    network: network ?? normalizeNetwork(fallbackNetwork),
    months: [...byMonth.values()].sort((a, b) => a.ym.localeCompare(b.ym)),
    audience,
    recognized,
    ignored,
  };
}
/* ------------------------------------------------------------------ */
/* Period helpers                                                      */
/* ------------------------------------------------------------------ */

export function monthBounds(ym: string): { start: string; end: string; label: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const label = start.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
}

export function periodLabel(start: string, end: string): string {
  const f = (d: string) =>
    new Date(d + "T12:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${f(start)} – ${f(end)}`;
}
