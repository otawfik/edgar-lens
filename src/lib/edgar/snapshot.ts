/**
 * Shape of data/snapshot.json — the compact, committed output of
 * scripts/build-snapshot.ts. Each value keeps its full point-in-time history
 * (every filing that changed it), referencing filings by index so an
 * accession number and date are stored once per company, not once per value.
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

/** [index into `filings`, value] — one vintage of a figure. */
export type SnapshotVintage = [filing: number, value: number];

/**
 * One reported figure: the period it covers and every value it has had, in
 * filing order. `history[0]` is as first reported, the last entry is the
 * current figure. Most figures have exactly one vintage. The third element is
 * 1 when the quarter was derived from a year-to-date chain rather than tagged.
 */
export type SnapshotPoint = [end: string, history: SnapshotVintage[], derived?: 1];

export type PeriodType = "annual" | "quarterly";

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
}

export interface RevisionLeagueRow {
  ticker: string;
  name: string;
  sector: Sector;
  /** Reported (metric, period) figures with at least one vintage. */
  figures: number;
  /** Figures with a material later change (splits excluded). */
  revised: number;
  rate: number;
  /** Median days from first filing to the first material change. */
  medianLagDays: number | null;
  /** Largest relative change, and what it was. */
  largest: { metric: MetricId; period: PeriodType; end: string; from: number; to: number } | null;
}

export interface MetricLeagueRow {
  metric: MetricId;
  figures: number;
  revised: number;
  rate: number;
  medianLagDays: number | null;
}

export interface SectorLeagueRow {
  sector: Sector;
  companies: number;
  figures: number;
  revised: number;
  rate: number;
}

export interface RevisionStats {
  figures: number;
  revised: number;
  rate: number;
  /** Figures that changed more than once. */
  revisedTwice: number;
  medianLagDays: number | null;
  /** Share of material changes carried in each form type. */
  byForm: { form: string; changes: number }[];
  lagBuckets: { label: string; changes: number }[];
  companies: RevisionLeagueRow[];
  metrics: MetricLeagueRow[];
  sectors: SectorLeagueRow[];
}

export interface Snapshot {
  version: 2;
  /** When this file was built. */
  generatedAt: string;
  /** When the SEC data behind it was downloaded (newest file in the raw cache). */
  fetchedAt: string;
  source: string;
  stats: {
    companies: number;
    rawFactsScanned: number;
    figures: number;
    vintages: number;
    filings: number;
    earliestFiled: string;
    latestFiled: string;
  };
  revisions: RevisionStats;
  companies: SnapshotCompany[];
}
