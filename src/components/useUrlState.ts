"use client";
import { useEffect } from "react";

/**
 * Two-way URL sync, the half that lives in components. On mount:
 * - if the URL carries state (a shared link, a reload), it wins → `hydrate`;
 * - if it doesn't (arrived via the nav bar), keep the Redux state and write
 *   it into the URL → `mirror`.
 * The other half — writing the URL on every change — is listener middleware
 * (src/store/listeners.ts), so components never touch history themselves.
 */
export function useUrlState(hydrate: (search: string) => void, mirror: () => void) {
  useEffect(() => {
    const search = window.location.search;
    if (search.length > 1) hydrate(search);
    else mirror();
    // Mount-only: later changes flow state → URL through the middleware.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
