import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RatioId } from "@/lib/finance/ratios";

export const MAX_COMPARE = 5;

export interface CompareState {
  tickers: string[];
  ratio: RatioId;
}

export const initialCompareState: CompareState = { tickers: [], ratio: "operatingMargin" };

const compareSlice = createSlice({
  name: "compare",
  initialState: initialCompareState,
  reducers: {
    /** Add if absent (up to MAX_COMPARE), remove if present. */
    toggleCompare(state, action: PayloadAction<string>) {
      const t = action.payload.toUpperCase();
      const i = state.tickers.indexOf(t);
      if (i >= 0) state.tickers.splice(i, 1);
      else if (state.tickers.length < MAX_COMPARE) state.tickers.push(t);
    },
    setCompareTickers(state, action: PayloadAction<string[]>) {
      state.tickers = [...new Set(action.payload.map((t) => t.toUpperCase()))].slice(0, MAX_COMPARE);
    },
    clearCompare(state) {
      state.tickers = [];
    },
    setCompareRatio(state, action: PayloadAction<RatioId>) {
      state.ratio = action.payload;
    },
    hydrateCompare(_state, action: PayloadAction<CompareState>) {
      return action.payload;
    },
  },
});

export const { toggleCompare, setCompareTickers, clearCompare, setCompareRatio, hydrateCompare } =
  compareSlice.actions;
export default compareSlice.reducer;
