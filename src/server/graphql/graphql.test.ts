import { parse } from "graphql";
import { describe, expect, it } from "vitest";
import { COMPANY, DIFF, HOME, RESTATEMENTS, SCREENER } from "@/graphql/operations";
import type { RestatementsQuery, ScreenerQuery } from "@/graphql/types.generated";
import { buildCompany } from "@/lib/edgar/normalize";
import { computeRevisionStats } from "@/lib/edgar/revisionStats";
import type { Snapshot } from "@/lib/edgar/snapshot";
import { fromEnum, toEnum } from "@/lib/enums";
import { METRIC_IDS } from "@/lib/edgar/concepts";
import { RATIO_IDS } from "@/lib/finance/ratios";
import { Dataset } from "@/server/dataset";
import { FIXTURE_ENTRY, FIXTURE_FACTS, FIXTURE_SUBMISSIONS, M } from "@/test/fixtures";
import { MAX_COST, MAX_DEPTH, estimateCost, operationDepths } from "./limits";
import { createGraphQLServer, schema } from "./yoga";

const { company } = buildCompany(FIXTURE_ENTRY, 1, [FIXTURE_FACTS], [FIXTURE_SUBMISSIONS]);
const snapshot: Snapshot = {
  version: 2,
  generatedAt: "2026-01-01T00:00:00Z",
  fetchedAt: "2026-01-01T00:00:00Z",
  source: "fixture",
  stats: { companies: 1, rawFactsScanned: 0, figures: 0, vintages: 0, filings: company.filings.length, earliestFiled: "2022-02-15", latestFiled: "2025-02-15" },
  revisions: computeRevisionStats([company]),
  companies: [company],
};
const dataset = new Dataset(snapshot);
const yoga = createGraphQLServer(() => dataset);

