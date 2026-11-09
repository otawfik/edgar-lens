import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Period = "annual" | "quarterly";
export type FormFilter = "all" | "10-K" | "10-Q";

export interface ViewState {
  /** Company page: fiscal years or quarters. */
  period: Period;
  /** Filings feed: which forms to show. */
  form: FormFilter;
}

export const initialViewState: ViewState = { period: "annual", form: "all" };

const viewSlice = createSlice({
  name: "view",
  initialState: initialViewState,
  reducers: {
    setPeriod(state, action: PayloadAction<Period>) {
      state.period = action.payload;
    },
    setForm(state, action: PayloadAction<FormFilter>) {
      state.form = action.payload;
    },
    hydrateView(state, action: PayloadAction<Partial<ViewState>>) {
      Object.assign(state, action.payload);
    },
  },
});

export const { setPeriod, setForm, hydrateView } = viewSlice.actions;
export default viewSlice.reducer;
