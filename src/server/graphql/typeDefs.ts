export const typeDefs = /* GraphQL */ `
  """
  Financial statements of ~100 US large caps, normalised from SEC EDGAR XBRL
  company facts. Monetary values are in US dollars; ratios are fractions
  (0.25 = 25%) unless the ratio's format is MULTIPLE.
  """
  type Query {
    "Provenance and size of the loaded snapshot."
    dataset: Dataset!
    "GICS sectors with company counts and median latest-fiscal-year ratios."
    sectors: [SectorSummary!]!
    "Companies in the coverage universe, optionally filtered. Max 200."
    companies(filter: CompanyFilter, first: Int = 200): [Company!]!
    "One company by ticker (case-insensitive)."
    company(ticker: String!): Company
    "Several companies in the order given. Unknown tickers are skipped. Max 6."
    compare(tickers: [String!]!): [Company!]!
    "Each company's latest 10-K/10-Q, newest first, with what changed. Max 120."
    latestFilings(first: Int = 25, form: FilingForm): [FilingChange!]!
    ratioDefinitions: [RatioDefinition!]!
    metricDefinitions: [MetricDefinition!]!
  }

  type Dataset {
    generatedAt: String!
    source: String!
    companies: Int!
    dataPoints: Int!
    filings: Int!
    revisions: Int!
    rawFactsScanned: Int!
    "Most recent filing date in the snapshot."
    latestFiled: String
  }

  input CompanyFilter {
    sectors: [String!]
    models: [BusinessModel!]
    "Matches ticker or name, case-insensitive."
    search: String
    tickers: [String!]
    "Every bound must hold on the latest fiscal year (null ratios fail a bound)."
    ratioBounds: [RatioBound!]
  }

  input RatioBound {
    ratio: Ratio!
    min: Float
    max: Float
  }

  enum BusinessModel {
    GENERAL
    BANK
    INSURER
  }

  enum PeriodType {
    ANNUAL
    QUARTERLY
  }

  enum FilingForm {
    TEN_K
    TEN_Q
  }

  enum RatioFormat {
    PERCENT
    MULTIPLE
  }

  enum Direction {
    HIGHER
    LOWER
  }

  enum Metric {
    REVENUE
    COST_OF_REVENUE
    GROSS_PROFIT
    OPERATING_INCOME
    NET_INCOME
    EPS_DILUTED
    RESEARCH_AND_DEVELOPMENT
    SHARE_BASED_COMP
    NET_INTEREST_INCOME
    NONINTEREST_INCOME
    NONINTEREST_EXPENSE
    OPERATING_CASH_FLOW
    CAPEX
    FREE_CASH_FLOW
    DIVIDENDS_PAID
    BUYBACKS
    TOTAL_ASSETS
    TOTAL_LIABILITIES
    EQUITY
    CASH
    LONG_TERM_DEBT
  }

  enum Ratio {
    REVENUE_GROWTH
    REVENUE_CAGR_3Y
    EPS_GROWTH
    GROSS_MARGIN
    OPERATING_MARGIN
    NET_MARGIN
    FCF_MARGIN
    ROE
    ROA
    DEBT_TO_EQUITY
    CASH_CONVERSION
    RD_INTENSITY
    SBC_TO_REVENUE
    CAPITAL_RETURN
    EFFICIENCY_RATIO
  }

  type Company {
    cik: Int!
    ticker: String!
    name: String!
    sector: String!
    industry: String!
    model: BusinessModel!
    "MMDD, e.g. 0927 for Apple."
    fiscalYearEnd: String!
    "EDGAR filing index for the company."
    secUrl: String!
    "Latest fiscal year (calendar-aligned: years ending Jan–May belong to the prior year)."
    latestFiscalYear: Int
    latestPeriodEnd: String
    "Latest fiscal-year figures, for screening."
    keyStats: KeyStats!
    series(metric: Metric!, period: PeriodType = ANNUAL, last: Int = 11): [DataPoint!]!
    ratio(id: Ratio!, period: PeriodType = ANNUAL, last: Int = 11): [RatioPoint!]!
    "Rank within GICS sector on each applicable ratio."
    ranking: [RatioRank!]!
    "Same-sector companies closest in revenue. Max 10."
    peers(limit: Int = 5): [Company!]!
    "What the latest filing changed."
    changes: FilingChange!
    "Most recent 10-K/10-Q filings."
    filings(first: Int = 6): [Filing!]!
    "Figures whose latest reported value differs from the first by ≥0.5%."
    revisions(first: Int = 25): [Revision!]!
  }

  type KeyStats {
    fiscalYear: Int
    periodEnd: String
    revenue: Float
    netIncome: Float
    operatingCashFlow: Float
    freeCashFlow: Float
    totalAssets: Float
    ratios: [RatioValue!]!
  }

  type RatioValue {
    ratio: Ratio!
    value: Float
  }

  type DataPoint {
    end: String!
    "FY2024 or Sep 2025"
    label: String!
    fiscalYear: Int!
    value: Float!
    "Computed from other reported values (e.g. FCF), not tagged by the filer."
    derived: Boolean!
    filing: Filing
  }

  type RatioPoint {
    end: String!
    label: String!
    fiscalYear: Int!
    value: Float
  }

  type RatioRank {
    ratio: Ratio!
    value: Float
    rank: Int
    of: Int!
    "Share of sector peers this company beats (0–1)."
    percentile: Float
    sectorMedian: Float
  }

  type Filing {
    accession: String!
    form: String!
    filed: String!
    period: String!
    url: String!
  }

  type MetricChange {
    metric: Metric!
    label: String!
    value: Float
    priorYear: Float
    yoy: Float
    priorQuarter: Float
    qoq: Float
  }

  type RatioChange {
    ratio: Ratio!
    value: Float
    priorYear: Float
    "Change in the ratio versus a year earlier (0.0123 = +123 bps)."
    delta: Float
  }

  type Revision {
    metric: Metric!
    label: String!
    period: PeriodType!
    end: String!
    periodLabel: String!
    from: Float!
    to: Float!
    change: Float
    "Per-share figure that moved by a whole-number factor: a stock split, not a restatement."
    likelySplit: Boolean!
    firstReported: Filing!
    revisedIn: Filing!
  }

  type FilingChange {
    company: Company!
    filing: Filing
    quarterEnd: String
    quarterLabel: String
    priorYearEnd: String
    priorQuarterEnd: String
    "The latest filing is newer than the XBRL data SEC has published for it."
    lagging: Boolean!
    headline: String!
    metrics: [MetricChange!]!
    ratios: [RatioChange!]!
    revisions: [Revision!]!
  }

  type SectorSummary {
    sector: String!
    companies: Int!
    medians: [RatioValue!]!
  }

  type RatioDefinition {
    id: Ratio!
    label: String!
    short: String!
    format: RatioFormat!
    better: Direction!
    quarterly: Boolean!
    models: [BusinessModel!]!
    description: String!
  }

  type MetricDefinition {
    id: Metric!
    label: String!
    unit: String!
  }
`;
