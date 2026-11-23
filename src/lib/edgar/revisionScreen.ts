/**
 * The revision screener's arithmetic: "for this line item, this period type
 * and this delay, whose reported numbers held and whose were changed?"
 *
 * A company is cut into cells, one per (line item, period type). A cell keeps
 * the count of reported figures and, for each figure a later filing changed
 * materially, the days between its first filing and that first change. Any
 * selection is then a sum over cells, so the screener's totals reconcile with
 * the league table on the home page: every cell of every company adds up to
 * the snapshot's `revised` and `figures`.
 *
 * Pure and free of imports: the server builds the cells (`companyCells` in
 * revisionStats.ts), the browser filters and ranks them with this file.
 */
import type { MetricId } from "./metricIds";
import type { PeriodType } from "./snapshot";

export interface RevisionCell {
  metric: MetricId;
  period: PeriodType;
  /** Reported (not derived) figures in this cell. */
  figures: number;
  /** One entry per figure that was later changed: days to its first material change. */
  lagDays: number[];
}

/** Delay between a figure's first filing and the filing that changed it. */
export type LagFilter = "any" | "within1y" | "after1y";
export const LAG_FILTERS: readonly LagFilter[] = ["any", "within1y", "after1y"];

export interface CellSelection {
  /** One line item, or null for all of them. */
  metric: MetricId | null;
  /** Annual or quarterly figures, or null for both. */
  period: PeriodType | null;
  lag: LagFilter;
}

export interface RevisionSummary {
  figures: number;
  revised: number;
  /** revised ÷ figures; null when the selection holds no figures at all. */
  rate: number | null;
  medianLagDays: number | null;
}

export function lagMatches(days: number, lag: LagFilter): boolean {
  return lag === "any" || (lag === "within1y" ? days <= 365 : days > 365);
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Totals for the cells a selection covers. The lag filter narrows which
 * changes count, never the denominator: "changed more than a year later" is
 * still a share of every figure reported.
 */
export function summarise(cells: readonly RevisionCell[], sel: CellSelection): RevisionSummary {
  let figures = 0;
  const lags: number[] = [];
  for (const cell of cells) {
    if (sel.metric && cell.metric !== sel.metric) continue;
    if (sel.period && cell.period !== sel.period) continue;
    figures += cell.figures;
    for (const d of cell.lagDays) if (lagMatches(d, sel.lag)) lags.push(d);
  }
  return { figures, revised: lags.length, rate: figures ? lags.length / figures : null, medianLagDays: median(lags) };
}

/**
 * The line item a company changed most often within a selection, by count and
 * then by rate; null when nothing in the selection was changed.
 */
export function mostRevised(
  cells: readonly RevisionCell[],
  sel: Omit<CellSelection, "metric">,
): { metric: MetricId; summary: RevisionSummary } | null {
  let best: { metric: MetricId; summary: RevisionSummary } | null = null;
  for (const metric of new Set(cells.map((c) => c.metric))) {
    const summary = summarise(cells, { ...sel, metric });
    if (!summary.revised) continue;
    if (!best || summary.revised > best.summary.revised || (summary.revised === best.summary.revised && (summary.rate ?? 0) > (best.summary.rate ?? 0))) {
      best = { metric, summary };
    }
  }
  return best;
}
