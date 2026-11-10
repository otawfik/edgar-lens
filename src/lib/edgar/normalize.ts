/**
 * Turn SEC "company facts" JSON into clean annual and quarterly series that
 * keep their point-in-time history.
 *
 * The raw API returns every value ever tagged, from every filing: Apple's FY2022
 * revenue appears in the FY2022, FY2023 and FY2024 10-Ks (as a comparative),
 * cash-flow lines in 10-Qs are year-to-date rather than per quarter, and the
 * tag a company uses can change between years. This module:
 *
 *   1. groups facts by reporting period and collapses them into *vintages*
 *      (the first value filed, then each filing that changed it);
 *   2. classifies periods as annual / quarterly / instant by length;
 *   3. derives discrete quarters from YTD chains (Q2 = 6M − 3M, Q4 = FY − 9M),
 *      with the derived history recomputed at each filing date;
 *   4. resolves each metric's concept fallback chain period by period.
 *
 * Everything here is pure, so it is unit-tested against small fixtures.
 */
import { METRICS, METRIC_IDS, type MetricDef, type MetricId } from "./concepts";
import { addDays, fiscalYearOf, isAnnualSpan, isQuarterSpan, periodDays } from "./periods";
import { combineVintages, toVintages, type Vintage } from "./pointInTime";
import type { SnapshotCompany, SnapshotFiling, SnapshotPoint, SnapshotVintage } from "./snapshot";
import type { UniverseEntry } from "../universe";

export interface RawFact {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number | null;
  fp?: string | null;
  form: string;
  filed: string;
  frame?: string;
}

export interface CompanyFactsJson {
  cik: number;
  entityName: string;
  facts: Record<
    string,
    Record<string, { label?: string | null; units: Record<string, RawFact[]> }>
  >;
}

export interface SubmissionsJson {
  cik: string | number;
  name: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
    };
  };
}

/** Periodic reports only; 8-K press releases and S-1s are ignored. */
export const FILING_FORMS = new Set([
  "10-K", "10-K/A", "10-KT", "10-KT/A", "10-Q", "10-Q/A",
]);

export interface Observation {
  start: string | null;
  end: string;
  /** Value-changing vintages, in filing order; never empty. */
  history: Vintage[];
  /** Reported in a 10-K at least once (not just a 10-Q). */
  inAnnualReport: boolean;
  /** True when computed from a YTD chain rather than tagged directly. */
  derived?: boolean;
}

export const latest = (o: Observation): Vintage => o.history[o.history.length - 1];

/** One observation per (start, end) context, carrying its vintages. */
export function collapseFacts(facts: readonly RawFact[]): Observation[] {
  const groups = new Map<string, RawFact[]>();
  for (const f of facts) {
    if (!FILING_FORMS.has(f.form) || !Number.isFinite(f.val)) continue;
    const key = `${f.start ?? ""}|${f.end}`;
    const g = groups.get(key);
    if (g) g.push(f);
    else groups.set(key, [f]);
  }
  const out: Observation[] = [];
  for (const g of groups.values()) {
    out.push({
      start: g[0].start ?? null,
      end: g[0].end,
      history: toVintages(g),
      inAnnualReport: g.some((f) => f.form.startsWith("10-K")),
    });
  }
  return out;
}

/** Keep the observation whose length is closest to `target` days for each end date. */
function bestPerEnd(obs: Observation[], target: number): Map<string, Observation> {
  const out = new Map<string, Observation>();
  for (const o of obs) {
    const cur = out.get(o.end);
    if (!cur) {
      out.set(o.end, o);
      continue;
    }
    const d = (x: Observation) => Math.abs(periodDays(x.start!, x.end) - target);
    if (d(o) < d(cur)) out.set(o.end, o);
  }
  return out;
}

/**
 * Fiscal years: ~12-month periods that appear in a 10-K. The 10-K condition
 * matters — Amazon tags trailing-twelve-month figures in its 10-Qs, which are
 * a year long but are not fiscal years.
 */
export function annualObservations(obs: Observation[]): Map<string, Observation> {
  return bestPerEnd(
    obs.filter((o) => o.start && o.inAnnualReport && isAnnualSpan(o.start, o.end)),
    365,
  );
}

export function instantObservations(obs: Observation[]): Map<string, Observation> {
  const out = new Map<string, Observation>();
  for (const o of obs) if (!o.start) out.set(o.end, o);
  return out;
}

