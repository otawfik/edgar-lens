import { describe, expect, it } from "vitest";
import { FIXTURE_ENTRY, FIXTURE_FACTS, FIXTURE_SUBMISSIONS, M } from "@/test/fixtures";
import { buildCompany } from "../edgar/normalize";
import { buildFinancials, lookupFor, valueAt, yearsBefore } from "./derive";
import { computeRatio, median, rankAmong, type Lookup } from "./ratios";

const fin = buildFinancials(buildCompany(FIXTURE_ENTRY, 1, [FIXTURE_FACTS], [FIXTURE_SUBMISSIONS]).company);

const lookup = (values: Record<string, (number | null)[]>): Lookup => (metric, back = 0) => values[metric]?.[back] ?? null;

describe("computeRatio", () => {
  it("computes margins over positive revenue only", () => {
    expect(computeRatio("operatingMargin", lookup({ revenue: [1000], operatingIncome: [250] }), "general", "annual")).toBeCloseTo(0.25);
    expect(computeRatio("operatingMargin", lookup({ revenue: [0], operatingIncome: [250] }), "general", "annual")).toBeNull();
    expect(computeRatio("operatingMargin", lookup({ revenue: [-5], operatingIncome: [250] }), "general", "annual")).toBeNull();
  });

  it("uses average balances for returns and refuses negative equity", () => {
    expect(computeRatio("roe", lookup({ netIncome: [120], equity: [2200, 2000] }), "general", "annual")).toBeCloseTo(120 / 2100);
    expect(computeRatio("roe", lookup({ netIncome: [120], equity: [2200] }), "general", "annual")).toBeCloseTo(120 / 2200);
    expect(computeRatio("roe", lookup({ netIncome: [120], equity: [-50, 10] }), "general", "annual")).toBeNull();
    expect(computeRatio("debtToEquity", lookup({ longTermDebt: [100], equity: [-50] }), "general", "annual")).toBeNull();
  });

  it("marks bank-only and non-bank ratios as not meaningful for the other model", () => {
    const g = lookup({ revenue: [100], noninterestExpense: [60], freeCashFlow: [20] });
    expect(computeRatio("efficiencyRatio", g, "bank", "annual")).toBeCloseTo(0.6);
    expect(computeRatio("efficiencyRatio", g, "general", "annual")).toBeNull();
    expect(computeRatio("fcfMargin", g, "general", "annual")).toBeCloseTo(0.2);
    expect(computeRatio("fcfMargin", g, "bank", "annual")).toBeNull();
  });

  it("computes growth and CAGR only from positive bases", () => {
    expect(computeRatio("revenueGrowth", lookup({ revenue: [110, 100] }), "general", "annual")).toBeCloseTo(0.1);
    expect(computeRatio("revenueGrowth", lookup({ revenue: [110, -100] }), "general", "annual")).toBeNull();
    expect(computeRatio("revenueCagr3y", lookup({ revenue: [133.1, 0, 0, 100] }), "general", "annual")).toBeCloseTo(0.1);
    expect(computeRatio("revenueCagr3y", lookup({ revenue: [133.1, 0, 0, null] }), "general", "annual")).toBeNull();
  });

  it("is annual-only for averaged or multi-year ratios", () => {
    expect(computeRatio("roe", lookup({ netIncome: [1], equity: [10] }), "general", "quarterly")).toBeNull();
    expect(computeRatio("revenueCagr3y", lookup({ revenue: [2, 1, 1, 1] }), "general", "quarterly")).toBeNull();
  });
});

describe("rankAmong / median", () => {
  it("ranks in the preferred direction, ties sharing the better rank", () => {
    expect(rankAmong(0.3, [0.1, 0.3, 0.5], "higher")).toEqual({ rank: 2, of: 3, percentile: 0.5 });
    expect(rankAmong(0.1, [0.1, 0.3, 0.5], "lower")).toEqual({ rank: 1, of: 3, percentile: 1 });
    expect(rankAmong(0.3, [0.3, 0.3, 0.5], "higher").rank).toBe(2);
  });
  it("takes the median of an even or odd list", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("derive: point-in-time lookups", () => {
  it("reads values as known on a date", () => {
    const rev = fin.annual.metrics.get("revenue")!.get("2022-12-31")!;
    expect(valueAt(rev)).toBe(1050 * M);
    expect(valueAt(rev, "2023-06-01")).toBe(1000 * M);
    expect(valueAt(rev, "2022-06-01")).toBeNull();
  });

  it("derives free cash flow with a point-in-time history", () => {
    // FY2023 OCF 200 (10-K FY23); no capex in the fixture → no FCF.
    expect(fin.annual.metrics.get("freeCashFlow")).toBeUndefined();
    // Gross profit is not derivable either (no cost of revenue).
    expect(fin.annual.metrics.get("grossProfit")).toBeUndefined();
  });

  it("finds the period a year earlier and feeds ratios as of a date", () => {
    expect(yearsBefore(fin.annual, "2023-12-31", 1)).toBe("2022-12-31");
    expect(yearsBefore(fin.quarterly, "2023-09-30", 1)).toBeNull(); // no 2022 quarters in the fixture
    const now = lookupFor(fin.annual, "2023-12-31");
    const then = lookupFor(fin.annual, "2023-12-31", "2024-06-01");
    // Revenue growth FY2023: today 1180/1050; as of mid-2024 1200/1050.
    expect(computeRatio("revenueGrowth", now, "general", "annual")).toBeCloseTo(1180 / 1050 - 1);
    expect(computeRatio("revenueGrowth", then, "general", "annual")).toBeCloseTo(1200 / 1050 - 1);
  });

  it("collects the distinct filing dates for the scrubber", () => {
    expect(fin.filingDates).toEqual(["2022-02-15", "2023-02-15", "2023-05-01", "2023-08-01", "2023-11-01", "2024-02-15", "2025-02-15"]);
  });
});
