import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { format as formatDate } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, FileSpreadsheet, Loader2, X, Info, CheckCircle2, AlertTriangle, CalendarIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { FKNetwork } from "@/hooks/useFanpageKarma";
import { cn } from "@/lib/utils";
import { canonicalizeFKProfileIdentity, normalizeFKText, prettifyFKIdentifier } from "@/lib/fkProfileUtils";

interface Props {
  clientId: string;
}

type FileKind = "kpis" | "posts" | "unknown";

interface DetectedFile {
  file: File;
  kind: FileKind;
  rowCount: number;
  /** Auto-detected from Excel metadata, if found */
  detectedPeriodStart?: Date;
  detectedPeriodEnd?: Date;
  /** Min/Max published_at extraído si el archivo es de Posts. Se usa para auto-rellenar
   *  el período de KPIs del mismo lote cuando éstos no traen metadata. */
  postsMinDate?: Date;
  postsMaxDate?: Date;
  /** User overrides (only relevant for KPIs). Default: últimos 28 días si no hay metadata. */
  periodStart?: Date;
  periodEnd?: Date;
  /** Origen del período actualmente aplicado al archivo de KPIs.
   *  - "metadata": detectado del propio Excel de KPIs
   *  - "posts": auto-rellenado desde el min/max de un archivo de Posts del mismo lote
   *  - "manual": el usuario lo ajustó
   *  - "default": fallback "últimos 28 días" */
  periodSource?: "metadata" | "posts" | "manual" | "default";
  /** @deprecated mantener por compatibilidad; equivalente a periodSource === "default" */
  periodIsDefault?: boolean;
}

const NETWORK_DETECT: Record<string, FKNetwork> = {
  facebook: "facebook", fb: "facebook",
  instagram: "instagram", ig: "instagram",
  youtube: "youtube", yt: "youtube",
  twitter: "twitter", x: "twitter",
  tiktok: "tiktok",
  linkedin: "linkedin",
  threads: "threads",
};

// Header keywords (Spanish + English) for FK exports
const KPI_KEYS = [
  "fans", "seguidor", "seguidores", "followers", "subscribers",
  "ppi", "rendimiento", "performance index", "indice de rendimiento",
  "growth", "crecimiento",
  "posts per day", "publicaciones por dia",
];
const POST_KEYS = [
  "message", "mensaje", "post",
  "interactions", "interacciones",
  "alcance por publicacion", "post interaction",
  "reacciones, comentarios y compartidos",
  "numero de me gusta", "numero de comentarios",
];

function normalizeKey(s: string): string {
  return normalizeFKText(s);
}

/**
 * Genera claves de búsqueda para resolver un perfil. Si `canonicalName` está
 * presente, se emite como **primera** clave con prefijo `canonical_anchor::`,
 * que tiene prioridad absoluta sobre cualquier otra heurística.
 */
function buildCandidateKeys(
  network: FKNetwork | string,
  displayName: string,
  profileId?: string | null,
  canonicalName?: string | null,
): string[] {
  const keys: string[] = [];

  // 1. Ancla canónica (prioridad máxima)
  const canon = (canonicalName || "").trim();
  if (canon) {
    keys.push(`${network}::canonical_anchor::${normalizeKey(canon)}`);
  }

  // 2. Heurísticas previas
  const candidates = [displayName, profileId || "", prettifyFKIdentifier(displayName), prettifyFKIdentifier(profileId || "")]
    .map((value) => value.trim())
    .filter(Boolean);

  const seen = new Set(keys);
  candidates.forEach((value) => {
    const k1 = `${network}::name::${normalizeKey(value)}`;
    const k2 = `${network}::canonical::${canonicalizeFKProfileIdentity(value)}`;
    if (!seen.has(k1)) { keys.push(k1); seen.add(k1); }
    if (!seen.has(k2)) { keys.push(k2); seen.add(k2); }
  });

  return keys;
}

/** Devuelve "unknown" cuando no podemos identificar la red (en lugar de
 * marcar silenciosamente como Facebook, lo que contamina el análisis). */
function detectNetwork(value: any): FKNetwork | "unknown" {
  const raw = normalizeKey(String(value || "")).trim();
  if (!raw) return "unknown";
  for (const [k, v] of Object.entries(NETWORK_DETECT)) {
    if (raw.includes(k)) return v;
  }
  return "unknown";
}

function parseNumeric(val: any): number | null {
  if (val == null || val === "" || val === "-") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const s = String(val).replace(/[%,\s]/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function readSheetWithHeaderDetection(sheet: XLSX.WorkSheet): { rows: Record<string, any>[]; kind: FileKind; headerRows: any[][] } {
  const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
  let headerIdx = -1;
  let kind: FileKind = "unknown";

  // Scan first 15 rows looking for the header row
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i].map((c) => normalizeKey(String(c || "")));
    const hasProfileCol = row.some((c) => c === "profile" || c === "perfil" || c === "page" || c === "name" || c === "nombre");
    if (!hasProfileCol) continue;

    // Posts have a "date/fecha" column; KPIs do not (they aggregate the whole period)
    const hasDateCol = row.some((c) => c === "date" || c === "fecha" || c.includes("published") || c.includes("publicado"));
    const hasMessageCol = row.some((c) => c === "message" || c === "mensaje" || c.includes("contenido"));
    const looksPost = hasDateCol || hasMessageCol || POST_KEYS.some((k) => row.some((c) => c.includes(k)));
    const looksKpi = !looksPost && KPI_KEYS.some((k) => row.some((c) => c.includes(k)));

    if (looksPost) { headerIdx = i; kind = "posts"; break; }
    if (looksKpi) { headerIdx = i; kind = "kpis"; break; }
  }

  if (headerIdx === -1) return { rows: [], kind: "unknown", headerRows: matrix.slice(0, Math.min(matrix.length, 6)) };

  const headers = matrix[headerIdx].map((h) => String(h ?? "").trim());
  const dataRows = matrix.slice(headerIdx + 1).filter((r) => r.some((c) => c !== "" && c != null));
  const rows = dataRows.map((r) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => { if (h) obj[h] = r[i]; });
    return obj;
  });
  return { rows, kind, headerRows: matrix.slice(0, headerIdx) };
}

/**
 * Try to detect the data period from the metadata rows above the table header.
 * FK exports usually include something like:
 *   "Period: 2026-03-01 - 2026-03-31"
 *   "Periodo: 01.03.2026 - 31.03.2026"
 *   "From 2026-03-01 to 2026-03-31"
 */
