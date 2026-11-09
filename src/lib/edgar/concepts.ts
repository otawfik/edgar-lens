/**
 * Which us-gaap XBRL concepts feed each metric.
 *
 * Filers don't agree on tags: Apple reports `RevenueFromContractWithCustomer...`
 * after ASC 606 and `SalesRevenueNet` before it; banks report
 * `RevenuesNetOfInterestExpense`. Each metric therefore has an ordered fallback
 * chain, resolved *per period* — so a company that switched tags in 2018 still
 * gets one continuous series.
 */
export type MetricKind =
  /** Measured over a period; quarters can be derived from year-to-date facts. */
  | "flow"
  /** Measured at an instant (balance sheet). */
  | "stock"
  /** Per-share or averaged over a period; cannot be differenced from YTD. */
  | "average";

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

export interface MetricDef {
  id: MetricId;
  label: string;
  kind: MetricKind;
  unit: "USD" | "USD/shares";
  concepts: string[];
}

export const METRICS: Record<MetricId, MetricDef> = {
  revenue: {
    id: "revenue",
    label: "Revenue",
    kind: "flow",
    unit: "USD",
    concepts: [
      "Revenues",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "RevenuesNetOfInterestExpense",
      "SalesRevenueNet",
      "SalesRevenueGoodsNet",
    ],
  },
  costOfRevenue: {
    id: "costOfRevenue",
    label: "Cost of revenue",
    kind: "flow",
    unit: "USD",
    concepts: [
      "CostOfRevenue",
      "CostOfGoodsAndServicesSold",
      "CostOfGoodsSold",
      "CostOfServices",
    ],
  },
  grossProfit: {
    id: "grossProfit",
    label: "Gross profit",
    kind: "flow",
    unit: "USD",
    concepts: ["GrossProfit"],
  },
  operatingIncome: {
    id: "operatingIncome",
    label: "Operating income",
    kind: "flow",
    unit: "USD",
    concepts: ["OperatingIncomeLoss"],
  },
  netIncome: {
    id: "netIncome",
    label: "Net income",
    kind: "flow",
    unit: "USD",
    concepts: ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss"],
  },
  epsDiluted: {
    id: "epsDiluted",
    label: "Diluted EPS",
    kind: "average",
    unit: "USD/shares",
    concepts: ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"],
  },
  researchAndDevelopment: {
    id: "researchAndDevelopment",
    label: "R&D expense",
    kind: "flow",
    unit: "USD",
    concepts: [
      "ResearchAndDevelopmentExpense",
      "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost",
    ],
  },
  shareBasedComp: {
    id: "shareBasedComp",
    label: "Stock-based compensation",
    kind: "flow",
    unit: "USD",
    concepts: ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"],
  },
  netInterestIncome: {
    id: "netInterestIncome",
    label: "Net interest income",
    kind: "flow",
    unit: "USD",
    concepts: ["InterestIncomeExpenseNet", "InterestIncomeExpenseAfterProvisionForLoanLoss"],
  },
  noninterestIncome: {
    id: "noninterestIncome",
    label: "Noninterest income",
    kind: "flow",
    unit: "USD",
    concepts: ["NoninterestIncome"],
  },
  noninterestExpense: {
    id: "noninterestExpense",
    label: "Noninterest expense",
    kind: "flow",
    unit: "USD",
    concepts: ["NoninterestExpense"],
  },
  operatingCashFlow: {
    id: "operatingCashFlow",
    label: "Operating cash flow",
    kind: "flow",
    unit: "USD",
    concepts: [
      "NetCashProvidedByUsedInOperatingActivities",
      "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ],
  },
  capex: {
    id: "capex",
    label: "Capital expenditure",
    kind: "flow",
    unit: "USD",
    concepts: [
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsToAcquireProductiveAssets",
      "PaymentsForCapitalImprovements",
    ],
  },
  dividendsPaid: {
    id: "dividendsPaid",
    label: "Dividends paid",
    kind: "flow",
    unit: "USD",
    concepts: ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
  },
  buybacks: {
    id: "buybacks",
    label: "Share repurchases",
    kind: "flow",
    unit: "USD",
    concepts: ["PaymentsForRepurchaseOfCommonStock"],
  },
  totalAssets: {
    id: "totalAssets",
    label: "Total assets",
    kind: "stock",
    unit: "USD",
    concepts: ["Assets"],
  },
  totalLiabilities: {
    id: "totalLiabilities",
    label: "Total liabilities",
    kind: "stock",
    unit: "USD",
    concepts: ["Liabilities"],
  },
  equity: {
    id: "equity",
    label: "Shareholders' equity",
    kind: "stock",
    unit: "USD",
    concepts: [
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ],
  },
  cash: {
    id: "cash",
    label: "Cash & equivalents",
    kind: "stock",
    unit: "USD",
    concepts: [
      "CashAndCashEquivalentsAtCarryingValue",
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
      "Cash",
    ],
  },
  longTermDebt: {
    id: "longTermDebt",
    label: "Long-term debt",
    kind: "stock",
    unit: "USD",
    concepts: [
      "LongTermDebt",
      "LongTermDebtNoncurrent",
      "LongTermDebtAndCapitalLeaseObligations",
      "LongTermBorrowings",
    ],
  },
};