/**
 * Discrete quarters. Directly tagged three-month values win; otherwise a
 * quarter is the difference between consecutive year-to-date values that share
 * a start date (Q2 = H1 − Q1, Q3 = 9M − H1, Q4 = FY − 9M). That is how
 * cash-flow statements, which 10-Qs only report YTD, get quarterly values.
 * The derived history is recomputed at every filing date of either input, so
 * "as of" queries on derived quarters stay honest.
 */
export function quarterlyObservations(
  obs: Observation[],
  derive: boolean,
): Map<string, Observation> {
  const durations = obs.filter((o): o is Observation & { start: string } => !!o.start);
  const direct = bestPerEnd(
    durations.filter((o) => isQuarterSpan(o.start, o.end)),
    91,
  );
  if (!derive) return direct;

  const chains = new Map<string, Observation[]>();
  for (const o of durations) {
    const c = chains.get(o.start);
    if (c) c.push(o);
    else chains.set(o.start, [o]);
  }
  const out = new Map(direct);
  for (const chain of chains.values()) {
    if (chain.length < 2) continue;
    chain.sort((a, b) => a.end.localeCompare(b.end));
    for (let i = 1; i < chain.length; i++) {
      const prev = chain[i - 1];
      const cur = chain[i];
      if (out.has(cur.end)) continue;
      const qStart = addDays(prev.end, 1);
      if (!isQuarterSpan(qStart, cur.end)) continue;
      const history = combineVintages(cur.history, prev.history, (ytd, priorYtd) => ytd - priorYtd);
      if (!history.length) continue;
      out.set(cur.end, {
        start: qStart,
        end: cur.end,
        history,
        inAnnualReport: cur.inAnnualReport,
        derived: true,
      });
    }
  }
  return out;
}

type ConceptSource = Record<string, { units: Record<string, RawFact[]> }>;

function factsFor(def: MetricDef, gaap: ConceptSource, concept: string): RawFact[] {
  const entry = gaap[concept];
  if (!entry) return [];
  return entry.units[def.unit] ?? [];
}

export interface ResolvedMetric {
  annual: Map<string, Observation>;
  quarterly: Map<string, Observation>;
  instants: Map<string, Observation>;
}

/**
 * Resolve a metric's concept chain period by period: for each period the first
 * concept in the chain that reports it wins. A company that tagged
 * `SalesRevenueNet` until 2017 and `RevenueFromContract...` after still gets
 * one continuous revenue series.
 */
export function resolveMetric(def: MetricDef, gaap: ConceptSource): ResolvedMetric {
  const annual = new Map<string, Observation>();
  const quarterly = new Map<string, Observation>();
  const instants = new Map<string, Observation>();
  for (const concept of def.concepts) {
    const obs = collapseFacts(factsFor(def, gaap, concept));
    if (!obs.length) continue;
    if (def.kind === "stock") {
      for (const [end, o] of instantObservations(obs)) if (!instants.has(end)) instants.set(end, o);
      continue;
    }
    for (const [end, o] of annualObservations(obs)) if (!annual.has(end)) annual.set(end, o);
    for (const [end, o] of quarterlyObservations(obs, def.kind === "flow"))
      if (!quarterly.has(end)) quarterly.set(end, o);
  }
  return { annual, quarterly, instants };
}

/** Merge us-gaap facts from a registrant and its predecessors. */
export function mergeGaap(sources: CompanyFactsJson[]): ConceptSource {
  const out: ConceptSource = {};
  for (const src of sources) {
    const gaap = src.facts["us-gaap"] ?? {};
    for (const [concept, entry] of Object.entries(gaap)) {
      const target = (out[concept] ??= { units: {} });
      for (const [unit, facts] of Object.entries(entry.units)) {
        (target.units[unit] ??= []).push(...facts);
      }
    }
  }
  return out;
}

export interface BuildOptions {
  annualYears: number;
  quarters: number;
  recentFilings: number;
}

export const DEFAULT_BUILD: BuildOptions = { annualYears: 15, quarters: 20, recentFilings: 8 };

