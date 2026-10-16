import { nameTokens } from "@/lib/entityNames";

export type BenchmarkAccount = {
  id: string;
  name: string;
  network: string;
  profile_external_id?: string | null;
  external_url?: string | null;
  dependencia_id?: string | null;
  account_type?: string | null;
};

export type BenchmarkSubject = { id: string; titular?: string | null };

const normalized = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/\/$/, "");

/**
 * Diminutivos y apodos frecuentes en cuentas oficiales mexicanas: el nombre
 * registrado es formal ("María Guadalupe") pero la cuenta usa el familiar
 * ("Lupita"). La comparación es bidireccional.
 */
const GIVEN_NAME_ALIASES = new Map<string, string[]>([
  ["regis", ["regina"]],
  ["lupita", ["guadalupe", "lupe"]],
  ["lupe", ["guadalupe", "lupita"]],
  ["guadalupe", ["lupita", "lupe"]],
  ["pepe", ["jose"]],
  ["chema", ["jose"]],
  ["poncho", ["alfonso", "ildefonso"]],
  ["ponchito", ["alfonso"]],
  ["alfonso", ["poncho"]],
  ["chayo", ["rosario"]],
  ["licha", ["alicia"]],
  ["quique", ["enrique"]],
  ["kike", ["enrique"]],
  ["chelo", ["consuelo"]],
  ["nando", ["fernando"]],
  ["tavo", ["gustavo"]],
  ["yola", ["yolanda"]],
  ["paco", ["francisco"]],
  ["pancho", ["francisco"]],
  ["memo", ["guillermo"]],
  ["toño", ["antonio"]],
  ["tono", ["antonio"]],
  ["beto", ["alberto", "roberto", "humberto"]],
  ["chuy", ["jesus"]],
  ["lalo", ["eduardo"]],
  ["nacho", ["ignacio"]],
  ["checo", ["sergio"]],
  ["tere", ["teresa"]],
  ["mari", ["maria"]],
  ["maru", ["maria"]],
  ["pati", ["patricia"]],
  ["fer", ["fernando", "fernanda"]],
  ["ale", ["alejandro", "alejandra"]],
  ["alex", ["alejandro", "alejandra"]],
  ["gabo", ["gabriel"]],
  ["gaby", ["gabriela"]],
  ["rafa", ["rafael"]],
  ["moni", ["monica"]],
  ["rocio", ["rocío"]],
]);


const tokenMatches = (actual: string, expected: string) => {
  if (actual === expected) return true;
  return (GIVEN_NAME_ALIASES.get(actual) ?? []).includes(expected)
    || (GIVEN_NAME_ALIASES.get(expected) ?? []).includes(actual);
};

function hasGivenNameAndSurname(actual: string[], expected: string[]): boolean {
  if (expected.length < 3) return false;
  const surnameStart = Math.max(1, expected.length - 2);
  const givenNames = expected.slice(0, surnameStart);
  const surnames = expected.slice(surnameStart);
  const hasGiven = actual.some((token) => givenNames.some((expectedToken) => tokenMatches(token, expectedToken)));
  const hasSurname = actual.some((token) => surnames.some((expectedToken) => tokenMatches(token, expectedToken)));
  return hasGiven && hasSurname;
}

function oneEditApart(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0; let j = 0; let edits = 0;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (shorter.length === longer.length) i += 1;
    j += 1;
  }
  return edits + (longer.length - j) <= 1;
}

/** Stable account identity across exports that alternate between display name and handle. */
export function benchmarkAccountKey(account: BenchmarkAccount): string {
  const network = normalized(account.network);
  const externalId = normalized(account.profile_external_id);
  if (externalId) return `${network}|id:${externalId}`;
  const url = normalized(account.external_url)?.replace(/^https?:\/\/(www\.)?/, "");
  if (url) return `${network}|url:${url}`;
  return `${network}|name:${nameTokens(account.name).join("-")}`;
}

/**
 * A titular block may only contain the registered titular and aliases of the
 * exact same social accounts (same platform external id / URL).
 */
export function titularAccountIds(accounts: BenchmarkAccount[], titular: string | null): Set<string> {
  if (!titular) return new Set<string>();
  const expected = new Set(nameTokens(titular));
  const expectedTokens = Array.from(expected);
  const directlyNamed = accounts.filter((account) => {
    const actual = nameTokens(account.name);
    if (actual.length < 2) return false;
    if (actual.every((token) => expectedTokens.some((expectedToken) => tokenMatches(token, expectedToken)))) {
      return actual.length >= 3 || actual.length === expected.size || hasGivenNameAndSurname(actual, expectedTokens);
    }
    // Tolera un único error tipográfico de una letra sólo en nombres completos
    // de 3+ tokens; nunca una coincidencia parcial por apellido.
    if (actual.length < 3) return false;
    let exact = 0;
    let fuzzy = 0;
    const used = new Set<string>();
    for (const token of actual) {
      if (expected.has(token)) { exact += 1; used.add(token); continue; }
      const fuzzyMatch = expectedTokens.find((candidate) => !used.has(candidate) && oneEditApart(token, candidate));
      if (!fuzzyMatch) return false;
      fuzzy += 1;
      used.add(fuzzyMatch);
    }
    return exact >= 2 && fuzzy <= 1;
  });
  const validKeys = new Set(directlyNamed.map(benchmarkAccountKey));
  return new Set(accounts.filter((account) => validKeys.has(benchmarkAccountKey(account))).map((account) => account.id));
}

/** One validity rule for dashboards, rankings and downloadable reports. */
export function buildValidCompetitorMaps(accounts: BenchmarkAccount[], subjects: BenchmarkSubject[]) {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const titularBySubject = new Map<string, BenchmarkAccount[]>();
  const validIds = new Set(accounts.filter((account) => account.account_type !== "titular").map((account) => account.id));
  for (const account of accounts) {
    if (!account.dependencia_id || account.account_type !== "titular") continue;
    titularBySubject.set(account.dependencia_id, [...(titularBySubject.get(account.dependencia_id) ?? []), account]);
  }
  titularBySubject.forEach((subjectAccounts, subjectId) => {
    titularAccountIds(subjectAccounts, subjectById.get(subjectId)?.titular ?? null).forEach((id) => validIds.add(id));
  });
  const depOfCompetitor = new Map<string, string>();
  const typeOfCompetitor = new Map<string, string>();
  for (const account of accounts) {
    if (!validIds.has(account.id)) continue;
    if (account.dependencia_id) depOfCompetitor.set(account.id, account.dependencia_id);
    typeOfCompetitor.set(account.id, account.account_type ?? "institucional");
  }
  return { validIds, depOfCompetitor, typeOfCompetitor };
}