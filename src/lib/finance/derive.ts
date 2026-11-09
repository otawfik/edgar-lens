/**
 * Turn a snapshot company into period-indexed financials, filling the metrics
 * that are arithmetic on reported ones:
 *
 * - revenue (banks that don't tag a total) = net interest + noninterest income
 * - gross profit (when not tagged)         = revenue − cost of revenue
 * - free cash flow                         = operating cash flow − capex
 *
 * Derived values are flagged so the UI can say "computed", not "reported".
 */
import type { MetricId } from "../edgar/concepts";
import { fiscalYearOf, periodDays, quarterLabel } from "../edgar/periods";
import type { PeriodType, SnapshotCompany } from "../edgar/snapshot";
import type { Lookup } from "./ratios";

export type DerivedMetricId = MetricId | "freeCashFlow";

export interface FinPoint {
  end: string;
  value: number;
  /** Index into the company's filings; null for derived values. */
  filing: number | null;
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
}

/** Metrics whose dates define a company's periods (not balance-sheet-only dates). */
const PERIOD_DEFINING: MetricId[] = ["revenue", "netIncome", "operatingCashFlow"];

function buildSeries(c: SnapshotCompany, type: PeriodType): PeriodSeries {
  const raw = type === "annual" ? c.annual : c.quarterly;
  const metrics = new Map<DerivedMetricId, Map<string, FinPoint>>();
  for (const [id, pts] of Object.entries(raw) as [MetricId, [string, number, number][]][]) {
    metrics.set(
      id,
      new Map(pts.map(([end, value, filing]) => [end, { end, value, filing, derived: false }])),
    );
  }
  const endSet = new Set<string>();
  for (const id of PERIOD_DEFINING) for (const end of metrics.get(id)?.keys() ?? []) endSet.add(end);
  const ends = [...endSet].sort();

  const at = (id: DerivedMetricId, end: string) => metrics.get(id)?.get(end)?.value ?? null;
  const put = (id: DerivedMetricId, end: string, value: number) => {
    let m = metrics.get(id);
    if (!m) metrics.set(id, (m = new Map()));
    m.set(end, { end, value, filing: null, derived: true });
  };

  for (const end of ends) {
    if (at("revenue", end) === null) {
      const nii = at("netInterestIncome", end);
      const nonii = at("noninterestIncome", end);
      if (nii !== null && nonii !== null) put("revenue", end, nii + nonii);
    }
    if (c.model === "general") {
      const rev = at("revenue", end);
      const cor = at("costOfRevenue", end);
      if (at("grossProfit", end) === null && rev !== null && cor !== null) {
        put("grossProfit", end, rev - cor);
      }
      const ocf = at("operatingCashFlow", end);
      const capex = at("capex", end);
      if (ocf !== null && capex !== null) put("freeCashFlow", end, ocf - capex);
    }
  }
  // Keep derived series in date order, like the reported ones.
  for (const [id, m] of metrics) metrics.set(id, new Map([...m].sort(([a], [b]) => a.localeCompare(b))));
  return { type, ends, metrics };
}

export function buildFinancials(company: SnapshotCompany): CompanyFinancials {
  return {
    company,
    annual: buildSeries(company, "annual"),
    quarterly: buildSeries(company, "quarterly"),
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

export function lookupFor(series: PeriodSeries, end: string): Lookup {
  return (metric, back = 0) => {
    const e = yearsBefore(series, end, back);
    return e === null ? null : (series.metrics.get(metric)?.get(e)?.value ?? null);
  };
}

export function periodLabel(type: PeriodType, end: string): string {
  return type === "annual" ? `FY${fiscalYearOf(end)}` : quarterLabel(end);
}
