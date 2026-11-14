import { describe, expect, it } from "vitest";
import {
  asOf,
  changeBetween,
  combineVintages,
  daysBetween,
  isLikelySplit,
  isMaterialChange,
  backfillVintages,
  isRoundingOf,
  toVintages,
  type Vintage,
} from "./pointInTime";

const v = (filed: string, value: number): Vintage => ({ filed, value, accn: `A-${filed}` });

describe("toVintages", () => {
  it("keeps the first value and each later change, in filing order", () => {
    const facts = [
      { filed: "2024-02-01", val: 1050, accn: "c" },
      { filed: "2023-02-01", val: 1000, accn: "a" },
      { filed: "2023-05-01", val: 1000, accn: "b" }, // same value re-reported: not a vintage
      { filed: "2025-02-01", val: 1050, accn: "d" }, // unchanged comparative
      { filed: "2026-02-01", val: 990, accn: "e" },
    ];
    expect(toVintages(facts).map((x) => [x.filed, x.value])).toEqual([
      ["2023-02-01", 1000],
      ["2024-02-01", 1050],
      ["2026-02-01", 990],
    ]);
  });

  it("orders same-day filings by accession so the result is deterministic", () => {
    const facts = [
      { filed: "2023-02-01", val: 2, accn: "0002" },
      { filed: "2023-02-01", val: 1, accn: "0001" },
    ];
    expect(toVintages(facts).map((x) => x.value)).toEqual([1, 2]);
  });

  it("lets the later accession win when two filings on one day disagree", () => {
    // A 10-K and its same-day 10-K/A: as of that date the amendment is in force.
    const facts = [
      { filed: "2023-02-01", val: 1010, accn: "0000000001-23-000002" },
      { filed: "2023-02-01", val: 1000, accn: "0000000001-23-000001" },
    ];
    const history = toVintages(facts);
    expect(history).toHaveLength(2);
    expect(asOf(history, "2023-02-01")?.value).toBe(1010);
    expect(asOf(history, "2023-01-31")).toBeNull();
  });

  it("collapses same-day filings that agree into one vintage", () => {
    const facts = [
      { filed: "2023-02-01", val: 1000, accn: "b" },
      { filed: "2023-02-01", val: 1000, accn: "a" },
    ];
    expect(toVintages(facts)).toEqual([{ filed: "2023-02-01", value: 1000, accn: "a" }]);
  });

  it("does not treat a figure quoted at coarser precision as a new value", () => {
    const facts = [
      { filed: "2020-02-25", val: 77_147_000_000, accn: "a" },
      { filed: "2020-04-28", val: 77_000_000_000, accn: "b" }, // "$77 billion" in a 10-Q note
      { filed: "2021-02-23", val: 77_147_000_000, accn: "c" },
      { filed: "2022-02-22", val: 57_714_000_000, accn: "d" }, // the real restatement
    ];
    expect(toVintages(facts).map((x) => [x.filed, x.value])).toEqual([
      ["2020-02-25", 77_147_000_000],
      ["2022-02-22", 57_714_000_000],
    ]);
  });

  it("keeps a restatement to a value in force after a later return to the original", () => {
    const facts = [
      { filed: "2023-02-01", val: 1000, accn: "a" },
      { filed: "2024-02-01", val: 1050, accn: "b" },
      { filed: "2025-02-01", val: 1000, accn: "c" },
    ];
    expect(toVintages(facts).map((x) => x.value)).toEqual([1000, 1050, 1000]);
  });
});

describe("isRoundingOf", () => {
  it("recognises the same number at coarser precision", () => {
    expect(isRoundingOf(77_000_000_000, 77_147_000_000)).toBe(true);
    expect(isRoundingOf(1_300_000_000, 1_314_000_000)).toBe(true);
    expect(isRoundingOf(1.2, 1.23)).toBe(true); // per-share
  });
  it("rejects real changes, finer precision and equal values", () => {
    expect(isRoundingOf(57_714_000_000, 77_147_000_000)).toBe(false);
    expect(isRoundingOf(78_000_000_000, 77_147_000_000)).toBe(false); // not what it rounds to
    expect(isRoundingOf(77_147_000_000, 77_000_000_000)).toBe(false); // more precise: a refinement, kept
    expect(isRoundingOf(3_000_000_000, 2_739_000_000)).toBe(false); // one significant digit: too coarse to call
    expect(isRoundingOf(1000, 1000)).toBe(false);
    expect(isRoundingOf(2.0, 4.0)).toBe(false); // a split
  });
});

describe("missing periods", () => {
  it("has nothing in force for a period before its first filing, on any earlier date", () => {
    const fy2024 = [v("2025-02-15", 1300)];
    expect(asOf(fy2024, "2024-12-31")).toBeNull(); // the year has ended but nothing is filed
    expect(changeBetween(fy2024, "2024-12-31", "2025-12-31")).toBeNull(); // new, not revised
  });
  it("leaves a derived figure undefined until both inputs exist", () => {
    const fullYear = [v("2024-02-15", 200)];
    expect(combineVintages(fullYear, [], (a, b) => a - b)).toEqual([]);
    const nineMonths = [v("2024-03-01", 140)]; // filed after the full year
    expect(combineVintages(fullYear, nineMonths, (a, b) => a - b).map((x) => x.filed)).toEqual(["2024-03-01"]);
  });
});