export function buildCompany(
  entry: UniverseEntry,
  cik: number,
  facts: CompanyFactsJson[],
  submissions: SubmissionsJson[],
  opts: BuildOptions = DEFAULT_BUILD,
): { company: SnapshotCompany; rawFacts: number } {
  const gaap = mergeGaap(facts);

  // Filing metadata: the submissions API is authoritative where it reaches;
  // older accessions fall back to what the facts themselves say.
  const subByAccn = new Map<string, SnapshotFiling>();
  for (const s of submissions) {
    const r = s.filings.recent;
    for (let i = 0; i < r.accessionNumber.length; i++) {
      if (!FILING_FORMS.has(r.form[i])) continue;
      subByAccn.set(r.accessionNumber[i], {
        accn: r.accessionNumber[i],
        form: r.form[i],
        filed: r.filingDate[i],
        period: r.reportDate[i],
        cik: Number(s.cik),
        doc: r.primaryDocument[i] || undefined,
      });
    }
  }
  const accnInfo = new Map<string, { form: string; filed: string; period: string; cik: number }>();
  let rawFacts = 0;
  for (const src of facts) {
    for (const entryFacts of Object.values(src.facts["us-gaap"] ?? {})) {
      for (const unitFacts of Object.values(entryFacts.units)) {
        for (const f of unitFacts) {
          rawFacts++;
          if (!FILING_FORMS.has(f.form)) continue;
          const cur = accnInfo.get(f.accn);
          if (!cur) accnInfo.set(f.accn, { form: f.form, filed: f.filed, period: f.end, cik: src.cik });
          else if (f.end > cur.period) cur.period = f.end;
        }
      }
    }
  }

  const filings: SnapshotFiling[] = [];
  const filingIndex = new Map<string, number>();
  const ref = (accn: string): number => {
    const known = filingIndex.get(accn);
    if (known !== undefined) return known;
    const info = subByAccn.get(accn) ?? { accn, ...accnInfo.get(accn)! };
    filingIndex.set(accn, filings.length);
    filings.push(info);
    return filings.length - 1;
  };

  const resolved = Object.fromEntries(
    METRIC_IDS.map((id) => [id, resolveMetric(METRICS[id], gaap)]),
  ) as Record<MetricId, ResolvedMetric>;

  // Fiscal-year and quarter end dates come from the flow statements; balance
  // sheet values are kept only at those dates.
  const annualEnds = new Set<string>();
  const quarterEnds = new Set<string>();
  for (const id of METRIC_IDS) {
    for (const end of resolved[id].annual.keys()) annualEnds.add(end);
    for (const end of resolved[id].quarterly.keys()) quarterEnds.add(end);
  }
  for (const end of annualEnds) quarterEnds.add(end);

  const latestFy = Math.max(...[...annualEnds].map(fiscalYearOf));
  const keepAnnual = (end: string) => fiscalYearOf(end) > latestFy - opts.annualYears;
  const keptQuarters = new Set(
    [...quarterEnds].sort().reverse().filter((end) => {
      // A fiscal-year end only counts as a quarter if some metric has a Q4 there.
      return METRIC_IDS.some((id) => resolved[id].quarterly.has(end) || resolved[id].instants.has(end));
    }).slice(0, opts.quarters),
  );

  const annual: SnapshotCompany["annual"] = {};
  const quarterly: SnapshotCompany["quarterly"] = {};
  const toPoints = (m: Map<string, Observation>, keep: (end: string) => boolean): SnapshotPoint[] => {
    const pts: SnapshotPoint[] = [];
    for (const o of [...m.values()].sort((a, b) => a.end.localeCompare(b.end))) {
      if (!keep(o.end)) continue;
      const history: SnapshotVintage[] = o.history.map((v) => [ref(v.accn), v.value]);
      pts.push(o.derived ? [o.end, history, 1] : [o.end, history]);
    }
    return pts;
  };

  for (const id of METRIC_IDS) {
    const r = resolved[id];
    const a = METRICS[id].kind === "stock" ? filterKeys(r.instants, annualEnds) : r.annual;
    const q = METRICS[id].kind === "stock" ? filterKeys(r.instants, quarterEnds) : r.quarterly;
    const ap = toPoints(a, keepAnnual);
    const qp = toPoints(q, (end) => keptQuarters.has(end));
    if (ap.length) annual[id] = ap;
    if (qp.length) quarterly[id] = qp;
  }

  const recent = [...subByAccn.values()]
    .filter((f) => f.form === "10-K" || f.form === "10-Q")
    .sort((a, b) => b.filed.localeCompare(a.filed) || b.accn.localeCompare(a.accn))
    .slice(0, opts.recentFilings)
    .map((f) => ref(f.accn));

  const primary = submissions.find((s) => Number(s.cik) === cik) ?? submissions[0];
  return {
    rawFacts,
    company: {
      cik,
      ticker: entry.ticker,
      name: primary?.name ?? facts[0]?.entityName ?? entry.ticker,
      sector: entry.sector,
      model: entry.model,
      industry: primary?.sicDescription ?? "",
      fiscalYearEnd: primary?.fiscalYearEnd ?? "",
      filings,
      recent,
      annual,
      quarterly,
    },
  };
}

function filterKeys<V>(m: Map<string, V>, keys: Set<string>): Map<string, V> {
  return new Map([...m].filter(([k]) => keys.has(k)));
}
