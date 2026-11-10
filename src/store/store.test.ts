import { describe, expect, it } from "vitest";
import rewind, { hydrateRewind, initialRewindState, resetRewind, setAsOf, setCompareFrom, setPeriod } from "./rewindSlice";
import screener, { applyPreset, initialScreenerState, resetFilters, setBound, setSort, toggleSector } from "./screenerSlice";
import { applyScreenerFilters, type ScreenerRow } from "./selectors";
import { parseRewind, parseScreener, serializeRewind, serializeScreener } from "./urlState";
import watchlist, { hydrateWatchlist, toggleWatch } from "./watchlistSlice";

describe("rewind slice", () => {
  it("sets the as-of date and drops an invalid one", () => {
    expect(rewind(initialRewindState, setAsOf("2020-06-30")).asOf).toBe("2020-06-30");
    expect(rewind(initialRewindState, setAsOf("yesterday")).asOf).toBeNull();
  });

  it("keeps the comparison baseline strictly earlier than the as-of date", () => {
    let s = rewind(initialRewindState, setAsOf("2020-06-30"));
    s = rewind(s, setCompareFrom("2019-06-30"));
    expect(s.compareFrom).toBe("2019-06-30");
    s = rewind(s, setCompareFrom("2021-01-01"));
    expect(s.compareFrom).toBeNull();
    s = rewind(s, setCompareFrom("2019-06-30"));
    s = rewind(s, setAsOf("2019-01-01")); // moving the as-of date behind the baseline clears it
    expect(s.compareFrom).toBeNull();
  });

  it("resets dates but not the period", () => {
    let s = rewind(initialRewindState, setPeriod("quarterly"));
    s = rewind(s, setAsOf("2020-06-30"));
    s = rewind(s, resetRewind());
    expect(s).toEqual({ asOf: null, compareFrom: null, period: "quarterly" });
  });
});

describe("rewind URL state", () => {
  it("round-trips", () => {
    const s = { asOf: "2020-06-30", compareFrom: "2019-02-01", period: "quarterly" as const };
    expect(serializeRewind(s)).toBe("asOf=2020-06-30&vs=2019-02-01&period=quarterly");
    expect(parseRewind(serializeRewind(s))).toEqual(s);
    expect(serializeRewind(initialRewindState)).toBe("");
  });

  it("drops malformed or inconsistent values", () => {
    expect(parseRewind("asOf=2020-02-30")).toEqual(initialRewindState); // not a real date
    expect(parseRewind("asOf=2020-06-30&vs=2020-06-30").compareFrom).toBeNull();
    expect(parseRewind("period=monthly").period).toBe("annual");
    expect(parseRewind("vs=2018-01-01").compareFrom).toBe("2018-01-01"); // baseline with asOf = today is fine
  });

  it("applies a hydrated state verbatim", () => {
    const s = parseRewind("asOf=2015-01-01");
    expect(rewind(initialRewindState, hydrateRewind(s))).toEqual(s);
  });
});

describe("screener slice and URL", () => {
  it("toggles sectors and normalises bounds", () => {
    let s = screener(initialScreenerState, toggleSector("Energy"));
    s = screener(s, toggleSector("Utilities"));
    s = screener(s, toggleSector("Energy"));
    expect(s.sectors).toEqual(["Utilities"]);
    s = screener(s, setBound({ ratio: "operatingMargin", bound: { min: 0.4, max: 0.2 } }));
    expect(s.bounds.operatingMargin).toEqual({ min: 0.2, max: 0.4 }); // swapped
    s = screener(s, setBound({ ratio: "operatingMargin", bound: { min: Number.NaN } }));
    expect(s.bounds.operatingMargin).toBeUndefined();
  });

  it("applies a preset and resets without losing the sort", () => {
    let s = screener(initialScreenerState, setSort({ field: "roe", direction: "asc" }));
    s = screener(s, applyPreset("compounders"));
    expect(s.bounds).toEqual({ revenueGrowth: { min: 0.1 }, operatingMargin: { min: 0.2 } });
    s = screener(s, resetFilters());
    expect(s.bounds).toEqual({});
    expect(s.sort).toEqual({ field: "roe", direction: "asc" });
  });

  it("round-trips through the URL and rejects junk", () => {
    const s = {
      ...initialScreenerState,
      sectors: ["Energy" as const, "Utilities" as const],
      search: "exx",
      bounds: { operatingMargin: { min: 0.2 }, debtToEquity: { max: 0.5 } },
      watchlistOnly: true,
      sort: { field: "roe" as const, direction: "asc" as const },
    };
    expect(parseScreener(serializeScreener(s))).toEqual(s);
    const junk = parseScreener("sector=Crypto&operatingMargin=abc..&sort=-bogus&q=" + "x".repeat(200));
    expect(junk.sectors).toEqual([]);
    expect(junk.bounds).toEqual({});
    expect(junk.sort).toEqual(initialScreenerState.sort);
    expect(junk.search).toHaveLength(80);
  });
});

describe("applyScreenerFilters", () => {
  const row = (over: Partial<ScreenerRow>): ScreenerRow =>
    ({
      ticker: "X", name: "X Corp", sector: "Energy", model: "GENERAL", fiscalYear: 2025, revenue: 1, netIncome: 1,
      freeCashFlow: 1, latestForm: "10-K", latestFiled: "2026-01-01", lagging: false,
      revenueGrowth: 0.1, revenueCagr3y: 0.1, epsGrowth: 0.1, grossMargin: 0.5, operatingMargin: 0.3, netMargin: 0.2,
      fcfMargin: 0.2, roe: 0.2, roa: 0.1, debtToEquity: 0.5, cashConversion: 1.1, rdIntensity: 0.1, sbcToRevenue: 0.02,
      capitalReturn: 0.5, efficiencyRatio: null,
      ...over,
    }) as ScreenerRow;
  const rows = [row({ ticker: "A", operatingMargin: 0.3 }), row({ ticker: "B", operatingMargin: 0.1, sector: "Utilities" }), row({ ticker: "C", operatingMargin: null })];

  it("excludes null ratios when a bound is set", () => {
    const out = applyScreenerFilters(rows, { sectors: [], search: "", bounds: { operatingMargin: { min: 0.05 } }, watchlistOnly: false }, []);
    expect(out.map((r) => r.ticker)).toEqual(["A", "B"]);
  });
  it("combines sector, search and watchlist filters", () => {
    expect(applyScreenerFilters(rows, { sectors: ["Utilities"], search: "", bounds: {}, watchlistOnly: false }, []).map((r) => r.ticker)).toEqual(["B"]);
    expect(applyScreenerFilters(rows, { sectors: [], search: "c corp", bounds: {}, watchlistOnly: false }, []).map((r) => r.ticker)).toEqual([]);
    expect(applyScreenerFilters(rows, { sectors: [], search: "", bounds: {}, watchlistOnly: true }, ["C"]).map((r) => r.ticker)).toEqual(["C"]);
  });
});

describe("watchlist slice", () => {
  it("toggles tickers case-insensitively and merges on hydration", () => {
    let s = watchlist(undefined, toggleWatch("aapl"));
    expect(s.tickers).toEqual(["AAPL"]);
    s = watchlist(s, hydrateWatchlist(["msft", "AAPL"]));
    expect(s.tickers).toEqual(["MSFT", "AAPL"]);
    expect(s.hydrated).toBe(true);
    s = watchlist(s, toggleWatch("AAPL"));
    expect(s.tickers).toEqual(["MSFT"]);
  });
});
