import { createSelector } from "@reduxjs/toolkit";
import type { ScreenerQuery } from "@/graphql/types.generated";
import type { MetricId } from "@/lib/edgar/metricIds";
import { lagMatches, median, mostRevised, summarise, type CellSelection, type RevisionCell } from "@/lib/edgar/revisionScreen";
import { fromEnum } from "@/lib/enums";
import type { Sector } from "@/lib/universe";
import { api } from "./api";
import type { ScreenerState } from "./screenerSlice";
import type { RootState } from "./store";

export interface ScreenerCompany {
  ticker: string;
  name: string;
  sector: Sector;
  cells: RevisionCell[];
}

/** One row per company for the current selection of line item, period type and delay. */
export interface ScreenerRow {
  ticker: string;
  name: string;
  sector: Sector;
  figures: number;
  revised: number;
  rate: number | null;
  medianLagDays: number | null;
  /** Delay of every counted change, for pooled medians. */
  lags: number[];
  /** The line item this company changed most, when all line items are selected. */
  top: { metric: MetricId; revised: number; figures: number } | null;
}

export function toCompanies(data: ScreenerQuery | undefined): ScreenerCompany[] {
  if (!data) return [];
  return data.companies.map((c) => ({
    ticker: c.ticker,
    name: c.name,
    sector: c.sector as Sector,
    cells: c.revisionCells.map((cell) => ({
      metric: fromEnum(cell.metric) as MetricId,
      period: cell.period === "ANNUAL" ? "annual" : "quarterly",
      figures: cell.figures,
      lagDays: cell.lagDays,
    })),
  }));
}

export function toRows(companies: ScreenerCompany[], sel: CellSelection): ScreenerRow[] {
  return companies.map((c) => {
    const s = summarise(c.cells, sel);
    const lags: number[] = [];
    for (const cell of c.cells) {
      if (sel.metric && cell.metric !== sel.metric) continue;
      if (sel.period && cell.period !== sel.period) continue;
      for (const d of cell.lagDays) if (lagMatches(d, sel.lag)) lags.push(d);
    }
    const top = sel.metric ? null : mostRevised(c.cells, sel);
    return {
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      ...s,
      lags,
      top: top ? { metric: top.metric, revised: top.summary.revised, figures: top.summary.figures } : null,
    };
  });
}

/**
 * Which companies are listed. A company that reports none of the selected
 * figures (a bank has no gross profit) is left out rather than shown at 0%:
 * nothing reported is not the same as nothing revised.
 */
export function applyScreenerFilters(
  rows: ScreenerRow[],
  f: Pick<ScreenerState, "sectors" | "search" | "watchlistOnly">,
  watchlist: string[],
): ScreenerRow[] {
  const q = f.search.trim().toLowerCase();
  const watched = new Set(watchlist);
  return rows.filter((r) => {
    if (r.figures === 0) return false;
    if (f.sectors.length && !f.sectors.includes(r.sector)) return false;
    if (f.watchlistOnly && !watched.has(r.ticker)) return false;
    if (q && !r.ticker.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

/**
 * Sort for the table. Nulls go last in both directions. Equal rates are
 * ordered by how much evidence is behind them — 0 of 60 figures revised ranks
 * as cleaner than 0 of 6 — then by ticker, so the order is stable.
 */
export function sortRows(rows: ScreenerRow[], sort: ScreenerState["sort"]): ScreenerRow[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  const key = sort.field;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x === null || y === null) {
      if (x !== y) return x === null ? 1 : -1;
    } else if (x !== y) {
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * sign;
    }
    return b.figures - a.figures || a.ticker.localeCompare(b.ticker);
  });
}

const selectScreenerResult = api.endpoints.screener.select();

export const selectScreenerData = (state: RootState) => selectScreenerResult(state).data;
export const selectScreener = (state: RootState) => state.screener;
export const selectWatchlist = (state: RootState) => state.watchlist.tickers;

export const selectCompanies = createSelector([selectScreenerData], toCompanies);

/** Line items present in the snapshot, in statement order, with their labels. */
export const selectMetricOptions = createSelector([selectScreenerData, selectCompanies], (data, companies) => {
  const present = new Set(companies.flatMap((c) => c.cells.map((cell) => cell.metric)));
  return (data?.metricDefinitions ?? [])
    .map((m) => ({ id: fromEnum(m.id) as MetricId, label: m.label }))
    .filter((m) => present.has(m.id));
});

const selectSelection = createSelector(
  [(s: RootState) => s.screener.metric, (s: RootState) => s.screener.period, (s: RootState) => s.screener.lag],
  (metric, period, lag): CellSelection => ({ metric, period, lag }),
);

export const selectAllRows = createSelector([selectCompanies, selectSelection], toRows);

const selectFiltered = createSelector(
  [selectAllRows, selectScreener, selectWatchlist],
  (rows, screener, watchlist) => applyScreenerFilters(rows, screener, watchlist),
);

export const selectFilteredRows = createSelector(
  [selectFiltered, (s: RootState) => s.screener.sort],
  sortRows,
);

export const selectActiveFilterCount = createSelector([selectScreener], (s) => {
  return (
    (s.metric ? 1 : 0) +
    (s.period ? 1 : 0) +
    (s.lag !== "any" ? 1 : 0) +
    (s.sectors.length ? 1 : 0) +
    (s.search.trim() ? 1 : 0) +
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

/** Pooled totals for the companies listed: every figure counts once, not every company. */
export function totals(rows: ScreenerRow[]) {
  const figures = rows.reduce((n, r) => n + r.figures, 0);
  const revised = rows.reduce((n, r) => n + r.revised, 0);
  return {
    companies: rows.length,
    untouched: rows.filter((r) => r.revised === 0).length,
    figures,
    revised,
    rate: figures ? revised / figures : null,
    medianLagDays: median(rows.flatMap((r) => r.lags)),
  };
}

export const selectTotals = createSelector([selectFiltered], totals);
