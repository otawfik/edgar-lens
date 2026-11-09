import { GraphQLError } from "graphql";
import { METRICS } from "@/lib/edgar/concepts";
import { fiscalYearOf, quarterLabel } from "@/lib/edgar/periods";
import type { SnapshotCompany, SnapshotRevision } from "@/lib/edgar/snapshot";
import { periodLabel, type CompanyFinancials, type DerivedMetricId } from "@/lib/finance/derive";
import { RATIO_IDS, RATIOS, type RatioId } from "@/lib/finance/ratios";
import { fromEnum, toEnum } from "@/lib/enums";
import { metricLabel, type Dataset } from "../dataset";
import type {
  BusinessModel,
  CompanyFilter,
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
const periodType = (p: PeriodType | null | undefined) =>
  p === "QUARTERLY" ? "quarterly" : "annual";
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

function filingOf(c: SnapshotCompany, index: number): Filing {
  const f = c.filings[index];
  const folder = f.accn.replace(/-/g, "");
  const url = f.doc
    ? `https://www.sec.gov/Archives/edgar/data/${f.cik}/${folder}/${f.doc}`
    : `https://www.sec.gov/Archives/edgar/data/${f.cik}/${folder}/${f.accn}-index.htm`;
  return { accession: f.accn, form: f.form, filed: f.filed, period: f.period, url };
}

/** Per-share values that shrank by ~2×, 3×, 4×, 10×… were split-adjusted. */
export function isLikelySplit(r: Pick<SnapshotRevision, "metric" | "from" | "to">): boolean {
  if (METRICS[r.metric].unit !== "USD/shares" || r.to === 0) return false;
  const factor = r.from / r.to;
  const k = Math.round(factor);
  return k >= 2 && Math.abs(factor - k) / k < 0.02;
}

function revisionOf(c: SnapshotCompany, r: SnapshotRevision): Revision {
  return {
    metric: metricEnum(r.metric),
    label: METRICS[r.metric].label,
    period: r.period === "annual" ? "ANNUAL" : "QUARTERLY",
    end: r.end,
    periodLabel: periodLabel(r.period, r.end),
    from: r.from,
    to: r.to,
    change: r.from === 0 ? null : (r.to - r.from) / Math.abs(r.from),
    likelySplit: isLikelySplit(r),
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
      const latestFiled = dataset.companies
        .flatMap((c) => c.company.filings.map((f) => f.filed))
        .reduce<string | null>((max, d) => (max === null || d > max ? d : max), null);
      return {
        generatedAt: s.generatedAt,
        source: s.source,
        companies: s.stats.companies,
        dataPoints: s.stats.points,
        filings: s.stats.filings,
        revisions: s.stats.revisions,
        rawFactsScanned: s.stats.rawFactsScanned,
        latestFiled,
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
      const list = filter
        ? dataset.companies.filter((c) => matchesFilter(dataset, c, filter))
        : dataset.companies;
      return list.slice(0, n);
    },
    company: (_, { ticker }, { dataset }) => dataset.company(ticker) ?? null,
    compare: (_, { tickers }, { dataset }) => {
      if (tickers.length > 6) {
        throw new GraphQLError("compare takes at most 6 tickers.", {
          extensions: { code: "BAD_USER_INPUT", argument: "tickers" },
        });
      }
      const seen = new Set<string>();
      return tickers
        .map((t) => dataset.company(t))
        .filter((c): c is CompanyFinancials => {
          if (!c || seen.has(c.company.ticker)) return false;
          seen.add(c.company.ticker);
          return true;
        });
    },
    latestFilings: (_, { first, form }, { dataset }) =>
      dataset.latestFilings(
        size("first", first, 25, 120),
        form === "TEN_K" ? "10-K" : form === "TEN_Q" ? "10-Q" : null,
      ),
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
    series: (fin, { metric, period, last }, { dataset }) => {
      const type = periodType(period);
      const n = size("last", last, 11, 40);
      const points = dataset.series(fin, type).metrics.get(metricId(metric));
      if (!points) return [];
      return [...points.values()].slice(-n).map((p) => ({
        end: p.end,
        label: periodLabel(type, p.end),
        fiscalYear: fiscalYearOf(p.end),
        value: p.value,
        derived: p.derived,
        filing: p.filing === null ? null : filingOf(fin.company, p.filing),
      }));
    },
    ratio: (fin, { id, period, last }, { dataset }) => {
      const type = periodType(period);
      return dataset
        .ratioSeries(fin, type, ratioId(id), size("last", last, 11, 40))
        .map((p) => ({ ...p, fiscalYear: fiscalYearOf(p.end) }));
    },
    ranking: (fin, _, { dataset }) =>
      dataset.ranking(fin).map((r) => ({ ...r, ratio: ratioEnum(r.ratio) })),
    peers: (fin, { limit }, { dataset }) => dataset.peers(fin, size("limit", limit, 5, 10)),
    changes: (fin, _, { dataset }) => dataset.changes(fin),
    filings: (fin, { first }) =>
      fin.company.recent.slice(0, size("first", first, 6, 20)).map((i) => filingOf(fin.company, i)),
    revisions: (fin, { first }) =>
      [...fin.company.revisions]
        .sort((a, b) => b.end.localeCompare(a.end) || a.metric.localeCompare(b.metric))
        .slice(0, size("first", first, 25, 200))
        .map((r) => revisionOf(fin.company, r)),
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
    metrics: (ch) =>
      ch.metrics.map((m) => ({ ...m, metric: metricEnum(m.metric), label: metricLabel(m.metric) })),
    ratios: (ch) =>
      ch.ratios.map((r) => ({
        ratio: ratioEnum(r.ratio),
        value: r.value,
        priorYear: r.priorYear,
        delta: r.delta,
      })),
    revisions: (ch) => ch.revisions.map((r) => revisionOf(ch.fin.company, r)),
  },
};
