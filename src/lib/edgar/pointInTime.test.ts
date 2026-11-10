import { describe, expect, it } from "vitest";
import {
  asOf,
  changeBetween,
  combineVintages,
  daysBetween,
  isLikelySplit,
  isMaterialChange,
  backfillVintages,
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
