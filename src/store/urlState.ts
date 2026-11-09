/**
 * Redux state <-> query string. Redux is the source of truth; the URL mirrors
 * it so any screen can be bookmarked or shared. Parsers are strict: anything
 * unknown or malformed in the URL is dropped, never trusted into state.
 *
 *   /?sector=Information%20Technology,Health%20Care&q=app&operatingMargin=0.2..&sort=-revenue&watch=1
 *   /compare?t=AAPL,MSFT,NVDA&ratio=fcfMargin
 *   /company/AAPL?period=quarterly
 *   /filings?form=10-Q
 */
import { RATIO_IDS, type RatioId } from "@/lib/finance/ratios";
import { SECTORS, type Sector } from "@/lib/universe";
import { MAX_COMPARE, initialCompareState, type CompareState } from "./compareSlice";
import {
  initialScreenerState,
  type Bound,
  type ScreenerState,
  type SortField,
} from "./screenerSlice";
import type { FormFilter, Period } from "./viewSlice";

const SORT_FIELDS = new Set<string>(["ticker", "name", "sector", "revenue", "netIncome", "freeCashFlow", ...RATIO_IDS]);
const TICKER = /^[A-Z][A-Z0-9.-]{0,9}$/;

function fmtNum(n: number): string {
  return String(Number(n.toPrecision(6)));
}

function parseNum(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function serializeScreener(s: ScreenerState): string {
  const p = new URLSearchParams();
  if (s.sectors.length) p.set("sector", s.sectors.join(","));
  if (s.search.trim()) p.set("q", s.search.trim());
  for (const id of RATIO_IDS) {
    const b = s.bounds[id];
    if (!b) continue;
    p.set(id, `${b.min === undefined ? "" : fmtNum(b.min)}..${b.max === undefined ? "" : fmtNum(b.max)}`);
  }
  if (s.watchlistOnly) p.set("watch", "1");
  const def = initialScreenerState.sort;
  if (s.sort.field !== def.field || s.sort.direction !== def.direction) {
    p.set("sort", `${s.sort.direction === "desc" ? "-" : ""}${s.sort.field}`);
  }
  return p.toString();
}

export function parseScreener(query: string | URLSearchParams): ScreenerState {
  const p = typeof query === "string" ? new URLSearchParams(query) : query;
  const sectors = (p.get("sector") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Sector => (SECTORS as readonly string[]).includes(s));
  const bounds: Partial<Record<RatioId, Bound>> = {};
  for (const id of RATIO_IDS) {
    const raw = p.get(id);
    if (!raw || !raw.includes("..")) continue;
    const [lo, hi] = raw.split("..");
    const b: Bound = {};
    const min = parseNum(lo);
    const max = parseNum(hi);
    if (min !== undefined) b.min = min;
    if (max !== undefined) b.max = max;
    if (b.min !== undefined || b.max !== undefined) bounds[id] = b;
  }
  let sort = initialScreenerState.sort;
  const rawSort = p.get("sort");
  if (rawSort) {
    const desc = rawSort.startsWith("-");
    const field = desc ? rawSort.slice(1) : rawSort;
    if (SORT_FIELDS.has(field)) sort = { field: field as SortField, direction: desc ? "desc" : "asc" };
  }
  return {
    sectors: [...new Set(sectors)],
    search: (p.get("q") ?? "").slice(0, 80),
    bounds,
    watchlistOnly: p.get("watch") === "1",
    sort,
  };
}

export function serializeCompare(s: CompareState): string {
  const p = new URLSearchParams();
  if (s.tickers.length) p.set("t", s.tickers.join(","));
  if (s.ratio !== initialCompareState.ratio) p.set("ratio", s.ratio);
  return p.toString();
}

export function parseCompare(query: string | URLSearchParams): CompareState {
  const p = typeof query === "string" ? new URLSearchParams(query) : query;
  const tickers = [
    ...new Set(
      (p.get("t") ?? "")
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => TICKER.test(t)),
    ),
  ].slice(0, MAX_COMPARE);
  const ratio = p.get("ratio");
  return {
    tickers,
    ratio: ratio && (RATIO_IDS as readonly string[]).includes(ratio) ? (ratio as RatioId) : initialCompareState.ratio,
  };
}

export function parsePeriod(query: string | URLSearchParams): Period {
  const p = typeof query === "string" ? new URLSearchParams(query) : query;
  return p.get("period") === "quarterly" ? "quarterly" : "annual";
}

export function serializePeriod(period: Period): string {
  return period === "quarterly" ? "period=quarterly" : "";
}

export function parseForm(query: string | URLSearchParams): FormFilter {
  const p = typeof query === "string" ? new URLSearchParams(query) : query;
  const f = p.get("form");
  return f === "10-K" || f === "10-Q" ? f : "all";
}

export function serializeForm(form: FormFilter): string {
  return form === "all" ? "" : `form=${form}`;
}
