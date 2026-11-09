/**
 * Ratio definitions and maths. Every ratio is a pure function of a lookup
 * `get(metric, yearsBack)`, so the same code serves annual series (yearsBack =
 * fiscal years) and quarterly series (yearsBack = same quarter, prior year).
 *
 * Conventions, chosen to fail safe rather than flatter:
 * - A ratio over revenue is null when revenue is missing or not positive.
 * - ROE and debt/equity are null when equity is negative (McDonald's, Boeing,
 *   Starbucks…): the sign flips the meaning and ranking them is nonsense.
 * - Return ratios use average balances when the prior year exists.
 * - FCF-based ratios are "not meaningful" for banks and insurers, whose
 *   operating cash flow mostly reflects trading and funding flows.
 */
import type { BusinessModel } from "../universe";
import type { DerivedMetricId } from "./derive";

export const RATIO_IDS = [
  "revenueGrowth",
  "revenueCagr3y",
  "epsGrowth",
  "grossMargin",
  "operatingMargin",
  "netMargin",
  "fcfMargin",
  "roe",
  "roa",
  "debtToEquity",
  "cashConversion",
  "rdIntensity",
  "sbcToRevenue",
  "capitalReturn",
  "efficiencyRatio",
] as const;

export type RatioId = (typeof RATIO_IDS)[number];

export type RatioFormat = "percent" | "multiple";

export interface RatioDef {
  id: RatioId;
  label: string;
  short: string;
  format: RatioFormat;
  /** Which direction ranks a company higher among its peers. */
  better: "higher" | "lower";
  /** Ratios needing averages or multi-year history are annual-only. */
  quarterly: boolean;
  models: BusinessModel[];
  description: string;
}

const ALL: BusinessModel[] = ["general", "bank", "insurer"];
const GENERAL: BusinessModel[] = ["general"];

export const RATIOS: Record<RatioId, RatioDef> = {
  revenueGrowth: {
    id: "revenueGrowth", label: "Revenue growth", short: "Rev growth", format: "percent",
    better: "higher", quarterly: true, models: ALL,
    description: "Revenue versus the same period a year earlier.",
  },
  revenueCagr3y: {
    id: "revenueCagr3y", label: "Revenue CAGR (3y)", short: "3y CAGR", format: "percent",
    better: "higher", quarterly: false, models: ALL,
    description: "Compound annual revenue growth over three fiscal years.",
  },
  epsGrowth: {
    id: "epsGrowth", label: "Diluted EPS growth", short: "EPS growth", format: "percent",
    better: "higher", quarterly: true, models: ALL,
    description: "Diluted EPS versus a year earlier; null when the prior EPS was not positive.",
  },
  grossMargin: {
    id: "grossMargin", label: "Gross margin", short: "Gross mgn", format: "percent",
    better: "higher", quarterly: true, models: GENERAL,
    description: "Gross profit / revenue. Reported gross profit, else revenue minus cost of revenue.",
  },
  operatingMargin: {
    id: "operatingMargin", label: "Operating margin", short: "Op mgn", format: "percent",
    better: "higher", quarterly: true, models: ALL,
    description: "Operating income / revenue.",
  },
  netMargin: {
    id: "netMargin", label: "Net margin", short: "Net mgn", format: "percent",
    better: "higher", quarterly: true, models: ALL,
    description: "Net income attributable to the company / revenue.",
  },
  fcfMargin: {
    id: "fcfMargin", label: "Free-cash-flow margin", short: "FCF mgn", format: "percent",
    better: "higher", quarterly: true, models: GENERAL,
    description: "(Operating cash flow − capital expenditure) / revenue.",
  },
  roe: {
    id: "roe", label: "Return on equity", short: "ROE", format: "percent",
    better: "higher", quarterly: false, models: ALL,
    description: "Net income / average shareholders' equity. Null when equity is negative.",
  },
  roa: {
    id: "roa", label: "Return on assets", short: "ROA", format: "percent",
    better: "higher", quarterly: false, models: ALL,
    description: "Net income / average total assets.",
  },
  debtToEquity: {
    id: "debtToEquity", label: "Long-term debt / equity", short: "Debt/Eq", format: "multiple",
    better: "lower", quarterly: true, models: GENERAL,
    description: "Long-term debt / shareholders' equity at period end. Null when equity is negative.",
  },
  cashConversion: {
    id: "cashConversion", label: "Cash conversion", short: "OCF/NI", format: "multiple",
    better: "higher", quarterly: true, models: GENERAL,
    description: "Operating cash flow / net income. Null when net income is not positive.",
  },
  rdIntensity: {
    id: "rdIntensity", label: "R&D intensity", short: "R&D %", format: "percent",
    better: "higher", quarterly: true, models: GENERAL,
    description: "Research and development expense / revenue.",
  },
  sbcToRevenue: {
    id: "sbcToRevenue", label: "Stock comp / revenue", short: "SBC %", format: "percent",
    better: "lower", quarterly: true, models: ALL,
    description: "Share-based compensation / revenue — dilution paid as wages.",
  },
  capitalReturn: {
    id: "capitalReturn", label: "Capital returned / FCF", short: "Payout", format: "percent",
    better: "higher", quarterly: false, models: GENERAL,
    description: "(Dividends + buybacks) / free cash flow. Above 100% means returning more than it generates.",
  },
  efficiencyRatio: {
    id: "efficiencyRatio", label: "Efficiency ratio", short: "Efficiency", format: "percent",
    better: "lower", quarterly: true, models: ["bank"],
    description: "Noninterest expense / revenue — the bank cost-to-income ratio.",
  },
};

