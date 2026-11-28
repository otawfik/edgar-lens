import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import * as rewind from "./rewindSlice";
import * as screener from "./screenerSlice";
import { serializeRewind, serializeScreener } from "./urlState";
import * as watchlist from "./watchlistSlice";
import type { AppDispatch, RootState } from "./store";

export const WATCHLIST_KEY = "edgar-lens:watchlist";

export const listener = createListenerMiddleware();
const startListening = listener.startListening.withTypes<RootState, AppDispatch>();

/** Mirror state into the query string of the current page, if `matches` it. */
function mirror(matches: (pathname: string) => boolean, query: string) {
  if (typeof window === "undefined" || !matches(window.location.pathname)) return;
  const next = query ? `?${query}` : "";
  if (window.location.search === next) return;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${next}${window.location.hash}`);
}

startListening({
  matcher: isAnyOf(
    screener.setMetric,
    screener.setPeriod,
    screener.setLag,
    screener.toggleSector,
    screener.setSearch,
    screener.setWatchlistOnly,
    screener.sortBy,
    screener.setSort,
    screener.resetFilters,
  ),
  effect: (_action, api) => mirror((p) => p === "/screener", serializeScreener(api.getState().screener)),
});

startListening({
  matcher: isAnyOf(rewind.setAsOf, rewind.setCompareFrom, rewind.setWindow, rewind.setPeriod, rewind.resetRewind),
  effect: (_action, api) => mirror((p) => p.startsWith("/company/"), serializeRewind(api.getState().rewind)),
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
