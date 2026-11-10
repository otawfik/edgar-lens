/**
 * Every operation the client sends. Types for each are generated into
 * types.generated.ts by `npm run codegen`; RTK Query endpoints in
 * src/store/api.ts pair each document with its generated types.
 */

export const FILING_FIELDS = /* GraphQL */ `
  fragment FilingFields on Filing {
    accession
    form
    filed
    period
    url
    indexUrl
  }
`;

export const REVISION_FIELDS = /* GraphQL */ `
  fragment RevisionFields on Revision {
    metric
    label
    period
    end
    periodLabel
    from
    to
    change
    lagDays
    material
    likelySplit
    firstReported {
      ...FilingFields
    }
    revisedIn {
      ...FilingFields
    }
  }
`;

export const HOME = /* GraphQL */ `
  query Home {
    dataset {
      generatedAt
      companies
      figures
      vintages
      filings
      earliestFiled
      latestFiled
    }
    revisionStats {
      figures
      revised
      rate
      revisedTwice
      medianLagDays
      byForm {
        form
        changes
      }
      lagBuckets {
        label
        changes
      }
      companies {
        ticker
        name
        sector
        figures
        revised
        rate
        medianLagDays
        largest {
          label
          periodLabel
          from
          to
          change
        }
      }
      metrics {
        metric
        label
        figures
        revised
        rate
        medianLagDays
      }
      sectors {
        sector
        companies
        figures
        revised
        rate
      }
    }
  }
`;

export const COMPANY_LIST = /* GraphQL */ `
  query CompanyList {
    companies(first: 200) {
      ticker
      name
      sector
    }
  }
`;

export const COMPANY = /* GraphQL */ `
  ${FILING_FIELDS}
  ${REVISION_FIELDS}

  fragment Point on DataPoint {
    end
    label
    fiscalYear
    value
    derived
    vintages
    revised
    vintage {
      value
      filing {
        ...FilingFields
      }
    }
    first {
      value
      filing {
        ...FilingFields
      }
    }
    history {
      value
      filing {
        ...FilingFields
      }
    }
  }

  query Company($ticker: String!, $period: PeriodType!, $asOf: String, $last: Int!) {
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
      filingDates
      lineItems(period: $period, last: $last, asOf: $asOf) {
        metric
        label
        unit
        points {
          ...Point
        }
      }
      operatingMargin: ratio(id: OPERATING_MARGIN, period: $period, last: $last, asOf: $asOf) {
        end
        label
        value
      }
      netMargin: ratio(id: NET_MARGIN, period: $period, last: $last, asOf: $asOf) {
        end
        label
        value
      }
      fcfMargin: ratio(id: FCF_MARGIN, period: $period, last: $last, asOf: $asOf) {
        end
        label
        value
      }
      efficiencyRatio: ratio(id: EFFICIENCY_RATIO, period: $period, last: $last, asOf: $asOf) {
        end
        label
        value
      }
      revisions(first: 100) {
        ...RevisionFields
      }
      filings(first: 8) {
        ...FilingFields
      }
    }
  }
`;

export const DIFF = /* GraphQL */ `
  ${FILING_FIELDS}
  ${REVISION_FIELDS}

  query Diff($ticker: String!, $from: String!, $to: String!) {
    company(ticker: $ticker) {
      ticker
      diff(from: $from, to: $to) {
        from
        to
        materialCount
        revised {
          ...RevisionFields
        }
        added {
          end
          label
          derived
          value
          vintage {
            filing {
              ...FilingFields
            }
          }
        }
        filingsBetween {
          ...FilingFields
        }
      }
    }
  }
`;

export const SCREENER = /* GraphQL */ `
  query Screener {
    dataset {
      generatedAt
      companies
      figures
      filings
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