async function gql<T = Record<string, unknown>>(query: string, variables: Record<string, unknown> = {}) {
  const res = await yoga.fetch("http://test/api/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
}

describe("enum naming", () => {
  it("round-trips every metric and ratio id", () => {
    for (const id of [...METRIC_IDS, ...RATIO_IDS, "freeCashFlow"]) expect(fromEnum(toEnum(id))).toBe(id);
    expect(toEnum("revenueCagr3y")).toBe("REVENUE_CAGR_3Y");
  });
});

describe("client operations", () => {
  it("are valid against the schema and within the limits", () => {
    for (const doc of [HOME, COMPANY, DIFF, RESTATEMENTS, SCREENER]) {
      const ast = parse(doc);
      for (const d of Object.values(operationDepths(ast))) expect(d).toBeLessThanOrEqual(MAX_DEPTH);
      expect(estimateCost(schema, ast, { ticker: "FIX", period: "ANNUAL", last: 12, from: "2023-01-01", to: "2025-01-01" })).toBeLessThanOrEqual(MAX_COST);
    }
  });
});

describe("as-of series", () => {
  const q = /* GraphQL */ `
    query ($asOf: String) {
      company(ticker: "fix") {
        series(metric: REVENUE, asOf: $asOf) { label value revised vintages vintage { filing { form filed indexUrl } } }
      }
    }
  `;

  it("returns today's figures without asOf", async () => {
    const { data, errors } = await gql<{ company: { series: { label: string; value: number; revised: boolean }[] } }>(q);
    expect(errors).toBeUndefined();
    expect(data!.company.series.map((p) => [p.label, p.value, p.revised])).toEqual([
      ["FY2021", 900 * M, false],
      ["FY2022", 1050 * M, true],
      ["FY2023", 1180 * M, true],
      ["FY2024", 1300 * M, false],
    ]);
  });

  it("rewinds to what was filed on the as-of date", async () => {
    const { data } = await gql<{ company: { series: { label: string; value: number; vintages: number; vintage: { filing: { form: string; filed: string; indexUrl: string } } }[] } }>(q, { asOf: "2023-06-30" });
    expect(data!.company.series.map((p) => [p.label, p.value, p.vintages])).toEqual([
      ["FY2021", 900 * M, 1],
      ["FY2022", 1000 * M, 1],
    ]);
    expect(data!.company.series[1].vintage.filing).toMatchObject({ form: "10-K", filed: "2023-02-15" });
    expect(data!.company.series[1].vintage.filing.indexUrl).toMatch(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1\//);
  });

  it("rejects a malformed date with a BAD_USER_INPUT code", async () => {
    const { errors } = await gql(q, { asOf: "June 2023" });
    expect(errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
  });

  it("recomputes ratios as of the date", async () => {
    const r = /* GraphQL */ `query ($asOf: String) { company(ticker: "FIX") { ratio(id: REVENUE_GROWTH, asOf: $asOf) { label value } } }`;
    const now = await gql<{ company: { ratio: { label: string; value: number | null }[] } }>(r);
    const then = await gql<{ company: { ratio: { label: string; value: number | null }[] } }>(r, { asOf: "2024-06-01" });
    const fy23 = (d: typeof now) => d.data!.company.ratio.find((p) => p.label === "FY2023")!.value!;
    expect(fy23(now)).toBeCloseTo(1180 / 1050 - 1);
    expect(fy23(then)).toBeCloseTo(1200 / 1050 - 1);
  });
});

describe("diff between two dates", () => {
  it("lists revised and newly filed figures with the filings between", async () => {
    const { data, errors } = await gql<{ company: { diff: { materialCount: number; revised: { label: string; periodLabel: string; from: number; to: number; material: boolean; likelySplit: boolean; derived: boolean; revisedIn: { filed: string } }[]; added: { label: string }[]; filingsBetween: { form: string; filed: string }[] } } }>(
      /* GraphQL */ `{ company(ticker: "FIX") { diff(from: "2023-06-30", to: "2024-06-30") {
        materialCount revised { label periodLabel from to material likelySplit derived revisedIn { filed } } added { label } filingsBetween { form filed } } } }`,
    );
    expect(errors).toBeUndefined();
    const d = data!.company.diff;
    const rev = d.revised.find((r) => r.label === "Revenue" && r.periodLabel === "FY2022")!;
    expect(rev).toMatchObject({ from: 1000 * M, to: 1050 * M, material: true, likelySplit: false, revisedIn: { filed: "2024-02-15" } });
    expect(d.revised.find((r) => r.label === "Diluted EPS")).toMatchObject({ likelySplit: true });
    expect(d.materialCount).toBe(d.revised.filter((r) => r.material && !r.likelySplit && !r.derived).length);
    expect(d.added.map((a) => a.label)).toContain("FY2023");
    expect(d.filingsBetween.map((f) => f.filed)).toEqual(["2023-08-01", "2023-11-01", "2024-02-15"]);
  });

  it("flags derived figures and leaves them out of the material count", async () => {
    // The FY2023 10-K restates 9M operating cash flow (150 → 140), which moves the derived Q3.
    const { data, errors } = await gql<{ company: { diff: { materialCount: number; revised: { label: string; periodLabel: string; from: number; to: number; material: boolean; likelySplit: boolean; derived: boolean }[] } } }>(
      /* GraphQL */ `{ company(ticker: "FIX") { diff(from: "2023-12-01", to: "2024-06-30") {
        materialCount revised { label periodLabel from to material likelySplit derived } } } }`,
    );
    expect(errors).toBeUndefined();
    const d = data!.company.diff;
    const q3 = d.revised.find((r) => r.label === "Operating cash flow" && r.periodLabel === "Sep 2023")!;
    expect(q3).toMatchObject({ from: 60 * M, to: 50 * M, material: true, derived: true });
    expect(d.materialCount).toBe(d.revised.filter((r) => r.material && !r.likelySplit && !r.derived).length);
    expect(d.materialCount).toBeLessThan(d.revised.length);
  });

  it("accepts the dates in either order", async () => {
    const a = await gql<{ company: { diff: { from: string; to: string } } }>(`{ company(ticker: "FIX") { diff(from: "2024-06-30", to: "2023-06-30") { from to } } }`);
    expect(a.data!.company.diff).toEqual({ from: "2023-06-30", to: "2024-06-30" });
  });
});

describe("restatement timeline", () => {
  type Events = NonNullable<RestatementsQuery["company"]>["restatements"];

  it("lists the filing dates that changed figures already on file, oldest first", async () => {
    const { data, errors } = await gql<RestatementsQuery>(RESTATEMENTS, { ticker: "FIX" });
    expect(errors).toBeUndefined();
    const events: Events = data!.company!.restatements;
    // The FY2023 10-K restates FY2022 revenue; the FY2024 10-K restates FY2023 revenue.
    expect(events.map((e) => [e.previous, e.filed, e.count, e.filings.map((f) => f.form)])).toEqual([
      ["2023-11-01", "2024-02-15", 1, ["10-K"]],
      ["2024-02-15", "2025-02-15", 1, ["10-K"]],
    ]);
    expect(events[0].largest).toMatchObject({ label: "Revenue", periodLabel: "FY2022", from: 1000 * M, to: 1050 * M });
    expect(events[0].largest.change).toBeCloseTo(0.05);
    expect(events[1].largest).toMatchObject({ label: "Revenue", periodLabel: "FY2023", from: 1200 * M, to: 1180 * M });
  });

  it("counts what the diff between the two dates lists, so the split and the derived quarter stay out", async () => {
    const { data } = await gql<RestatementsQuery>(RESTATEMENTS, { ticker: "FIX" });
    for (const e of data!.company!.restatements) {
      const d = await gql<{ company: { diff: { materialCount: number; revised: { material: boolean; likelySplit: boolean; derived: boolean }[] } } }>(
        /* GraphQL */ `query ($from: String!, $to: String!) { company(ticker: "FIX") { diff(from: $from, to: $to) { materialCount revised { material likelySplit derived } } } }`,
        { from: e.previous, to: e.filed },
      );
      expect(d.data!.company.diff.materialCount).toBe(e.count);
    }
    // The FY2023 10-K also halved EPS for a split and moved a derived quarter: listed in the diff, not counted.
    const first = dataset.diff(dataset.company("FIX")!, "2023-11-01", "2024-02-15");
    expect(first.revised.some((r) => r.likelySplit)).toBe(true);
    expect(first.revised.some((r) => r.derived)).toBe(true);
    expect(first.revised.length).toBeGreaterThan(1);
  });

  it("adds up to the company's revision log and skips dates that only added periods", () => {
    const fin = dataset.company("FIX")!;
    const events = dataset.restatements(fin);
    expect(events.reduce((n, e) => n + e.count, 0)).toBe(dataset.revisionLog(fin).length);
    expect(events.map((e) => e.filed)).not.toContain("2023-05-01");
    expect(dataset.restatements(fin)).toBe(events); // memoised per company
  });
});

describe("limits and validation", () => {
  it("rejects over-deep queries", async () => {
    const deep = `{ company(ticker:"FIX"){ changes{ company{ changes{ company{ changes{ company{ changes{ company { ticker } } } } } } } } } }`;
    const { errors } = await gql(deep);
    expect(errors?.[0].extensions?.code).toBe("QUERY_TOO_DEEP");
  });

  it("rejects over-costly queries before executing them", async () => {
    const costly = `{ companies(first: 200) { lineItems(last: 40) { points { history { value } } } } }`;
    const { errors } = await gql(costly);
    expect(errors?.[0].extensions?.code).toBe("QUERY_TOO_COSTLY");
    expect(estimateCost(schema, parse(costly))).toBeGreaterThan(MAX_COST);
  });

  it("rejects out-of-range page sizes", async () => {
    const { errors } = await gql(`{ companies(first: 500) { ticker } }`);
    expect(errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
  });

  it("serves the screener's cells, which add up to the league table", async () => {
    const res = await gql<ScreenerQuery>(SCREENER);
    expect(res.errors).toBeUndefined();
    const cells = res.data!.companies[0].revisionCells;
    expect(cells.find((c) => c.metric === "REVENUE" && c.period === "ANNUAL")).toEqual({ metric: "REVENUE", period: "ANNUAL", figures: 4, lagDays: [365, 366] });
    const league = snapshot.revisions.companies[0];
    expect(cells.reduce((n, c) => n + c.figures, 0)).toBe(league.figures);
    expect(cells.reduce((n, c) => n + c.lagDays.length, 0)).toBe(league.revised);
    // Every line item in a cell has a label for the screener's picker.
    const labelled = new Set(res.data!.metricDefinitions.map((m) => m.id));
    expect(cells.every((c) => labelled.has(c.metric))).toBe(true);
  });

  it("pages the league table: ten rows unless asked, and never more than 200", async () => {
    const many = new Dataset({
      ...snapshot,
      revisions: { ...snapshot.revisions, companies: Array.from({ length: 25 }, (_, i) => ({ ...snapshot.revisions.companies[0], ticker: `T${i}` })) },
    });
    const server = createGraphQLServer(() => many);
    const ask = async (query: string) => {
      const res = await server.fetch("http://test/api/graphql", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
      return (await res.json()) as { data?: { revisionStats: { companies: { ticker: string }[] } }; errors?: { extensions?: { code?: string } }[] };
    };
    expect((await ask(HOME)).data!.revisionStats.companies.map((c) => c.ticker)).toEqual(Array.from({ length: 10 }, (_, i) => `T${i}`));
    expect((await ask(`{ revisionStats { companies { ticker } } }`)).data!.revisionStats.companies).toHaveLength(10);
    expect((await ask(`{ revisionStats { companies(first: 25) { ticker } } }`)).data!.revisionStats.companies).toHaveLength(25);
    expect((await ask(`{ revisionStats { companies(first: 201) { ticker } } }`)).errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
  });

  it("no longer exposes the ratio-screening fields the interface stopped using", async () => {
    for (const q of [`{ sectors { sector } }`, `{ company(ticker: "FIX") { keyStats { revenue } } }`, `{ company(ticker: "FIX") { ranking { rank } } }`, `{ company(ticker: "FIX") { peers { ticker } } }`, `{ companies(filter: { ratioBounds: [] }) { ticker } }`]) {
      const { errors } = await gql(q);
      expect(errors?.[0].extensions?.code).toBe("GRAPHQL_VALIDATION_FAILED");
    }
  });

  it("serves the home and company documents the client sends", async () => {
    const home = await gql<{ revisionStats: { revised: number; companies: { ticker: string }[] } }>(HOME);
    expect(home.errors).toBeUndefined();
    expect(home.data!.revisionStats.companies[0].ticker).toBe("FIX");
    const c = await gql<{ company: { lineItems: { metric: string }[]; filingDates: string[] } }>(COMPANY, { ticker: "FIX", period: "QUARTERLY", asOf: "2023-12-01", last: 8 });
    expect(c.errors).toBeUndefined();
    expect(c.data!.company.filingDates).toHaveLength(7);
    expect(c.data!.company.lineItems.map((l) => l.metric)).toContain("OPERATING_CASH_FLOW");
  });
});
