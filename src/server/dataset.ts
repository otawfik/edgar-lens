/**
 * In-memory query layer over data/snapshot.json. Built once per server process
 * (~100 companies, ~40k figures), with per-company memoisation of what is
 * asked for repeatedly: revision cells and logs, restatement events.
 *
 * Every read takes an optional `asOf` date. Without it, figures are the latest
 * reported; with it, they are what had been filed on or before that date.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { METRICS, type MetricId } from "@/lib/edgar/concepts";
import { changeBetween, daysBetween, isLikelySplit, isMaterialChange } from "@/lib/edgar/pointInTime";
import type { RevisionCell } from "@/lib/edgar/revisionScreen";
import { companyCells, companyRevisions, type MaterialRevision } from "@/lib/edgar/revisionStats";
import type { PeriodType, Snapshot, SnapshotFiling } from "@/lib/edgar/snapshot";
import {
  buildFinancials,
  lookupFor,
  periodLabel,
  previousEnd,
  valueAt,
  vintageAt,
  yearsBefore,
  type CompanyFinancials,
  type DerivedMetricId,
  type FinPoint,
  type FinVintage,
  type PeriodSeries,
} from "@/lib/finance/derive";
import { RATIOS, computeRatio, ratioApplies, type RatioId } from "@/lib/finance/ratios";
import { formatBps, formatChange, formatMoney } from "@/lib/format";

export interface MetricChange {
  metric: DerivedMetricId;
  value: number | null;
  priorYear: number | null;
  yoy: number | null;
  priorQuarter: number | null;
  qoq: number | null;
}

export interface RatioChange {
  ratio: RatioId;
  value: number | null;
  priorYear: number | null;
  delta: number | null;
}

export interface FilingChange {
  fin: CompanyFinancials;
  filing: SnapshotFiling | null;
  quarterEnd: string | null;
  priorYearEnd: string | null;
  priorQuarterEnd: string | null;
  /** The latest filing covers a period the XBRL feed doesn't have yet. */
  lagging: boolean;
  metrics: MetricChange[];
  ratios: RatioChange[];
  headline: string;
}

/** One figure as known on a date. */
export interface PointView {
  metric: DerivedMetricId;
  period: PeriodType;
  end: string;
  value: number;
  derived: boolean;
  /** The vintage in force. */
  vintage: FinVintage;
  first: FinVintage;
  history: FinVintage[];
}

/** A figure whose in-force value differs between two dates. */
export interface RevisionView {
  metric: DerivedMetricId;
  period: PeriodType;
  end: string;
  from: FinVintage;
  to: FinVintage;
  /** Above the snapshot's threshold (0.5% and $1M / $0.01). */
  material: boolean;
  likelySplit: boolean;
  /** Computed from other figures (FCF, untagged gross profit, a quarter from YTD). */
  derived: boolean;
}

/** A filing date on which previously reported figures were materially changed. */
export interface RestatementEvent {
  filed: string;
  /** The filing date before it: the state the changes are measured against. */
  previous: string;
  /** Filings made on `filed` (indices into the company's filings). */
  filings: number[];
  /** Reported figures changed: material, not a split, not derived. */
  count: number;
  /** The largest relative change among them. */
  largest: RevisionView;
}

export interface AsOfDiff {
  fin: CompanyFinancials;
  from: string;
  to: string;
  revised: RevisionView[];
  added: PointView[];
  filingsBetween: number[];
}

const CHANGE_METRICS: DerivedMetricId[] = [
  "revenue", "operatingIncome", "netIncome", "epsDiluted", "operatingCashFlow",
  "freeCashFlow", "netInterestIncome", "cash", "longTermDebt",
];
const CHANGE_RATIOS: RatioId[] = [
  "grossMargin", "operatingMargin", "netMargin", "fcfMargin", "efficiencyRatio",
];
const PERIOD_DEFINING: DerivedMetricId[] = ["revenue", "netIncome", "operatingCashFlow"];

