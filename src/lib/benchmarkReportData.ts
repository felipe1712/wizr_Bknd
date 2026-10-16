export type BenchmarkPeriod = {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  created_at?: string | null;
};

export type BenchmarkMetric = {
  period_id: string;
  competitor_id: string;
  network: string;
  followers: number | null;
  follower_growth_rate: number | null;
  engagement_rate: number | null;
  posts_per_day: number | null;
  created_at?: string | null;
};

const MONTHS_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const dateKey = (period: BenchmarkPeriod) => `${period.period_start}|${period.period_end}`;

/** Display month of the data cut. Accumulated exports (1 jun–25 ago) live in the month they close. */
export function periodMonthLabel(period: Pick<BenchmarkPeriod, "period_end" | "period_label">): string {
  const end = new Date(`${period.period_end}T00:00:00`);
  if (Number.isNaN(end.getTime())) return period.period_label;
  return `${MONTHS_ES[end.getMonth()]} ${end.getFullYear()}`;
}

/** A period may match the visible month even when its raw import label is accumulated. */
export function periodMatchesDisplayLabel(period: BenchmarkPeriod, label: string): boolean {
  return period.period_label === label || periodMonthLabel(period) === label;
}

export function periodRangeForDisplayLabel(label: string, periods: BenchmarkPeriod[]): { from: string; to: string } | null {
  const matching = periods.filter((period) => periodMatchesDisplayLabel(period, label));
  if (!matching.length) return null;
  const latestEnd = matching.map((period) => period.period_end).sort().at(-1);
  if (!latestEnd) return null;
  const end = new Date(`${latestEnd}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const y = end.getFullYear();
  const m = end.getMonth();
  const from = new Date(y, m, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { from, to: latestEnd < monthEnd ? latestEnd : monthEnd };
}

/**
 * A data cut may be split across several imports (for example, institutional
 * accounts and office-holder accounts). A cohort therefore contains every
 * import with the same effective date range, not one arbitrary period id.
 */
export function selectLatestPeriodCohort(
  periods: BenchmarkPeriod[],
  options: { label?: string; onOrBefore?: string; beforeEnd?: string } = {},
): BenchmarkPeriod[] {
  const eligible = periods.filter((period) => {
    if (options.label && period.period_label !== options.label) return false;
    if (options.onOrBefore && period.period_end > options.onOrBefore) return false;
    if (options.beforeEnd && period.period_end >= options.beforeEnd) return false;
    return true;
  });
  if (!eligible.length) return [];

  const latest = eligible.reduce((winner, period) => {
    if (period.period_end !== winner.period_end) return period.period_end > winner.period_end ? period : winner;
    if (period.period_start !== winner.period_start) return period.period_start > winner.period_start ? period : winner;
    return period;
  });
  const key = dateKey(latest);
  return eligible
    .filter((period) => dateKey(period) === key)
    .sort((a, b) => (a.created_at ?? a.id).localeCompare(b.created_at ?? b.id));
}

export function selectPreviousPeriodCohort(
  periods: BenchmarkPeriod[],
  current: BenchmarkPeriod[],
  options: { label?: string } = {},
): BenchmarkPeriod[] {
  const currentEnd = current[0]?.period_end;
  if (!currentEnd) return [];
  return selectLatestPeriodCohort(periods, { label: options.label, beforeEnd: currentEnd });
}

const metricCompleteness = (metric: BenchmarkMetric) => [
  metric.followers,
  metric.follower_growth_rate,
  metric.engagement_rate,
  metric.posts_per_day,
].filter((value) => value != null && Number.isFinite(Number(value))).length;

/** One snapshot per real account/network; never add duplicate imported rows. */
export function uniqueMetricsForPeriods<T extends BenchmarkMetric>(
  metrics: T[],
  periodIds: string[],
  accountIdentity?: ReadonlyMap<string, string>,
  periods?: readonly BenchmarkPeriod[],
): T[] {
  const ids = new Set(periodIds);
  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));
  const byAccount = new Map<string, T>();
  for (const metric of metrics) {
    if (!ids.has(metric.period_id)) continue;
    const accountKey = accountIdentity?.get(metric.competitor_id) ?? metric.competitor_id;
    const key = `${accountKey}|${metric.network.toLowerCase()}`;
    const previous = byAccount.get(key);
    if (!previous) {
      byAccount.set(key, metric);
      continue;
    }
    const metricPeriod = periodById.get(metric.period_id);
    const previousPeriod = periodById.get(previous.period_id);
    const metricCut = `${metricPeriod?.period_end ?? ""}|${metricPeriod?.period_start ?? ""}`;
    const previousCut = `${previousPeriod?.period_end ?? ""}|${previousPeriod?.period_start ?? ""}`;
    const metricTime = metric.created_at ?? "";
    const previousTime = previous.created_at ?? "";
    if (
      metricCut > previousCut
      || (metricCut === previousCut && metricTime > previousTime)
      || (metricCut === previousCut && metricTime === previousTime && metricCompleteness(metric) > metricCompleteness(previous))
    ) {
      byAccount.set(key, metric);
    }
  }
  return Array.from(byAccount.values());
}
const dayDistance = (a: string, b: string) =>
  Math.abs(Math.round((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86_400_000));

/**
 * Accounts loaded through a single accumulated export have no snapshot inside
 * older cuts, so a past-month report would show them without followers or
 * engagement. For those accounts we reuse the snapshot closest to the report
 * window (a past cut wins over a later one) instead of dropping the row.
 * Only apply this to the current window: previous-period buckets must stay
 * empty so growth deltas are never computed against a borrowed snapshot.
 */
export function fillMissingAccountSnapshots<T extends BenchmarkMetric>(
  base: T[],
  allMetrics: T[],
  accountIdentity: ReadonlyMap<string, string> | undefined,
  periods: readonly BenchmarkPeriod[],
  refDate?: string | null,
): T[] {
  if (!refDate || !base.length) return base;
  const keyOf = (metric: BenchmarkMetric) =>
    `${accountIdentity?.get(metric.competitor_id) ?? metric.competitor_id}|${metric.network.toLowerCase()}`;
  const present = new Set(base.map(keyOf));
  const periodById = new Map(periods.map((period) => [period.id, period]));
  const best = new Map<string, { metric: T; past: number; distance: number }>();
  for (const metric of allMetrics) {
    const key = keyOf(metric);
    if (present.has(key)) continue;
    const period = periodById.get(metric.period_id);
    if (!period) continue;
    const past = period.period_end <= refDate ? 0 : 1;
    const distance = dayDistance(period.period_end, refDate);
    const current = best.get(key);
    if (!current || past < current.past || (past === current.past && distance < current.distance)) {
      best.set(key, { metric, past, distance });
    }
  }
  return [...base, ...Array.from(best.values(), (entry) => entry.metric)];
}