describe("backfillVintages", () => {
  it("prepends an older concept's earlier filings to the canonical history", () => {
    const old = [v("2018-02-01", 100)];
    const renamed = [v("2019-02-01", 100), v("2020-02-01", 95)];
    expect(backfillVintages(renamed, old).map((x) => [x.filed, x.value])).toEqual([
      ["2018-02-01", 100],
      ["2020-02-01", 95],
    ]);
  });
  it("never mixes a concurrent concept filed alongside the canonical one", () => {
    const canonical = [v("2019-02-01", 100)];
    const other = [v("2019-02-01", 90), v("2020-02-01", 91)]; // same filings, a different line
    expect(backfillVintages(canonical, other)).toEqual(canonical);
  });
});

describe("asOf", () => {
  const history = [v("2023-02-01", 1000), v("2024-02-01", 1050), v("2026-02-01", 990)];

  it("returns null before the first filing", () => {
    expect(asOf(history, "2023-01-31")).toBeNull();
  });
  it("includes a filing made on the as-of date itself", () => {
    expect(asOf(history, "2023-02-01")?.value).toBe(1000);
  });
  it("returns the value in force between filings", () => {
    expect(asOf(history, "2024-01-31")?.value).toBe(1000);
    expect(asOf(history, "2024-02-01")?.value).toBe(1050);
    expect(asOf(history, "2025-12-31")?.value).toBe(1050);
  });
  it("returns the latest value after the last filing", () => {
    expect(asOf(history, "2030-01-01")?.value).toBe(990);
  });
  it("handles an empty history", () => {
    expect(asOf([], "2024-01-01")).toBeNull();
  });
});

describe("combineVintages", () => {
  it("derives a quarter from YTD chains and re-evaluates at every filing date", () => {
    // 9M YTD filed in Q3 10-Q, restated in the 10-K; FY filed in the 10-K.
    const nineMonths = [v("2023-11-01", 150), v("2024-02-15", 140)];
    const fullYear = [v("2024-02-15", 200), v("2025-02-15", 210)];
    const q4 = combineVintages(fullYear, nineMonths, (fy, ytd) => fy - ytd);
    // Undefined until both exist (2024-02-15): 200 − 140 = 60; then FY restated: 210 − 140 = 70.
    expect(q4.map((x) => [x.filed, x.value])).toEqual([
      ["2024-02-15", 60],
      ["2025-02-15", 70],
    ]);
  });

  it("collapses a change in one input that leaves the result unchanged", () => {
    const a = [v("2023-01-01", 10), v("2023-06-01", 12)];
    const b = [v("2023-01-01", 4), v("2023-06-01", 6)];
    expect(combineVintages(a, b, (x, y) => x - y)).toHaveLength(1);
  });

  it("attributes the change to the input filed on that date", () => {
    const a = [v("2023-01-01", 10)];
    const b = [v("2023-01-01", 4), v("2023-06-01", 5)];
    const out = combineVintages(a, b, (x, y) => x - y);
    expect(out[1].accn).toBe("A-2023-06-01");
  });
});

describe("materiality and splits", () => {
  it("ignores rounding noise", () => {
    expect(isMaterialChange(1_000_000_000, 1_000_400_000, "USD")).toBe(false); // 0.04%
    expect(isMaterialChange(100_000, 900_000, "USD")).toBe(false); // < $1M
    expect(isMaterialChange(1_000_000_000, 1_010_000_000, "USD")).toBe(true); // 1% and > $1M
    expect(isMaterialChange(2.0, 2.005, "USD/shares")).toBe(false);
    expect(isMaterialChange(2.0, 2.03, "USD/shares")).toBe(true);
  });

  it("recognises whole-number per-share factors as splits, in either direction", () => {
    expect(isLikelySplit(11.91, 2.98, "USD/shares")).toBe(true); // Apple 4:1
    expect(isLikelySplit(2.98, 11.91, "USD/shares")).toBe(true);
    expect(isLikelySplit(4.0, 2.0, "USD/shares")).toBe(true);
    expect(isLikelySplit(2.4, 2.1, "USD/shares")).toBe(false);
    expect(isLikelySplit(100e9, 50e9, "USD")).toBe(false); // dollars never split
  });
});

describe("changeBetween / daysBetween", () => {
  const history = [v("2023-02-01", 1000), v("2024-02-01", 1050)];
  it("reports a change only when the in-force value differs", () => {
    expect(changeBetween(history, "2023-06-01", "2023-12-01")).toBeNull();
    expect(changeBetween(history, "2023-06-01", "2024-06-01")).toEqual({ from: history[0], to: history[1] });
    expect(changeBetween(history, "2022-01-01", "2024-06-01")).toBeNull(); // not yet reported on the first date
  });
  it("counts calendar days", () => {
    expect(daysBetween("2023-02-01", "2024-02-01")).toBe(365);
    expect(daysBetween("2024-02-01", "2023-02-01")).toBe(-365);
  });
});
