"use client";
import { useState, type KeyboardEvent } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { CompanyQuery, Metric } from "@/graphql/types.generated";
import { formatDate } from "@/lib/edgar/periods";
import { formatChange, formatEps, formatMoney } from "@/lib/format";
import { figures } from "@/theme/theme";

type Company = NonNullable<CompanyQuery["company"]>;
type Point = Company["lineItems"][number]["points"][number];

/** Statement order; metrics not listed go at the end. */
const ORDER: Metric[] = [
  "REVENUE", "NET_INTEREST_INCOME", "NONINTEREST_INCOME", "COST_OF_REVENUE", "GROSS_PROFIT",
  "RESEARCH_AND_DEVELOPMENT", "NONINTEREST_EXPENSE", "OPERATING_INCOME", "NET_INCOME", "EPS_DILUTED",
  "SHARE_BASED_COMP", "OPERATING_CASH_FLOW", "CAPEX", "FREE_CASH_FLOW", "DIVIDENDS_PAID", "BUYBACKS",
  "CASH", "TOTAL_ASSETS", "TOTAL_LIABILITIES", "LONG_TERM_DEBT", "EQUITY",
];

const fmt = (unit: string, v: number | null | undefined) => (unit === "USD/shares" ? formatEps(v) : formatMoney(v));

function HistoryTip({ point, unit, latest }: { point: Point; unit: string; latest: number | null }) {
  return (
    <Box sx={{ ...figures, fontSize: "0.75rem" }}>
      {point.history.map((h, i) => (
        <Box key={i} sx={{ display: "flex", gap: 1, justifyContent: "space-between", fontWeight: h.value === point.value ? 700 : 400 }}>
          <span>
            {h.filing.form} · {formatDate(h.filing.filed)}
          </span>
          <span>{fmt(unit, h.value)}</span>
        </Box>
      ))}
      {latest !== null && latest !== point.value && (
        <Box sx={{ mt: 0.5, pt: 0.5, borderTop: 1, borderColor: "divider" }}>
          Today: {fmt(unit, latest)} ({formatChange((latest - point.value) / Math.abs(point.value || 1))})
        </Box>
      )}
      {point.derived && <Box sx={{ mt: 0.5, color: "text.secondary" }}>Computed from other reported figures</Box>}
    </Box>
  );
}

/**
 * The statement as known on the as-of date. A cell is tinted when today's
 * figure for that period differs (the company later changed it); a dot marks
 * a value that had already been revised by the as-of date.
 */
