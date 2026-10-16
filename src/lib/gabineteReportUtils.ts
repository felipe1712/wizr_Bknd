import { nameTokens } from "@/lib/entityNames";

export type MentionSubject = { id: string; nombre: string; titular?: string | null };
export type MentionResolution = {
  dep: string | null;
  scope: "institucional" | "titular" | null;
  match: string | null;
};

const GENERIC = new Set([
  "secretaria", "subsecretaria", "instituto", "organismo", "procuraduria", "coordinacion",
  "direccion", "general", "estado", "estatal", "guanajuato", "gobierno", "sistema", "comision", "consejo", "unidad",
]);

function personPhrases(fullName: string): string[] {
  const tokens = nameTokens(fullName);
  if (tokens.length < 2) return [];
  const phrases = new Set<string>([tokens.join(" ")]);
  if (tokens.length >= 3) {
    phrases.add(`${tokens[0]} ${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}`);
    phrases.add(`${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}`);
    phrases.add(`${tokens[0]} ${tokens[tokens.length - 2]}`);
  }
  return Array.from(phrases);
}

/** One canonical attribution rule for dashboards, exports and PDFs. */
export function resolveGabineteMention(haystack: string, subjects: MentionSubject[]): MentionResolution {
  const normalized = ` ${nameTokens(haystack).join(" ")} `;
  const has = (phrase: string) => phrase.length > 3 && normalized.includes(` ${phrase} `);
  for (const subject of subjects) {
    const hit = subject.titular ? personPhrases(subject.titular).find(has) : undefined;
    if (hit) return { dep: subject.id, scope: "titular", match: subject.titular ?? hit };
  }
  for (const subject of subjects) {
    const phrase = nameTokens(subject.nombre).join(" ");
    if (has(phrase)) return { dep: subject.id, scope: "institucional", match: subject.nombre };
    const tokens = nameTokens(subject.nombre).filter((token) => !GENERIC.has(token));
    if (tokens.length >= 2 && tokens.every((token) => normalized.includes(` ${token} `))) {
      return { dep: subject.id, scope: "institucional", match: subject.nombre };
    }
  }
  return { dep: null, scope: null, match: null };
}

export function benchmarkPostKey(post: {
  competitor_id: string | null;
  network: string;
  posted_at: string | null;
  message: string | null;
  link?: string | null;
}, accountIdentity?: ReadonlyMap<string, string>) {
  const link = post.link?.trim().toLowerCase();
  if (link) return `link|${link}`;
  const accountKey = post.competitor_id
    ? accountIdentity?.get(post.competitor_id) ?? post.competitor_id
    : "";
  return [accountKey, post.network.toLowerCase(), post.posted_at ?? "", post.message?.trim() ?? ""].join("|");
}

export function weightedRate(rows: { rate: number | null; weight: number | null }[]): number | null {
  const valid = rows.filter((row) => row.rate != null && Number.isFinite(row.rate) && row.weight != null && row.weight > 0);
  const totalWeight = valid.reduce((sum, row) => sum + Number(row.weight), 0);
  return totalWeight ? valid.reduce((sum, row) => sum + Number(row.rate) * Number(row.weight), 0) / totalWeight : null;
}