import { GraphQLError } from "graphql";
import { METRICS } from "@/lib/edgar/concepts";
import { fiscalYearOf, isIsoDate, quarterLabel } from "@/lib/edgar/periods";
import { daysBetween, isLikelySplit } from "@/lib/edgar/pointInTime";
import type { MaterialRevision } from "@/lib/edgar/revisionStats";
import type { PeriodType as SnapshotPeriod, SnapshotCompany } from "@/lib/edgar/snapshot";
import { periodLabel, type CompanyFinancials, type DerivedMetricId, type FinVintage } from "@/lib/finance/derive";
import { RATIO_IDS, RATIOS, type RatioId } from "@/lib/finance/ratios";
import { fromEnum, toEnum } from "@/lib/enums";
import { countsAsRevision, metricLabel, metricUnit, type Dataset, type PointView, type RevisionView } from "../dataset";
import type {
  BusinessModel,
  CompanyFilter,
  DataPoint,
  Filing,
  Metric,
  PeriodType,
  Ratio,
  Resolvers,
  Revision,
} from "./resolvers-types.generated";

const metricId = (m: Metric) => fromEnum(m) as DerivedMetricId;
const ratioId = (r: Ratio) => fromEnum(r) as RatioId;
const metricEnum = (id: DerivedMetricId) => toEnum(id) as Metric;
const ratioEnum = (id: RatioId) => toEnum(id) as Ratio;
const periodType = (p: PeriodType | null | undefined): SnapshotPeriod => (p === "QUARTERLY" ? "quarterly" : "annual");
const periodEnum = (p: SnapshotPeriod): PeriodType => (p === "annual" ? "ANNUAL" : "QUARTERLY");
const modelEnum = (m: SnapshotCompany["model"]) => m.toUpperCase() as BusinessModel;

/** Reject out-of-range page sizes instead of silently clamping them. */
function size(name: string, value: number | null | undefined, fallback: number, max: number): number {
  const n = value ?? fallback;
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new GraphQLError(`"${name}" must be an integer between 1 and ${max}.`, {
      extensions: { code: "BAD_USER_INPUT", argument: name },
    });
  }
  return n;
}

function date(name: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (!isIsoDate(value)) {
    throw new GraphQLError(`"${name}" must be an ISO date (yyyy-mm-dd).`, {
      extensions: { code: "BAD_USER_INPUT", argument: name },
    });
  }
  return value;
}

export function filingOf(c: SnapshotCompany, index: number): Filing {
  const f = c.filings[index];
  const folder = f.accn.replace(/-/g, "");
  const base = `https://www.sec.gov/Archives/edgar/data/${f.cik}/${folder}`;
  const indexUrl = `${base}/${f.accn}-index.htm`;
  return { accession: f.accn, form: f.form, filed: f.filed, period: f.period, url: f.doc ? `${base}/${f.doc}` : indexUrl, indexUrl };
}

const vintageOf = (c: SnapshotCompany, v: FinVintage) => ({ value: v.value, filing: filingOf(c, v.filing) });

function dataPoint(fin: CompanyFinancials, p: PointView, asOf: string | null): DataPoint {
  const c = fin.company;
  const known = asOf ? p.history.filter((v) => v.filed <= asOf) : p.history;
  return {
    end: p.end,
    label: periodLabel(p.period, p.end),
    fiscalYear: fiscalYearOf(p.end),
    value: p.value,
    derived: p.derived,
    vintage: vintageOf(c, p.vintage),
    first: vintageOf(c, p.first),
    vintages: known.length,
    revised: p.vintage.value !== p.first.value,
    history: p.history.map((v) => vintageOf(c, v)),
  };
}

function revisionFromView(fin: CompanyFinancials, r: RevisionView): Revision {
  const c = fin.company;
  return {
    metric: metricEnum(r.metric),
    label: metricLabel(r.metric),
    period: periodEnum(r.period),
    end: r.end,
    periodLabel: periodLabel(r.period, r.end),
    from: r.from.value,
    to: r.to.value,
    change: r.from.value === 0 ? null : (r.to.value - r.from.value) / Math.abs(r.from.value),
    lagDays: daysBetween(r.from.filed, r.to.filed),
    material: r.material,
    likelySplit: r.likelySplit,
    derived: r.derived,
    firstReported: filingOf(c, r.from.filing),
    revisedIn: filingOf(c, r.to.filing),
  };
}

