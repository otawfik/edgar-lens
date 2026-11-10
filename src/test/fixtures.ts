/**
 * A tiny, hand-built company in SEC companyfacts shape, with the situations
 * the normaliser has to get right:
 * - FY2022 revenue restated twice (10-K FY2023 and 10-K FY2024);
 * - a concept switch (SalesRevenueNet → RevenueFromContract…) across years;
 * - YTD-only cash flow in 10-Qs, so Q2/Q3/Q4 must be derived;
 * - an EPS value halved by a 2-for-1 split (not a restatement);
 * - an 8-K fact that must be ignored.
 */
import type { CompanyFactsJson, RawFact, SubmissionsJson } from "@/lib/edgar/normalize";
import type { UniverseEntry } from "@/lib/universe";

/** Dollar figures are written in millions so the $1M materiality floor behaves as in real data. */
export const M = 1e6;

const fact = (
  start: string | undefined,
  end: string,
  val: number,
  filed: string,
  form: string,
  accn = `ACC-${filed}-${form}`,
): RawFact => ({ start, end, val, accn, form, filed, fy: Number(end.slice(0, 4)), fp: form.startsWith("10-K") ? "FY" : "Q", frame: undefined });

const f = (start: string | undefined, end: string, val: number, filed: string, form: string, accn?: string) =>
  fact(start, end, val * M, filed, form, accn);
/** Per-share facts stay in dollars. */
const e = fact;

// Filings: 10-Q (Q1, Q2, Q3) and 10-K per year, 2022–2024.
const K22 = "2023-02-15";
const K23 = "2024-02-15";
const K24 = "2025-02-15";
const Q1_23 = "2023-05-01";
const Q2_23 = "2023-08-01";
const Q3_23 = "2023-11-01";

export const FIXTURE_FACTS: CompanyFactsJson = {
  cik: 1,
  entityName: "Fixture Corp",
  facts: {
    "us-gaap": {
      SalesRevenueNet: {
        units: {
          USD: [
            f("2021-01-01", "2021-12-31", 900, "2022-02-15", "10-K"),
            f("2022-01-01", "2022-12-31", 1000, K22, "10-K"),
          ],
        },
      },
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        units: {
          USD: [
            // FY2022 as restated in the FY2023 10-K, then again in the FY2024 10-K.
            f("2022-01-01", "2022-12-31", 1050, K23, "10-K"),
            f("2022-01-01", "2022-12-31", 1050, K24, "10-K", "ACC-dup"), // unchanged comparative: not a vintage
            f("2023-01-01", "2023-12-31", 1200, K23, "10-K"),
            f("2023-01-01", "2023-12-31", 1180, K24, "10-K"),
            f("2024-01-01", "2024-12-31", 1300, K24, "10-K"),
            // quarters, tagged directly
            f("2023-01-01", "2023-03-31", 280, Q1_23, "10-Q"),
            f("2023-04-01", "2023-06-30", 300, Q2_23, "10-Q"),
            f("2023-07-01", "2023-09-30", 310, Q3_23, "10-Q"),
            // a press release: ignored
            f("2024-01-01", "2024-12-31", 9999, "2025-01-30", "8-K"),
          ],
        },
      },
      NetIncomeLoss: {
        units: {
          USD: [
            f("2022-01-01", "2022-12-31", 100, K22, "10-K"),
            f("2023-01-01", "2023-12-31", 120, K23, "10-K"),
            f("2024-01-01", "2024-12-31", 130, K24, "10-K"),
            f("2023-01-01", "2023-03-31", 25, Q1_23, "10-Q"),
            f("2023-04-01", "2023-06-30", 30, Q2_23, "10-Q"),
            f("2023-07-01", "2023-09-30", 32, Q3_23, "10-Q"),
          ],
        },
      },
      NetCashProvidedByUsedInOperatingActivities: {
        units: {
          USD: [
            f("2022-01-01", "2022-12-31", 150, K22, "10-K"),
            f("2023-01-01", "2023-12-31", 200, K23, "10-K"),
            // YTD only
            f("2023-01-01", "2023-03-31", 40, Q1_23, "10-Q"),
            f("2023-01-01", "2023-06-30", 90, Q2_23, "10-Q"),
            f("2023-01-01", "2023-09-30", 150, Q3_23, "10-Q"),
            // the 10-K restates the 9M figure, which moves the derived Q3 and Q4
            f("2023-01-01", "2023-09-30", 140, K23, "10-K"),
          ],
        },
      },
      EarningsPerShareDiluted: {
        units: {
          "USD/shares": [
            e("2022-01-01", "2022-12-31", 4.0, K22, "10-K"),
            e("2022-01-01", "2022-12-31", 2.0, K23, "10-K"), // 2-for-1 split
            e("2023-01-01", "2023-12-31", 2.4, K23, "10-K"),
            e("2024-01-01", "2024-12-31", 2.6, K24, "10-K"),
          ],
        },
      },
      Assets: {
        units: {
          USD: [
            f(undefined, "2022-12-31", 5000, K22, "10-K"),
            f(undefined, "2023-12-31", 5500, K23, "10-K"),
            f(undefined, "2023-06-30", 5200, Q2_23, "10-Q"),
            f(undefined, "2024-12-31", 6000, K24, "10-K"),
          ],
        },
      },
      StockholdersEquity: {
        units: {
          USD: [
            f(undefined, "2022-12-31", 2000, K22, "10-K"),
            f(undefined, "2023-12-31", 2200, K23, "10-K"),
            f(undefined, "2024-12-31", 2500, K24, "10-K"),
          ],
        },
      },
    },
  },
};

const accns = ["2022-02-15|10-K", `${K22}|10-K`, `${Q1_23}|10-Q`, `${Q2_23}|10-Q`, `${Q3_23}|10-Q`, `${K23}|10-K`, `${K24}|10-K`];

export const FIXTURE_SUBMISSIONS: SubmissionsJson = {
  cik: 1,
  name: "Fixture Corp",
  sicDescription: "Testing",
  fiscalYearEnd: "1231",
  filings: {
    recent: {
      accessionNumber: accns.map((a) => `ACC-${a.replace("|", "-")}`),
      filingDate: accns.map((a) => a.split("|")[0]),
      reportDate: ["2021-12-31", "2022-12-31", "2023-03-31", "2023-06-30", "2023-09-30", "2023-12-31", "2024-12-31"],
      form: accns.map((a) => a.split("|")[1]),
      primaryDocument: accns.map(() => "doc.htm"),
    },
  },
};

export const FIXTURE_ENTRY: UniverseEntry = { ticker: "FIX", sector: "Industrials", model: "general" };
