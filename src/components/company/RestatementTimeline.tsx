"use client";
import type { MouseEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { RestatementsQuery } from "@/graphql/types.generated";
import { formatDate, toUtc } from "@/lib/edgar/periods";
import { formatChange, formatEps, formatMoney } from "@/lib/format";
import { useRestatementsQuery } from "@/store/api";
import { setWindow } from "@/store/rewindSlice";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { serializeRewind } from "@/store/urlState";
import { figures } from "@/theme/theme";

export type RestatementEvent = NonNullable<RestatementsQuery["company"]>["restatements"][number];

const TRACK = 72; // height of the tallest bar, px

const count = (n: number) => `${n} figure${n === 1 ? "" : "s"} changed`;
const forms = (e: RestatementEvent) => [...new Set(e.filings.map((f) => f.form))].join(" + ");
const value = (e: RestatementEvent, v: number) => (e.largest.metric === "EPS_DILUTED" ? formatEps(v) : formatMoney(v));

/** "Revenue FY2018 $121.6B → $97.0B (−20.2%)" */
export function largestChange(e: RestatementEvent): string {
  const l = e.largest;
  return `${l.label} ${l.periodLabel} ${value(e, l.from)} → ${value(e, l.to)} (${formatChange(l.change)})`;
}

/** Where each event sits between the first and last filing date (0–1), and the 1 January of each year between. */
export function timelineScale(filingDates: readonly string[]) {
  const t0 = filingDates.length ? toUtc(filingDates[0]) : 0;
  const t1 = filingDates.length ? toUtc(filingDates[filingDates.length - 1]) : 1;
  const at = (iso: string) => (t1 > t0 ? Math.min(1, Math.max(0, (toUtc(iso) - t0) / (t1 - t0))) : 0.5);
  const years: { year: number; at: number }[] = [];
  if (filingDates.length) {
    for (let y = Number(filingDates[0].slice(0, 4)) + 1; y <= Number(filingDates[filingDates.length - 1].slice(0, 4)); y++) {
      const x = at(`${y}-01-01`);
      // A label starting at the very end of the track would run off it.
      if (x <= 0.96) years.push({ year: y, at: x });
    }
  }
  return { at, years };
}

/**
 * Every filing date on which the company changed figures it had already
 * reported, on a calendar axis; a bar's height is the number of figures that
 * filing changed. Each bar is a link to the comparison of that filing date
 * with the one before it (?asOf=…&vs=…), which the "What changed" panel below
 * then lists in full, so a restatement can be opened, bookmarked or shared.
 */
export function RestatementTimeline({ ticker, filingDates }: { ticker: string; filingDates: string[] }) {
  const dispatch = useAppDispatch();
  const { asOf, compareFrom, period } = useAppSelector((s) => s.rewind);
  const { data, isLoading, error } = useRestatementsQuery({ ticker });
  const events = data?.company?.restatements ?? [];
  const { at, years } = timelineScale(filingDates);
  const max = Math.max(1, ...events.map((e) => e.count));
  const total = events.reduce((n, e) => n + e.count, 0);

  const selected = events.findIndex((e) => e.filed === asOf && e.previous === compareFrom);
  // Stepping starts from the as-of date when no restatement is open.
  const earlier = selected >= 0 ? selected - 1 : events.findLastIndex((e) => !asOf || e.filed < asOf);
  const later = selected >= 0 ? selected + 1 : asOf ? events.findIndex((e) => e.filed > asOf) : -1;
  const open = (e: RestatementEvent) => dispatch(setWindow({ asOf: e.filed, compareFrom: e.previous }));
  const href = (e: RestatementEvent) => `?${serializeRewind({ asOf: e.filed, compareFrom: e.previous, period })}`;
  const onClick = (ev: MouseEvent, e: RestatementEvent) => {
    // A plain click updates the page in place; modified clicks open the link as usual.
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
    ev.preventDefault();
    open(e);
  };

  return (
    <Paper sx={{ p: 2 }} data-testid="restatement-timeline">
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "flex-start" }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h3">Restatement timeline</Typography>
          <Typography variant="body2" color="text.secondary">
            {events.length
              ? `${events.length} filing date${events.length === 1 ? "" : "s"} changed ${total} figure${total === 1 ? "" : "s"} already on file. A bar's height is the number of figures that filing changed; select one to see exactly what it changed.`
              : isLoading
                ? "Loading…"
                : "No filing in the snapshot materially changed a figure this company had already reported."}
          </Typography>
        </Box>
        {events.length > 0 && (
          <Box sx={{ display: "flex" }}>
            <Tooltip title="Earlier restatement">
              <span>
                <IconButton size="small" aria-label="Earlier restatement" disabled={earlier < 0} onClick={() => open(events[earlier])}>
                  <ChevronLeftIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Later restatement">
              <span>
                <IconButton size="small" aria-label="Later restatement" disabled={later < 0 || later >= events.length} onClick={() => open(events[later])}>
                  <ChevronRightIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mt: 1 }}>Couldn&apos;t load the restatement timeline.</Alert>}
      {isLoading && <Skeleton variant="rounded" height={TRACK + 28} sx={{ mt: 1.5 }} />}
      {events.length > 0 && (
        <>
          {/* Scrolls sideways on a phone; the links inside keep it reachable from the keyboard. */}
          <Box sx={{ overflowX: "auto", mt: 1.5, mx: -0.5, px: 0.5 }}>
            <Box sx={{ minWidth: 640, px: 1 }}>
              <Box component="ol" aria-label="Restatements by filing date" sx={{ position: "relative", height: TRACK + 8, m: 0, p: 0, listStyle: "none", borderBottom: 1, borderColor: "divider" }}>
                {events.map((e, i) => (
                  <Box component="li" key={e.filed} sx={{ position: "absolute", bottom: 0, left: `${at(e.filed) * 100}%`, width: 12, ml: "-6px", height: "100%" }}>
                    <Tooltip
                      describeChild
                      placement="top"
                      title={
                        <Box sx={{ fontSize: "0.75rem" }}>
                          <Box sx={{ fontWeight: 600 }}>
                            {formatDate(e.filed)} · {forms(e)}
                          </Box>
                          <Box>{count(e.count)}</Box>
                          <Box sx={figures}>{largestChange(e)}</Box>
                        </Box>
                      }
                    >
                      <Box
                        component="a"
                        href={href(e)}
                        onClick={(ev: MouseEvent) => onClick(ev, e)}
                        aria-label={`${formatDate(e.filed)}, ${forms(e)}: ${count(e.count)}`}
                        aria-current={i === selected ? "true" : undefined}
                        sx={{
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                          height: "100%",
                          borderRadius: 0.5,
                          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
                          "& > span": { bgcolor: "primary.main", opacity: 0.8 },
                          "&:hover > span, &:focus-visible > span": { opacity: 1 },
                          '&[aria-current="true"] > span': { bgcolor: "secondary.main", opacity: 1, width: 10 },
                        }}
                      >
                        <Box component="span" sx={{ display: "block", width: 8, borderRadius: "2px 2px 0 0", height: Math.max(3, Math.round((e.count / max) * TRACK)) }} />
                      </Box>
                    </Tooltip>
                  </Box>
                ))}
              </Box>
              <Box aria-hidden sx={{ position: "relative", height: 20, ...figures, fontSize: "0.7rem", color: "text.secondary" }}>
                {years.map((y) => (
                  <Box key={y.year} sx={{ position: "absolute", left: `${y.at * 100}%`, top: 0, pl: 0.5, pt: 0.5, borderLeft: 1, borderColor: "divider", lineHeight: 1.2 }}>
                    {y.year}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
          <Typography variant="body2" role="status" sx={{ mt: 0.5, minHeight: "1.5em" }} data-testid="restatement-selected">
            {selected >= 0 ? (
              <>
                <strong>
                  {formatDate(events[selected].filed)} · {forms(events[selected])}
                </strong>{" "}
                · {count(events[selected].count)} since {formatDate(events[selected].previous)} · largest:{" "}
                <Box component="span" sx={figures}>
                  {largestChange(events[selected])}
                </Box>
              </>
            ) : (
              <Box component="span" sx={{ color: "text.secondary" }}>
                Largest: {formatDate(events.reduce((a, b) => (b.count > a.count ? b : a)).filed)}, {count(max)}.
              </Box>
            )}
          </Typography>
        </>
      )}
    </Paper>
  );
}