export class Dataset {
  readonly companies: CompanyFinancials[];
  private readonly byTicker: Map<string, CompanyFinancials>;
  private changeCache = new Map<string, FilingChange>();
  private revisionCache = new Map<string, MaterialRevision[]>();
  private cellCache = new Map<string, RevisionCell[]>();
  private restatementCache = new Map<string, RestatementEvent[]>();

  constructor(readonly snapshot: Snapshot) {
    this.companies = snapshot.companies.map(buildFinancials);
    this.byTicker = new Map(this.companies.map((c) => [c.company.ticker, c]));
  }

  company(ticker: string): CompanyFinancials | undefined {
    return this.byTicker.get(ticker.trim().toUpperCase());
  }

  series(fin: CompanyFinancials, type: PeriodType): PeriodSeries {
    return type === "annual" ? fin.annual : fin.quarterly;
  }

  /** Period ends known on `asOf` (some defining metric had been filed). */
  knownEnds(fin: CompanyFinancials, type: PeriodType, asOf?: string | null): string[] {
    const s = this.series(fin, type);
    if (!asOf) return s.ends;
    return s.ends.filter((end) => PERIOD_DEFINING.some((m) => valueAt(s.metrics.get(m)?.get(end), asOf) !== null));
  }

  latestEnd(fin: CompanyFinancials, type: PeriodType = "annual", asOf?: string | null): string | null {
    const ends = this.knownEnds(fin, type, asOf);
    return ends.length ? ends[ends.length - 1] : null;
  }

  ratioAt(fin: CompanyFinancials, type: PeriodType, end: string, id: RatioId, asOf?: string | null) {
    return computeRatio(id, lookupFor(this.series(fin, type), end, asOf), fin.company.model, type);
  }

  metricAt(fin: CompanyFinancials, type: PeriodType, end: string | null, id: DerivedMetricId, asOf?: string | null) {
    if (!end) return null;
    return valueAt(this.series(fin, type).metrics.get(id)?.get(end), asOf);
  }

  private view(metric: DerivedMetricId, period: PeriodType, p: FinPoint, asOf?: string | null): PointView | null {
    const vintage = vintageAt(p, asOf);
    if (!vintage) return null;
    return { metric, period, end: p.end, value: vintage.value, derived: p.derived, vintage, first: p.history[0], history: p.history };
  }

  /** A metric's series as known on `asOf`, last `last` periods. */
  points(fin: CompanyFinancials, type: PeriodType, metric: DerivedMetricId, last: number, asOf?: string | null): PointView[] {
    const m = this.series(fin, type).metrics.get(metric);
    if (!m) return [];
    const out: PointView[] = [];
    for (const p of m.values()) {
      const v = this.view(metric, type, p, asOf);
      if (v) out.push(v);
    }
    return out.slice(-last);
  }

  ratioSeries(fin: CompanyFinancials, type: PeriodType, id: RatioId, last: number, asOf?: string | null) {
    return this.knownEnds(fin, type, asOf).slice(-last).map((end) => ({
      end,
      label: periodLabel(type, end),
      value: this.ratioAt(fin, type, end, id, asOf),
    }));
  }

