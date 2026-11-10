/**
 * Point-in-time arithmetic. A reported figure is not one number but a history:
 * the value first filed, then every later filing that carried a different
 * value for the same period (a restatement, a reclassification, a split
 * adjustment). "What was known on date D" is the last entry filed on or
 * before D. Everything here is pure and unit-tested.
 */

export interface Vintage {
  /** Filing date (ISO yyyy-mm-dd) of the filing that carried this value. */
  filed: string;
  value: number;
  /** Accession number (or, in the snapshot, an index into the filings table). */
  accn: string;
}

/**
 * Collapse every tagging of one fact into its value-changing vintages: the
 * first filing, then only filings whose value differs from the previous one.
 * Re-reporting an unchanged comparative is not a revision.
 */
export function toVintages<T extends { filed: string; val: number; accn: string }>(
  facts: readonly T[],
): Vintage[] {
  const sorted = [...facts].sort((a, b) =>
    a.filed === b.filed ? a.accn.localeCompare(b.accn) : a.filed.localeCompare(b.filed),
  );
  const out: Vintage[] = [];
  for (const f of sorted) {
    const last = out[out.length - 1];
    if (last && last.value === f.val) continue;
    out.push({ filed: f.filed, value: f.val, accn: f.accn });
  }
  return out;
}

/** The vintage in force on `date` (filed <= date), or null if not yet reported. */
export function asOf<V extends Vintage>(vintages: readonly V[], date: string): V | null {
  let found: V | null = null;
  for (const v of vintages) {
    if (v.filed <= date) found = v;
    else break;
  }
  return found;
}

/**
 * Combine two histories with an arithmetic function (used for Q2 = H1 − Q1
 * and friends). The result changes whenever either input changes, evaluated
 * with what was known at each filing date, and is again collapsed to value
 * changes. Undefined until both inputs have been filed.
 */
export function combineVintages(
  a: readonly Vintage[],
  b: readonly Vintage[],
  fn: (x: number, y: number) => number,
): Vintage[] {
  const dates = [...new Set([...a, ...b].map((v) => v.filed))].sort();
  const out: Vintage[] = [];
  for (const d of dates) {
    const va = asOf(a, d);
    const vb = asOf(b, d);
    if (!va || !vb) continue;
    const value = fn(va.value, vb.value);
    const last = out[out.length - 1];
    if (last && last.value === value) continue;
    // Attribute the change to whichever input was filed on this date.
    const source = va.filed === d ? va : vb;
    out.push({ filed: d, value, accn: source.accn });
  }
  return out;
}

export const MATERIAL_REL = 0.005;
export const MATERIAL_ABS = { USD: 1_000_000, "USD/shares": 0.01 } as const;

/** A change big enough to count as a revision rather than rounding noise. */
export function isMaterialChange(from: number, to: number, unit: keyof typeof MATERIAL_ABS): boolean {
  const diff = Math.abs(to - from);
  return diff >= MATERIAL_ABS[unit] && diff >= MATERIAL_REL * Math.max(Math.abs(from), Math.abs(to));
}

/**
 * Per-share values that shrank or grew by a whole-number factor (2×, 4×,
 * 10×…) were adjusted for a stock split, not restated.
 */
export function isLikelySplit(from: number, to: number, unit: keyof typeof MATERIAL_ABS): boolean {
  if (unit !== "USD/shares" || from === 0 || to === 0) return false;
  const factor = Math.max(Math.abs(from), Math.abs(to)) / Math.min(Math.abs(from), Math.abs(to));
  const k = Math.round(factor);
  return k >= 2 && Math.abs(factor - k) / k < 0.02;
}

export interface VintageChange<V extends Vintage = Vintage> {
  from: V;
  to: V;
}

/** The vintage in force on each date, when they differ. */
export function changeBetween<V extends Vintage>(
  vintages: readonly V[],
  fromDate: string,
  toDate: string,
): VintageChange<V> | null {
  const a = asOf(vintages, fromDate);
  const b = asOf(vintages, toDate);
  if (!a || !b || a.value === b.value) return null;
  return { from: a, to: b };
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
