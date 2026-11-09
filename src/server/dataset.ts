/**
 * In-memory query layer over data/snapshot.json. Built once per server process
 * (~100 companies, ~33k points), with per-company memoisation of the things the
 * screener asks for on every request: latest ratios and sector ranks.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { METRICS } from "@/lib/edgar/concepts";
import type { Snapshot, SnapshotFiling, SnapshotRevision } from "@/lib/edgar/snapshot";
import {
  buildFinancials,
  lookupFor,
  periodLabel,
  previousEnd,
  yearsBefore,
  type CompanyFinancials,
  type DerivedMetricId,
  type PeriodSeries,
} from "@/lib/finance/derive";
import {
  RATIO_IDS,
  RATIOS,
  computeRatio,
  median,
  rankAmong,
  ratioApplies,
  type RatioId,
} from "@/lib/finance/ratios";
import { formatBps, formatChange, formatMoney } from "@/lib/format";
import { SECTORS, type Sector } from "@/lib/universe";

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
  revisions: SnapshotRevision[];
  headline: string;
}

export interface RatioRank {
  ratio: RatioId;
  value: number | null;
  rank: number | null;
  of: number;
  percentile: number | null;
  sectorMedian: number | null;
}

const CHANGE_METRICS: DerivedMetricId[] = [
  "revenue", "operatingIncome", "netIncome", "epsDiluted", "operatingCashFlow",
  "freeCashFlow", "netInterestIncome", "cash", "longTermDebt",
];
const CHANGE_RATIOS: RatioId[] = [
  "grossMargin", "operatingMargin", "netMargin", "fcfMargin", "efficiencyRatio",
];

export class Dataset {
  readonly companies: CompanyFinancials[];
  private readonly byTicker: Map<string, CompanyFinancials>;
  private readonly ratioCache = new Map<string, Map<RatioId, number | null>>();
  private rankCache: Map<string, RatioRank[]> | null = null;
  private changeCache = new Map<string, FilingChange>();

  constructor(readonly snapshot: Snapshot) {
    this.companies = snapshot.companies.map(buildFinancials);
    this.byTicker = new Map(this.companies.map((c) => [c.company.ticker, c]));
  }

  company(ticker: string): CompanyFinancials | undefined {
    return this.byTicker.get(ticker.trim().toUpperCase());
  }

  series(fin: CompanyFinancials, type: "annual" | "quarterly"): PeriodSeries {
    return type === "annual" ? fin.annual : fin.quarterly;
  }

  latestEnd(fin: CompanyFinancials, type: "annual" | "quarterly" = "annual"): string | null {
    const ends = this.series(fin, type).ends;
    return ends.length ? ends[ends.length - 1] : null;
  }

  ratioAt(fin: CompanyFinancials, type: "annual" | "quarterly", end: string, id: RatioId) {
    return computeRatio(id, lookupFor(this.series(fin, type), end), fin.company.model, type);
  }

  metricAt(fin: CompanyFinancials, type: "annual" | "quarterly", end: string | null, id: DerivedMetricId) {
    if (!end) return null;
    return this.series(fin, type).metrics.get(id)?.get(end)?.value ?? null;
  }

  /** Latest fiscal-year ratios, memoised per company. */
  latestRatios(fin: CompanyFinancials): Map<RatioId, number | null> {
    const key = fin.company.ticker;
    let m = this.ratioCache.get(key);
    if (!m) {
      const end = this.latestEnd(fin);
      m = new Map(
        RATIO_IDS.map((id) => [id, end ? this.ratioAt(fin, "annual", end, id) : null]),
      );
      this.ratioCache.set(key, m);
    }
    return m;
  }

  ratioSeries(fin: CompanyFinancials, type: "annual" | "quarterly", id: RatioId, last: number) {
    const s = this.series(fin, type);
    return s.ends.slice(-last).map((end) => ({
      end,
      label: periodLabel(type, end),
      value: this.ratioAt(fin, type, end, id),
    }));
  }

  /** Rank every company against its GICS sector on each ratio's latest value. */
  ranking(fin: CompanyFinancials): RatioRank[] {
    if (!this.rankCache) {
      this.rankCache = new Map();
      const bySector = new Map<Sector, CompanyFinancials[]>();
      for (const c of this.companies) {
        const list = bySector.get(c.company.sector) ?? [];
        list.push(c);
        bySector.set(c.company.sector, list);
      }
      for (const peers of bySector.values()) {
        const valuesByRatio = new Map<RatioId, number[]>(
          RATIO_IDS.map((id) => [
            id,
            peers
              .map((p) => this.latestRatios(p).get(id))
              .filter((v): v is number => v !== null && v !== undefined),
          ]),
        );
        for (const c of peers) {
          const ranks: RatioRank[] = [];
          for (const id of RATIO_IDS) {
            if (!ratioApplies(id, c.company.model)) continue;
            const values = valuesByRatio.get(id)!;
            const value = this.latestRatios(c).get(id) ?? null;
            const r = value === null ? null : rankAmong(value, values, RATIOS[id].better);
            ranks.push({
              ratio: id,
              value,
              rank: r?.rank ?? null,
              of: values.length,
              percentile: r?.percentile ?? null,
              sectorMedian: median(values),
            });
          }
          this.rankCache.set(c.company.ticker, ranks);
        }
      }
    }
    return this.rankCache.get(fin.company.ticker) ?? [];
  }

  /** Same-sector companies closest in size (log revenue). */
  peers(fin: CompanyFinancials, limit: number): CompanyFinancials[] {
    const size = (c: CompanyFinancials) => {
      const rev = this.metricAt(c, "annual", this.latestEnd(c), "revenue");
      return rev && rev > 0 ? Math.log(rev) : null;
    };
    const mine = size(fin);
    return this.companies
      .filter((c) => c !== fin && c.company.sector === fin.company.sector)
      .map((c) => ({ c, d: mine === null ? 0 : Math.abs((size(c) ?? Infinity) - mine) }))
      .sort((a, b) => a.d - b.d || a.c.company.ticker.localeCompare(b.c.company.ticker))
      .slice(0, limit)
      .map((x) => x.c);
  }

  sectorSummaries() {
    return SECTORS.map((sector) => {
      const members = this.companies.filter((c) => c.company.sector === sector);
      return {
        sector,
        companies: members.length,
        medians: RATIO_IDS.map((id) => ({
          ratio: id,
          value: median(
            members
              .map((c) => this.latestRatios(c).get(id))
              .filter((v): v is number => v !== null && v !== undefined),
          ),
        })),
      };
    });
  }

  /**
   * What changed in the latest filing: the newest quarter against the same
   * quarter a year earlier and the quarter before, margin moves in basis
   * points, and any prior-period figures that filing revised.
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

    const pct = (a: number | null, b: number | null) =>
      a === null || b === null || b === 0 ? null : (a - b) / Math.abs(b);

    const metrics: MetricChange[] = CHANGE_METRICS.filter((id) =>
      q.metrics.has(id),
    ).map((metric) => {
      const value = this.metricAt(fin, "quarterly", quarterEnd, metric);
      const priorYear = this.metricAt(fin, "quarterly", priorYearEnd, metric);
      const priorQuarter = this.metricAt(fin, "quarterly", priorQuarterEnd, metric);
      return {
        metric,
        value,
        priorYear,
        yoy: pct(value, priorYear),
        priorQuarter,
        qoq: pct(value, priorQuarter),
      };
    }).filter((m) => m.value !== null);

    const ratios: RatioChange[] = CHANGE_RATIOS.filter((id) => ratioApplies(id, c.model)).map(
      (ratio) => {
        const value = quarterEnd ? this.ratioAt(fin, "quarterly", quarterEnd, ratio) : null;
        const priorYear = priorYearEnd ? this.ratioAt(fin, "quarterly", priorYearEnd, ratio) : null;
        return {
          ratio,
          value,
          priorYear,
          delta: value === null || priorYear === null ? null : value - priorYear,
        };
      },
    ).filter((r) => r.value !== null);

    // The filing that carried the latest quarter's numbers; revisions it made.
    const dataFiling =
      quarterEnd === null
        ? null
        : (q.metrics.get("revenue")?.get(quarterEnd)?.filing ??
          q.metrics.get("netIncome")?.get(quarterEnd)?.filing ??
          null);
    const revisions =
      dataFiling === null ? [] : c.revisions.filter((r) => r.toFiling === dataFiling);

    const change: FilingChange = {
      fin,
      filing,
      quarterEnd,
      priorYearEnd,
      priorQuarterEnd,
      lagging: !!(filing && quarterEnd && filing.period > quarterEnd),
      metrics,
      ratios,
      revisions,
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
      .sort(
        (a, b) =>
          b.filing!.filed.localeCompare(a.filing!.filed) ||
          a.fin.company.ticker.localeCompare(b.fin.company.ticker),
      )
      .slice(0, first);
  }
}

function headline(ch: FilingChange): string {
  if (!ch.quarterEnd) return "No quarterly XBRL data.";
  const parts: string[] = [];
  const rev = ch.metrics.find((m) => m.metric === "revenue");
  if (rev?.value != null) {
    parts.push(
      rev.yoy === null
        ? `Revenue ${formatMoney(rev.value)}`
        : `Revenue ${formatChange(rev.yoy)} YoY to ${formatMoney(rev.value)}`,
    );
  }
  const margin =
    ch.ratios.find((r) => r.ratio === "operatingMargin" && r.delta !== null) ??
    ch.ratios.find((r) => r.ratio === "netMargin" && r.delta !== null);
  if (margin) {
    parts.push(`${RATIOS[margin.ratio].label.toLowerCase()} ${formatBps(margin.delta)}`);
  }
  const ni = ch.metrics.find((m) => m.metric === "netIncome");
  if (ni?.yoy != null) parts.push(`net income ${formatChange(ni.yoy)}`);
  if (ch.revisions.length) {
    parts.push(`${ch.revisions.length} prior figure${ch.revisions.length === 1 ? "" : "s"} revised`);
  }
  return parts.length ? parts.join(" · ") : "No comparable figures.";
}

export function metricLabel(id: DerivedMetricId): string {
  return id === "freeCashFlow" ? "Free cash flow" : METRICS[id].label;
}

let instance: Dataset | null = null;

export function loadSnapshot(file = path.join(process.cwd(), "data", "snapshot.json")): Snapshot {
  return JSON.parse(readFileSync(file, "utf8")) as Snapshot;
}

export function getDataset(): Dataset {
  instance ??= new Dataset(loadSnapshot());
  return instance;
}
