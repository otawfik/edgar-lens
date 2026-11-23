"use client";
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

  return (
    <Paper sx={{ overflow: "hidden" }}>
      <Box sx={{ p: 2, pb: 1, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "baseline" }}>
        <Typography variant="h3" sx={{ flexGrow: 1 }}>
          Line items{asOf ? ` as known on ${formatDate(asOf)}` : ""}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, bgcolor: "secondary.main", opacity: 0.35, mr: 0.5, verticalAlign: "middle", borderRadius: 0.5 }} />
          later changed by the company ·{" "}
          <Box component="span" sx={{ color: "secondary.main", fontWeight: 700 }}>•</Box> already revised by this date · hover a cell
          for its history
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
          <TableBody>
            {items.map((li) => {
              const byEnd = new Map(li.points.map((p) => [p.end, p]));
              return (
                <TableRow key={li.metric} hover>
                  <TableCell component="th" scope="row" sx={{ position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 1, fontWeight: 500 }}>
                    {li.label}
                  </TableCell>
                  {ends.map((end) => {
                    const p = byEnd.get(end);
                    if (!p) return <TableCell key={end} align="right" sx={{ color: "text.disabled" }}>—</TableCell>;
                    const now = latest.get(li.metric)?.get(end) ?? null;
                    const changedLater = now !== null && now !== p.value;
                    return (
                      <Tooltip key={end} title={<HistoryTip point={p} unit={li.unit} latest={now} />} placement="top" enterDelay={300}>
                        <TableCell
                          align="right"
                          data-changed={changedLater || undefined}
                          sx={{
                            ...figures,
                            whiteSpace: "nowrap",
                            cursor: "help",
                            bgcolor: changedLater ? "color-mix(in srgb, var(--mui-palette-secondary-main) 22%, transparent)" : undefined,
                            color: p.derived ? "text.secondary" : "text.primary",
                          }}
                        >
                          {fmt(li.unit, p.value)}
                          {p.revised && (
                            <Box component="span" sx={{ color: "secondary.main", fontWeight: 700, ml: 0.25 }} aria-label="revised before this date">
                              •
                            </Box>
                          )}
                        </TableCell>
                      </Tooltip>
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
