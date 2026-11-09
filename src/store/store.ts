import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, useStore } from "react-redux";
import { api } from "./api";
import compare from "./compareSlice";
import { listener } from "./listeners";
import screener from "./screenerSlice";
import view from "./viewSlice";
import watchlist from "./watchlistSlice";

const rootReducer = combineReducers({
  screener,
  watchlist,
  compare,
  view,
  [api.reducerPath]: api.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

/** A store per request on the server, one per tab in the browser (RTK's Next.js pattern). */
export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) => getDefault().prepend(listener.middleware).concat(api.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
