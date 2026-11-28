import { describe, expect, it } from "vitest";
import { fraction, labelEvery, niceStep, valueAxis } from "./scale";

describe("niceStep", () => {
  it("rounds up to 1, 2, 2.5 or 5 times a power of ten", () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1.2)).toBe(2);
    expect(niceStep(23)).toBe(25);
    expect(niceStep(30)).toBe(50);
    expect(niceStep(0.03)).toBeCloseTo(0.05);
    expect(niceStep(24.3e9)).toBe(25e9);
  });
  it("falls back to 1 for a zero or invalid range", () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(Number.NaN)).toBe(1);
  });
});

describe("valueAxis", () => {
  it("pins a bar axis to zero and ends on round ticks that cover the data", () => {
    const a = valueAxis([97.0e9, 121.6e9, 95.2e9], 5, true);
    expect(a.min).toBe(0);
    expect(a.ticks).toEqual([0, 25e9, 50e9, 75e9, 100e9, 125e9]);
  });
  it("spans the zero line when a series goes negative", () => {
    const a = valueAxis([-22.4e9, 8.2e9, 5.1e9], 5, true);
    expect(a.ticks).toContain(0);
    expect(a.min).toBeLessThanOrEqual(-22.4e9);
    expect(a.max).toBeGreaterThanOrEqual(8.2e9);
  });
  it("hugs the data for a line axis and keeps decimal ticks exact", () => {
    const a = valueAxis([0.12, 0.31, null, 0.18], 4);
    expect(a.ticks).toEqual([0.1, 0.15, 0.2, 0.25, 0.3, 0.35]);
  });
  it("ignores missing values and still returns a range for flat or empty data", () => {
    expect(valueAxis([null, undefined]).ticks.length).toBeGreaterThan(1);
    const flat = valueAxis([5, 5, 5], 5, true);
    expect(flat.min).toBe(0);
    expect(flat.max).toBe(5);
    const zero = valueAxis([0, 0], 5, true);
    expect(zero.max).toBeGreaterThan(zero.min);
  });
});

describe("labelEvery / fraction", () => {
  it("thins category labels when bands are narrower than a label", () => {
    expect(labelEvery(60, 48)).toBe(1);
    expect(labelEvery(24, 48)).toBe(2);
    expect(labelEvery(10, 48)).toBe(5);
    expect(labelEvery(0, 48)).toBe(1);
  });
  it("places a value between the axis ends", () => {
    expect(fraction({ min: 0, max: 200 }, 50)).toBe(0.25);
    expect(fraction({ min: -100, max: 100 }, 0)).toBe(0.5);
  });
});
