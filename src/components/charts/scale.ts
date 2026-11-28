/**
 * The arithmetic behind the SVG charts: a value axis with round tick values,
 * and which category labels fit. Pure, so it is tested without a DOM.
 */

/** 1, 2, 2.5 or 5 times a power of ten: the round step nearest to `raw` from above. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

export interface ValueAxis {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * A value axis covering every value, with about `count` evenly spaced round
 * ticks. `includeZero` (bars) pins the axis to the zero line, because a bar's
 * length is read from zero; without it (lines) the axis hugs the data.
 */
export function valueAxis(values: readonly (number | null | undefined)[], count = 5, includeZero = false): ValueAxis {
  const finite = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  let lo = finite.length ? Math.min(...finite) : 0;
  let hi = finite.length ? Math.max(...finite) : 1;
  if (includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    // A flat series still needs a range to draw in.
    const pad = Math.abs(lo) || 1;
    lo = includeZero && lo >= 0 ? 0 : lo - pad;
    hi = hi + pad;
  }
  const step = niceStep((hi - lo) / Math.max(1, count));
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  // Multiply rather than accumulate, so 0.1 + 0.2 never becomes 0.30000000000000004.
  for (let i = Math.round(min / step); i <= Math.round(max / step); i++) ticks.push(Number((i * step).toPrecision(12)));
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

/** Show every `n`-th category label so that labels `labelWidth` wide do not collide. */
export function labelEvery(bandWidth: number, labelWidth: number): number {
  if (!(bandWidth > 0)) return 1;
  return Math.max(1, Math.ceil(labelWidth / bandWidth));
}

/** Position of `value` between the axis ends, 0 at `min` and 1 at `max`. */
export function fraction(axis: Pick<ValueAxis, "min" | "max">, value: number): number {
  return (value - axis.min) / (axis.max - axis.min);
}
