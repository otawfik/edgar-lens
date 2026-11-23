"use client";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { formatPercent } from "@/lib/format";
import { resetFilters, sortBy, type SortField } from "@/store/screenerSlice";
import { selectMetricOptions, type ScreenerRow } from "@/store/selectors";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { toggleWatch } from "@/store/watchlistSlice";
import { figures } from "@/theme/theme";

/** Columns give way as the screen narrows; ticker, the counts and the rate always stay. */
const from = (bp: "sm" | "md" | "lg") => ({ display: { xs: "none", [bp]: "table-cell" } });

const COLUMNS: { field: SortField; label: string; numeric?: boolean; sx?: object; hint?: string }[] = [
  { field: "ticker", label: "Ticker" },
  { field: "name", label: "Company", sx: from("sm") },
  { field: "sector", label: "Sector", sx: from("md") },
  { field: "figures", label: "Reported", numeric: true, hint: "Figures the company reported in the selection" },
  { field: "revised", label: "Changed", numeric: true, hint: "Of those, figures a later filing changed by a material amount" },
  { field: "rate", label: "Rate", numeric: true, hint: "Changed ÷ reported" },
  { field: "medianLagDays", label: "Median delay", numeric: true, sx: from("sm"), hint: "Days from a figure's first filing to the filing that changed it" },
];

export function RevisionTable({ rows, loading, allLineItems }: { rows: ScreenerRow[]; loading: boolean; allLineItems: boolean }) {
  const dispatch = useAppDispatch();
  const sort = useAppSelector((s) => s.screener.sort);
  const watched = new Set(useAppSelector((s) => s.watchlist.tickers));
  const labels = new Map(useAppSelector(selectMetricOptions).map((m) => [m.id, m.label]));
  const maxRate = Math.max(0, ...rows.map((r) => r.rate ?? 0));
  const columnCount = COLUMNS.length + 1 + (allLineItems ? 1 : 0);

  return (
    <TableContainer component={Paper}>
      <Table size="small" aria-label="Companies by share of reported figures later changed" aria-busy={loading}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...from("sm"), width: 44, px: 0.5 }}>
              <Box component="span" sx={{ position: "absolute", left: -9999 }}>Watchlist</Box>
            </TableCell>
            {COLUMNS.map((c) => (
              <TableCell
                key={c.field}
                align={c.numeric ? "right" : "left"}
                sortDirection={sort.field === c.field ? sort.direction : false}
                title={c.hint}
                sx={{ whiteSpace: "nowrap", ...c.sx }}
              >
                <TableSortLabel
                  active={sort.field === c.field}
                  direction={sort.field === c.field ? sort.direction : "desc"}
                  onClick={() => dispatch(sortBy(c.field))}
                >
                  {c.label}
                </TableSortLabel>
              </TableCell>
            ))}
            {allLineItems && <TableCell sx={{ whiteSpace: "nowrap", ...from("lg") }}>Most-changed line item</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading &&
            Array.from({ length: 12 }, (_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={columnCount}>
                  <Skeleton variant="text" />
                </TableCell>
              </TableRow>
            ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columnCount} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
                No company reports figures matching these filters.{" "}
                <Button size="small" onClick={() => dispatch(resetFilters())}>
                  Reset filters
                </Button>
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => {
            const on = watched.has(r.ticker);
            return (
              <TableRow key={r.ticker} hover>
                <TableCell sx={{ ...from("sm"), px: 0.5 }}>
                  <IconButton
                    size="small"
                    aria-label={on ? `Remove ${r.ticker} from watchlist` : `Add ${r.ticker} to watchlist`}
                    aria-pressed={on}
                    onClick={() => dispatch(toggleWatch(r.ticker))}
                  >
                    {on ? <StarIcon fontSize="small" color="secondary" /> : <StarBorderIcon fontSize="small" />}
                  </IconButton>
                </TableCell>
                <TableCell component="th" scope="row">
                  <Box
                    component={Link}
                    href={`/company/${r.ticker}`}
                    prefetch={false}
                    sx={{ fontWeight: 700, color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                  >
                    {r.ticker}
                  </Box>
                </TableCell>
                <TableCell sx={from("sm")}>{r.name}</TableCell>
                <TableCell sx={from("md")}>{r.sector}</TableCell>
                <TableCell align="right" sx={figures}>{r.figures}</TableCell>
                <TableCell align="right" sx={figures}>{r.revised}</TableCell>
                <TableCell align="right" data-col="rate" sx={{ ...figures, minWidth: 104 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
                    <Box aria-hidden sx={{ display: { xs: "none", sm: "block" }, flex: "0 0 56px", height: 6, borderRadius: 3, bgcolor: "action.hover" }}>
                      <Box sx={{ width: `${maxRate ? ((r.rate ?? 0) / maxRate) * 100 : 0}%`, height: 1, borderRadius: 3, bgcolor: "primary.main" }} />
                    </Box>
                    <span>{formatPercent(r.rate)}</span>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ ...figures, ...from("sm") }}>
                  {r.medianLagDays === null ? "—" : `${Math.round(r.medianLagDays)} d`}
                </TableCell>
                {allLineItems && (
                  <TableCell sx={{ whiteSpace: "nowrap", ...from("lg") }}>
                    {r.top ? (
                      <>
                        {labels.get(r.top.metric) ?? r.top.metric}{" "}
                        <Box component="span" sx={{ ...figures, color: "text.secondary" }}>
                          {r.top.revised} of {r.top.figures}
                        </Box>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
