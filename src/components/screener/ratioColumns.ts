import { RATIOS, type RatioId } from "@/lib/finance/ratios";

/** Ratios offered as screener filters, with slider domains. */
export const FILTER_RATIOS: { id: RatioId; domain: [number, number]; step: number }[] = [
  { id: "revenueGrowth", domain: [-0.2, 0.5], step: 0.01 },
  { id: "operatingMargin", domain: [-0.1, 0.6], step: 0.01 },
  { id: "fcfMargin", domain: [-0.1, 0.5], step: 0.01 },
  { id: "roe", domain: [-0.1, 0.6], step: 0.01 },
  { id: "debtToEquity", domain: [0, 3], step: 0.05 },
];

/** Ratio columns shown in the grid, in order. */
export const GRID_RATIOS: RatioId[] = [
  "revenueGrowth",
  "grossMargin",
  "operatingMargin",
  "fcfMargin",
  "roe",
  "debtToEquity",
  "revenueCagr3y",
  "rdIntensity",
  "sbcToRevenue",
  "capitalReturn",
  "efficiencyRatio",
];

export const ratioLabel = (id: RatioId) => RATIOS[id].label;
