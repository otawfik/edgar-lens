/** Number formatting shared by the server (headlines) and the UI. */

const DASH = "—";

/** $416.2B, $8.1B, $940.0M, -$1.2B */
export function formatMoney(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(digits)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(digits)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(digits)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(digits)}K`;
  return `${sign}$${a.toFixed(2)}`;
}

/** 0.1234 → "12.3%" */
export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return `${(v * 100).toFixed(digits)}%`;
}

/** 0.1234 → "+12.3%" (for changes) */
export function formatChange(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const s = (v * 100).toFixed(digits);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s.replace("-", "")}%`;
}

/** Change in a ratio, in basis points: 0.0123 → "+123 bps" */
export function formatBps(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return DASH;
  const bps = Math.round(delta * 10_000);
  return `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${Math.abs(bps).toLocaleString("en-US")} bps`;
}

/** 1.234 → "1.23×" */
export function formatMultiple(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return `${v.toFixed(digits)}×`;
}

export function formatRatio(v: number | null | undefined, format: "percent" | "multiple"): string {
  return format === "percent" ? formatPercent(v) : formatMultiple(v);
}

export function formatEps(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
}
