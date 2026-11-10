/**
 * Snapshot-wide revision statistics: which companies, line items and sectors
 * change their reported figures most, and how long after the first filing.
 * Computed once at build time (scripts/build-snapshot.ts) and committed with
 * the snapshot, so the home page is a static read.
 */
import { METRICS, METRIC_IDS, type MetricId } from "./concepts";
import { daysBetween, isLikelySplit, isMaterialChange } from "./pointInTime";
import type {
  MetricLeagueRow,
  PeriodType,
  RevisionLeagueRow,
  RevisionStats,
  SectorLeagueRow,
  SnapshotCompany,
} from "./snapshot";
import type { Sector } from "../universe";

export interface MaterialRevision {
  metric: MetricId;
  period: PeriodType;
  end: string;
  from: number;
  to: number;
  fromFiling: number;
  toFiling: number;
  lagDays: number;
  /** Ordinal of this change within the figure's history (1 = first revision). */
  nth: number;
}

/**
 * Every material, non-split change in a company's figures. Derived quarterly
 * series are skipped: their vintages move whenever either YTD input moves,
 * which would double-count the same restatement.
 */
export function companyRevisions(c: SnapshotCompany): MaterialRevision[] {
  const out: MaterialRevision[] = [];
  for (const period of ["annual", "quarterly"] as const) {
    const series = period === "annual" ? c.annual : c.quarterly;
    for (const id of METRIC_IDS) {
      const unit = METRICS[id].unit;
      for (const [end, history, derived] of series[id] ?? []) {
        if (derived) continue;
        let nth = 0;
        for (let i = 1; i < history.length; i++) {
          const [fromFiling, from] = history[i - 1];
          const [toFiling, to] = history[i];
          if (!isMaterialChange(from, to, unit) || isLikelySplit(from, to, unit)) continue;
          nth++;
          out.push({
            metric: id,
            period,
            end,
            from,
            to,
            fromFiling,
            toFiling,
            lagDays: daysBetween(c.filings[fromFiling].filed, c.filings[toFiling].filed),
            nth,
          });
        }
      }
    }
  }
  return out;
}

/** Reported (not derived) figures: the denominator of every revision rate. */
export function countFigures(c: SnapshotCompany, metric?: MetricId): number {
  let n = 0;
  for (const id of metric ? [metric] : METRIC_IDS) {
    for (const series of [c.annual, c.quarterly]) {
      for (const [, , derived] of series[id] ?? []) if (!derived) n++;
    }
  }
  return n;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const relChange = (r: MaterialRevision) => Math.abs(r.to - r.from) / Math.max(Math.abs(r.from), 1);

const LAG_BUCKETS: [string, number, number][] = [
  ["≤ 90 days", 0, 90],
  ["91–365 days", 91, 365],
  ["1–2 years", 366, 730],
  ["> 2 years", 731, Infinity],
];

export function computeRevisionStats(companies: SnapshotCompany[]): RevisionStats {
  const rows: RevisionLeagueRow[] = [];
  const metricAgg = new Map<MetricId, { figures: number; revised: number; lags: number[] }>();
  const sectorAgg = new Map<Sector, { companies: number; figures: number; revised: number }>();
  const byForm = new Map<string, number>();
  const lagCounts = LAG_BUCKETS.map(() => 0);
  const allLags: number[] = [];
  let figures = 0;
  let revised = 0;
  let revisedTwice = 0;

  for (const c of companies) {
    const revs = companyRevisions(c);
    const figureCount = countFigures(c);
    const firstChanges = revs.filter((r) => r.nth === 1);
    const multi = revs.filter((r) => r.nth === 2).length;
    figures += figureCount;
    revised += firstChanges.length;
    revisedTwice += multi;

    for (const r of revs) {
      const form = c.filings[r.toFiling].form;
      byForm.set(form, (byForm.get(form) ?? 0) + 1);
      const bucket = LAG_BUCKETS.findIndex(([, lo, hi]) => r.lagDays >= lo && r.lagDays <= hi);
      if (bucket >= 0) lagCounts[bucket]++;
    }
    for (const r of firstChanges) {
      allLags.push(r.lagDays);
      const m = metricAgg.get(r.metric) ?? { figures: 0, revised: 0, lags: [] };
      m.revised++;
      m.lags.push(r.lagDays);
      metricAgg.set(r.metric, m);
    }
    for (const id of METRIC_IDS) {
      const m = metricAgg.get(id) ?? { figures: 0, revised: 0, lags: [] };
      m.figures += countFigures(c, id);
      metricAgg.set(id, m);
    }
    const s = sectorAgg.get(c.sector) ?? { companies: 0, figures: 0, revised: 0 };
    s.companies++;
    s.figures += figureCount;
    s.revised += firstChanges.length;
    sectorAgg.set(c.sector, s);

    const largest = revs.length ? revs.reduce((a, b) => (relChange(b) > relChange(a) ? b : a)) : null;
    rows.push({
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      figures: figureCount,
      revised: firstChanges.length,
      rate: figureCount ? firstChanges.length / figureCount : 0,
      medianLagDays: median(firstChanges.map((r) => r.lagDays)),
      largest: largest
        ? { metric: largest.metric, period: largest.period, end: largest.end, from: largest.from, to: largest.to }
        : null,
    });
  }

  const metrics: MetricLeagueRow[] = [...metricAgg]
    .filter(([, m]) => m.figures > 0)
    .map(([metric, m]) => ({
      metric,
      figures: m.figures,
      revised: m.revised,
      rate: m.revised / m.figures,
      medianLagDays: median(m.lags),
    }))
    .sort((a, b) => b.rate - a.rate);

  const sectors: SectorLeagueRow[] = [...sectorAgg]
    .map(([sector, s]) => ({ sector, ...s, rate: s.figures ? s.revised / s.figures : 0 }))
    .sort((a, b) => b.rate - a.rate);

  return {
    figures,
    revised,
    rate: figures ? revised / figures : 0,
    revisedTwice,
    medianLagDays: median(allLags),
    byForm: [...byForm].map(([form, changes]) => ({ form, changes })).sort((a, b) => b.changes - a.changes),
    lagBuckets: LAG_BUCKETS.map(([label], i) => ({ label, changes: lagCounts[i] })),
    companies: rows.sort((a, b) => b.rate - a.rate || b.revised - a.revised),
    metrics,
    sectors,
  };
}
