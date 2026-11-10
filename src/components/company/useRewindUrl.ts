"use client";
import { hydrateRewind } from "@/store/rewindSlice";
import { useAppDispatch, useAppStore } from "@/store/store";
import { parseRewind, serializeRewind } from "@/store/urlState";
import { useUrlState } from "../useUrlState";

/** Company page: URL → Redux on arrival with a query string, Redux → URL otherwise. */
export function useRewindUrl() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  useUrlState(
    (search) => dispatch(hydrateRewind(parseRewind(search))),
    () => {
      const q = serializeRewind(store.getState().rewind);
      if (q) window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q}`);
    },
  );
}
