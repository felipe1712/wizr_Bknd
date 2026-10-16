// Parses a text log (.txt) export into per-day entries.
// Message header format examples:
//   [2/1/26, 07:17:09] Author Name: content...
//   [12/03/25, 22:05:11 p. m.] @user: content
// Continuation lines belong to the previous message.

export type ParsedEntry = {
  entry_date: string; // YYYY-MM-DD
  content_md: string;
  kinds: ReportKind[]; // tipos de reporte detectados en ese día
  dated: boolean; // true si la fecha vino del encabezado del reporte
};

export type ReportKind = "listening" | "medios" | "otro";

const HEADER_RE = /^\[(\d{1,2})[\/](\d{1,2})[\/](\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*[ap]\.?\s*m\.?)?\]\s*([^:]+?):\s?(.*)$/i;

const NOISE_RE = [
  /\b(sticker|imagen|audio|video|v[ií]deo|documento|GIF|contacto|ubicaci[oó]n|archivo|adjunto)\s+omitid[oa]s?\b/i,
  /se\s+elimin[oó]\s+este\s+mensaje/i,
  /mensaje\s+eliminado/i,
  /los\s+mensajes\s+y\s+las\s+llamadas\s+est[aá]n\s+cifrad/i,
  /^\s*(a[ñn]adi[oó]|elimin[oó]|sali[oó]|cambi[oó]|cre[oó]|uni[oó])\b/i,
  /cambi[oó]\s+(el\s+asunto|la\s+descripci[oó]n|el\s+icono|su\s+n[uú]mero)/i,
];

const LISTENING_RE =
  /(an[aá]lisis\s+de\s+mencion|volumen\s+total\s+de\s+mencion|narrativas\s+del\s+d[ií]a|an[aá]lisis\s+de\s+sentimiento|hallazgos\s+clave|menciones\s+[uú]nicas)/i;

const MEDIOS_RE =
  /(RESUMEN\s+EJECUTIVO|S[IÍ]NTESIS\s+(ESTATAL|INFORMATIVA|NACIONAL)?|OCHO\s+COLUMNAS|PRIMERAS\s+PLANAS|MONITOREO\s+DE\s+MEDIOS|CLIPPING|^\s*\*?\s*Tema\s+[A-ZÁÉÍÓÚÑ]|AN[AÁ]LISIS\s+[A-ZÁÉÍÓÚÑ]{3,}|impreso\s+y\s+web|\bimpreso\.)/im;

const MIN_SUBSTANTIVE_CHARS = 180;

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const FECHA_TEXTO_RE = new RegExp(
  String.raw`(\d{1,2})\s+de\s+(${MESES.join("|")})\s+(?:de\s+)?(\d{4})`,
  "i",
);

/**
 * Fecha declarada dentro del propio reporte (p. ej. "12 de agosto de 2026").
 * Los reportes suelen enviarse al día siguiente, así que esta fecha manda
 * sobre la marca de tiempo de la bitácora.
 */
function dateFromBody(body: string): string | null {
  const head = body.slice(0, 600).normalize("NFC");
  const m = head.match(FECHA_TEXTO_RE);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const mes = MESES.indexOf(m[2].toLowerCase());
  if (mes < 0) return null;
  return `${m[3]}-${String(mes + 1).padStart(2, "0")}-${day}`;
}

function kindOf(body: string): ReportKind {
  if (LISTENING_RE.test(body)) return "listening";
  if (MEDIOS_RE.test(body)) return "medios";
  return "otro";
}

function stripDecoration(s: string): string {
  return s
    .replace(/<Se edit[oó] este mensaje>/gi, "")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, "")
    .replace(/[*_~`>#\-–—•·.,!?¡¿:;()\[\]"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoise(body: string): boolean {
  const clean = stripDecoration(body);
  if (clean.length === 0) return true;
  if (NOISE_RE.some((re) => re.test(body))) return true;
  if (clean.length < 15) return true;
  if (/^https?:\/\/\S+$/i.test(body.trim())) return true;
  return false;
}

function toIsoDate(d: string, m: string, y: string): string {
  const yy = y.length === 2 ? `20${y}` : y;
  return `${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

type Msg = { author: string; body: string; kind: ReportKind; dated: boolean };

export function parseBitacoraTxt(text: string): ParsedEntry[] {
  const lines = text.replace(/\u200e/g, "").split(/\r?\n/);
  const byDate = new Map<string, Msg[]>();
  const seen = new Set<string>();
  let currentDate: string | null = null;
  let currentAuthor: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentDate || buffer.length === 0) return;
    const body = buffer.join("\n").replace(/<Se edit[oó] este mensaje>/gi, "").trim();
    buffer = [];
    if (!body || isNoise(body)) return;
    const kind = kindOf(body);
    const own = body.length >= 200 ? dateFromBody(body) : null;
    const fecha = own ?? currentDate;
    const huella = `${fecha}|${stripDecoration(body).slice(0, 300)}`;
    if (seen.has(huella)) return;
    seen.add(huella);
    const arr = byDate.get(fecha) ?? [];
    arr.push({ author: currentAuthor ?? "", body, kind, dated: !!own });
    byDate.set(fecha, arr);
  };

  for (const raw of lines) {
    const m = raw.match(HEADER_RE);
    if (m) {
      flush();
      const [, d, mo, y, , , , author, first] = m;
      currentDate = toIsoDate(d, mo, y);
      currentAuthor = author.trim();
      buffer = first ? [first] : [];
    } else if (currentDate) {
      buffer.push(raw);
    }
  }
  flush();

  return Array.from(byDate.entries())
    .map(([entry_date, msgs]) => {
      const hasReport = msgs.some((m) => m.kind !== "otro" && m.body.length >= 200);
      const kept = hasReport
        ? msgs.filter((m) => (m.kind !== "otro" && m.body.length >= 200) || m.body.length >= MIN_SUBSTANTIVE_CHARS)
        : msgs.filter((m) => m.body.length >= 60);
      const rank = (k: ReportKind) => (k === "listening" ? 0 : k === "medios" ? 1 : 2);
      const ordered = [
        ...kept.filter((m) => m.kind === "listening"),
        ...kept.filter((m) => m.kind === "medios"),
        ...kept.filter((m) => m.kind === "otro"),
      ].sort((a, b) => rank(a.kind) - rank(b.kind));
      return { entry_date, msgs: ordered };
    })
    .filter(({ msgs }) => msgs.length > 0)
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
    .map(({ entry_date, msgs }) => ({
      entry_date,
      kinds: Array.from(new Set(msgs.map((m) => m.kind))) as ReportKind[],
      dated: msgs.some((m) => m.dated),
      content_md: msgs
        .map((m) => {
          const etiqueta = m.kind === "listening"
            ? "Escucha digital"
            : m.kind === "medios" ? "Medios / prensa" : "Nota";
          return `**${etiqueta} · ${m.author}**\n\n${m.body}`;
        })
        .join("\n\n---\n\n"),
    }));
}
