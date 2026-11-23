/**
 * Redux state <-> query string. Redux is the source of truth; the URL mirrors
 * it so any screen can be bookmarked or shared. Parsers are strict: anything
 * unknown or malformed in the URL is dropped, never trusted into state.
 *
 *   /company/AAPL?asOf=2020-06-30&vs=2018-12-31&period=quarterly
 *   /screener?item=revenue&period=annual&lag=after1y&sector=Industrials,Health%20Care&q=ge&sort=rate&watch=1
 */
import { isIsoDate } from "@/lib/edgar/periods";
import { METRIC_IDS, type MetricId } from "@/lib/edgar/metricIds";
import { LAG_FILTERS, type LagFilter } from "@/lib/edgar/revisionScreen";
import { SECTORS, type Sector } from "@/lib/universe";
import { initialRewindState, type RewindState } from "./rewindSlice";
import { initialScreenerState, type ScreenerState, type SortField } from "./screenerSlice";

const SORT_FIELDS = new Set<string>(["ticker", "name", "sector", "figures", "revised", "rate", "medianLagDays"]);

export function serializeScreener(s: ScreenerState): string {
  const p = new URLSearchParams();
  if (s.metric) p.set("item", s.metric);
  if (s.period) p.set("period", s.period);
  if (s.lag !== "any") p.set("lag", s.lag);
  if (s.sectors.length) p.set("sector", s.sectors.join(","));
  if (s.search.trim()) p.set("q", s.search.trim());
  if (s.watchlistOnly) p.set("watch", "1");
  const def = initialScreenerState.sort;
  if (s.sort.field !== def.field || s.sort.direction !== def.direction) {
    p.set("sort", `${s.sort.direction === "desc" ? "-" : ""}${s.sort.field}`);
  }
  return p.toString();
}

export function parseScreener(query: string | URLSearchParams): ScreenerState {
  const p = typeof query === "string" ? new URLSearchParams(query) : query;
  const item = p.get("item");
  const period = p.get("period");
  const lag = p.get("lag");
  const sectors = (p.get("sector") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Sector => (SECTORS as readonly string[]).includes(s));
  let sort = initialScreenerState.sort;
  const rawSort = p.get("sort");
  if (rawSort) {
    const desc = rawSort.startsWith("-");
    const field = desc ? rawSort.slice(1) : rawSort;
    if (SORT_FIELDS.has(field)) sort = { field: field as SortField, direction: desc ? "desc" : "asc" };
  }
  return {
    metric: (METRIC_IDS as readonly string[]).includes(item ?? "") ? (item as MetricId) : null,
    period: period === "annual" || period === "quarterly" ? period : null,
    lag: (LAG_FILTERS as readonly string[]).includes(lag ?? "") ? (lag as LagFilter) : "any",
    sectors: [...new Set(sectors)],
    search: (p.get("q") ?? "").slice(0, 80),
    watchlistOnly: p.get("watch") === "1",
    sort,
  };
}

export function serializeRewind(r: RewindState): string {
  const p = new URLSearchParams();
  if (r.asOf) p.set("asOf", r.asOf);
  if (r.compareFrom) p.set("vs", r.compareFrom);
  if (r.period !== initialRewindState.period) p.set("period", r.period);
  return p.toString();
}

export function parseRewind(query: string | URLSearchParams): RewindState {
  const p = typeof query === "string" ? new URLSearchParams(query) : query;
  const isoOrNull = (v: string | null) => (v && isIsoDate(v) ? v : null);
  const asOf = isoOrNull(p.get("asOf"));
  let compareFrom = isoOrNull(p.get("vs"));
  if (compareFrom && asOf && compareFrom >= asOf) compareFrom = null;
  return {
    asOf,
    compareFrom,
    period: p.get("period") === "quarterly" ? "quarterly" : "annual",
  };
}