/** `get(metric, k)` = the metric k years before the period being measured. */
export type Lookup = (metric: DerivedMetricId, yearsBack?: number) => number | null;

const div = (a: number | null, b: number | null): number | null =>
  a === null || b === null || b === 0 ? null : a / b;

const overRevenue = (get: Lookup, metric: DerivedMetricId) => {
  const rev = get("revenue");
  return rev !== null && rev > 0 ? div(get(metric), rev) : null;
};

const growth = (cur: number | null, prev: number | null): number | null =>
  cur === null || prev === null || prev <= 0 ? null : cur / prev - 1;

/** Average of this and last year's balance, or the closing one if no prior. */
const avgBalance = (get: Lookup, metric: DerivedMetricId): number | null => {
  const cur = get(metric);
  if (cur === null) return null;
  const prev = get(metric, 1);
  return prev === null ? cur : (cur + prev) / 2;
};

export function computeRatio(
  id: RatioId,
  get: Lookup,
  model: BusinessModel,
  period: "annual" | "quarterly",
): number | null {
  const def = RATIOS[id];
  if (!def.models.includes(model)) return null;
  if (period === "quarterly" && !def.quarterly) return null;

  switch (id) {
    case "revenueGrowth":
      return growth(get("revenue"), get("revenue", 1));
    case "revenueCagr3y": {
      const cur = get("revenue");
      const base = get("revenue", 3);
      if (cur === null || base === null || cur <= 0 || base <= 0) return null;
      return (cur / base) ** (1 / 3) - 1;
    }
    case "epsGrowth":
      return growth(get("epsDiluted"), get("epsDiluted", 1));
    case "grossMargin":
      return overRevenue(get, "grossProfit");
    case "operatingMargin":
      return overRevenue(get, "operatingIncome");
    case "netMargin":
      return overRevenue(get, "netIncome");
    case "fcfMargin":
      return overRevenue(get, "freeCashFlow");
    case "rdIntensity":
      return overRevenue(get, "researchAndDevelopment");
    case "sbcToRevenue":
      return overRevenue(get, "shareBasedComp");
    case "efficiencyRatio":
      return overRevenue(get, "noninterestExpense");
    case "roe": {
      const eq = get("equity");
      const prev = get("equity", 1);
      if (eq === null || eq <= 0 || (prev !== null && prev <= 0)) return null;
      return div(get("netIncome"), avgBalance(get, "equity"));
    }
    case "roa":
      return div(get("netIncome"), avgBalance(get, "totalAssets"));
    case "debtToEquity": {
      const eq = get("equity");
      if (eq === null || eq <= 0) return null;
      return div(get("longTermDebt"), eq);
    }
    case "cashConversion": {
      const ni = get("netIncome");
      return ni !== null && ni > 0 ? div(get("operatingCashFlow"), ni) : null;
    }
    case "capitalReturn": {
      const fcf = get("freeCashFlow");
      if (fcf === null || fcf <= 0) return null;
      const returned = (get("dividendsPaid") ?? 0) + (get("buybacks") ?? 0);
      return returned / fcf;
    }
  }
}

export function ratioApplies(id: RatioId, model: BusinessModel): boolean {
  return RATIOS[id].models.includes(model);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface Rank {
  rank: number;
  of: number;
  /** Share of the other peers this company beats, 0..1. */
  percentile: number;
}

/**
 * Rank `value` among `peerValues` (which include it) in the ratio's preferred
 * direction. Ties share the better rank.
 */
export function rankAmong(value: number, peerValues: number[], better: "higher" | "lower"): Rank {
  const beats = (a: number, b: number) => (better === "higher" ? a > b : a < b);
  const ahead = peerValues.filter((v) => beats(v, value)).length;
  const behind = peerValues.filter((v) => beats(value, v)).length;
  const others = peerValues.length - 1;
  return {
    rank: ahead + 1,
    of: peerValues.length,
    percentile: others > 0 ? behind / others : 1,
  };
}