function detectPeriodFromMeta(headerRows: any[][]): { start?: Date; end?: Date } {
  const flat = headerRows
    .flat()
    .map((c) => String(c ?? "").trim())
    .filter(Boolean)
    .join(" | ");
  if (!flat) return {};

  // Spanish + English month abbreviations
  const MONTHS: Record<string, number> = {
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

  // Try numeric format first: 2026-03-01 - 2026-03-31 / 01.03.2026 - 31.03.2026
  const numericRe = /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})/g;
  const numMatches = flat.match(numericRe);
  const parseNum = (s: string): Date | null => {
    const norm = s.replace(/\./g, "-").replace(/\//g, "-");
    const parts = norm.split("-").map((x) => parseInt(x, 10));
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    let y: number, m: number, d: number;
    if (parts[0] > 31) { [y, m, d] = parts; }
    else { [d, m, y] = parts; if (y < 100) y += 2000; }
    const dt = new Date(Date.UTC(y, m - 1, d));
    return isNaN(dt.getTime()) ? null : dt;
  };
  if (numMatches && numMatches.length >= 2) {
    const d1 = parseNum(numMatches[0]);
    const d2 = parseNum(numMatches[1]);
    if (d1 && d2) return d1 <= d2 ? { start: d1, end: d2 } : { start: d2, end: d1 };
  }

  // Try worded format: "1 mar 2026 - 20 abr 2026" (ES) or "Mar 1, 2026" (EN)
  const wordedRe = /(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ\.]+)\s*(?:de\s+)?(\d{2,4})/gi;
  const dates: Date[] = [];
  let m: RegExpExecArray | null;
  while ((m = wordedRe.exec(flat)) !== null) {
    const day = parseInt(m[1], 10);
    const monKey = normalizeKey(m[2]).replace(/\./g, "");
    const mon = MONTHS[monKey] ?? MONTHS[monKey.slice(0, 3)];
    let yr = parseInt(m[3], 10);
    if (!mon || isNaN(day) || isNaN(yr)) continue;
    if (yr < 100) yr += 2000;
    const dt = new Date(Date.UTC(yr, mon - 1, day));
    if (!isNaN(dt.getTime())) dates.push(dt);
    if (dates.length >= 2) break;
  }
  if (dates.length >= 2) {
    const [a, b] = dates;
    return a <= b ? { start: a, end: b } : { start: b, end: a };
  }
  return {};
}

function pickField(row: Record<string, any>, candidates: string[]): any {
  for (const k of Object.keys(row)) {
    const nk = normalizeKey(k);
    for (const c of candidates) {
      if (nk === c || nk.includes(c)) return row[k];
    }
  }
  return null;
}

interface KpiRow {
  profileId: string;
  displayName: string;
  network: FKNetwork | "unknown";
  followers: number | null;
  engagementRate: number | null;
  postsPerDay: number | null;
  pagePerformanceIndex: number | null;
  followerGrowthPercent: number | null;
  reachPerDay: number | null;
  impressionsPerInteraction: number | null;
}

interface PostRow {
  profileId: string;
  displayName: string;
  network: FKNetwork | "unknown";
  externalId: string | null;
  publishedAt: string;
  message: string | null;
  link: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagement: number | null;
  reach: number | null;
  interactionRate: number | null;
  postType: string | null;
  raw: Record<string, any>;
}

function mapKpiRow(row: Record<string, any>): KpiRow | null {
  // FK exports: column "Profile" usually has the display name, "Profile-ID" has the real platform ID
  const profileIdRaw = String(pickField(row, ["profile-id", "profile id", "page id", "page-id"]) || "").trim();
  const displayName = String(pickField(row, ["profile", "perfil", "page name", "name", "nombre", "page"]) || "").trim();
  if (!profileIdRaw && !displayName) return null;
  const networkRaw = pickField(row, ["network", "platform", "red", "plattform"]);
  const profileId = (profileIdRaw || displayName).replace(/^@/, "");
  return {
    profileId,
    displayName: displayName || profileId,
    network: detectNetwork(networkRaw),
    followers: parseNumeric(pickField(row, ["seguidor", "fans", "followers", "subscribers"])),
    engagementRate: parseNumeric(pickField(row, ["tasa de interaccion", "engagement rate", "engagement"])),
    postsPerDay: parseNumeric(pickField(row, ["publicaciones por dia", "posts per day", "posts/day"])),
    pagePerformanceIndex: parseNumeric(pickField(row, ["indice de rendimiento", "ppi", "page performance index", "rendimiento"])),
    followerGrowthPercent: parseNumeric(pickField(row, ["crecimiento de seguidores", "growth_percentage", "growth", "crecimiento", "fan growth"])),
    reachPerDay: parseNumeric(pickField(row, ["alcance por dia", "reach per day"])),
    impressionsPerInteraction: parseNumeric(pickField(row, ["interaccion por impresion", "post_interaction", "post interaction", "impresiones por interaccion"])),
  };
}

function parseDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0)).toISOString();
  }
  const d = new Date(String(v));
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

function mapPostRow(row: Record<string, any>): PostRow | null {
  const dateVal = pickField(row, ["date", "fecha", "published"]);
  const publishedAt = parseDate(dateVal);
  if (!publishedAt) return null;
  // For posts, FK puts the display name in "Profile" column
  const displayName = String(pickField(row, ["profile", "perfil", "page name", "name", "nombre"]) || "").trim();
  if (!displayName) return null;
  const networkRaw = pickField(row, ["network", "platform", "red"]);
  const externalIdRaw = String(pickField(row, ["message-id", "message id", "post id", "post-id", "external id", "external-id", "id"]) || "").trim();
  return {
    profileId: displayName.replace(/^@/, ""),
    displayName,
    network: detectNetwork(networkRaw),
    externalId: externalIdRaw || null,
    publishedAt,
    message: String(pickField(row, ["message", "mensaje", "content", "contenido", "text"]) || "") || null,
    link: String(pickField(row, ["link", "url", "permalink"]) || "") || null,
    likes: parseNumeric(pickField(row, ["numero de me gusta", "likes", "me gusta", "reactions"])),
    comments: parseNumeric(pickField(row, ["numero de comentarios", "comments", "comentarios"])),
    shares: parseNumeric(pickField(row, ["compartidos", "shares", "retweets"])),
    engagement: parseNumeric(pickField(row, ["reacciones, comentarios y compartidos", "interactions", "interacciones", "engagement"])),
    reach: parseNumeric(pickField(row, ["alcance por publicacion", "reach", "alcance"])),
    interactionRate: parseNumeric(pickField(row, ["tasa de interaccion", "interaction rate"])),
    postType: String(pickField(row, ["type", "tipo", "post type"]) || "") || null,
    raw: row,
  };
}

async function detectFile(file: File): Promise<DetectedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  let kind: FileKind = "unknown";
  let rowCount = 0;
  let detectedStart: Date | undefined;
  let detectedEnd: Date | undefined;
  let postsMin: Date | undefined;
  let postsMax: Date | undefined;

  for (const name of wb.SheetNames) {
    const { rows, kind: k, headerRows } = readSheetWithHeaderDetection(wb.Sheets[name]);
    if (k !== "unknown") {
      kind = k;
      rowCount += rows.length;
      // Detect period from metadata for both KPIs and Posts
      if (!detectedStart) {
        const period = detectPeriodFromMeta(headerRows);
        detectedStart = period.start;
        detectedEnd = period.end;
      }
      // Para archivos de Posts, calculamos min/max de las fechas reales de publicación
      // — esto se usará para auto-rellenar el período de KPIs del mismo lote.
      if (k === "posts") {
        for (const r of rows) {
          const dateVal = pickField(r, ["date", "fecha", "published"]);
          const iso = parseDate(dateVal);
          if (!iso) continue;
          const d = new Date(iso);
          if (isNaN(d.getTime())) continue;
          if (!postsMin || d < postsMin) postsMin = d;
          if (!postsMax || d > postsMax) postsMax = d;
        }
      }
    }
  }

  // Período inicial para KPIs según prioridad: metadata del archivo > default 28 días.
  // El "auto desde Posts" se aplica después en un segundo pase, cuando ya conocemos
  // todos los archivos del lote (ver `applyBatchPeriodInference`).
  let periodStart = detectedStart;
  let periodEnd = detectedEnd;
  let periodSource: DetectedFile["periodSource"] | undefined;
  if (kind === "kpis") {
    if (periodStart && periodEnd) {
      periodSource = "metadata";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(today);
      start.setDate(today.getDate() - 27); // 28 días incluyendo hoy
      periodStart = start;
      periodEnd = today;
      periodSource = "default";
    }
  }

  return {
    file,
    kind,
    rowCount,
    detectedPeriodStart: detectedStart,
    detectedPeriodEnd: detectedEnd,
    postsMinDate: postsMin,
    postsMaxDate: postsMax,
    periodStart,
    periodEnd,
    periodSource,
    periodIsDefault: periodSource === "default",
  };
}

