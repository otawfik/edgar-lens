import type { GridComparatorFn, GridSortDirection } from "@mui/x-data-grid";

/**
 * Sort numbers with nulls (not reported / not meaningful) at the bottom in
 * both directions — a company with no gross margin should never top a
 * "highest gross margin" sort.
 */
export function nullsLast(direction: GridSortDirection): GridComparatorFn<number | null> {
  const sign = direction === "desc" ? -1 : 1;
  return (a, b) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1 * sign;
    if (b === null) return -1 * sign;
    return a - b;
  };
}
