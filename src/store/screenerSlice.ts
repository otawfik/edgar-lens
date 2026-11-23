import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { MetricId } from "@/lib/edgar/metricIds";
import type { LagFilter } from "@/lib/edgar/revisionScreen";
import type { PeriodType } from "@/lib/edgar/snapshot";
import type { Sector } from "@/lib/universe";

export type SortField = "ticker" | "name" | "sector" | "figures" | "revised" | "rate" | "medianLagDays";

export interface ScreenerState {
  /** One line item, or null for every line item. */
  metric: MetricId | null;
  /** Fiscal-year or quarterly figures, or null for both. */
  period: PeriodType | null;
  /** Which changes count, by delay after the figure's first filing. */
  lag: LagFilter;
  sectors: Sector[];
  search: string;
  watchlistOnly: boolean;
  sort: { field: SortField; direction: "asc" | "desc" };
}

export const initialScreenerState: ScreenerState = {
  metric: null,
  period: null,
  lag: "any",
  sectors: [],
  search: "",
  watchlistOnly: false,
  sort: { field: "rate", direction: "desc" },
};

const screenerSlice = createSlice({
  name: "screener",
  initialState: initialScreenerState,
  reducers: {
    setMetric(state, action: PayloadAction<MetricId | null>) {
      state.metric = action.payload;
    },
    setPeriod(state, action: PayloadAction<PeriodType | null>) {
      state.period = action.payload;
    },
    setLag(state, action: PayloadAction<LagFilter>) {
      state.lag = action.payload;
    },
    toggleSector(state, action: PayloadAction<Sector>) {
      const i = state.sectors.indexOf(action.payload);
      if (i >= 0) state.sectors.splice(i, 1);
      else state.sectors.push(action.payload);
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    setWatchlistOnly(state, action: PayloadAction<boolean>) {
      state.watchlistOnly = action.payload;
    },
    /** Clicking the sorted column flips it; a new column starts where its extremes are interesting. */
    sortBy(state, action: PayloadAction<SortField>) {
      const field = action.payload;
      if (state.sort.field === field) state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
      else state.sort = { field, direction: field === "ticker" || field === "name" || field === "sector" ? "asc" : "desc" };
    },
    setSort(state, action: PayloadAction<ScreenerState["sort"]>) {
      state.sort = action.payload;
    },
    resetFilters(state) {
      return { ...initialScreenerState, sort: state.sort };
    },
    /** Replace state from the URL (on load and back/forward). */
    hydrateScreener(_state, action: PayloadAction<ScreenerState>) {
      return action.payload;
    },
  },
});

export const {
  setMetric,
  setPeriod,
  setLag,
  toggleSector,
  setSearch,
  setWatchlistOnly,
  sortBy,
  setSort,
  resetFilters,
  hydrateScreener,
} = screenerSlice.actions;
export default screenerSlice.reducer;