/**
 * Auto-rellena el período de los archivos de KPIs del lote usando los archivos
 * de Posts presentes. Prioridad por archivo de KPIs:
 *   1) "manual"   → respeta lo que el usuario tocó
 *   2) "metadata" → respeta lo detectado del propio Excel
 *   3) min/max de Posts del lote (si hay al menos un archivo de Posts con fechas)
 *   4) "default"  → últimos 28 días (fallback ya aplicado por detectFile)
 */
function applyBatchPeriodInference(list: DetectedFile[]): DetectedFile[] {
  // Unificamos el rango de TODOS los Posts del lote (min de mins, max de maxes)
  let batchMin: Date | undefined;
  let batchMax: Date | undefined;
  for (const f of list) {
    if (f.kind !== "posts") continue;
    if (f.postsMinDate && (!batchMin || f.postsMinDate < batchMin)) batchMin = f.postsMinDate;
    if (f.postsMaxDate && (!batchMax || f.postsMaxDate > batchMax)) batchMax = f.postsMaxDate;
  }
  if (!batchMin || !batchMax) return list;

  return list.map((f) => {
    if (f.kind !== "kpis") return f;
    // No pisamos manual ni metadata
    if (f.periodSource === "manual" || f.periodSource === "metadata") return f;
    return {
      ...f,
      periodStart: batchMin,
      periodEnd: batchMax,
      periodSource: "posts",
      periodIsDefault: false,
    };
  });
}

/** Resumen post-import por archivo procesado. Se muestra en un accordion para
 * que el usuario vea exactamente qué llegó a base de datos y qué se descartó. */
interface ImportFileReport {
  fileName: string;
  kind: FileKind;
  rowsRead: number;
  resolvedProfiles: number;
  unresolvedProfiles: string[];
  unknownNetworkProfiles: string[];
  kpisInserted: number;
  kpisDiscarded: number;
  postsInserted: number;
  postsDiscarded: number;
  topPostsUpserted: number;
  profilesWithoutKpis: string[];
  errors: string[];
}

/**
 * Fila de la tabla de anclaje. Una por (network, displayName) detectado en
 * los archivos. El usuario puede editar `canonicalName` antes de confirmar.
 */
interface AnchorRow {
  key: string; // network::normalizedDisplayName
  network: FKNetwork;
  detectedDisplayName: string;
  detectedProfileId: string;
  canonicalName: string;
  matchedProfileId: string | null; // ID de fk_profiles si ya existe
  isNew: boolean; // true si no se encontró match (perfil nuevo no reconocido)
  matchedBy: "anchor" | "heuristic" | null;
  discarded: boolean;
}

