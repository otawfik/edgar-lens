import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import * as compare from "./compareSlice";
import * as screener from "./screenerSlice";
import * as view from "./viewSlice";
import * as watchlist from "./watchlistSlice";
import { serializeCompare, serializeForm, serializePeriod, serializeScreener } from "./urlState";
import type { AppDispatch, RootState } from "./store";

export const WATCHLIST_KEY = "edgar-lens:watchlist";

export const listener = createListenerMiddleware();
const startListening = listener.startListening.withTypes<RootState, AppDispatch>();

/** Mirror state into the query string of `path`, if that is the current page. */
function mirror(matches: (pathname: string) => boolean, query: string) {
  if (typeof window === "undefined" || !matches(window.location.pathname)) return;
  const next = query ? `?${query}` : "";
  if (window.location.search === next) return;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${next}${window.location.hash}`);
}

startListening({
  matcher: isAnyOf(
    screener.toggleSector,
    screener.setSectors,
    screener.setSearch,
    screener.setBound,
    screener.applyPreset,
    screener.setWatchlistOnly,
    screener.setSort,
    screener.resetFilters,
  ),
  effect: (_action, api) => mirror((p) => p === "/", serializeScreener(api.getState().screener)),
});

startListening({
  matcher: isAnyOf(compare.toggleCompare, compare.setCompareTickers, compare.clearCompare, compare.setCompareRatio),
  effect: (_action, api) => mirror((p) => p === "/compare", serializeCompare(api.getState().compare)),
});

startListening({
  actionCreator: view.setPeriod,
  effect: (action) => mirror((p) => p.startsWith("/company/"), serializePeriod(action.payload)),
});

startListening({
  actionCreator: view.setForm,
  effect: (action) => mirror((p) => p === "/filings", serializeForm(action.payload)),
});

startListening({
  matcher: isAnyOf(watchlist.toggleWatch, watchlist.removeWatch, watchlist.hydrateWatchlist),
  effect: (_action, api) => {
    const { tickers, hydrated } = api.getState().watchlist;
    if (!hydrated) return;
    try {
      window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(tickers));
    } catch {
      /* private mode or storage disabled: the watchlist lives for the session */
    }
  },
});
