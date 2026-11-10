/**
 * Turn a snapshot company into period-indexed financials with point-in-time
 * histories, filling the metrics that are arithmetic on reported ones:
 *
 * - revenue (banks that don't tag a total) = net interest + noninterest income
 * - gross profit (when not tagged)         = revenue − cost of revenue
 * - free cash flow                         = operating cash flow − capex
 *
 * Derived histories are recomputed at every filing date of their inputs, so
 * an "as of" view of free cash flow is what could have been computed then.
 */
import type { MetricId } from "../edgar/concepts";
import { fiscalYearOf, periodDays, quarterLabel } from "../edgar/periods";
import { asOf as vintageAsOf, combineVintages, type Vintage } from "../edgar/pointInTime";
import type { PeriodType, SnapshotCompany } from "../edgar/snapshot";
import type { Lookup } from "./ratios";

export type DerivedMetricId = MetricId | "freeCashFlow";

export interface FinVintage extends Vintage {
  /** Index into the company's filings table. */
  filing: number;
}

export interface FinPoint {
  end: string;
  /** Value-changing vintages, in filing order; never empty. */
  history: FinVintage[];
  /** Computed from other figures (quarter from YTD, FCF, gross profit). */
  derived: boolean;
}

export interface PeriodSeries {
  type: PeriodType;
  /** This company's fiscal-year (or quarter) end dates, ascending. */
  ends: string[];
  metrics: Map<DerivedMetricId, Map<string, FinPoint>>;
}

export interface CompanyFinancials {
  company: SnapshotCompany;
  annual: PeriodSeries;
  quarterly: PeriodSeries;
  /** Distinct filing dates, ascending — the stops of the date scrubber. */
  filingDates: string[];
}

/** Latest known vintage, or the one in force on `asOf`. */
export function vintageAt(point: FinPoint, asOf?: string | null): FinVintage | null {
  if (!asOf) return point.history[point.history.length - 1];
  return vintageAsOf(point.history, asOf);
}

export function valueAt(point: FinPoint | undefined, asOf?: string | null): number | null {
  return point ? (vintageAt(point, asOf)?.value ?? null) : null;
}

/** Metrics whose dates define a company's periods (not balance-sheet-only dates). */
const PERIOD_DEFINING: MetricId[] = ["revenue", "netIncome", "operatingCashFlow"];

function buildSeries(c: SnapshotCompany, type: PeriodType): PeriodSeries {
  const raw = type === "annual" ? c.annual : c.quarterly;
  const metrics = new Map<DerivedMetricId, Map<string, FinPoint>>();
  const toFin = (filing: number, value: number): FinVintage => ({
    filing,
    value,
    filed: c.filings[filing].filed,
    accn: c.filings[filing].accn,
  });
  for (const [id, pts] of Object.entries(raw) as [MetricId, NonNullable<SnapshotCompany["annual"][MetricId]>][]) {
    metrics.set(
      id,
      new Map(
        pts.map(([end, history, derived]) => [
          end,
          { end, history: history.map(([f, v]) => toFin(f, v)), derived: derived === 1 },
        ]),
      ),
    );
  }
  const endSet = new Set<string>();
  for (const id of PERIOD_DEFINING) for (const end of metrics.get(id)?.keys() ?? []) endSet.add(end);
  const ends = [...endSet].sort();

  const accnToFiling = new Map(c.filings.map((f, i) => [f.accn, i]));
  const point = (id: DerivedMetricId, end: string) => metrics.get(id)?.get(end);
  const combine = (target: DerivedMetricId, end: string, a: FinPoint, b: FinPoint, fn: (x: number, y: number) => number) => {
    const history = combineVintages(a.history, b.history, fn).map((v) => ({
      ...v,
      filing: accnToFiling.get(v.accn)!,
    }));
    if (!history.length) return;
    let m = metrics.get(target);
    if (!m) metrics.set(target, (m = new Map()));
    m.set(end, { end, history, derived: true });
  };

  for (const end of ends) {
    if (!point("revenue", end)) {
      const nii = point("netInterestIncome", end);
      const nonii = point("noninterestIncome", end);
      if (nii && nonii) combine("revenue", end, nii, nonii, (x, y) => x + y);
    }
    if (c.model === "general") {
      const rev = point("revenue", end);
      const cor = point("costOfRevenue", end);
      if (!point("grossProfit", end) && rev && cor) combine("grossProfit", end, rev, cor, (x, y) => x - y);
      const ocf = point("operatingCashFlow", end);
      const capex = point("capex", end);
      if (ocf && capex) combine("freeCashFlow", end, ocf, capex, (x, y) => x - y);
    }
  }
  // Keep every series in date order, like the reported ones.
  for (const [id, m] of metrics) metrics.set(id, new Map([...m].sort(([a], [b]) => a.localeCompare(b))));
  return { type, ends, metrics };
}

export function buildFinancials(company: SnapshotCompany): CompanyFinancials {
  return {
    company,
    annual: buildSeries(company, "annual"),
    quarterly: buildSeries(company, "quarterly"),
    filingDates: [...new Set(company.filings.map((f) => f.filed))].sort(),
  };
}

const YEAR = 365.25;
const TOLERANCE_DAYS = 20;

/** The period end `years` years before `end` in this series, if there is one. */
export function yearsBefore(series: PeriodSeries, end: string, years: number): string | null {
  if (years === 0) return end;
  let best: string | null = null;
  let bestErr = Infinity;
  for (const e of series.ends) {
    if (e >= end) continue;
    const err = Math.abs(periodDays(e, end) - 1 - years * YEAR);
    if (err < bestErr) {
      best = e;
      bestErr = err;
    }
  }
  return bestErr <= TOLERANCE_DAYS * Math.max(1, years) ? best : null;
}

/** The immediately preceding period end (previous quarter for quarterly series). */
export function previousEnd(series: PeriodSeries, end: string): string | null {
  const i = series.ends.indexOf(end);
  return i > 0 ? series.ends[i - 1] : null;
}

/** A ratio lookup bound to one period, reading values as known on `asOf`. */
export function lookupFor(series: PeriodSeries, end: string, asOf?: string | null): Lookup {
  return (metric, back = 0) => {
    const e = yearsBefore(series, end, back);
    return e === null ? null : valueAt(series.metrics.get(metric)?.get(e), asOf);
  };
}

export function periodLabel(type: PeriodType, end: string): string {
  return type === "annual" ? `FY${fiscalYearOf(end)}` : quarterLabel(end);
}
