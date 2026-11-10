/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type BusinessModel =
  | 'BANK'
  | 'GENERAL'
  | 'INSURER';

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

export type FilingFieldsFragment = { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string };

export type RevisionFieldsFragment = { metric: Metric, label: string, period: PeriodType, end: string, periodLabel: string, from: number, to: number, change: number | null, lagDays: number, material: boolean, likelySplit: boolean, firstReported: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string }, revisedIn: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string } };

export type HomeQueryVariables = Exact<{ [key: string]: never; }>;


export type HomeQuery = { dataset: { generatedAt: string, companies: number, figures: number, vintages: number, filings: number, earliestFiled: string, latestFiled: string }, revisionStats: { figures: number, revised: number, rate: number, revisedTwice: number, medianLagDays: number | null, byForm: Array<{ form: string, changes: number }>, lagBuckets: Array<{ label: string, changes: number }>, companies: Array<{ ticker: string, name: string, sector: string, figures: number, revised: number, rate: number, medianLagDays: number | null, largest: { label: string, periodLabel: string, from: number, to: number, change: number | null } | null }>, metrics: Array<{ metric: Metric, label: string, figures: number, revised: number, rate: number, medianLagDays: number | null }>, sectors: Array<{ sector: string, companies: number, figures: number, revised: number, rate: number }> } };

export type CompanyListQueryVariables = Exact<{ [key: string]: never; }>;


export type CompanyListQuery = { companies: Array<{ ticker: string, name: string, sector: string }> };

export type PointFragment = { end: string, label: string, fiscalYear: number, value: number, derived: boolean, vintages: number, revised: boolean, vintage: { value: number, filing: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string } }, first: { value: number, filing: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string } }, history: Array<{ value: number, filing: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string } }> };

export type CompanyQueryVariables = Exact<{
  ticker: string;
  period: PeriodType;
  asOf?: string | null | undefined;
  last: number;
}>;


export type CompanyQuery = { company: { cik: number, ticker: string, name: string, sector: string, industry: string, model: BusinessModel, fiscalYearEnd: string, secUrl: string, latestFiscalYear: number | null, latestPeriodEnd: string | null, filingDates: Array<string>, lineItems: Array<{ metric: Metric, label: string, unit: string, points: Array<{ end: string, label: string, fiscalYear: number, value: number, derived: boolean, vintages: number, revised: boolean, vintage: { value: number, filing: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string } }, first: { value: number, filing: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string } }, history: Array<{ value: number, filing: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string } }> }> }>, operatingMargin: Array<{ end: string, label: string, value: number | null }>, netMargin: Array<{ end: string, label: string, value: number | null }>, fcfMargin: Array<{ end: string, label: string, value: number | null }>, efficiencyRatio: Array<{ end: string, label: string, value: number | null }>, revisions: Array<{ metric: Metric, label: string, period: PeriodType, end: string, periodLabel: string, from: number, to: number, change: number | null, lagDays: number, material: boolean, likelySplit: boolean, firstReported: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string }, revisedIn: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string } }>, filings: Array<{ accession: string, form: string, filed: string, period: string, url: string, indexUrl: string }> } | null };

export type DiffQueryVariables = Exact<{
  ticker: string;
  from: string;
  to: string;
}>;


export type DiffQuery = { company: { ticker: string, diff: { from: string, to: string, materialCount: number, revised: Array<{ metric: Metric, label: string, period: PeriodType, end: string, periodLabel: string, from: number, to: number, change: number | null, lagDays: number, material: boolean, likelySplit: boolean, firstReported: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string }, revisedIn: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string } }>, added: Array<{ end: string, label: string, derived: boolean, value: number, vintage: { filing: { accession: string, form: string, filed: string, period: string, url: string, indexUrl: string } } }>, filingsBetween: Array<{ accession: string, form: string, filed: string, period: string, url: string, indexUrl: string }> } } | null };

export type ScreenerQueryVariables = Exact<{ [key: string]: never; }>;


export type ScreenerQuery = { dataset: { generatedAt: string, companies: number, figures: number, filings: number, latestFiled: string }, companies: Array<{ ticker: string, name: string, sector: string, model: BusinessModel, latestFiscalYear: number | null, latestPeriodEnd: string | null, keyStats: { revenue: number | null, netIncome: number | null, freeCashFlow: number | null, ratios: Array<{ ratio: Ratio, value: number | null }> }, changes: { lagging: boolean, filing: { form: string, filed: string } | null } }> };
