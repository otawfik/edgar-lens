/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type BusinessModel =
  | 'BANK'
  | 'GENERAL'
  | 'INSURER';

export type FilingForm =
  | 'TEN_K'
  | 'TEN_Q';

export type Metric =
  | 'BUYBACKS'
  | 'CAPEX'
  | 'CASH'
  | 'COST_OF_REVENUE'
  | 'DIVIDENDS_PAID'
  | 'EPS_DILUTED'
  | 'EQUITY'
  | 'FREE_CASH_FLOW'
  | 'GROSS_PROFIT'
  | 'LONG_TERM_DEBT'
  | 'NET_INCOME'
  | 'NET_INTEREST_INCOME'
  | 'NONINTEREST_EXPENSE'
  | 'NONINTEREST_INCOME'
  | 'OPERATING_CASH_FLOW'
  | 'OPERATING_INCOME'
  | 'RESEARCH_AND_DEVELOPMENT'
  | 'REVENUE'
  | 'SHARE_BASED_COMP'
  | 'TOTAL_ASSETS'
  | 'TOTAL_LIABILITIES';

export type PeriodType =
  | 'ANNUAL'
  | 'QUARTERLY';

export type Ratio =
  | 'CAPITAL_RETURN'
  | 'CASH_CONVERSION'
  | 'DEBT_TO_EQUITY'
  | 'EFFICIENCY_RATIO'
  | 'EPS_GROWTH'
  | 'FCF_MARGIN'
  | 'GROSS_MARGIN'
  | 'NET_MARGIN'
  | 'OPERATING_MARGIN'
  | 'RD_INTENSITY'
  | 'REVENUE_CAGR_3Y'
  | 'REVENUE_GROWTH'
  | 'ROA'
  | 'ROE'
  | 'SBC_TO_REVENUE';

export type ScreenerQueryVariables = Exact<{ [key: string]: never; }>;


export type ScreenerQuery = { dataset: { generatedAt: string, companies: number, dataPoints: number, filings: number, revisions: number, latestFiled: string | null }, companies: Array<{ ticker: string, name: string, sector: string, model: BusinessModel, latestFiscalYear: number | null, latestPeriodEnd: string | null, keyStats: { revenue: number | null, netIncome: number | null, freeCashFlow: number | null, ratios: Array<{ ratio: Ratio, value: number | null }> }, changes: { lagging: boolean, filing: { form: string, filed: string } | null } }> };

export type PointFragment = { end: string, label: string, fiscalYear: number, value: number, derived: boolean };

export type RatioPtFragment = { end: string, label: string, value: number | null };

export type FilingFieldsFragment = { accession: string, form: string, filed: string, period: string, url: string };

export type CompanyQueryVariables = Exact<{
  ticker: string;
  period: PeriodType;
}>;


export type CompanyQuery = { company: { cik: number, ticker: string, name: string, sector: string, industry: string, model: BusinessModel, fiscalYearEnd: string, secUrl: string, latestFiscalYear: number | null, latestPeriodEnd: string | null, revenue: Array<{ end: string, label: string, fiscalYear: number, value: number, derived: boolean }>, grossProfit: Array<{ end: string, label: string, fiscalYear: number, value: number, derived: boolean }>, operatingIncome: Array<{ end: string, label: string, fiscalYear: number, value: number, derived: boolean }>, netIncome: Array<{ end: string, label: string, fiscalYear: number, value: number, derived: boolean }>, operatingCashFlow: Array<{ end: string, label: string, fiscalYear: number, value: number, derived: boolean }>, freeCashFlow: Array<{ end: string, label: string, fiscalYear: number, value: number, derived: boolean }>, netInterestIncome: Array<{ end: string, label: string, fiscalYear: number, value: number, derived: boolean }>, grossMargin: Array<{ end: string, label: string, value: number | null }>, operatingMargin: Array<{ end: string, label: string, value: number | null }>, netMargin: Array<{ end: string, label: string, value: number | null }>, fcfMargin: Array<{ end: string, label: string, value: number | null }>, efficiencyRatio: Array<{ end: string, label: string, value: number | null }>, ranking: Array<{ ratio: Ratio, value: number | null, rank: number | null, of: number, percentile: number | null, sectorMedian: number | null }>, peers: Array<{ ticker: string, name: string, keyStats: { revenue: number | null, ratios: Array<{ ratio: Ratio, value: number | null }> } }>, changes: { quarterEnd: string | null, quarterLabel: string | null, priorYearEnd: string | null, lagging: boolean, headline: string, filing: { accession: string, form: string, filed: string, period: string, url: string } | null, metrics: Array<{ metric: Metric, label: string, value: number | null, priorYear: number | null, yoy: number | null, priorQuarter: number | null, qoq: number | null }>, ratios: Array<{ ratio: Ratio, value: number | null, priorYear: number | null, delta: number | null }> }, filings: Array<{ accession: string, form: string, filed: string, period: string, url: string }>, revisions: Array<{ metric: Metric, label: string, period: PeriodType, end: string, periodLabel: string, from: number, to: number, change: number | null, likelySplit: boolean, firstReported: { accession: string, form: string, filed: string, period: string, url: string }, revisedIn: { accession: string, form: string, filed: string, period: string, url: string } }> } | null };

export type CompareQueryVariables = Exact<{
  tickers: Array<string> | string;
  ratio: Ratio;
}>;


export type CompareQuery = { compare: Array<{ ticker: string, name: string, sector: string, model: BusinessModel, latestFiscalYear: number | null, keyStats: { revenue: number | null, netIncome: number | null, freeCashFlow: number | null, ratios: Array<{ ratio: Ratio, value: number | null }> }, revenue: Array<{ end: string, fiscalYear: number, value: number }>, selected: Array<{ end: string, fiscalYear: number, value: number | null }> }> };

export type LatestFilingsQueryVariables = Exact<{
  first: number;
  form?: FilingForm | null | undefined;
}>;


export type LatestFilingsQuery = { latestFilings: Array<{ quarterLabel: string | null, lagging: boolean, headline: string, company: { ticker: string, name: string, sector: string }, filing: { form: string, filed: string, period: string, url: string } | null, metrics: Array<{ metric: Metric, value: number | null, yoy: number | null }>, ratios: Array<{ ratio: Ratio, delta: number | null }>, revisions: Array<{ metric: Metric }> }> };
