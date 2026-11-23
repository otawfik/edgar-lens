export const typeDefs = /* GraphQL */ `
  """
  Point-in-time financial statements of ~100 US large caps, normalised from SEC
  EDGAR XBRL company facts. Every figure keeps the history of values it has
  had across filings; any series can be read "as of" a past date. Monetary
  values are US dollars; ratios are fractions (0.25 = 25%) unless MULTIPLE.
  Dates are ISO yyyy-mm-dd.
  """
  type Query {
    "Provenance and size of the loaded snapshot."
    dataset: Dataset!
    "Snapshot-wide revision statistics and league tables, computed at build time."
    revisionStats: RevisionStats!
    "GICS sectors with company counts and median latest-fiscal-year ratios."
    sectors: [SectorSummary!]!
    "Companies in the coverage universe, optionally filtered. Max 200."
    companies(filter: CompanyFilter, first: Int = 200): [Company!]!
    "One company by ticker (case-insensitive)."
    company(ticker: String!): Company
    "Each company's latest 10-K/10-Q, newest first, with what changed. Max 120."
    latestFilings(first: Int = 25, form: FilingForm): [FilingChange!]!
    ratioDefinitions: [RatioDefinition!]!
    metricDefinitions: [MetricDefinition!]!
  }

  type Dataset {
    generatedAt: String!
    source: String!
    companies: Int!
    "Reported (metric, period) figures; derived quarters are not counted."
    figures: Int!
    "Distinct values those figures have had across filings."
    vintages: Int!
    filings: Int!
    rawFactsScanned: Int!
    earliestFiled: String!
    latestFiled: String!
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
    "Distinct dates on which this company filed a 10-K/10-Q in the snapshot, ascending."
    filingDates: [String!]!
    "Latest fiscal-year figures, for screening."
    keyStats: KeyStats!
    "One metric's series. With asOf, values are what had been filed on or before that date."
    series(metric: Metric!, period: PeriodType = ANNUAL, last: Int = 11, asOf: String): [DataPoint!]!
    "Every metric's series at once, for a statement view. Max last 40."
    lineItems(period: PeriodType = ANNUAL, last: Int = 8, asOf: String): [LineItem!]!
    ratio(id: Ratio!, period: PeriodType = ANNUAL, last: Int = 11, asOf: String): [RatioPoint!]!
    "Figures whose in-force value differs between two dates, and figures first filed between them."
    diff(from: String!, to: String!): AsOfDiff!
    "Material revisions across the company's history, newest change first. Max 200."
    revisions(first: Int = 50): [Revision!]!
    "How many material revisions the company has in total."
    revisionCount: Int!
    """
    Reported figures per (line item, period type) with the delay of each one's
    first material change. Any revision rate — by line item, by period type, by
    delay — is a sum over these cells.
    """
    revisionCells: [RevisionCell!]!
    "Rank within GICS sector on each applicable ratio (latest figures)."
    ranking: [RatioRank!]!
    "Same-sector companies closest in revenue. Max 10."
    peers(limit: Int = 5): [Company!]!
    "What the latest filing changed versus a year earlier."
    changes: FilingChange!
    "Most recent 10-K/10-Q filings."
    filings(first: Int = 8): [Filing!]!
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

  type Vintage {
    value: Float!
    filing: Filing!
  }

  type DataPoint {
    end: String!
    "FY2024 or Sep 2025"
    label: String!
    fiscalYear: Int!
    "The value in force on the as-of date (or today)."
    value: Float!
    "Computed from other reported values (quarter from YTD, FCF, gross profit)."
    derived: Boolean!
    "The filing whose value is in force."
    vintage: Vintage!
    "As first reported."
    first: Vintage!
    "Number of distinct values this figure has had up to the as-of date."
    vintages: Int!
    "True when the in-force value differs from the first reported one."
    revised: Boolean!
    "Every value this figure has had, in filing order (not limited by asOf)."
    history: [Vintage!]!
  }

  type LineItem {
    metric: Metric!
    label: String!
    unit: String!
    points: [DataPoint!]!
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
    "The primary document on EDGAR."
    url: String!
    "The EDGAR filing index page."
    indexUrl: String!
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
    "Relative change, (to − from) / |from|."
    change: Float
    "Days between the two filings."
    lagDays: Int!
    "Above the materiality threshold (0.5% and $1M / $0.01)."
    material: Boolean!
    "Computed from other figures (free cash flow, untagged gross profit, a quarter from year-to-date values); it moved because its inputs did."
    derived: Boolean!
    "Per-share figure that moved by a whole-number factor: a stock split, not a restatement."
    likelySplit: Boolean!
    firstReported: Filing!
    revisedIn: Filing!
  }

  type AsOfDiff {
    from: String!
    to: String!
    "Figures whose in-force value differs between the two dates, largest material change first."
    revised: [Revision!]!
    "Reported figures with a material, non-split change (derived figures are not counted)."
    materialCount: Int!
    "Figures first filed after \`from\` and on or before \`to\`, newest period first."
    added: [DataPoint!]!
    "10-K/10-Q filings made after \`from\` and on or before \`to\`."
    filingsBetween: [Filing!]!
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
  }

  type SectorSummary {
    sector: String!
    companies: Int!
    medians: [RatioValue!]!
  }

  type RevisionStats {
    figures: Int!
    revised: Int!
    rate: Float!
    revisedTwice: Int!
    medianLagDays: Float
    byForm: [FormCount!]!
    lagBuckets: [LagBucket!]!
    "Every company, highest revision rate first."
    companies: [CompanyLeagueRow!]!
    metrics: [MetricLeagueRow!]!
    sectors: [SectorLeagueRow!]!
  }

  type RevisionCell {
    metric: Metric!
    period: PeriodType!
    "Reported figures in the cell; derived quarters are not counted."
    figures: Int!
    "Days from first filing to first material change, one entry per changed figure, ascending."
    lagDays: [Int!]!
  }

  type FormCount {
    form: String!
    changes: Int!
  }

  type LagBucket {
    label: String!
    changes: Int!
  }

  type CompanyLeagueRow {
    ticker: String!
    name: String!
    sector: String!
    figures: Int!
    revised: Int!
    rate: Float!
    medianLagDays: Float
    largest: LargestRevision
  }

  type LargestRevision {
    metric: Metric!
    label: String!
    period: PeriodType!
    end: String!
    periodLabel: String!
    from: Float!
    to: Float!
    change: Float
  }

  type MetricLeagueRow {
    metric: Metric!
    label: String!
    figures: Int!
    revised: Int!
    rate: Float!
    medianLagDays: Float
  }

  type SectorLeagueRow {
    sector: String!
    companies: Int!
    figures: Int!
    revised: Int!
    rate: Float!
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
