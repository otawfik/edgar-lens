import type { GraphQLResolveInfo } from 'graphql';
import type { CompanyFinancials as CompanyFinancialsModel } from '@/lib/finance/derive';
import type { FilingChange as FilingChangeModel } from '@/server/dataset';
import type { GraphQLContext } from './context';
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type BusinessModel =
  | 'BANK'
  | 'GENERAL'
  | 'INSURER';

export type Company = {
  __typename?: 'Company';
  /** What the latest filing changed. */
  changes: FilingChange;
  cik: Scalars['Int']['output'];
  /** Most recent 10-K/10-Q filings. */
  filings: Array<Filing>;
  /** MMDD, e.g. 0927 for Apple. */
  fiscalYearEnd: Scalars['String']['output'];
  industry: Scalars['String']['output'];
  /** Latest fiscal-year figures, for screening. */
  keyStats: KeyStats;
  /** Latest fiscal year (calendar-aligned: years ending Jan–May belong to the prior year). */
  latestFiscalYear?: Maybe<Scalars['Int']['output']>;
  latestPeriodEnd?: Maybe<Scalars['String']['output']>;
  model: BusinessModel;
  name: Scalars['String']['output'];
  /** Same-sector companies closest in revenue. Max 10. */
  peers: Array<Company>;
  /** Rank within GICS sector on each applicable ratio. */
  ranking: Array<RatioRank>;
  ratio: Array<RatioPoint>;
  /** Figures whose latest reported value differs from the first by ≥0.5%. */
  revisions: Array<Revision>;
  /** EDGAR filing index for the company. */
  secUrl: Scalars['String']['output'];
  sector: Scalars['String']['output'];
  series: Array<DataPoint>;
  ticker: Scalars['String']['output'];
};


export type CompanyFilingsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type CompanyPeersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type CompanyRatioArgs = {
  id: Ratio;
  last?: InputMaybe<Scalars['Int']['input']>;
  period?: InputMaybe<PeriodType>;
};


export type CompanyRevisionsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type CompanySeriesArgs = {
  last?: InputMaybe<Scalars['Int']['input']>;
  metric: Metric;
  period?: InputMaybe<PeriodType>;
};

