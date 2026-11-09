import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface WatchlistState {
  tickers: string[];
  /** False until localStorage has been read, so we never overwrite it with []. */
  hydrated: boolean;
}

const initialState: WatchlistState = { tickers: [], hydrated: false };

const watchlistSlice = createSlice({
  name: "watchlist",
  initialState,
  reducers: {
    toggleWatch(state, action: PayloadAction<string>) {
      const t = action.payload.toUpperCase();
      const i = state.tickers.indexOf(t);
      if (i >= 0) state.tickers.splice(i, 1);
      else state.tickers.push(t);
    },
    removeWatch(state, action: PayloadAction<string>) {
      state.tickers = state.tickers.filter((t) => t !== action.payload.toUpperCase());
    },
    hydrateWatchlist(state, action: PayloadAction<string[]>) {
      // Merge rather than replace: a star clicked before hydration is kept.
      state.tickers = [...new Set([...action.payload.map((t) => t.toUpperCase()), ...state.tickers])];
      state.hydrated = true;
    },
  },
});

export const { toggleWatch, removeWatch, hydrateWatchlist } = watchlistSlice.actions;
export default watchlistSlice.reducer;
