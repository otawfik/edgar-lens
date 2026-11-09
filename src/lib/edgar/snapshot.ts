/**
 * Shape of data/snapshot.json — the compact, committed output of
 * scripts/build-snapshot.ts. Points reference filings by index so an
 * accession number is stored once per company, not once per value.
 */
import type { MetricId } from "./concepts";
import type { BusinessModel, Sector } from "../universe";

export interface SnapshotFiling {
  /** Accession number, e.g. 0000320193-25-000079. */
  accn: string;
  form: string;
  filed: string;
  /** Period of report (balance-sheet date). */
  period: string;
  /** Filer CIK — differs from the company's for predecessor registrants. */
  cik: number;
  /** Primary document file name, when known from the submissions API. */
  doc?: string;
}

/** [period end, value, index into `filings`] */
export type SnapshotPoint = [end: string, value: number, filing: number];

export type PeriodType = "annual" | "quarterly";

export interface SnapshotRevision {
  metric: MetricId;
  period: PeriodType;
  end: string;
  /** As first reported. */
  from: number;
  /** As reported in the latest filing that carries this period. */
  to: number;
  fromFiling: number;
  toFiling: number;
}

export interface SnapshotCompany {
  cik: number;
  ticker: string;
  name: string;
  sector: Sector;
  model: BusinessModel;
  industry: string;
  /** MMDD of the fiscal year end, as SEC reports it. */
  fiscalYearEnd: string;
  filings: SnapshotFiling[];
  /** Most recent 10-K/10-Q filings, newest first (indices into `filings`). */
  recent: number[];
  annual: Partial<Record<MetricId, SnapshotPoint[]>>;
  quarterly: Partial<Record<MetricId, SnapshotPoint[]>>;
  revisions: SnapshotRevision[];
}

export interface Snapshot {
  version: 1;
  generatedAt: string;
  source: string;
  stats: {
    companies: number;
    rawFactsScanned: number;
    points: number;
    filings: number;
    revisions: number;
  };
  companies: SnapshotCompany[];
}