export type CompanyFilter = {
  models?: InputMaybe<Array<BusinessModel>>;
  /** Every bound must hold on the latest fiscal year (null ratios fail a bound). */
  ratioBounds?: InputMaybe<Array<RatioBound>>;
  /** Matches ticker or name, case-insensitive. */
  search?: InputMaybe<Scalars['String']['input']>;
  sectors?: InputMaybe<Array<Scalars['String']['input']>>;
  tickers?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type DataPoint = {
  __typename?: 'DataPoint';
  /** Computed from other reported values (e.g. FCF), not tagged by the filer. */
  derived: Scalars['Boolean']['output'];
  end: Scalars['String']['output'];
  filing?: Maybe<Filing>;
  fiscalYear: Scalars['Int']['output'];
  /** FY2024 or Sep 2025 */
  label: Scalars['String']['output'];
  value: Scalars['Float']['output'];
};

export type Dataset = {
  __typename?: 'Dataset';
  companies: Scalars['Int']['output'];
  dataPoints: Scalars['Int']['output'];
  filings: Scalars['Int']['output'];
  generatedAt: Scalars['String']['output'];
  /** Most recent filing date in the snapshot. */
  latestFiled?: Maybe<Scalars['String']['output']>;
  rawFactsScanned: Scalars['Int']['output'];
  revisions: Scalars['Int']['output'];
  source: Scalars['String']['output'];
};

export type Direction =
  | 'HIGHER'
  | 'LOWER';

export type Filing = {
  __typename?: 'Filing';
  accession: Scalars['String']['output'];
  filed: Scalars['String']['output'];
  form: Scalars['String']['output'];
  period: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

export type FilingChange = {
  __typename?: 'FilingChange';
  company: Company;
  filing?: Maybe<Filing>;
  headline: Scalars['String']['output'];
  /** The latest filing is newer than the XBRL data SEC has published for it. */
  lagging: Scalars['Boolean']['output'];
  metrics: Array<MetricChange>;
  priorQuarterEnd?: Maybe<Scalars['String']['output']>;
  priorYearEnd?: Maybe<Scalars['String']['output']>;
  quarterEnd?: Maybe<Scalars['String']['output']>;
  quarterLabel?: Maybe<Scalars['String']['output']>;
  ratios: Array<RatioChange>;
  revisions: Array<Revision>;
};

export type FilingForm =
  | 'TEN_K'
  | 'TEN_Q';

export type KeyStats = {
  __typename?: 'KeyStats';
  fiscalYear?: Maybe<Scalars['Int']['output']>;
  freeCashFlow?: Maybe<Scalars['Float']['output']>;
  netIncome?: Maybe<Scalars['Float']['output']>;
  operatingCashFlow?: Maybe<Scalars['Float']['output']>;
  periodEnd?: Maybe<Scalars['String']['output']>;
  ratios: Array<RatioValue>;
  revenue?: Maybe<Scalars['Float']['output']>;
  totalAssets?: Maybe<Scalars['Float']['output']>;
};

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

export type MetricChange = {
  __typename?: 'MetricChange';
  label: Scalars['String']['output'];
  metric: Metric;
  priorQuarter?: Maybe<Scalars['Float']['output']>;
  priorYear?: Maybe<Scalars['Float']['output']>;
  qoq?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
  yoy?: Maybe<Scalars['Float']['output']>;
};

export type MetricDefinition = {
  __typename?: 'MetricDefinition';
  id: Metric;
  label: Scalars['String']['output'];
  unit: Scalars['String']['output'];
};

export type PeriodType =
  | 'ANNUAL'
  | 'QUARTERLY';

/**
 * Financial statements of ~100 US large caps, normalised from SEC EDGAR XBRL
 * company facts. Monetary values are in US dollars; ratios are fractions
 * (0.25 = 25%) unless the ratio's format is MULTIPLE.
 */
export type Query = {
  __typename?: 'Query';
  /** Companies in the coverage universe, optionally filtered. Max 200. */
  companies: Array<Company>;
  /** One company by ticker (case-insensitive). */
  company?: Maybe<Company>;
  /** Several companies in the order given. Unknown tickers are skipped. Max 6. */
  compare: Array<Company>;
  /** Provenance and size of the loaded snapshot. */
  dataset: Dataset;
  /** Each company's latest 10-K/10-Q, newest first, with what changed. Max 120. */
  latestFilings: Array<FilingChange>;
  metricDefinitions: Array<MetricDefinition>;
  ratioDefinitions: Array<RatioDefinition>;
  /** GICS sectors with company counts and median latest-fiscal-year ratios. */
  sectors: Array<SectorSummary>;
};


/**
 * Financial statements of ~100 US large caps, normalised from SEC EDGAR XBRL
 * company facts. Monetary values are in US dollars; ratios are fractions
 * (0.25 = 25%) unless the ratio's format is MULTIPLE.
 */
export type QueryCompaniesArgs = {
  filter?: InputMaybe<CompanyFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


/**
 * Financial statements of ~100 US large caps, normalised from SEC EDGAR XBRL
 * company facts. Monetary values are in US dollars; ratios are fractions
 * (0.25 = 25%) unless the ratio's format is MULTIPLE.
 */
export type QueryCompanyArgs = {
  ticker: Scalars['String']['input'];
};


/**
 * Financial statements of ~100 US large caps, normalised from SEC EDGAR XBRL
 * company facts. Monetary values are in US dollars; ratios are fractions
 * (0.25 = 25%) unless the ratio's format is MULTIPLE.
 */
export type QueryCompareArgs = {
  tickers: Array<Scalars['String']['input']>;
};


/**
 * Financial statements of ~100 US large caps, normalised from SEC EDGAR XBRL
 * company facts. Monetary values are in US dollars; ratios are fractions
 * (0.25 = 25%) unless the ratio's format is MULTIPLE.
 */
export type QueryLatestFilingsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  form?: InputMaybe<FilingForm>;
};

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

export type RatioBound = {
  max?: InputMaybe<Scalars['Float']['input']>;
  min?: InputMaybe<Scalars['Float']['input']>;
  ratio: Ratio;
};

export type RatioChange = {
  __typename?: 'RatioChange';
  /** Change in the ratio versus a year earlier (0.0123 = +123 bps). */
  delta?: Maybe<Scalars['Float']['output']>;
  priorYear?: Maybe<Scalars['Float']['output']>;
  ratio: Ratio;
  value?: Maybe<Scalars['Float']['output']>;
};

export type RatioDefinition = {
  __typename?: 'RatioDefinition';
  better: Direction;
  description: Scalars['String']['output'];
  format: RatioFormat;
  id: Ratio;
  label: Scalars['String']['output'];
  models: Array<BusinessModel>;
  quarterly: Scalars['Boolean']['output'];
  short: Scalars['String']['output'];
};

export type RatioFormat =
  | 'MULTIPLE'
  | 'PERCENT';

export type RatioPoint = {
  __typename?: 'RatioPoint';
  end: Scalars['String']['output'];
  fiscalYear: Scalars['Int']['output'];
  label: Scalars['String']['output'];
  value?: Maybe<Scalars['Float']['output']>;
};

export type RatioRank = {
  __typename?: 'RatioRank';
  of: Scalars['Int']['output'];
  /** Share of sector peers this company beats (0–1). */
  percentile?: Maybe<Scalars['Float']['output']>;
  rank?: Maybe<Scalars['Int']['output']>;
  ratio: Ratio;
  sectorMedian?: Maybe<Scalars['Float']['output']>;
  value?: Maybe<Scalars['Float']['output']>;
};

export type RatioValue = {
  __typename?: 'RatioValue';
  ratio: Ratio;
  value?: Maybe<Scalars['Float']['output']>;
};

export type Revision = {
  __typename?: 'Revision';
  change?: Maybe<Scalars['Float']['output']>;
  end: Scalars['String']['output'];
  firstReported: Filing;
  from: Scalars['Float']['output'];
  label: Scalars['String']['output'];
  /** Per-share figure that moved by a whole-number factor: a stock split, not a restatement. */
  likelySplit: Scalars['Boolean']['output'];
  metric: Metric;
  period: PeriodType;
  periodLabel: Scalars['String']['output'];
  revisedIn: Filing;
  to: Scalars['Float']['output'];
};

export type SectorSummary = {
  __typename?: 'SectorSummary';
  companies: Scalars['Int']['output'];
  medians: Array<RatioValue>;
  sector: Scalars['String']['output'];
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  BusinessModel: BusinessModel;
  Company: ResolverTypeWrapper<CompanyFinancialsModel>;
  CompanyFilter: CompanyFilter;
  DataPoint: ResolverTypeWrapper<DataPoint>;
  Dataset: ResolverTypeWrapper<Dataset>;
  Direction: Direction;
  Filing: ResolverTypeWrapper<Filing>;
  FilingChange: ResolverTypeWrapper<FilingChangeModel>;
  FilingForm: FilingForm;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  KeyStats: ResolverTypeWrapper<KeyStats>;
  Metric: Metric;
  MetricChange: ResolverTypeWrapper<MetricChange>;
  MetricDefinition: ResolverTypeWrapper<MetricDefinition>;
  PeriodType: PeriodType;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Ratio: Ratio;
  RatioBound: RatioBound;
  RatioChange: ResolverTypeWrapper<RatioChange>;
  RatioDefinition: ResolverTypeWrapper<RatioDefinition>;
  RatioFormat: RatioFormat;
  RatioPoint: ResolverTypeWrapper<RatioPoint>;
  RatioRank: ResolverTypeWrapper<RatioRank>;
  RatioValue: ResolverTypeWrapper<RatioValue>;
  Revision: ResolverTypeWrapper<Revision>;
  SectorSummary: ResolverTypeWrapper<SectorSummary>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars['Boolean']['output'];
  Company: CompanyFinancialsModel;
  CompanyFilter: CompanyFilter;
  DataPoint: DataPoint;
  Dataset: Dataset;
  Filing: Filing;
  FilingChange: FilingChangeModel;
  Float: Scalars['Float']['output'];
  Int: Scalars['Int']['output'];
  KeyStats: KeyStats;
  MetricChange: MetricChange;
  MetricDefinition: MetricDefinition;
  Query: Record<PropertyKey, never>;
  RatioBound: RatioBound;
  RatioChange: RatioChange;
  RatioDefinition: RatioDefinition;
  RatioPoint: RatioPoint;
  RatioRank: RatioRank;
  RatioValue: RatioValue;
  Revision: Revision;
  SectorSummary: SectorSummary;
  String: Scalars['String']['output'];
};

export type CompanyResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Company'] = ResolversParentTypes['Company']> = {
  changes?: Resolver<ResolversTypes['FilingChange'], ParentType, ContextType>;
  cik?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  filings?: Resolver<Array<ResolversTypes['Filing']>, ParentType, ContextType, RequireFields<CompanyFilingsArgs, 'first'>>;
  fiscalYearEnd?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  industry?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  keyStats?: Resolver<ResolversTypes['KeyStats'], ParentType, ContextType>;
  latestFiscalYear?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  latestPeriodEnd?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  model?: Resolver<ResolversTypes['BusinessModel'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  peers?: Resolver<Array<ResolversTypes['Company']>, ParentType, ContextType, RequireFields<CompanyPeersArgs, 'limit'>>;
  ranking?: Resolver<Array<ResolversTypes['RatioRank']>, ParentType, ContextType>;
  ratio?: Resolver<Array<ResolversTypes['RatioPoint']>, ParentType, ContextType, RequireFields<CompanyRatioArgs, 'id' | 'last' | 'period'>>;
  revisions?: Resolver<Array<ResolversTypes['Revision']>, ParentType, ContextType, RequireFields<CompanyRevisionsArgs, 'first'>>;
  secUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sector?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  series?: Resolver<Array<ResolversTypes['DataPoint']>, ParentType, ContextType, RequireFields<CompanySeriesArgs, 'last' | 'metric' | 'period'>>;
  ticker?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type DataPointResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['DataPoint'] = ResolversParentTypes['DataPoint']> = {
  derived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  end?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  filing?: Resolver<Maybe<ResolversTypes['Filing']>, ParentType, ContextType>;
  fiscalYear?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  label?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type DatasetResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Dataset'] = ResolversParentTypes['Dataset']> = {
  companies?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  dataPoints?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  filings?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  generatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  latestFiled?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  rawFactsScanned?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  revisions?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  source?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type FilingResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Filing'] = ResolversParentTypes['Filing']> = {
  accession?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  filed?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  form?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  period?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  url?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type FilingChangeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['FilingChange'] = ResolversParentTypes['FilingChange']> = {
  company?: Resolver<ResolversTypes['Company'], ParentType, ContextType>;
  filing?: Resolver<Maybe<ResolversTypes['Filing']>, ParentType, ContextType>;
  headline?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  lagging?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  metrics?: Resolver<Array<ResolversTypes['MetricChange']>, ParentType, ContextType>;
  priorQuarterEnd?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  priorYearEnd?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  quarterEnd?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  quarterLabel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ratios?: Resolver<Array<ResolversTypes['RatioChange']>, ParentType, ContextType>;
  revisions?: Resolver<Array<ResolversTypes['Revision']>, ParentType, ContextType>;
};

export type KeyStatsResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['KeyStats'] = ResolversParentTypes['KeyStats']> = {
  fiscalYear?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  freeCashFlow?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  netIncome?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  operatingCashFlow?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  periodEnd?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ratios?: Resolver<Array<ResolversTypes['RatioValue']>, ParentType, ContextType>;
  revenue?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  totalAssets?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
};

export type MetricChangeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['MetricChange'] = ResolversParentTypes['MetricChange']> = {
  label?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  metric?: Resolver<ResolversTypes['Metric'], ParentType, ContextType>;
  priorQuarter?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  priorYear?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  qoq?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  yoy?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
};

export type MetricDefinitionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['MetricDefinition'] = ResolversParentTypes['MetricDefinition']> = {
  id?: Resolver<ResolversTypes['Metric'], ParentType, ContextType>;
  label?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  unit?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  companies?: Resolver<Array<ResolversTypes['Company']>, ParentType, ContextType, RequireFields<QueryCompaniesArgs, 'first'>>;
  company?: Resolver<Maybe<ResolversTypes['Company']>, ParentType, ContextType, RequireFields<QueryCompanyArgs, 'ticker'>>;
  compare?: Resolver<Array<ResolversTypes['Company']>, ParentType, ContextType, RequireFields<QueryCompareArgs, 'tickers'>>;
  dataset?: Resolver<ResolversTypes['Dataset'], ParentType, ContextType>;
  latestFilings?: Resolver<Array<ResolversTypes['FilingChange']>, ParentType, ContextType, RequireFields<QueryLatestFilingsArgs, 'first'>>;
  metricDefinitions?: Resolver<Array<ResolversTypes['MetricDefinition']>, ParentType, ContextType>;
  ratioDefinitions?: Resolver<Array<ResolversTypes['RatioDefinition']>, ParentType, ContextType>;
  sectors?: Resolver<Array<ResolversTypes['SectorSummary']>, ParentType, ContextType>;
};

export type RatioChangeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['RatioChange'] = ResolversParentTypes['RatioChange']> = {
  delta?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  priorYear?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  ratio?: Resolver<ResolversTypes['Ratio'], ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
};

export type RatioDefinitionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['RatioDefinition'] = ResolversParentTypes['RatioDefinition']> = {
  better?: Resolver<ResolversTypes['Direction'], ParentType, ContextType>;
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  format?: Resolver<ResolversTypes['RatioFormat'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Ratio'], ParentType, ContextType>;
  label?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  models?: Resolver<Array<ResolversTypes['BusinessModel']>, ParentType, ContextType>;
  quarterly?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  short?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type RatioPointResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['RatioPoint'] = ResolversParentTypes['RatioPoint']> = {
  end?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fiscalYear?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  label?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
};

export type RatioRankResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['RatioRank'] = ResolversParentTypes['RatioRank']> = {
  of?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  percentile?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  rank?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  ratio?: Resolver<ResolversTypes['Ratio'], ParentType, ContextType>;
  sectorMedian?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
};

export type RatioValueResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['RatioValue'] = ResolversParentTypes['RatioValue']> = {
  ratio?: Resolver<ResolversTypes['Ratio'], ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
};

export type RevisionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Revision'] = ResolversParentTypes['Revision']> = {
  change?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  end?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  firstReported?: Resolver<ResolversTypes['Filing'], ParentType, ContextType>;
  from?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  label?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  likelySplit?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  metric?: Resolver<ResolversTypes['Metric'], ParentType, ContextType>;
  period?: Resolver<ResolversTypes['PeriodType'], ParentType, ContextType>;
  periodLabel?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  revisedIn?: Resolver<ResolversTypes['Filing'], ParentType, ContextType>;
  to?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type SectorSummaryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['SectorSummary'] = ResolversParentTypes['SectorSummary']> = {
  companies?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  medians?: Resolver<Array<ResolversTypes['RatioValue']>, ParentType, ContextType>;
  sector?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type Resolvers<ContextType = GraphQLContext> = {
  Company?: CompanyResolvers<ContextType>;
  DataPoint?: DataPointResolvers<ContextType>;
  Dataset?: DatasetResolvers<ContextType>;
  Filing?: FilingResolvers<ContextType>;
  FilingChange?: FilingChangeResolvers<ContextType>;
  KeyStats?: KeyStatsResolvers<ContextType>;
  MetricChange?: MetricChangeResolvers<ContextType>;
  MetricDefinition?: MetricDefinitionResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RatioChange?: RatioChangeResolvers<ContextType>;
  RatioDefinition?: RatioDefinitionResolvers<ContextType>;
  RatioPoint?: RatioPointResolvers<ContextType>;
  RatioRank?: RatioRankResolvers<ContextType>;
  RatioValue?: RatioValueResolvers<ContextType>;
  Revision?: RevisionResolvers<ContextType>;
  SectorSummary?: SectorSummaryResolvers<ContextType>;
};

