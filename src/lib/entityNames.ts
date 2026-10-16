// Unifica variantes del mismo actor ("Francisco Lira" / "Francisco Lira Mariel" /
// "Francisco Javier Lira Mariel") para que los conteos no se partan al agregar.

const NAME_STOPWORDS = new Set([
  "de","del","la","las","los","el","y","lic","ing","mtro","dr","dra","sr","sra","don",
  "diputado","diputada","senador","senadora","presidente","presidenta","director","directora",
]);

export function nameTokens(raw: string): string[] {
  return (raw || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NAME_STOPWORDS.has(t));
}

function isSubsetName(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b);
  if (!a.every((t) => setB.has(t))) return false;
  return a.length >= 2 || (a.length === 1 && a[0].length >= 6);
}

/** Mapa nombreOriginal → nombreCanónico (la variante más específica). */
export function buildNameCanonicalMap(names: string[]): Map<string, string> {
  const uniq = Array.from(new Set(names.filter(Boolean)));
  const toks = new Map(uniq.map((n) => [n, nameTokens(n)]));
  const sorted = [...uniq].sort(
    (a, b) => (toks.get(b)!.length - toks.get(a)!.length) || a.localeCompare(b),
  );
  const map = new Map<string, string>();
  for (const n of sorted) {
    const tn = toks.get(n)!;
    let canonical = n;
    for (const c of map.values()) {
      const tc = toks.get(c) ?? nameTokens(c);
      if (isSubsetName(tn, tc) || isSubsetName(tc, tn)) { canonical = c; break; }
    }
    map.set(n, canonical);
  }
  return map;
}

/** Suma conteos de un mapa nombre→conteo unificando variantes. */
export function mergeNameCounts(src: Map<string, number>): Map<string, number> {
  const canon = buildNameCanonicalMap(Array.from(src.keys()));
  const out = new Map<string, number>();
  for (const [name, count] of src.entries()) {
    const key = canon.get(name) ?? name;
    out.set(key, (out.get(key) ?? 0) + count);
  }
  return out;
}