export function LineItemTable({ asOfData, latestData, asOf }: { asOfData: Company; latestData: Company | undefined; asOf: string | null }) {
  const items = [...asOfData.lineItems].sort((a, b) => ORDER.indexOf(a.metric) - ORDER.indexOf(b.metric));
  const ends = [...new Set(items.flatMap((li) => li.points.map((p) => p.end)))].sort();
  const labelOf = new Map(items.flatMap((li) => li.points.map((p) => [p.end, p.label] as const)));
  const latest = new Map<string, Map<string, number>>();
  for (const li of latestData?.lineItems ?? []) latest.set(li.metric, new Map(li.points.map((p) => [p.end, p.value])));

  // One tab stop for the whole grid of figures; arrow keys move between them.
  const [stop, setStop] = useState<string | null>(null);
  const keys = items.flatMap((li) => li.points.map((p) => `${li.metric}|${p.end}`));
  const current = stop && keys.includes(stop) ? stop : keys[0];
  const onKeyDown = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    const from = (e.target as HTMLElement).closest<HTMLElement>("button[data-row]");
    if (!from) return;
    const row = Number(from.dataset.row);
    const col = Number(from.dataset.col);
    const step: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    let target: HTMLElement | null = null;
    if (e.key in step) {
      // Keep going past cells with no figure (a dash) until one is found or the table ends.
      const [dr, dc] = step[e.key];
      for (let r = row + dr, c = col + dc; r >= 0 && r < items.length && c >= 0 && c < ends.length && !target; r += dr, c += dc) {
        target = e.currentTarget.querySelector<HTMLElement>(`button[data-row="${r}"][data-col="${c}"]`);
      }
    } else if (e.key === "Home" || e.key === "End") {
      const inRow = e.currentTarget.querySelectorAll<HTMLElement>(`button[data-row="${row}"]`);
      target = inRow[e.key === "Home" ? 0 : inRow.length - 1] ?? null;
    } else {
      return;
    }
    e.preventDefault();
    target?.focus();
  };

  return (
    <Paper sx={{ overflow: "hidden" }}>
      <Box sx={{ p: 2, pb: 1, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "baseline" }}>
        <Typography variant="h3" sx={{ flexGrow: 1 }}>
          Line items{asOf ? ` as known on ${formatDate(asOf)}` : ""}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, bgcolor: "secondary.main", opacity: 0.35, mr: 0.5, verticalAlign: "middle", borderRadius: 0.5 }} />
          later changed by the company ·{" "}
          <Box component="span" sx={{ color: "secondary.main", fontWeight: 700 }}>•</Box> already revised by this date · hover a figure
          for its history, or tab into the table and use the arrow keys
        </Typography>
      </Box>
      {/* Scrolls sideways on narrow screens: focusable, so the keyboard can scroll it too. */}
      <TableContainer tabIndex={0} role="region" aria-label="Financial line items, scrollable" sx={{ maxWidth: "100%" }}>
        <Table size="small" aria-label="Financial line items by period" sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1, minWidth: 180 }}>Line item</TableCell>
              {ends.map((end) => (
                <TableCell key={end} align="right" sx={{ ...figures, whiteSpace: "nowrap" }}>
                  {labelOf.get(end)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody onKeyDown={onKeyDown}>
            {items.map((li, row) => {
              const byEnd = new Map(li.points.map((p) => [p.end, p]));
              return (
                <TableRow key={li.metric} hover>
                  <TableCell component="th" scope="row" sx={{ position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1, fontWeight: 500 }}>
                    {li.label}
                  </TableCell>
                  {ends.map((end, col) => {
                    const p = byEnd.get(end);
                    if (!p) return <TableCell key={end} align="right" sx={{ color: "text.disabled" }}>—</TableCell>;
                    const now = latest.get(li.metric)?.get(end) ?? null;
                    const changedLater = now !== null && now !== p.value;
                    return (
                      <TableCell
                        key={end}
                        align="right"
                        data-changed={changedLater || undefined}
                        sx={{
                          ...figures,
                          whiteSpace: "nowrap",
                          bgcolor: changedLater ? "color-mix(in srgb, var(--mui-palette-secondary-main) 22%, transparent)" : undefined,
                          color: p.derived ? "text.secondary" : "text.primary",
                        }}
                      >
                        {/* The figure is a button so its history opens on keyboard focus as well as on hover. */}
                        <Tooltip describeChild title={<HistoryTip point={p} unit={li.unit} latest={now} />} placement="top" enterDelay={300}>
                          <Box
                            component="button"
                            type="button"
                            data-row={row}
                            data-col={col}
                            tabIndex={`${li.metric}|${end}` === current ? 0 : -1}
                            onFocus={() => setStop(`${li.metric}|${end}`)}
                            aria-label={`${li.label}, ${p.label}: ${fmt(li.unit, p.value)}${p.revised ? ", revised before this date" : ""}${changedLater ? ", later changed" : ""}`}
                            sx={{
                              all: "unset",
                              cursor: "help",
                              borderRadius: 0.5,
                              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                            }}
                          >
                            {fmt(li.unit, p.value)}
                            {p.revised && (
                              <Box component="span" aria-hidden sx={{ color: "secondary.main", fontWeight: 700, ml: 0.25 }}>
                                •
                              </Box>
                            )}
                          </Box>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
