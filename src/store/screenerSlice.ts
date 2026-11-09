import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RatioId } from "@/lib/finance/ratios";
import type { Sector } from "@/lib/universe";

export interface Bound {
  min?: number;
  max?: number;
}

export type SortField = "ticker" | "name" | "sector" | "revenue" | "netIncome" | "freeCashFlow" | RatioId;

export interface ScreenerState {
  sectors: Sector[];
  search: string;
  /** Inclusive bounds on latest-fiscal-year ratios. */
  bounds: Partial<Record<RatioId, Bound>>;
  watchlistOnly: boolean;
  sort: { field: SortField; direction: "asc" | "desc" };
}

export const initialScreenerState: ScreenerState = {
  sectors: [],
  search: "",
  bounds: {},
  watchlistOnly: false,
  sort: { field: "revenue", direction: "desc" },
};

export interface Preset {
  id: string;
  label: string;
  description: string;
  bounds: Partial<Record<RatioId, Bound>>;
}

export const PRESETS: Preset[] = [
  {
    id: "compounders",
    label: "Compounders",
    description: "Revenue growth ≥ 10% and operating margin ≥ 20%",
    bounds: { revenueGrowth: { min: 0.1 }, operatingMargin: { min: 0.2 } },
  },
  {
    id: "cash-machines",
    label: "Cash machines",
    description: "FCF margin ≥ 20% and cash conversion ≥ 1×",
    bounds: { fcfMargin: { min: 0.2 }, cashConversion: { min: 1 } },
  },
  {
    id: "low-leverage",
    label: "Low leverage",
    description: "Long-term debt / equity ≤ 0.5× and ROE ≥ 15%",
    bounds: { debtToEquity: { max: 0.5 }, roe: { min: 0.15 } },
  },
];

const screenerSlice = createSlice({
  name: "screener",
  initialState: initialScreenerState,
  reducers: {
    toggleSector(state, action: PayloadAction<Sector>) {
      const i = state.sectors.indexOf(action.payload);
      if (i >= 0) state.sectors.splice(i, 1);
      else state.sectors.push(action.payload);
    },
    setSectors(state, action: PayloadAction<Sector[]>) {
      state.sectors = [...new Set(action.payload)];
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    setBound(state, action: PayloadAction<{ ratio: RatioId; bound: Bound | null }>) {
      const { ratio, bound } = action.payload;
      const clean: Bound = {};
      if (bound?.min !== undefined && Number.isFinite(bound.min)) clean.min = bound.min;
      if (bound?.max !== undefined && Number.isFinite(bound.max)) clean.max = bound.max;
      if (clean.min !== undefined && clean.max !== undefined && clean.min > clean.max) {
        [clean.min, clean.max] = [clean.max, clean.min];
      }
      if (clean.min === undefined && clean.max === undefined) delete state.bounds[ratio];
      else state.bounds[ratio] = clean;
    },
    applyPreset(state, action: PayloadAction<string>) {
      const preset = PRESETS.find((p) => p.id === action.payload);
      if (preset) state.bounds = structuredClone(preset.bounds);
    },
    setWatchlistOnly(state, action: PayloadAction<boolean>) {
      state.watchlistOnly = action.payload;
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
  toggleSector,
  setSectors,
  setSearch,
  setBound,
  applyPreset,
  setWatchlistOnly,
  setSort,
  resetFilters,
  hydrateScreener,
} = screenerSlice.actions;
export default screenerSlice.reducer;