  /**
   * Every figure whose in-force value differs between two dates, plus the
   * figures that did not exist on the first date. Derived points are included
   * (they are what a reader would have seen) but flagged: they move because
   * their inputs moved, so counting them would count one restatement twice.
   */
  diff(fin: CompanyFinancials, from: string, to: string): AsOfDiff {
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    const revised: RevisionView[] = [];
    const added: PointView[] = [];
    for (const type of ["annual", "quarterly"] as const) {
      for (const [metric, m] of this.series(fin, type).metrics) {
        const unit = metric === "freeCashFlow" ? "USD" : METRICS[metric].unit;
        for (const p of m.values()) {
          const change = changeBetween(p.history, lo, hi);
          if (change) {
            revised.push({
              metric,
              period: type,
              end: p.end,
              from: change.from,
              to: change.to,
              material: isMaterialChange(change.from.value, change.to.value, unit),
              likelySplit: isLikelySplit(change.from.value, change.to.value, unit),
              derived: p.derived,
            });
          } else if (!vintageAt(p, lo)) {
            const v = this.view(metric, type, p, hi);
            if (v) added.push(v);
          }
        }
      }
    }
    const rel = (r: RevisionView) => Math.abs(r.to.value - r.from.value) / Math.max(Math.abs(r.from.value), 1e-9);
    // Reported material revisions first, then derived consequences, then noise.
    const rank = (r: RevisionView) => (countsAsRevision(r) ? 0 : r.material && !r.likelySplit ? 1 : 2);
    revised.sort((a, b) => rank(a) - rank(b) || rel(b) - rel(a));
    added.sort((a, b) => b.end.localeCompare(a.end) || a.metric.localeCompare(b.metric));
    const filingsBetween = fin.company.filings
      .map((f, i) => [f, i] as const)
      .filter(([f]) => f.filed > lo && f.filed <= hi)
      .sort(([a], [b]) => a.filed.localeCompare(b.filed))
      .map(([, i]) => i);
    return { fin, from: lo, to: hi, revised, added, filingsBetween };
  }

  /** Material revisions in the company's history, newest change first. */
  revisionLog(fin: CompanyFinancials): MaterialRevision[] {
    let log = this.revisionCache.get(fin.company.ticker);
    if (!log) {
      log = companyRevisions(fin.company).sort(
        (a, b) =>
          fin.company.filings[b.toFiling].filed.localeCompare(fin.company.filings[a.toFiling].filed) ||
          b.end.localeCompare(a.end),
      );
      this.revisionCache.set(fin.company.ticker, log);
    }
    return log;
  }

  /**
   * The restatement timeline: each filing date whose filings changed figures
   * that were already on file, oldest first. Every event is the diff between
   * two consecutive filing dates, so opening that diff shows exactly the
   * changes counted here, and nothing can be counted that the diff would not
   * list. A date that only added new periods is not an event.
   */
  restatements(fin: CompanyFinancials): RestatementEvent[] {
    let events = this.restatementCache.get(fin.company.ticker);
    if (!events) {
      events = [];
      const dates = fin.filingDates;
      for (let i = 1; i < dates.length; i++) {
        const d = this.diff(fin, dates[i - 1], dates[i]);
        // diff() sorts counted revisions first, largest relative change first.
        const counted = d.revised.filter(countsAsRevision);
        if (!counted.length) continue;
        events.push({ filed: dates[i], previous: dates[i - 1], filings: d.filingsBetween, count: counted.length, largest: counted[0] });
      }
      this.restatementCache.set(fin.company.ticker, events);
    }
    return events;
  }

  /** Reported figures and first-change delays per (line item, period type). */
  revisionCells(fin: CompanyFinancials): RevisionCell[] {
    let cells = this.cellCache.get(fin.company.ticker);
    if (!cells) {
      cells = companyCells(fin.company);
      this.cellCache.set(fin.company.ticker, cells);
    }
    return cells;
  }

  /**
   * What changed in the latest filing: the newest quarter against the same
   * quarter a year earlier and the quarter before, and margin moves in bps.
   */
  changes(fin: CompanyFinancials): FilingChange {
    const cached = this.changeCache.get(fin.company.ticker);
    if (cached) return cached;
    const c = fin.company;
    const q = fin.quarterly;
    const filing = c.recent.length ? c.filings[c.recent[0]] : null;
    const quarterEnd = q.ends.length ? q.ends[q.ends.length - 1] : null;
    const priorYearEnd = quarterEnd ? yearsBefore(q, quarterEnd, 1) : null;
    const priorQuarterEnd = quarterEnd ? previousEnd(q, quarterEnd) : null;
    const pct = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : (a - b) / Math.abs(b));

