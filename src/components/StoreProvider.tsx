"use client";
import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { WATCHLIST_KEY } from "@/store/listeners";
import { makeStore } from "@/store/store";
import { hydrateWatchlist } from "@/store/watchlistSlice";

function readWatchlist(): string[] {
  try {
    const raw = window.localStorage.getItem(WATCHLIST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string").slice(0, 200) : [];
  } catch {
    return [];
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // One store per browser tab; created lazily so it survives re-renders.
  const [store] = useState(makeStore);
  useEffect(() => {
    store.dispatch(hydrateWatchlist(readWatchlist()));
  }, [store]);
  return <Provider store={store}>{children}</Provider>;
}