function revisionFromLog(c: SnapshotCompany, r: MaterialRevision): Revision {
  return {
    metric: metricEnum(r.metric),
    label: METRICS[r.metric].label,
    period: periodEnum(r.period),
    end: r.end,
    periodLabel: periodLabel(r.period, r.end),
    from: r.from,
    to: r.to,
    change: r.from === 0 ? null : (r.to - r.from) / Math.abs(r.from),
    lagDays: r.lagDays,
    material: true,
    likelySplit: isLikelySplit(r.from, r.to, METRICS[r.metric].unit),
    derived: false,
    firstReported: filingOf(c, r.fromFiling),
    revisedIn: filingOf(c, r.toFiling),
  };
}

function matchesFilter(ds: Dataset, fin: CompanyFinancials, filter: CompanyFilter): boolean {
  const c = fin.company;
  if (filter.sectors?.length && !filter.sectors.includes(c.sector)) return false;
  if (filter.models?.length && !filter.models.includes(modelEnum(c.model))) return false;
  if (filter.tickers?.length && !filter.tickers.map((t) => t.toUpperCase()).includes(c.ticker)) return false;
  if (filter.search) {
    const q = filter.search.trim().toLowerCase();
    if (q && !c.ticker.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q)) return false;
  }
  for (const b of filter.ratioBounds ?? []) {
    const v = ds.latestRatios(fin).get(ratioId(b.ratio));
    if (v === null || v === undefined) return false;
    if (b.min !== null && b.min !== undefined && v < b.min) return false;
    if (b.max !== null && b.max !== undefined && v > b.max) return false;
  }
  return true;
}