    const metrics: MetricChange[] = CHANGE_METRICS.filter((id) => q.metrics.has(id))
      .map((metric) => {
        const value = this.metricAt(fin, "quarterly", quarterEnd, metric);
        const priorYear = this.metricAt(fin, "quarterly", priorYearEnd, metric);
        const priorQuarter = this.metricAt(fin, "quarterly", priorQuarterEnd, metric);
        return { metric, value, priorYear, yoy: pct(value, priorYear), priorQuarter, qoq: pct(value, priorQuarter) };
      })
      .filter((m) => m.value !== null);

    const ratios: RatioChange[] = CHANGE_RATIOS.filter((id) => ratioApplies(id, c.model))
      .map((ratio) => {
        const value = quarterEnd ? this.ratioAt(fin, "quarterly", quarterEnd, ratio) : null;
        const priorYear = priorYearEnd ? this.ratioAt(fin, "quarterly", priorYearEnd, ratio) : null;
        return { ratio, value, priorYear, delta: value === null || priorYear === null ? null : value - priorYear };
      })
      .filter((r) => r.value !== null);

    const change: FilingChange = {
      fin,
      filing,
      quarterEnd,
      priorYearEnd,
      priorQuarterEnd,
      lagging: !!(filing && quarterEnd && filing.period > quarterEnd),
      metrics,
      ratios,
      headline: "",
    };
    change.headline = headline(change);
    this.changeCache.set(c.ticker, change);
    return change;
  }

  latestFilings(first: number, form?: string | null): FilingChange[] {
    return this.companies
      .map((c) => this.changes(c))
      .filter((ch) => ch.filing && (!form || ch.filing.form === form))
      .sort((a, b) => b.filing!.filed.localeCompare(a.filing!.filed) || a.fin.company.ticker.localeCompare(b.fin.company.ticker))
      .slice(0, first);
  }
}

function headline(ch: FilingChange): string {
  if (!ch.quarterEnd) return "No quarterly XBRL data.";
  const parts: string[] = [];
  const rev = ch.metrics.find((m) => m.metric === "revenue");
  if (rev?.value != null) {
    parts.push(rev.yoy === null ? `Revenue ${formatMoney(rev.value)}` : `Revenue ${formatChange(rev.yoy)} YoY to ${formatMoney(rev.value)}`);
  }
  const margin =
    ch.ratios.find((r) => r.ratio === "operatingMargin" && r.delta !== null) ??
    ch.ratios.find((r) => r.ratio === "netMargin" && r.delta !== null);
  if (margin) parts.push(`${RATIOS[margin.ratio].label.toLowerCase()} ${formatBps(margin.delta)}`);
  const ni = ch.metrics.find((m) => m.metric === "netIncome");
  if (ni?.yoy != null) parts.push(`net income ${formatChange(ni.yoy)}`);
  return parts.length ? parts.join(" · ") : "No comparable figures.";
}

/** A restatement of a reported figure: material, not a split, not derived. */
export function countsAsRevision(r: Pick<RevisionView, "material" | "likelySplit" | "derived">): boolean {
  return r.material && !r.likelySplit && !r.derived;
}

export function metricLabel(id: DerivedMetricId): string {
  return id === "freeCashFlow" ? "Free cash flow" : METRICS[id].label;
}

export function metricUnit(id: DerivedMetricId): "USD" | "USD/shares" {
  return id === "freeCashFlow" ? "USD" : METRICS[id].unit;
}

export { daysBetween };
export type { MetricId };

let instance: Dataset | null = null;

export function loadSnapshot(file?: string): Snapshot {
  // Statically scoped so Turbopack traces data/ into the server output, not the whole repo.
  const target = file ?? path.join(process.cwd(), "data", "snapshot.json");
  return JSON.parse(readFileSync(/* turbopackIgnore: true */ target, "utf8")) as Snapshot;
}

export function getDataset(): Dataset {
  instance ??= new Dataset(loadSnapshot());
  return instance;
}
