import { parse } from "graphql";
import { describe, expect, it } from "vitest";
import { COMPANY, DIFF, HOME, SCREENER } from "@/graphql/operations";
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
    for (const doc of [HOME, COMPANY, DIFF, SCREENER]) {
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

  it("accepts the dates in either order", async () => {
    const a = await gql<{ company: { diff: { from: string; to: string } } }>(`{ company(ticker: "FIX") { diff(from: "2024-06-30", to: "2023-06-30") { from to } } }`);
    expect(a.data!.company.diff).toEqual({ from: "2023-06-30", to: "2024-06-30" });
  });
});

describe("limits and validation", () => {
  it("rejects over-deep queries", async () => {
    const deep = `{ company(ticker:"FIX"){ peers{ peers{ peers{ peers{ peers{ peers{ peers{ peers { ticker } } } } } } } } } }`;
    const { errors } = await gql(deep);
    expect(errors?.[0].extensions?.code).toBe("QUERY_TOO_DEEP");
  });

  it("rejects over-costly queries before executing them", async () => {
    const costly = `{ companies(first: 200) { peers(limit: 10) { peers(limit: 10) { series(metric: REVENUE, last: 40) { value } } } } }`;
    const { errors } = await gql(costly);
    expect(errors?.[0].extensions?.code).toBe("QUERY_TOO_COSTLY");
    expect(estimateCost(schema, parse(costly))).toBeGreaterThan(MAX_COST);
  });

  it("rejects out-of-range page sizes", async () => {
    const { errors } = await gql(`{ companies(first: 500) { ticker } }`);
    expect(errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
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