export function FKExcelImporter({ clientId }: Props) {
  const [files, setFiles] = useState<DetectedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [overlapInfo, setOverlapInfo] = useState<{
    overlaps: Array<{ profileName: string; network: string; existing: string; incoming: string }>;
  } | null>(null);
  const [importLog, setImportLog] = useState<ImportFileReport[] | null>(null);
  const [anchorRows, setAnchorRows] = useState<AnchorRow[] | null>(null);
  const [anchoring, setAnchoring] = useState(false);
  /** Mapa pre-resuelto tras el anclaje: `${network}::canonical_anchor::${normalize(canonical_name)}` → fk_profile_id */
  const resolvedAnchorMapRef = useRef<Map<string, string> | null>(null);
  const qc = useQueryClient();

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const detected = await Promise.all(arr.map(detectFile));
    const known = detected.filter((d) => d.kind !== "unknown");
    if (known.length < detected.length) {
      toast({
        title: "Algunos archivos no se reconocieron",
        description: `${detected.length - known.length} archivo(s) sin formato KPIs ni Posts.`,
        variant: "destructive",
      });
    }
    setFiles((prev) => applyBatchPeriodInference([...prev, ...detected]));
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (i: number) =>
    setFiles((prev) => applyBatchPeriodInference(prev.filter((_, idx) => idx !== i)));
  const setPeriodStart = (i: number, d?: Date) =>
    setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, periodStart: d, periodSource: "manual", periodIsDefault: false } : f)));
  const setPeriodEnd = (i: number, d?: Date) =>
    setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, periodEnd: d, periodSource: "manual", periodIsDefault: false } : f)));

  // Con default automático (28d) ya nunca debería faltar período, pero conservamos
  // el guard por si el usuario borra manualmente las fechas.
  const missingPeriod = files.some(
    (f) => f.kind === "kpis" && (!f.periodStart || !f.periodEnd)
  );

  /**
   * Extrae todos los perfiles únicos detectados en los archivos cargados,
   * agrupados por (network, normalizedDisplayName).
   */
  const extractDetectedProfiles = async (): Promise<Array<{ network: FKNetwork; displayName: string; profileId: string }>> => {
    const seen = new Map<string, { network: FKNetwork; displayName: string; profileId: string }>();
    for (const f of files) {
      if (f.kind === "unknown") continue;
      const buf = await f.file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      for (const sheetName of wb.SheetNames) {
        const { rows, kind } = readSheetWithHeaderDetection(wb.Sheets[sheetName]);
        if (kind === "unknown") continue;
        for (const r of rows) {
          const m = kind === "kpis" ? mapKpiRow(r) : mapPostRow(r);
          if (!m || m.network === "unknown") continue;
          const key = `${m.network}::${normalizeKey(m.displayName || m.profileId)}`;
          if (!seen.has(key)) {
            seen.set(key, {
              network: m.network as FKNetwork,
              displayName: m.displayName || m.profileId,
              profileId: m.profileId,
            });
          }
        }
      }
    }
    return Array.from(seen.values());
  };

  /**
   * Paso de anclaje: detecta perfiles, los confronta con BD usando
   * canonical_name primero, y muestra la tabla editable de confirmación.
   */
  const openAnchoring = async () => {
    setAnchoring(true);
    try {
      const detected = await extractDetectedProfiles();
      if (detected.length === 0) {
        // Sin perfiles detectables → continuar sin anclaje
        return proceedAfterAnchoring();
      }
      const { data: existing } = await supabase
        .from("fk_profiles")
        .select("id, network, profile_id, display_name, canonical_name")
        .eq("client_id", clientId);

      // Indexamos por anchor (prioridad) y por heurísticas (fallback)
      const byAnchor = new Map<string, { id: string; canonical: string }>();
      const byHeuristic = new Map<string, { id: string; canonical: string }>();
      (existing || []).forEach((e: any) => {
        const canon = e.canonical_name || e.display_name || e.profile_id;
        if (e.canonical_name) {
          byAnchor.set(`${e.network}::canonical_anchor::${normalizeKey(e.canonical_name)}`, { id: e.id, canonical: canon });
        }
        buildCandidateKeys(e.network, e.display_name || e.profile_id, e.profile_id).forEach((k) => {
          if (!byHeuristic.has(k)) byHeuristic.set(k, { id: e.id, canonical: canon });
        });
      });

      const rows: AnchorRow[] = detected.map((d) => {
        const anchorKey = `${d.network}::canonical_anchor::${normalizeKey(d.displayName)}`;
        const hit = byAnchor.get(anchorKey);
        if (hit) {
          return {
            key: `${d.network}::${normalizeKey(d.displayName)}`,
            network: d.network,
            detectedDisplayName: d.displayName,
            detectedProfileId: d.profileId,
            canonicalName: hit.canonical,
            matchedProfileId: hit.id,
            isNew: false,
            matchedBy: "anchor",
            discarded: false,
          };
        }
        const heur = buildCandidateKeys(d.network, d.displayName, d.profileId)
          .map((k) => byHeuristic.get(k))
          .find(Boolean);
        if (heur) {
          return {
            key: `${d.network}::${normalizeKey(d.displayName)}`,
            network: d.network,
            detectedDisplayName: d.displayName,
            detectedProfileId: d.profileId,
            canonicalName: heur.canonical,
            matchedProfileId: heur.id,
            isNew: false,
            matchedBy: "heuristic",
            discarded: false,
          };
        }
        return {
          key: `${d.network}::${normalizeKey(d.displayName)}`,
          network: d.network,
          detectedDisplayName: d.displayName,
          detectedProfileId: d.profileId,
          canonicalName: prettifyFKIdentifier(d.displayName) || d.displayName,
          matchedProfileId: null,
          isNew: true,
          matchedBy: null,
          discarded: false,
        };
      });
      setAnchorRows(rows);
    } catch (err: any) {
      console.error("Anchoring detection error", err);
      toast({ title: "Error preparando anclaje de perfiles", description: err.message || String(err), variant: "destructive" });
    } finally {
      setAnchoring(false);
    }
  };

  /**
   * Confirma la tabla de anclaje: persiste `canonical_name` en perfiles
   * existentes y crea perfiles nuevos con su ancla. Construye un mapa
   * pre-resuelto que `runImport` consume para no duplicar.
   */
  const confirmAnchoring = async () => {
    if (!anchorRows) return;
    setAnchoring(true);
    try {
      const map = new Map<string, string>();
      const active = anchorRows.filter((r) => !r.discarded && r.canonicalName.trim());

      // 1) Update canonical_name en perfiles ya existentes
      const toUpdate = active.filter((r) => r.matchedProfileId);
      for (const r of toUpdate) {
        const { error } = await supabase
          .from("fk_profiles")
          .update({ canonical_name: r.canonicalName.trim() })
          .eq("id", r.matchedProfileId!);
        if (error) console.error("update canonical_name", error);
        // Indexamos por displayName detectado (lo que viene en el archivo)
        // para que el resolutor de runImport encuentre match directo.
        map.set(`${r.network}::detected::${normalizeKey(r.detectedDisplayName)}`, r.matchedProfileId!);
        map.set(`${r.network}::canonical_anchor::${normalizeKey(r.canonicalName)}`, r.matchedProfileId!);
      }

      // 2) Crear perfiles nuevos
      const toInsert = active.filter((r) => !r.matchedProfileId);
      if (toInsert.length > 0) {
        const payload = toInsert.map((r) => ({
          client_id: clientId,
          network: r.network,
          profile_id: r.detectedProfileId || r.canonicalName,
          display_name: r.detectedDisplayName,
          canonical_name: r.canonicalName.trim(),
          is_active: true,
          is_competitor: false,
        }));
        const { data: inserted, error } = await supabase
          .from("fk_profiles")
          .insert(payload)
          .select("id, network, canonical_name, display_name");
        if (error) throw error;
        (inserted || []).forEach((row: any) => {
          map.set(`${row.network}::canonical_anchor::${normalizeKey(row.canonical_name)}`, row.id);
          map.set(`${row.network}::detected::${normalizeKey(row.display_name)}`, row.id);
        });
        // También mapear los displayNames detectados originalmente (por si insert
        // normalizó de forma distinta).
        toInsert.forEach((r) => {
          const k = `${r.network}::detected::${normalizeKey(r.detectedDisplayName)}`;
          if (!map.has(k)) {
            // buscar el id recién creado por canonical
            const id = map.get(`${r.network}::canonical_anchor::${normalizeKey(r.canonicalName)}`);
            if (id) map.set(k, id);
          }
        });
      }

      resolvedAnchorMapRef.current = map;
      setAnchorRows(null);
      // Continuar al flujo normal (overlap check + import)
      await proceedAfterAnchoring();
    } catch (err: any) {
      console.error("Anchoring confirm error", err);
      toast({ title: "Error guardando anclaje", description: err.message || String(err), variant: "destructive" });
    } finally {
      setAnchoring(false);
    }
  };

  /**
   * Pre-check: detecta periodos de KPIs que se solapan con snapshots existentes
   * (sin ser idénticos). Si hay solapamiento, muestra un aviso global y deja que
   * el usuario decida reemplazar (borrar existentes solapados) o cancelar.
   * Igualdad exacta (mismo period_start+period_end) NO es solapamiento: es upsert natural.
   */
  const handleImport = async () => {
    if (missingPeriod) {
      toast({
        title: "Falta el período en uno o más archivos de KPIs",
        description: "Selecciona la fecha de inicio y fin del período al que corresponden los datos.",
        variant: "destructive",
      });
      return;
    }
    // Anclaje primero
    await openAnchoring();
  };

  const proceedAfterAnchoring = async () => {

    const kpiFiles = files.filter((f) => f.kind === "kpis" && f.periodStart && f.periodEnd);
    if (kpiFiles.length === 0) {
      return runImport(false);
    }

    const incoming: Array<{ network: FKNetwork; displayName: string; profileId: string; periodStart: string; periodEnd: string }> = [];
    for (const f of kpiFiles) {
      const buf = await f.file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ps = formatDate(f.periodStart!, "yyyy-MM-dd");
      const pe = formatDate(f.periodEnd!, "yyyy-MM-dd");
      for (const sheetName of wb.SheetNames) {
        const { rows, kind } = readSheetWithHeaderDetection(wb.Sheets[sheetName]);
        if (kind !== "kpis") continue;
        for (const r of rows) {
          const m = mapKpiRow(r);
          if (m && m.network !== "unknown") {
            incoming.push({ network: m.network as FKNetwork, displayName: m.displayName, profileId: m.profileId, periodStart: ps, periodEnd: pe });
          }
        }
      }
    }

    if (incoming.length === 0) return runImport(false);

    const { data: existingProfiles } = await supabase
      .from("fk_profiles")
      .select("id, network, profile_id, display_name")
      .eq("client_id", clientId);

    const profileMap = new Map<string, { id: string; displayName: string; network: string }>();
    (existingProfiles || []).forEach((e: any) => {
      buildCandidateKeys(e.network, e.display_name || e.profile_id, e.profile_id).forEach((key) => {
        profileMap.set(key, { id: e.id, displayName: e.display_name || e.profile_id, network: e.network });
      });
    });

    const existingIds = Array.from(new Set(Array.from(profileMap.values()).map((p) => p.id)));
    let existingKpis: Array<{ fk_profile_id: string; period_start: string; period_end: string }> = [];
    if (existingIds.length > 0) {
      const { data } = await supabase
        .from("fk_profile_kpis")
        .select("fk_profile_id, period_start, period_end")
        .in("fk_profile_id", existingIds);
      existingKpis = data || [];
    }

    const overlaps: Array<{ profileName: string; network: string; existing: string; incoming: string }> = [];
    const seen = new Set<string>();
    for (const inc of incoming) {
      const candidates = buildCandidateKeys(inc.network, inc.displayName, inc.profileId);
      const matched = candidates.map((k) => profileMap.get(k)).find(Boolean);
      if (!matched) continue;
      for (const ek of existingKpis) {
        if (ek.fk_profile_id !== matched.id) continue;
        const sameRange = ek.period_start === inc.periodStart && ek.period_end === inc.periodEnd;
        if (sameRange) continue;
        const intersects = ek.period_start <= inc.periodEnd && ek.period_end >= inc.periodStart;
        if (intersects) {
          const key = `${matched.id}|${ek.period_start}|${ek.period_end}|${inc.periodStart}|${inc.periodEnd}`;
          if (!seen.has(key)) {
            seen.add(key);
            overlaps.push({
              profileName: matched.displayName,
              network: matched.network,
              existing: `${ek.period_start} → ${ek.period_end}`,
              incoming: `${inc.periodStart} → ${inc.periodEnd}`,
            });
          }
        }
      }
    }

    if (overlaps.length === 0) {
      return runImport(false);
    }

    setOverlapInfo({ overlaps });
  };

  const runImport = async (replaceOverlaps: boolean) => {
    setOverlapInfo(null);
    setImporting(true);
    setImportLog(null);
    let totalProfiles = 0;
    let totalKpis = 0;
    let totalPosts = 0;
    let deletedOverlaps = 0;
    const reports: ImportFileReport[] = [];

    /** Resuelve un perfil priorizando el ancla del paso de anclaje. */
    const resolveWithAnchor = (
      network: FKNetwork | string,
      displayName: string,
      profileId: string | null | undefined,
      lookupMap: Map<string, string>,
    ): string | undefined => {
      const anchor = resolvedAnchorMapRef.current?.get(`${network}::detected::${normalizeKey(displayName)}`);
      if (anchor) return anchor;
      return buildCandidateKeys(network, displayName, profileId).map((k) => lookupMap.get(k)).find(Boolean);
    };

    try {
      for (const f of files) {
        if (f.kind === "unknown") continue;
        const report: ImportFileReport = {
          fileName: f.file.name,
          kind: f.kind,
          rowsRead: 0,
          resolvedProfiles: 0,
          unresolvedProfiles: [],
          unknownNetworkProfiles: [],
          kpisInserted: 0,
          kpisDiscarded: 0,
          postsInserted: 0,
          postsDiscarded: 0,
          topPostsUpserted: 0,
          profilesWithoutKpis: [],
          errors: [],
        };
        const buf = await f.file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true });

        if (f.kind === "kpis") {
          const kpiRows: KpiRow[] = [];
          for (const sheetName of wb.SheetNames) {
            const { rows, kind } = readSheetWithHeaderDetection(wb.Sheets[sheetName]);
            if (kind !== "kpis") continue;
            report.rowsRead += rows.length;
            for (const r of rows) {
              const m = mapKpiRow(r);
              if (!m) continue;
              if (m.network === "unknown") {
                report.unknownNetworkProfiles.push(m.displayName || m.profileId);
                report.kpisDiscarded += 1;
                continue;
              }
              kpiRows.push(m);
            }
          }
          if (kpiRows.length === 0) {
            reports.push(report);
            continue;
          }

          // Resolve profiles by (client_id, network, normalized display_name)
          // so that re-imports with different profile_id formats (handle vs numeric ID)
          // map to the same canonical profile. Different brands within the same network
          // (e.g. Banorte + Actinver in Facebook) remain distinct via display_name.
          const { data: existing } = await supabase
            .from("fk_profiles")
            .select("id, network, profile_id, display_name, canonical_name")
            .eq("client_id", clientId);
          const existingByName = new Map<string, string>();
          (existing || []).forEach((e: any) => {
            buildCandidateKeys(e.network, e.display_name || e.profile_id, e.profile_id, e.canonical_name).forEach((key) => {
              existingByName.set(key, e.id);
            });
          });
          // Inyecta el mapa de anclaje (prioridad absoluta)
          if (resolvedAnchorMapRef.current) {
            resolvedAnchorMapRef.current.forEach((id, key) => existingByName.set(key, id));
          }

          const profilePayload = kpiRows.map((k) => ({
            client_id: clientId,
            network: k.network,
            profile_id: k.profileId,
            display_name: k.displayName,
            is_active: true,
            // Perfiles nuevos quedan SIN clasificar — la clasificación marca/competencia
            // se realiza desde el banner ámbar / modal de ClientDetail. Esto desacopla
            // la importación (operación técnica) de la decisión analítica.
            classification_status: "unclassified",
            is_competitor: false,
            _key: `${k.network}::canonical::${canonicalizeFKProfileIdentity(k.displayName || k.profileId)}`,
          }));

          const toInsert = profilePayload
            .filter((p) => !existingByName.has(p._key))
            // dedupe within batch
            .filter((p, idx, arr) => arr.findIndex((x) => x._key === p._key) === idx)
            .map(({ _key, ...rest }) => rest);

          if (toInsert.length > 0) {
            const { data: inserted, error } = await supabase
              .from("fk_profiles")
              .insert(toInsert as any)
              .select("id, network, profile_id, display_name");
            if (error) throw error;
            (inserted || []).forEach((row: any) => {
              buildCandidateKeys(row.network, row.display_name || row.profile_id, row.profile_id).forEach((key) => {
                existingByName.set(key, row.id);
              });
            });
          }

          totalProfiles += toInsert.length;

          const periodStart = formatDate(f.periodStart!, "yyyy-MM-dd");
          const periodEnd = formatDate(f.periodEnd!, "yyyy-MM-dd");

          const kpiPayload = kpiRows
            .map((k) => {
              const id = resolveWithAnchor(k.network, k.displayName || k.profileId, k.profileId, existingByName);
              if (!id) return null;
              return {
                fk_profile_id: id,
                period_start: periodStart,
                period_end: periodEnd,
                // snapshot_date registra la fecha exacta de importación, independiente
                // del período cubierto. Permite cadencia diaria con períodos solapados.
                snapshot_date: formatDate(new Date(), "yyyy-MM-dd"),
                followers: k.followers != null ? Math.round(k.followers) : null,
                engagement_rate: k.engagementRate,
                posts_per_day: k.postsPerDay,
                page_performance_index: k.pagePerformanceIndex,
                follower_growth_percent: k.followerGrowthPercent,
                reach_per_day: k.reachPerDay != null ? Math.round(k.reachPerDay) : null,
                impressions_per_interaction: k.impressionsPerInteraction,
              };
            })
            .filter(Boolean) as any[];

          // IDs de perfiles que tocó este archivo (para validación post-import)
          const touchedProfileIds = Array.from(new Set(
            kpiRows
              .map((k) => resolveWithAnchor(k.network, k.displayName || k.profileId, k.profileId, existingByName))
              .filter(Boolean) as string[]
          ));
          (f as any).__touchedProfileIds = touchedProfileIds;

          if (kpiPayload.length > 0) {
            // Si el usuario eligió reemplazar solapamientos, borramos los snapshots
            // que intersectan con el rango entrante (sin ser idénticos — el mismo
            // rango ya se maneja como upsert natural).
            if (replaceOverlaps) {
              const profileIds = Array.from(new Set(kpiPayload.map((p) => p.fk_profile_id)));
              const { data: existingForDelete } = await supabase
                .from("fk_profile_kpis")
                .select("id, fk_profile_id, period_start, period_end")
                .in("fk_profile_id", profileIds);
              const idsToDelete = (existingForDelete || [])
                .filter((ek: any) => {
                  const sameRange = ek.period_start === periodStart && ek.period_end === periodEnd;
                  if (sameRange) return false;
                  return ek.period_start <= periodEnd && ek.period_end >= periodStart;
                })
                .map((ek: any) => ek.id);
              if (idsToDelete.length > 0) {
                const { error: delErr } = await supabase
                  .from("fk_profile_kpis")
                  .delete()
                  .in("id", idsToDelete);
                if (delErr) console.error("Overlap delete", delErr);
                else deletedOverlaps += idsToDelete.length;
              }
            }

            // Idempotent: re-importing same period updates the row
            const { error } = await supabase
              .from("fk_profile_kpis")
              .upsert(kpiPayload, { onConflict: "fk_profile_id,period_start,period_end", ignoreDuplicates: false });
            if (error) {
              console.error("KPI upsert", error);
              report.errors.push(`KPIs: ${error.message}`);
              report.kpisDiscarded += kpiPayload.length;
            } else {
              totalKpis += kpiPayload.length;
              report.kpisInserted += kpiPayload.length;
              report.resolvedProfiles = kpiPayload.length;
              // Perfiles del Excel que no resolvieron a un fk_profile_id
              const resolvedCount = kpiPayload.length;
              const unresolvedCount = kpiRows.length - resolvedCount;
              if (unresolvedCount > 0) {
                kpiRows.forEach((k) => {
                  const id = buildCandidateKeys(k.network, k.displayName || k.profileId, k.profileId)
                    .map((key) => existingByName.get(key))
                    .find(Boolean);
                  if (!id) report.unresolvedProfiles.push(k.displayName || k.profileId);
                });
              }
            }
          }
        } else if (f.kind === "posts") {
          const postRows: PostRow[] = [];
          for (const sheetName of wb.SheetNames) {
            const { rows, kind } = readSheetWithHeaderDetection(wb.Sheets[sheetName]);
            if (kind !== "posts") continue;
            for (const r of rows) {
              const m = mapPostRow(r);
              if (m) postRows.push(m);
            }
          }
          if (postRows.length === 0) continue;

          // Load existing profiles by both profile_id AND display_name (posts don't carry Profile-ID)
          const { data: existing } = await supabase
            .from("fk_profiles")
            .select("id, network, profile_id, display_name, canonical_name")
            .eq("client_id", clientId);
          const byId = new Map<string, string>();
          const byName = new Map<string, string>();
          const byCanonical = new Map<string, string>();
          const byAnchor = new Map<string, string>();
          (existing || []).forEach((e: any) => {
            byId.set(`${e.network}::${e.profile_id}`, e.id);
            buildCandidateKeys(e.network, e.display_name || e.profile_id, e.profile_id, e.canonical_name).forEach((key) => {
              if (key.includes("::name::")) byName.set(key, e.id);
              if (key.includes("::canonical::") && !key.includes("::canonical_anchor::")) byCanonical.set(key, e.id);
              if (key.includes("::canonical_anchor::")) byAnchor.set(key, e.id);
            });
          });

          const resolveProfileId = (network: FKNetwork | string, displayName: string): string | undefined => {
            // 1) Anchor map del paso de anclaje (clave por displayName detectado)
            const anchorHit = resolvedAnchorMapRef.current?.get(`${network}::detected::${normalizeKey(displayName)}`);
            if (anchorHit) return anchorHit;
            // 2) canonical_name persistido en BD
            const dbAnchor = byAnchor.get(`${network}::canonical_anchor::${normalizeKey(displayName)}`);
            if (dbAnchor) return dbAnchor;
            // 3) Heurísticas (nombre normalizado / canónico)
            return buildCandidateKeys(network, displayName, displayName)
              .map((key) => {
                if (key.includes("::name::")) return byName.get(key);
                if (key.includes("::canonical::") && !key.includes("::canonical_anchor::")) return byCanonical.get(key);
                return undefined;
              })
              .find(Boolean)
              ?? byId.get(`${network}::${displayName.replace(/^@/, "")}`);
          };

          // Create profiles for posts whose profile doesn't exist yet (rare: posts before KPIs)
          const uniqueNew = new Map<string, { network: FKNetwork | string; displayName: string }>();
          for (const p of postRows) {
            if (p.network === "unknown") {
              report.unknownNetworkProfiles.push(p.displayName);
              report.postsDiscarded += 1;
              continue;
            }
            if (resolveProfileId(p.network, p.displayName)) continue;
            const k = `${p.network}::canonical::${canonicalizeFKProfileIdentity(p.displayName)}`;
            if (!uniqueNew.has(k)) uniqueNew.set(k, { network: p.network, displayName: p.displayName });
          }
          if (uniqueNew.size > 0) {
            const toInsert = Array.from(uniqueNew.values()).map((p) => ({
              client_id: clientId,
              network: p.network,
              profile_id: p.displayName.replace(/^@/, ""),
              display_name: p.displayName,
              is_active: true,
              classification_status: "unclassified",
              is_competitor: false,
            }));
            const { data: inserted, error } = await supabase
              .from("fk_profiles")
              .insert(toInsert as any)
              .select("id, network, profile_id, display_name");
            if (error) throw error;
            (inserted || []).forEach((row: any) => {
              byId.set(`${row.network}::${row.profile_id}`, row.id);
              buildCandidateKeys(row.network, row.display_name || row.profile_id, row.profile_id).forEach((key) => {
                if (key.includes("::name::")) byName.set(key, row.id);
                if (key.includes("::canonical::")) byCanonical.set(key, row.id);
              });
            });
            totalProfiles += toInsert.length;
          }

          // Build payload + dedupe within batch by (fk_profile_id, external_id)
          // AND by content fingerprint (fk_profile_id + published_at + message snippet + link)
          // because FK exports often assign different external_ids to the same post across exports.
          const seen = new Set<string>();
          const seenContent = new Set<string>();
          const postsPayload: any[] = [];
          // Pre-load existing content fingerprints to skip already-imported posts
          const profileIdsForPosts = Array.from(new Set(postRows.map((p) => resolveProfileId(p.network, p.displayName)).filter(Boolean) as string[]));
          if (profileIdsForPosts.length > 0) {
            const { data: existingPosts } = await supabase
              .from("fk_posts")
              .select("fk_profile_id, published_at, message, link")
              .in("fk_profile_id", profileIdsForPosts);
            (existingPosts || []).forEach((ep: any) => {
              const fp = `${ep.fk_profile_id}::${ep.published_at}::${(ep.message || "").slice(0, 200)}::${ep.link || ""}`;
              seenContent.add(fp);
            });
          }
          for (const p of postRows) {
            if (p.network === "unknown") continue;
            const id = resolveProfileId(p.network, p.displayName);
            if (!id) continue;
            // Synthesize a stable external_id when missing to avoid null collisions
            const extId = p.externalId
              || p.link
              || `${p.publishedAt}::${(p.message || "").slice(0, 80)}`;
            const dedupKey = `${id}::${extId}`;
            if (seen.has(dedupKey)) continue;
            const contentKey = `${id}::${p.publishedAt}::${(p.message || "").slice(0, 200)}::${p.link || ""}`;
            if (seenContent.has(contentKey)) continue;
            seen.add(dedupKey);
            seenContent.add(contentKey);
            postsPayload.push({
              fk_profile_id: id,
              network: p.network,
              external_id: extId,
              published_at: p.publishedAt,
              message: p.message,
              link: p.link,
              likes: p.likes != null ? Math.round(p.likes) : 0,
              comments: p.comments != null ? Math.round(p.comments) : 0,
              shares: p.shares != null ? Math.round(p.shares) : 0,
              engagement: p.engagement != null ? Math.round(p.engagement) : 0,
              reach: p.reach != null ? Math.round(p.reach) : 0,
              interaction_rate: p.interactionRate,
              post_type: p.postType,
              raw_data: p.raw,
            });
          }

          const CHUNK = 500;
          for (let i = 0; i < postsPayload.length; i += CHUNK) {
            const slice = postsPayload.slice(i, i + CHUNK);
            const { error } = await supabase
              .from("fk_posts")
              .upsert(slice, { onConflict: "fk_profile_id,external_id", ignoreDuplicates: false });
            if (error) {
              console.error("upsert posts error", error);
              throw error;
            }
            totalPosts += slice.length;
          }

          // Derive top post per profile per day for the legacy fk_daily_top_posts panel
          const topByDay = new Map<string, any>();
          for (const p of postsPayload) {
            const day = (p.published_at || "").slice(0, 10);
            if (!day) continue;
            const k = `${p.fk_profile_id}::${day}`;
            const cur = topByDay.get(k);
            if (!cur || (p.engagement || 0) > (cur.engagement || 0)) {
              topByDay.set(k, {
                fk_profile_id: p.fk_profile_id,
                network: p.network,
                post_date: day,
                post_url: p.link,
                post_content: p.message,
                likes: p.likes,
                comments: p.comments,
                shares: p.shares,
                engagement: p.engagement,
                raw_data: { external_id: p.external_id, reach: p.reach },
              });
            }
          }
          const topArr = Array.from(topByDay.values());
          for (let i = 0; i < topArr.length; i += CHUNK) {
            const slice = topArr.slice(i, i + CHUNK);
            const { error: tpErr } = await supabase
              .from("fk_daily_top_posts")
              .upsert(slice, { onConflict: "fk_profile_id,network,post_date", ignoreDuplicates: false });
            if (tpErr) {
              console.error("upsert daily top posts", tpErr);
              report.errors.push(`Top posts: ${tpErr.message}`);
            } else {
              report.topPostsUpserted += slice.length;
            }
          }
        }
        // Acumula contadores generales en el report del archivo
        if (f.kind === "kpis") {
          report.kpisInserted = report.kpisInserted; // se ajusta abajo en validación
        }

        // Validación post-import: confirmar que los perfiles tocados tienen KPIs en BD
        const touchedIds = (f as any).__touchedProfileIds as string[] | undefined;
        if (f.kind === "kpis" && touchedIds && touchedIds.length > 0) {
          const { data: kpiCheck } = await supabase
            .from("fk_profile_kpis")
            .select("fk_profile_id")
            .in("fk_profile_id", touchedIds);
          const withKpis = new Set((kpiCheck || []).map((k: any) => k.fk_profile_id));
          const missing = touchedIds.filter((id) => !withKpis.has(id));
          if (missing.length > 0) {
            const { data: missingProfiles } = await supabase
              .from("fk_profiles")
              .select("id, display_name, profile_id")
              .in("id", missing);
            (missingProfiles || []).forEach((p: any) => {
              report.profilesWithoutKpis.push(p.display_name || p.profile_id);
            });
          }
        }
        reports.push(report);
      }

      setImportLog(reports);
      toast({
        title: "Importación completada",
        description: `${totalProfiles} perfiles nuevos · ${totalKpis} KPIs · ${totalPosts} posts${
          deletedOverlaps > 0 ? ` · ${deletedOverlaps} snapshots solapados reemplazados` : ""
        }.`,
      });
      setFiles([]);
      resolvedAnchorMapRef.current = null;
      qc.invalidateQueries({ queryKey: ["fk-profiles-client"] });
      qc.invalidateQueries({ queryKey: ["fk-kpis"] });
      qc.invalidateQueries({ queryKey: ["fk-all-kpis"] });
      qc.invalidateQueries({ queryKey: ["fk-daily-top-posts"] });
      qc.invalidateQueries({ queryKey: ["fk-posts"] });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error al importar", description: err.message || String(err), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Importar Excel de Performance
        </CardTitle>
        <CardDescription>
          Sube los exports de KPIs y Posts. El importador detecta tipo de archivo y, cuando es posible, también el período.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("fk-excel-input")?.click()}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium text-sm">Arrastra varios archivos o haz clic para seleccionar</p>
          <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv — puedes mezclar KPIs y Posts</p>
        </div>
        <input
          id="fk-excel-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
        />

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((f, i) => {
              const periodMissing = f.kind === "kpis" && (!f.periodStart || !f.periodEnd);
              const src = f.periodSource;
              return (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.file.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {f.kind === "kpis" && <Badge variant="default">KPIs · {f.rowCount} perfiles</Badge>}
                        {f.kind === "posts" && <Badge variant="secondary">Posts · {f.rowCount} filas</Badge>}
                        {f.kind === "unknown" && <Badge variant="destructive">No reconocido</Badge>}
                        {f.kind === "kpis" && src === "metadata" && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            Período detectado del archivo
                          </Badge>
                        )}
                        {f.kind === "kpis" && src === "posts" && (
                          <Badge variant="outline" className="text-xs gap-1 border-primary/40 text-primary">
                            <CheckCircle2 className="h-3 w-3" />
                            Auto-detectado desde Posts
                          </Badge>
                        )}
                        {f.kind === "kpis" && src === "default" && (
                          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                            <Info className="h-3 w-3" />
                            Período por defecto (28 días)
                          </Badge>
                        )}
                        {f.kind === "kpis" && src === "manual" && (
                          <Badge variant="outline" className="text-xs gap-1">
                            Período ajustado manualmente
                          </Badge>
                        )}
                        {periodMissing && (
                          <Badge variant="outline" className="text-xs gap-1 text-destructive border-destructive/40">
                            <AlertTriangle className="h-3 w-3" />
                            Selecciona el período
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Switch "Competencia" eliminado: la clasificación marca/competencia
                        se realiza desde el banner ámbar en ClientDetail una vez que los
                        perfiles existen en BD, no en el momento de importar. */}
                    <Button variant="ghost" size="icon" onClick={() => removeFile(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {f.kind === "kpis" && (
                    <div className="flex items-center gap-2 pl-8">
                      <Label className="text-xs text-muted-foreground shrink-0">Período de los datos:</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("h-8 text-xs justify-start font-normal", !f.periodStart && "text-muted-foreground")}
                          >
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {f.periodStart ? formatDate(f.periodStart, "dd MMM yyyy", { locale: es }) : "Inicio"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={f.periodStart}
                            onSelect={(d) => setPeriodStart(i, d)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="text-xs text-muted-foreground">→</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("h-8 text-xs justify-start font-normal", !f.periodEnd && "text-muted-foreground")}
                          >
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {f.periodEnd ? formatDate(f.periodEnd, "dd MMM yyyy", { locale: es }) : "Fin"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={f.periodEnd}
                            onSelect={(d) => setPeriodEnd(i, d)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFiles([])}>Limpiar</Button>
              <Button
                onClick={handleImport}
                disabled={importing || files.every((f) => f.kind === "unknown") || missingPeriod}
              >
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Importar {files.filter((f) => f.kind !== "unknown").length} archivo(s)
              </Button>
            </div>
          </div>
        )}

        {importLog && importLog.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Resumen de importación</h4>
              <Button variant="ghost" size="sm" onClick={() => setImportLog(null)}>
                <X className="h-3 w-3 mr-1" /> Cerrar
              </Button>
            </div>
            <Accordion type="multiple" className="border rounded-lg">
              {importLog.map((r, i) => {
                const hasUnknown = r.unknownNetworkProfiles.length > 0;
                const hasUnresolved = r.unresolvedProfiles.length > 0 || r.profilesWithoutKpis.length > 0;
                const hasErrors = r.errors.length > 0;
                const status = hasUnknown || hasErrors ? "error" : hasUnresolved ? "warning" : "ok";
                return (
                  <AccordionItem key={i} value={`f-${i}`} className="border-b last:border-0 px-3">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
                        {status === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                        {status === "warning" && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                        {status === "error" && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                        <span className="text-sm font-medium truncate">{r.fileName}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {r.kind === "kpis" ? "KPIs" : r.kind === "posts" ? "Posts" : "?"}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <div className="text-xs space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="bg-muted/40 rounded p-2">
                            <div className="text-muted-foreground">Filas leídas</div>
                            <div className="font-semibold">{r.rowsRead}</div>
                          </div>
                          <div className="bg-muted/40 rounded p-2">
                            <div className="text-muted-foreground">Perfiles resueltos</div>
                            <div className="font-semibold">{r.resolvedProfiles}</div>
                          </div>
                          {r.kind === "kpis" && (
                            <div className="bg-muted/40 rounded p-2">
                              <div className="text-muted-foreground">KPIs insertados</div>
                              <div className="font-semibold">
                                {r.kpisInserted}
                                {r.kpisDiscarded > 0 && (
                                  <span className="text-muted-foreground"> / -{r.kpisDiscarded}</span>
                                )}
                              </div>
                            </div>
                          )}
                          {r.kind === "posts" && (
                            <>
                              <div className="bg-muted/40 rounded p-2">
                                <div className="text-muted-foreground">Posts insertados</div>
                                <div className="font-semibold">
                                  {r.postsInserted}
                                  {r.postsDiscarded > 0 && (
                                    <span className="text-muted-foreground"> / -{r.postsDiscarded}</span>
                                  )}
                                </div>
                              </div>
                              <div className="bg-muted/40 rounded p-2">
                                <div className="text-muted-foreground">Top posts diarios</div>
                                <div className="font-semibold">{r.topPostsUpserted}</div>
                              </div>
                            </>
                          )}
                        </div>

                        {r.unknownNetworkProfiles.length > 0 && (
                          <div className="rounded border border-destructive/40 bg-destructive/5 p-2">
                            <div className="font-semibold text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Red desconocida ({r.unknownNetworkProfiles.length})
                            </div>
                            <div className="text-muted-foreground mt-1 break-words">
                              {Array.from(new Set(r.unknownNetworkProfiles)).join(", ")}
                            </div>
                            <div className="text-muted-foreground mt-1 italic">
                              Estos perfiles no se importaron. Verifica que el Excel incluya la columna Network/Platform.
                            </div>
                          </div>
                        )}

                        {r.unresolvedProfiles.length > 0 && (
                          <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2">
                            <div className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Perfiles no resueltos ({r.unresolvedProfiles.length})
                            </div>
                            <div className="text-muted-foreground mt-1 break-words">
                              {Array.from(new Set(r.unresolvedProfiles)).join(", ")}
                            </div>
                          </div>
                        )}

                        {r.profilesWithoutKpis.length > 0 && (
                          <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2">
                            <div className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Perfiles sin KPIs en BD ({r.profilesWithoutKpis.length})
                            </div>
                            <div className="text-muted-foreground mt-1 break-words">
                              {Array.from(new Set(r.profilesWithoutKpis)).join(", ")}
                            </div>
                            <div className="text-muted-foreground mt-1 italic">
                              Este perfil se guardó pero no tiene KPIs — revisa que el archivo de KPIs corresponda al mismo período.
                            </div>
                          </div>
                        )}

                        {r.errors.length > 0 && (
                          <div className="rounded border border-destructive/40 bg-destructive/5 p-2">
                            <div className="font-semibold text-destructive">Errores</div>
                            <ul className="list-disc pl-4 mt-1 text-muted-foreground space-y-0.5">
                              {r.errors.map((e, idx) => <li key={idx}>{e}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Los archivos de <strong>KPIs</strong> requieren un período (inicio y fin). Si el Excel lo trae en sus metadatos, se detecta automáticamente; si no, lo seleccionas manualmente. Re-importar el mismo período para un perfil <strong>actualiza</strong> sus métricas en lugar de duplicarlas. Los archivos de <strong>Posts</strong> usan la fecha real de cada publicación.
          </span>
        </div>
      </CardContent>

      <AlertDialog open={!!overlapInfo} onOpenChange={(open) => !open && setOverlapInfo(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Periodos solapados detectados
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {overlapInfo?.overlaps.length} snapshot(s) existentes se solapan con los periodos que estás subiendo (sin ser idénticos).
                  Esto suele pasar cuando combinas exportes de rangos distintos (p.ej. semanal vs. mensual) que terminan el mismo día.
                </p>
                <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/40 p-2 text-xs font-mono space-y-1">
                  {overlapInfo?.overlaps.slice(0, 20).map((o, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        <strong>{o.profileName}</strong> · {o.network}
                      </span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {o.existing} <span className="text-destructive">↔</span> {o.incoming}
                      </span>
                    </div>
                  ))}
                  {overlapInfo && overlapInfo.overlaps.length > 20 && (
                    <div className="text-muted-foreground">… y {overlapInfo.overlaps.length - 20} más</div>
                  )}
                </div>
                <p className="text-sm">
                  <strong>Reemplazar</strong> borra los snapshots solapados existentes y mantiene los nuevos (recomendado para evitar series duplicadas).
                  <br />
                  <strong>Conservar ambos</strong> importa sin borrar: quedarán varios snapshots terminando el mismo día.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => runImport(false)}>
              Conservar ambos
            </Button>
            <AlertDialogAction onClick={() => runImport(true)}>
              Reemplazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!anchorRows} onOpenChange={(open) => !open && setAnchorRows(null)}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Anclaje de perfiles
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Confirma el <strong>nombre canónico</strong> de cada perfil detectado. Este nombre se usará como ancla
                  para reconocer al mismo perfil en importaciones futuras y evitar duplicados.
                </p>
                <p className="text-xs text-muted-foreground">
                  Perfiles marcados como <Badge variant="outline" className="text-[10px]">Nuevo</Badge> no se reconocieron — edita el nombre canónico o descarta la fila.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-[50vh] overflow-y-auto border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Detectado</th>
                  <th className="text-left p-2 font-medium">Red</th>
                  <th className="text-left p-2 font-medium">Estado</th>
                  <th className="text-left p-2 font-medium">Nombre canónico</th>
                  <th className="text-left p-2 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {(anchorRows || []).map((row, idx) => (
                  <tr key={row.key} className={cn("border-t", row.discarded && "opacity-40")}>
                    <td className="p-2">
                      <div className="font-medium truncate max-w-[180px]">{row.detectedDisplayName}</div>
                      {row.detectedProfileId && row.detectedProfileId !== row.detectedDisplayName && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">{row.detectedProfileId}</div>
                      )}
                    </td>
                    <td className="p-2"><Badge variant="outline" className="text-[10px]">{row.network}</Badge></td>
                    <td className="p-2">
                      {row.matchedBy === "anchor" && (
                        <Badge variant="default" className="text-[10px] gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Anclado
                        </Badge>
                      )}
                      {row.matchedBy === "heuristic" && (
                        <Badge variant="secondary" className="text-[10px]">Match heurístico</Badge>
                      )}
                      {row.isNew && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                          Nuevo
                        </Badge>
                      )}
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.canonicalName}
                        disabled={row.discarded}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAnchorRows((prev) => prev?.map((r, i) => i === idx ? { ...r, canonicalName: v } : r) || null);
                        }}
                        className="w-full bg-background border rounded px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setAnchorRows((prev) => prev?.map((r, i) => i === idx ? { ...r, discarded: !r.discarded } : r) || null)}
                        title={row.discarded ? "Recuperar" : "Descartar"}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={anchoring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAnchoring} disabled={anchoring}>
              {anchoring && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar y continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
