/** Date arithmetic and period labelling for XBRL contexts (ISO yyyy-mm-dd, UTC). */

const DAY = 86_400_000;

export function toUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY);
}

/** Inclusive length of a reporting period: 2024-01-01..2024-12-31 is 366 days. */
export function periodDays(start: string, end: string): number {
  return Math.round((toUtc(end) - toUtc(start)) / DAY) + 1;
}

/** 52/53-week years run 364 or 371 days; calendar years 365/366. */
export const ANNUAL_DAYS = { min: 350, max: 380 } as const;
/**
 * 13-week quarters are 91 days, but Costco reports 12-week quarters (84) and a
 * 16- or 17-week fourth quarter (112/119), so the window is deliberately wide.
 * It still cannot be confused with a half-year (~182 days).
 */
export const QUARTER_DAYS = { min: 80, max: 125 } as const;

export function isAnnualSpan(start: string, end: string): boolean {
  const d = periodDays(start, end);
  return d >= ANNUAL_DAYS.min && d <= ANNUAL_DAYS.max;
}

export function isQuarterSpan(start: string, end: string): boolean {
  const d = periodDays(start, end);
  return d >= QUARTER_DAYS.min && d <= QUARTER_DAYS.max;
}

/**
 * Calendar-aligned fiscal year, using the convention most databases use:
 * a fiscal year ending January–May is labelled with the *previous* calendar
 * year, because most of its months fall there. So NVIDIA's year ending
 * 26 Jan 2025 is FY2024 here (NVIDIA calls it fiscal 2025), and lines up with
 * Apple's year ending Sep 2024 when peers are compared. 52/53-week years that
 * end in the first week of a month count as ending in the month before.
 */
export function fiscalYearOf(end: string): number {
  const shifted = new Date(toUtc(end) - 7 * DAY);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  return month <= 5 ? year - 1 : year;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Sep 2025" — quarters are labelled by the month they end in. */
export function quarterLabel(end: string): string {
  const d = new Date(toUtc(end));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDate(iso: string): string {
  const d = new Date(toUtc(iso));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Is `end` roughly one year after `prevEnd` (same quarter or year, prior year)? */
export function isYearApart(prevEnd: string, end: string): boolean {
  const d = periodDays(prevEnd, end) - 1;
  return d >= ANNUAL_DAYS.min && d <= ANNUAL_DAYS.max;
}
