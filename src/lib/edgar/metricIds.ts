/**
 * Ids of the reported line items, in statement order. Kept apart from
 * concepts.ts so the browser can validate an id without bundling the XBRL
 * concept tables.
 */
export const METRIC_IDS = [
  "revenue",
  "costOfRevenue",
  "grossProfit",
  "operatingIncome",
  "netIncome",
  "epsDiluted",
  "researchAndDevelopment",
  "shareBasedComp",
  "netInterestIncome",
  "noninterestIncome",
  "noninterestExpense",
  "operatingCashFlow",
  "capex",
  "dividendsPaid",
  "buybacks",
  "totalAssets",
  "totalLiabilities",
  "equity",
  "cash",
  "longTermDebt",
] as const;

export type MetricId = (typeof METRIC_IDS)[number];
