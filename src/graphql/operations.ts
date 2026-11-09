/**
 * Every operation the client sends. Types for each are generated into
 * types.generated.ts by `npm run codegen`; RTK Query endpoints in
 * src/store/api.ts pair each document with its generated types.
 */

export const SCREENER = /* GraphQL */ `
  query Screener {
    dataset {
      generatedAt
      companies
      dataPoints
      filings
      revisions
      latestFiled
    }
    companies(first: 200) {
      ticker
      name
      sector
      model
      latestFiscalYear
      latestPeriodEnd
      keyStats {
        revenue
        netIncome
        freeCashFlow
        ratios {
          ratio
          value
        }
      }
      changes {
        lagging
        filing {
          form
          filed
        }
      }
    }
  }
`;

export const COMPANY = /* GraphQL */ `
  fragment Point on DataPoint {
    end
    label
    fiscalYear
    value
    derived
  }

  fragment RatioPt on RatioPoint {
    end
    label
    value
  }

  fragment FilingFields on Filing {
    accession
    form
    filed
    period
    url
  }

  query Company($ticker: String!, $period: PeriodType!) {
    company(ticker: $ticker) {
      cik
      ticker
      name
      sector
      industry
      model
      fiscalYearEnd
      secUrl
      latestFiscalYear
      latestPeriodEnd
      revenue: series(metric: REVENUE, period: $period, last: 12) {
        ...Point
      }
      grossProfit: series(metric: GROSS_PROFIT, period: $period, last: 12) {
        ...Point
      }
      operatingIncome: series(metric: OPERATING_INCOME, period: $period, last: 12) {
        ...Point
      }
      netIncome: series(metric: NET_INCOME, period: $period, last: 12) {
        ...Point
      }
      operatingCashFlow: series(metric: OPERATING_CASH_FLOW, period: $period, last: 12) {
        ...Point
      }
      freeCashFlow: series(metric: FREE_CASH_FLOW, period: $period, last: 12) {
        ...Point
      }
      netInterestIncome: series(metric: NET_INTEREST_INCOME, period: $period, last: 12) {
        ...Point
      }
      grossMargin: ratio(id: GROSS_MARGIN, period: $period, last: 12) {
        ...RatioPt
      }
      operatingMargin: ratio(id: OPERATING_MARGIN, period: $period, last: 12) {
        ...RatioPt
      }
      netMargin: ratio(id: NET_MARGIN, period: $period, last: 12) {
        ...RatioPt
      }
      fcfMargin: ratio(id: FCF_MARGIN, period: $period, last: 12) {
        ...RatioPt
      }
      efficiencyRatio: ratio(id: EFFICIENCY_RATIO, period: $period, last: 12) {
        ...RatioPt
      }
      ranking {
        ratio
        value
        rank
        of
        percentile
        sectorMedian
      }
      peers(limit: 5) {
        ticker
        name
        keyStats {
          revenue
          ratios {
            ratio
            value
          }
        }
      }
      changes {
        quarterEnd
        quarterLabel
        priorYearEnd
        lagging
        headline
        filing {
          ...FilingFields
        }
        metrics {
          metric
          label
          value
          priorYear
          yoy
          priorQuarter
          qoq
        }
        ratios {
          ratio
          value
          priorYear
          delta
        }
      }
      filings(first: 6) {
        ...FilingFields
      }
      revisions(first: 40) {
        metric
        label
        period
        end
        periodLabel
        from
        to
        change
        likelySplit
        firstReported {
          ...FilingFields
        }
        revisedIn {
          ...FilingFields
        }
      }
    }
  }
`;

export const COMPARE = /* GraphQL */ `
  query Compare($tickers: [String!]!, $ratio: Ratio!) {
    compare(tickers: $tickers) {
      ticker
      name
      sector
      model
      latestFiscalYear
      keyStats {
        revenue
        netIncome
        freeCashFlow
        ratios {
          ratio
          value
        }
      }
      revenue: series(metric: REVENUE, last: 11) {
        end
        fiscalYear
        value
      }
      selected: ratio(id: $ratio, last: 11) {
        end
        fiscalYear
        value
      }
    }
  }
`;

export const LATEST_FILINGS = /* GraphQL */ `
  query LatestFilings($first: Int!, $form: FilingForm) {
    latestFilings(first: $first, form: $form) {
      company {
        ticker
        name
        sector
      }
      filing {
        form
        filed
        period
        url
      }
      quarterLabel
      lagging
      headline
      metrics {
        metric
        value
        yoy
      }
      ratios {
        ratio
        delta
      }
      revisions {
        metric
      }
    }
  }
`;
