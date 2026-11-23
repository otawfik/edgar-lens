import { describe, expect, it } from "vitest";
import { FIXTURE_ENTRY, FIXTURE_FACTS, FIXTURE_SUBMISSIONS } from "@/test/fixtures";
import { buildCompany } from "./normalize";
import { companyCells, lagMatches, median, mostRevised, summarise, type RevisionCell } from "./revisionScreen";
import { computeRevisionStats, countFigures } from "./revisionStats";

const { company } = buildCompany(FIXTURE_ENTRY, 1, [FIXTURE_FACTS], [FIXTURE_SUBMISSIONS]);
const cells = companyCells(company);
const ALL = { metric: null, period: null, lag: "any" } as const;

describe("companyCells", () => {
  it("adds up to the league table's totals for the company", () => {
    const league = computeRevisionStats([company]).companies[0];
    const total = summarise(cells, ALL);
    expect(total.figures).toBe(countFigures(company));
    expect(total.figures).toBe(league.figures);
    expect(total.revised).toBe(league.revised);
    expect(total.rate).toBe(league.rate);
    expect(total.medianLagDays).toBe(league.medianLagDays);
  });

  it("keeps the delay of each figure's first change, per line item and period type", () => {
    // FY2022 revenue: filed 2023-02-15, restated 2024-02-15 (365 days; the second restatement is not a new figure).
    // FY2023 revenue: filed 2024-02-15, restated 2025-02-15 (366 days, across a leap day).
    const revenue = cells.find((c) => c.metric === "revenue" && c.period === "annual")!;
    expect(revenue.figures).toBe(4);
    expect(revenue.lagDays).toEqual([365, 366]);
  });

  it("leaves out derived quarters and the split-adjusted EPS", () => {
    const ocfQuarters = cells.find((c) => c.metric === "operatingCashFlow" && c.period === "quarterly");
    // Only Q1 is tagged as a quarter; Q2-Q4 are differenced from year-to-date facts.
    expect(ocfQuarters?.figures).toBe(1);
    expect(cells.find((c) => c.metric === "epsDiluted" && c.period === "annual")!.lagDays).toEqual([]);
  });

  it("has no empty cells", () => {
    expect(cells.every((c) => c.figures > 0)).toBe(true);
  });
});

describe("summarise", () => {
  it("narrows by line item and period type", () => {
    expect(summarise(cells, { metric: "revenue", period: "annual", lag: "any" })).toEqual({ figures: 4, revised: 2, rate: 0.5, medianLagDays: 365.5 });
    expect(summarise(cells, { metric: "revenue", period: "quarterly", lag: "any" })).toMatchObject({ figures: 3, revised: 0, rate: 0, medianLagDays: null });
  });

  it("filters changes by delay without shrinking the denominator", () => {
    const sel = { metric: "revenue", period: "annual" } as const;
    expect(summarise(cells, { ...sel, lag: "within1y" })).toMatchObject({ figures: 4, revised: 1, rate: 0.25, medianLagDays: 365 });
    expect(summarise(cells, { ...sel, lag: "after1y" })).toMatchObject({ figures: 4, revised: 1, rate: 0.25, medianLagDays: 366 });
  });

  it("gives a null rate, not zero, when the selection holds no figures", () => {
    expect(summarise(cells, { metric: "netInterestIncome", period: null, lag: "any" })).toEqual({ figures: 0, revised: 0, rate: null, medianLagDays: null });
  });

  it("splits a year exactly at 365 days", () => {
    expect(lagMatches(365, "within1y")).toBe(true);
    expect(lagMatches(365, "after1y")).toBe(false);
    expect(lagMatches(366, "after1y")).toBe(true);
    expect(lagMatches(9999, "any")).toBe(true);
  });
});

describe("mostRevised", () => {
  it("picks the line item with the most changed figures, then the higher rate", () => {
    const made: RevisionCell[] = [
      { metric: "revenue", period: "annual", figures: 10, lagDays: [100, 200] },
      { metric: "netIncome", period: "annual", figures: 4, lagDays: [400, 500] },
      { metric: "equity", period: "annual", figures: 10, lagDays: [] },
    ];
    expect(mostRevised(made, { period: null, lag: "any" })?.metric).toBe("netIncome");
    expect(mostRevised(made, { period: null, lag: "within1y" })?.metric).toBe("revenue");
    expect(mostRevised(made, { period: "quarterly", lag: "any" })).toBeNull();
  });
});

describe("median", () => {
  it("averages the middle pair and is null for nothing", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
