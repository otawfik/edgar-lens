import { createSelector } from "@reduxjs/toolkit";
import type { ScreenerQuery } from "@/graphql/types.generated";
import { fromEnum } from "@/lib/enums";
import { RATIO_IDS, type RatioId } from "@/lib/finance/ratios";
import type { Sector } from "@/lib/universe";
import { api } from "./api";
import type { ScreenerState } from "./screenerSlice";
import type { RootState } from "./store";

/** One flat, grid-ready row per company. */
export type ScreenerRow = {
  ticker: string;
  name: string;
  sector: Sector;
  model: "GENERAL" | "BANK" | "INSURER";
  fiscalYear: number | null;
  revenue: number | null;
  netIncome: number | null;
  freeCashFlow: number | null;
  latestForm: string | null;
  latestFiled: string | null;
  lagging: boolean;
} & Record<RatioId, number | null>;

export function toRows(data: ScreenerQuery | undefined): ScreenerRow[] {
  if (!data) return [];
  return data.companies.map((c) => {
    const ratios = Object.fromEntries(RATIO_IDS.map((id) => [id, null])) as Record<RatioId, number | null>;
    for (const r of c.keyStats.ratios) ratios[fromEnum(r.ratio) as RatioId] = r.value;
    return {
      ticker: c.ticker,
      name: c.name,
      sector: c.sector as Sector,
      model: c.model,
      fiscalYear: c.latestFiscalYear,
      revenue: c.keyStats.revenue,
      netIncome: c.keyStats.netIncome,
      freeCashFlow: c.keyStats.freeCashFlow,
      latestForm: c.changes.filing?.form ?? null,
      latestFiled: c.changes.filing?.filed ?? null,
      lagging: c.changes.lagging,
      ...ratios,
    };
  });
}

/**
 * The screener's filter logic, pure so it is unit-tested directly. A bound on
 * a ratio excludes companies where that ratio is null (not meaningful or not
 * reported) — "operating margin ≥ 20%" should not include banks by accident.
 */
export function applyScreenerFilters(
  rows: ScreenerRow[],
  f: Pick<ScreenerState, "sectors" | "search" | "bounds" | "watchlistOnly">,
  watchlist: string[],
): ScreenerRow[] {
  const q = f.search.trim().toLowerCase();
  const watched = new Set(watchlist);
  const bounds = Object.entries(f.bounds) as [RatioId, { min?: number; max?: number }][];
  return rows.filter((r) => {
    if (f.sectors.length && !f.sectors.includes(r.sector)) return false;
    if (f.watchlistOnly && !watched.has(r.ticker)) return false;
    if (q && !r.ticker.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;
    for (const [id, b] of bounds) {
      const v = r[id];
      if (v === null) return false;
      if (b.min !== undefined && v < b.min) return false;
      if (b.max !== undefined && v > b.max) return false;
    }
    return true;
  });
}

const selectScreenerResult = api.endpoints.screener.select();

export const selectScreenerData = (state: RootState) => selectScreenerResult(state).data;

export const selectAllRows = createSelector([selectScreenerData], toRows);

export const selectScreener = (state: RootState) => state.screener;
export const selectWatchlist = (state: RootState) => state.watchlist.tickers;

export const selectFilteredRows = createSelector(
  [selectAllRows, selectScreener, selectWatchlist],
  (rows, screener, watchlist) => applyScreenerFilters(rows, screener, watchlist),
);

export const selectActiveFilterCount = createSelector([selectScreener], (s) => {
  return (
    (s.sectors.length ? 1 : 0) +
    (s.search.trim() ? 1 : 0) +
    Object.keys(s.bounds).length +
    (s.watchlistOnly ? 1 : 0)
  );
});

/** Companies per sector *after* every filter except the sector one. */
export const selectSectorCounts = createSelector(
  [selectAllRows, selectScreener, selectWatchlist],
  (rows, screener, watchlist) => {
    const counts = new Map<Sector, number>();
    for (const r of applyScreenerFilters(rows, { ...screener, sectors: [] }, watchlist)) {
      counts.set(r.sector, (counts.get(r.sector) ?? 0) + 1);
    }
    return counts;
  },
);

/** Median of each ratio across the rows currently on screen. */
export const selectFilteredMedians = createSelector([selectFilteredRows], (rows) => {
  const out = {} as Record<RatioId, number | null>;
  for (const id of RATIO_IDS) {
    const vals = rows.map((r) => r[id]).filter((v): v is number => v !== null).sort((a, b) => a - b);
    const mid = vals.length >> 1;
    out[id] = vals.length ? (vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2) : null;
  }
  return out;
});