export const resolvers: Resolvers = {
  Query: {
    dataset: (_, __, { dataset }) => {
      const s = dataset.snapshot;
      return {
        generatedAt: s.generatedAt,
        source: s.source,
        companies: s.stats.companies,
        figures: s.stats.figures,
        vintages: s.stats.vintages,
        filings: s.stats.filings,
        rawFactsScanned: s.stats.rawFactsScanned,
        earliestFiled: s.stats.earliestFiled,
        latestFiled: s.stats.latestFiled,
      };
    },
    revisionStats: (_, __, { dataset }) => {
      const r = dataset.snapshot.revisions;
      return {
        ...r,
        companies: r.companies.map((row) => ({
          ...row,
          largest: row.largest
            ? {
                metric: metricEnum(row.largest.metric),
                label: METRICS[row.largest.metric].label,
                period: periodEnum(row.largest.period),
                end: row.largest.end,
                periodLabel: periodLabel(row.largest.period, row.largest.end),
                from: row.largest.from,
                to: row.largest.to,
                change: row.largest.from === 0 ? null : (row.largest.to - row.largest.from) / Math.abs(row.largest.from),
              }
            : null,
        })),
        metrics: r.metrics.map((m) => ({ ...m, metric: metricEnum(m.metric), label: METRICS[m.metric].label })),
      };
    },
    sectors: (_, __, { dataset }) =>
      dataset.sectorSummaries().map((s) => ({
        sector: s.sector,
        companies: s.companies,
        medians: s.medians.map((m) => ({ ratio: ratioEnum(m.ratio), value: m.value })),
      })),
    companies: (_, { filter, first }, { dataset }) => {
      const n = size("first", first, 200, 200);
      const list = filter ? dataset.companies.filter((c) => matchesFilter(dataset, c, filter)) : dataset.companies;
      return list.slice(0, n);
    },
    company: (_, { ticker }, { dataset }) => dataset.company(ticker) ?? null,
    latestFilings: (_, { first, form }, { dataset }) =>
      dataset.latestFilings(size("first", first, 25, 120), form === "TEN_K" ? "10-K" : form === "TEN_Q" ? "10-Q" : null),
    ratioDefinitions: () =>
      RATIO_IDS.map((id) => {
        const r = RATIOS[id];
        return {
          id: ratioEnum(id),
          label: r.label,
          short: r.short,
          format: r.format === "percent" ? "PERCENT" : "MULTIPLE",
          better: r.better === "higher" ? "HIGHER" : "LOWER",
          quarterly: r.quarterly,
          models: r.models.map(modelEnum),
          description: r.description,
        };
      }),
    metricDefinitions: () => [
      ...Object.values(METRICS).map((m) => ({ id: metricEnum(m.id), label: m.label, unit: m.unit })),
      { id: "FREE_CASH_FLOW" as const, label: "Free cash flow", unit: "USD" },
    ],
  },

  Company: {
    cik: (fin) => fin.company.cik,
    ticker: (fin) => fin.company.ticker,
    name: (fin) => fin.company.name,
    sector: (fin) => fin.company.sector,
    industry: (fin) => fin.company.industry,
    model: (fin) => modelEnum(fin.company.model),
    fiscalYearEnd: (fin) => fin.company.fiscalYearEnd,
    secUrl: (fin) =>
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${String(fin.company.cik).padStart(10, "0")}&type=10-&dateb=&owner=include&count=40`,
    latestFiscalYear: (fin, _, { dataset }) => {
      const end = dataset.latestEnd(fin);
      return end ? fiscalYearOf(end) : null;
    },
    latestPeriodEnd: (fin, _, { dataset }) => dataset.latestEnd(fin),
    filingDates: (fin) => fin.filingDates,
    keyStats: (fin, _, { dataset }) => {
      const end = dataset.latestEnd(fin);
      const m = (id: DerivedMetricId) => dataset.metricAt(fin, "annual", end, id);
      return {
        fiscalYear: end ? fiscalYearOf(end) : null,
        periodEnd: end,
        revenue: m("revenue"),
        netIncome: m("netIncome"),
        operatingCashFlow: m("operatingCashFlow"),
        freeCashFlow: m("freeCashFlow"),
        totalAssets: m("totalAssets"),
        ratios: [...dataset.latestRatios(fin)].map(([id, value]) => ({ ratio: ratioEnum(id), value })),
      };
    },
    series: (fin, { metric, period, last, asOf }, { dataset }) => {
      const d = date("asOf", asOf);
      return dataset
        .points(fin, periodType(period), metricId(metric), size("last", last, 11, 40), d)
        .map((p) => dataPoint(fin, p, d));
    },
    lineItems: (fin, { period, last, asOf }, { dataset }) => {
      const d = date("asOf", asOf);
      const type = periodType(period);
      const n = size("last", last, 8, 40);
      return [...dataset.series(fin, type).metrics.keys()]
        .map((metric) => ({
          metric: metricEnum(metric),
          label: metricLabel(metric),
          unit: metricUnit(metric),
          points: dataset.points(fin, type, metric, n, d).map((p) => dataPoint(fin, p, d)),
        }))
        .filter((li) => li.points.length);
    },
    ratio: (fin, { id, period, last, asOf }, { dataset }) =>
      dataset
        .ratioSeries(fin, periodType(period), ratioId(id), size("last", last, 11, 40), date("asOf", asOf))
        .map((p) => ({ ...p, fiscalYear: fiscalYearOf(p.end) })),
    diff: (fin, { from, to }, { dataset }) => {
      const d = dataset.diff(fin, date("from", from)!, date("to", to)!);
      return {
        from: d.from,
        to: d.to,
        revised: d.revised.map((r) => revisionFromView(fin, r)),
        materialCount: d.revised.filter(countsAsRevision).length,
        added: d.added.map((p) => dataPoint(fin, p, d.to)),
        filingsBetween: d.filingsBetween.map((i) => filingOf(fin.company, i)),
      };
    },
    revisionCount: (fin, _, { dataset }) => dataset.revisionLog(fin).length,
    revisionCells: (fin, _, { dataset }) =>
      dataset.revisionCells(fin).map((c) => ({ ...c, metric: metricEnum(c.metric), period: periodEnum(c.period) })),
    revisions: (fin, { first }, { dataset }) =>
      dataset.revisionLog(fin).slice(0, size("first", first, 50, 200)).map((r) => revisionFromLog(fin.company, r)),
    ranking: (fin, _, { dataset }) => dataset.ranking(fin).map((r) => ({ ...r, ratio: ratioEnum(r.ratio) })),
    peers: (fin, { limit }, { dataset }) => dataset.peers(fin, size("limit", limit, 5, 10)),
    changes: (fin, _, { dataset }) => dataset.changes(fin),
    filings: (fin, { first }) => fin.company.recent.slice(0, size("first", first, 8, 20)).map((i) => filingOf(fin.company, i)),
  },

  FilingChange: {
    company: (ch) => ch.fin,
    filing: (ch) => {
      const c = ch.fin.company;
      return ch.filing ? filingOf(c, c.filings.indexOf(ch.filing)) : null;
    },
    quarterEnd: (ch) => ch.quarterEnd,
    quarterLabel: (ch) => (ch.quarterEnd ? quarterLabel(ch.quarterEnd) : null),
    priorYearEnd: (ch) => ch.priorYearEnd,
    priorQuarterEnd: (ch) => ch.priorQuarterEnd,
    lagging: (ch) => ch.lagging,
    headline: (ch) => ch.headline,
    metrics: (ch) => ch.metrics.map((m) => ({ ...m, metric: metricEnum(m.metric), label: metricLabel(m.metric) })),
    ratios: (ch) => ch.ratios.map((r) => ({ ...r, ratio: ratioEnum(r.ratio) })),
  },
};
