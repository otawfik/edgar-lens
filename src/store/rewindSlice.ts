import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { isIsoDate } from "@/lib/edgar/periods";

export type Period = "annual" | "quarterly";

/**
 * The company page's point in time. `asOf` is the date whose filings are
 * "known" (null = everything, i.e. today); `compareFrom` is the earlier date
 * the diff panel compares against (null = panel closed). Mirrored to the URL
 * by listener middleware so any view is a shareable link.
 */
export interface RewindState {
  asOf: string | null;
  compareFrom: string | null;
  period: Period;
}

export const initialRewindState: RewindState = { asOf: null, compareFrom: null, period: "annual" };

const clean = (d: string | null | undefined): string | null => (d && isIsoDate(d) ? d : null);

const rewindSlice = createSlice({
  name: "rewind",
  initialState: initialRewindState,
  reducers: {
    setAsOf(state, action: PayloadAction<string | null>) {
      state.asOf = clean(action.payload);
      // The baseline must stay strictly earlier than the as-of date.
      if (state.compareFrom && state.asOf && state.compareFrom >= state.asOf) state.compareFrom = null;
    },
    setCompareFrom(state, action: PayloadAction<string | null>) {
      const d = clean(action.payload);
      state.compareFrom = d && state.asOf && d >= state.asOf ? null : d;
    },
    /** Both dates at once: "what did the filings of `asOf` change since `compareFrom`?" */
    setWindow(state, action: PayloadAction<{ asOf: string; compareFrom: string }>) {
      const asOf = clean(action.payload.asOf);
      const from = clean(action.payload.compareFrom);
      if (!asOf) return;
      state.asOf = asOf;
      state.compareFrom = from && from < asOf ? from : null;
    },
    setPeriod(state, action: PayloadAction<Period>) {
      state.period = action.payload;
    },
    resetRewind(state) {
      state.asOf = null;
      state.compareFrom = null;
    },
    hydrateRewind(_state, action: PayloadAction<RewindState>) {
      return action.payload;
    },
  },
});

export const { setAsOf, setCompareFrom, setWindow, setPeriod, resetRewind, hydrateRewind } = rewindSlice.actions;
export default rewindSlice.reducer;
