import { describe, expect, it } from "vitest";
import rewind, { hydrateRewind, initialRewindState, resetRewind, setAsOf, setCompareFrom, setPeriod } from "./rewindSlice";
import type { RevisionCell } from "@/lib/edgar/revisionScreen";
import screener, { initialScreenerState, resetFilters, setLag, setMetric, sortBy, toggleSector } from "./screenerSlice";
import { applyScreenerFilters, sortRows, toRows, totals, type ScreenerCompany } from "./selectors";
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
  it("toggles sectors and resets without losing the sort", () => {
    let s = screener(initialScreenerState, toggleSector("Energy"));
    s = screener(s, toggleSector("Utilities"));
    s = screener(s, toggleSector("Energy"));
    expect(s.sectors).toEqual(["Utilities"]);
    s = screener(s, setMetric("revenue"));
    s = screener(s, setLag("after1y"));
    s = screener(s, sortBy("figures"));
    s = screener(s, resetFilters());
    expect(s).toEqual({ ...initialScreenerState, sort: { field: "figures", direction: "desc" } });
  });

  it("flips the sorted column and starts a new one where it is useful", () => {
    let s = screener(initialScreenerState, sortBy("rate"));
    expect(s.sort).toEqual({ field: "rate", direction: "asc" }); // was desc: now the cleanest first
    s = screener(s, sortBy("ticker"));
    expect(s.sort).toEqual({ field: "ticker", direction: "asc" });
    s = screener(s, sortBy("medianLagDays"));
    expect(s.sort).toEqual({ field: "medianLagDays", direction: "desc" });
  });

  it("round-trips through the URL and rejects junk", () => {
    const s = {
      ...initialScreenerState,
      metric: "revenue" as const,
      period: "annual" as const,
      lag: "after1y" as const,
      sectors: ["Energy" as const, "Utilities" as const],
      search: "exx",
      watchlistOnly: true,
      sort: { field: "revised" as const, direction: "asc" as const },
    };
    expect(serializeScreener(s)).toBe("item=revenue&period=annual&lag=after1y&sector=Energy%2CUtilities&q=exx&watch=1&sort=revised");
    expect(parseScreener(serializeScreener(s))).toEqual(s);
    expect(serializeScreener(initialScreenerState)).toBe("");
    const junk = parseScreener("item=goodwill&period=monthly&lag=never&sector=Crypto&sort=-bogus&q=" + "x".repeat(200));
    expect(junk).toEqual({ ...initialScreenerState, search: "x".repeat(80) });
  });
});

describe("screener rows", () => {
  const cell = (metric: RevisionCell["metric"], period: RevisionCell["period"], figures: number, lagDays: number[]): RevisionCell => ({ metric, period, figures, lagDays });
  const companies: ScreenerCompany[] = [
    { ticker: "A", name: "A Corp", sector: "Energy", cells: [cell("revenue", "annual", 10, [100, 400]), cell("netIncome", "annual", 10, [])] },
    { ticker: "B", name: "B Corp", sector: "Utilities", cells: [cell("revenue", "annual", 4, []), cell("revenue", "quarterly", 30, [50])] },
    { ticker: "C", name: "C Bank", sector: "Financials", cells: [cell("netIncome", "annual", 12, [])] },
  ];
  const none = { sectors: [], search: "", watchlistOnly: false };
  const ALL = { metric: null, period: null, lag: "any" } as const;

  it("summarises the selection per company and names the most-changed line item", () => {
    const [a, b, c] = toRows(companies, ALL);
    expect(a).toMatchObject({ figures: 20, revised: 2, rate: 0.1, medianLagDays: 250, top: { metric: "revenue", revised: 2, figures: 10 } });
    expect(b).toMatchObject({ figures: 34, revised: 1, top: { metric: "revenue", revised: 1, figures: 34 } });
    expect(c).toMatchObject({ figures: 12, revised: 0, rate: 0, medianLagDays: null, top: null });
    expect(toRows(companies, { metric: "revenue", period: "annual", lag: "after1y" })[0]).toMatchObject({ figures: 10, revised: 1, lags: [400], top: null });
  });

  it("leaves out companies that report none of the selected figures", () => {
    const revenue = toRows(companies, { metric: "revenue", period: null, lag: "any" });
    expect(applyScreenerFilters(revenue, none, []).map((r) => r.ticker)).toEqual(["A", "B"]); // the bank reports no revenue here
  });

  it("combines sector, search and watchlist filters", () => {
    const rows = toRows(companies, ALL);
    expect(applyScreenerFilters(rows, { ...none, sectors: ["Utilities"] }, []).map((r) => r.ticker)).toEqual(["B"]);
    expect(applyScreenerFilters(rows, { ...none, search: "bank" }, []).map((r) => r.ticker)).toEqual(["C"]);
    expect(applyScreenerFilters(rows, { ...none, watchlistOnly: true }, ["C"]).map((r) => r.ticker)).toEqual(["C"]);
  });

  it("sorts with nulls last and breaks rate ties by the number of figures behind them", () => {
    const rows = toRows(companies, { metric: "revenue", period: "annual", lag: "any" }); // A 2/10, B 0/4, C none
    const clean = toRows([...companies, { ticker: "D", name: "D Corp", sector: "Energy", cells: [cell("revenue", "annual", 9, [])] }], { metric: "revenue", period: "annual", lag: "any" });
    expect(sortRows(clean, { field: "rate", direction: "asc" }).map((r) => r.ticker)).toEqual(["D", "B", "A", "C"]); // 0 of 9 before 0 of 4
    expect(sortRows(rows, { field: "rate", direction: "desc" }).map((r) => r.ticker)).toEqual(["A", "B", "C"]);
    expect(sortRows(rows, { field: "medianLagDays", direction: "asc" }).map((r) => r.ticker)[0]).toBe("A"); // the only one with a delay
    expect(sortRows(rows, { field: "name", direction: "desc" }).map((r) => r.ticker)).toEqual(["C", "B", "A"]);
  });

  it("pools totals over figures, not companies", () => {
    const t = totals(applyScreenerFilters(toRows(companies, ALL), none, []));
    expect(t).toEqual({ companies: 3, untouched: 1, figures: 66, revised: 3, rate: 3 / 66, medianLagDays: 100 });
    expect(totals([])).toMatchObject({ companies: 0, rate: null, medianLagDays: null });
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
