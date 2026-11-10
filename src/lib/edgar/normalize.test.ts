import { describe, expect, it } from "vitest";
import { FIXTURE_ENTRY, FIXTURE_FACTS, FIXTURE_SUBMISSIONS } from "@/test/fixtures";
import { buildCompany } from "./normalize";
import { fiscalYearOf, isAnnualSpan, isQuarterSpan, periodDays } from "./periods";
import { companyRevisions, computeRevisionStats, countFigures } from "./revisionStats";

const { company } = buildCompany(FIXTURE_ENTRY, 1, [FIXTURE_FACTS], [FIXTURE_SUBMISSIONS]);
const filedOf = (i: number) => company.filings[i].filed;

describe("periods", () => {
  it("classifies spans with 52/53-week and 12/16-week tolerance", () => {
    expect(isAnnualSpan("2024-01-01", "2024-12-31")).toBe(true);
    expect(isAnnualSpan("2023-09-04", "2024-09-01")).toBe(true); // Costco 52 weeks
    expect(isAnnualSpan("2024-01-01", "2024-06-30")).toBe(false);
    expect(isQuarterSpan("2024-01-01", "2024-03-31")).toBe(true);
    expect(isQuarterSpan("2024-05-13", "2024-09-01")).toBe(true); // Costco 16-week Q4
    expect(isQuarterSpan("2024-01-01", "2024-06-30")).toBe(false);
    expect(periodDays("2024-01-01", "2024-12-31")).toBe(366);
  });

  it("labels fiscal years ending Jan–May with the prior calendar year", () => {
    expect(fiscalYearOf("2025-01-26")).toBe(2024); // NVIDIA
    expect(fiscalYearOf("2025-01-31")).toBe(2024); // Walmart
    expect(fiscalYearOf("2024-09-28")).toBe(2024); // Apple
    expect(fiscalYearOf("2024-06-30")).toBe(2024); // Microsoft
    expect(fiscalYearOf("2025-01-03")).toBe(2024); // 53-week year spilling into January
  });
});

describe("buildCompany", () => {
  it("joins a concept switch into one continuous annual revenue series", () => {
    const rev = company.annual.revenue!;
    expect(rev.map(([end]) => end)).toEqual(["2021-12-31", "2022-12-31", "2023-12-31", "2024-12-31"]);
  });

  it("keeps every value-changing vintage of a figure with its filing", () => {
    const fy22 = company.annual.revenue!.find(([end]) => end === "2022-12-31")!;
    expect(fy22[1].map(([filing, value]) => [filedOf(filing), value])).toEqual([
      ["2023-02-15", 1000],
      ["2024-02-15", 1050],
    ]);
    const fy23 = company.annual.revenue!.find(([end]) => end === "2023-12-31")!;
    expect(fy23[1].map(([, value]) => value)).toEqual([1200, 1180]);
  });

  it("ignores 8-K facts", () => {
    const fy24 = company.annual.revenue!.find(([end]) => end === "2024-12-31")!;
    expect(fy24[1]).toEqual([[expect.any(Number), 1300]]);
  });

  it("derives Q2–Q4 cash flow from YTD chains and flags them", () => {
    const ocf = Object.fromEntries(company.quarterly.operatingCashFlow!.map(([end, h, d]) => [end, { h, d }]));
    expect(ocf["2023-03-31"].d).toBeUndefined();
    expect(ocf["2023-03-31"].h.map(([, v]) => v)).toEqual([40]);
    expect(ocf["2023-06-30"].d).toBe(1);
    expect(ocf["2023-06-30"].h.map(([, v]) => v)).toEqual([50]); // 90 − 40
    // Q3 = 9M − H1: 150 − 90 = 60 at the Q3 10-Q, then 140 − 90 = 50 when the 10-K restated 9M.
    expect(ocf["2023-09-30"].h.map(([f, v]) => [filedOf(f), v])).toEqual([
      ["2023-11-01", 60],
      ["2024-02-15", 50],
    ]);
    // Q4 = FY − 9M, both known only at the 10-K: 200 − 140 = 60.
    expect(ocf["2023-12-31"].h.map(([, v]) => v)).toEqual([60]);
  });

  it("keeps directly tagged quarters over derived ones", () => {
    const q2 = company.quarterly.revenue!.find(([end]) => end === "2023-06-30")!;
    expect(q2[2]).toBeUndefined();
    expect(q2[1][0][1]).toBe(300);
  });

  it("keeps balance-sheet values only at fiscal period ends", () => {
    expect(company.annual.totalAssets!.map(([end]) => end)).toEqual(["2022-12-31", "2023-12-31", "2024-12-31"]);
    expect(company.quarterly.totalAssets!.map(([end]) => end)).toContain("2023-06-30");
  });

  it("records filing metadata once per accession, from the submissions feed", () => {
    const k23 = company.filings.find((f) => f.filed === "2024-02-15")!;
    expect(k23).toMatchObject({ form: "10-K", period: "2023-12-31", doc: "doc.htm", cik: 1 });
    expect(new Set(company.filings.map((f) => f.accn)).size).toBe(company.filings.length);
  });

  it("lists recent 10-K/10-Q filings newest first", () => {
    expect(company.recent.map((i) => company.filings[i].filed).slice(0, 2)).toEqual(["2025-02-15", "2024-02-15"]);
  });
});

describe("revision statistics", () => {
  const revs = companyRevisions(company);

  it("counts material, non-split changes to reported figures only", () => {
    const keys = revs.map((r) => `${r.metric}:${r.period}:${r.end}`);
    expect(keys).toContain("revenue:annual:2022-12-31");
    expect(keys).toContain("revenue:annual:2023-12-31");
    expect(keys).not.toContain("epsDiluted:annual:2022-12-31"); // the split
    expect(keys.filter((k) => k.startsWith("operatingCashFlow:quarterly"))).toEqual([]); // derived quarters skipped
  });

  it("measures the lag in days between the two filings", () => {
    const r = revs.find((r) => r.metric === "revenue" && r.end === "2022-12-31")!;
    expect(r.lagDays).toBe(365);
    expect(r.from).toBe(1000);
    expect(r.to).toBe(1050);
  });

  it("aggregates league tables that add up", () => {
    const stats = computeRevisionStats([company]);
    expect(stats.figures).toBe(countFigures(company));
    expect(stats.revised).toBe(revs.filter((r) => r.nth === 1).length);
    expect(stats.companies[0]).toMatchObject({ ticker: "FIX", revised: stats.revised, figures: stats.figures });
    expect(stats.metrics.reduce((n, m) => n + m.revised, 0)).toBe(stats.revised);
    expect(stats.lagBuckets.reduce((n, b) => n + b.changes, 0)).toBe(revs.length);
    expect(stats.sectors[0].sector).toBe("Industrials");
  });
});
