"use client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatPercent } from "@/lib/format";
import { useScreenerQuery } from "@/store/api";
import { hydrateScreener } from "@/store/screenerSlice";
import { selectAllRows, selectFilteredRows, selectTotals } from "@/store/selectors";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/store";
import { parseScreener, serializeScreener } from "@/store/urlState";
import { figures } from "@/theme/theme";
import { useUrlState } from "../useUrlState";
import { FilterBar } from "./FilterBar";
import { RevisionTable } from "./RevisionTable";

function Tile({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId?: string }) {
  return (
    <Paper sx={{ p: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography sx={{ ...figures, fontSize: "1.4rem", fontWeight: 500, lineHeight: 1.3 }} data-testid={testId}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

/**
 * The revision screener: of the figures a company reported, how many did a
 * later filing change — for any line item, annual or quarterly, and by how
 * late the change came. All arithmetic is in src/lib/edgar/revisionScreen.ts.
 */
export function ScreenerView() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { isLoading, error, refetch } = useScreenerQuery();
  const all = useAppSelector(selectAllRows);
  const rows = useAppSelector(selectFilteredRows);
  const t = useAppSelector(selectTotals);
  const allLineItems = useAppSelector((s) => s.screener.metric === null);
  const reporting = all.filter((r) => r.figures > 0).length;

  useUrlState(
    (search) => dispatch(hydrateScreener(parseScreener(search))),
    () => {
      const q = serializeScreener(store.getState().screener);
      if (q) window.history.replaceState(window.history.state, "", `/screener?${q}`);
    },
  );

  return (
    <Stack spacing={2.5}>
      <Box sx={{ maxWidth: 820 }}>
        <Typography variant="h1">Which reported numbers held?</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Of the figures each company reported in its 10-Ks and 10-Qs, how many a later filing changed by a material
          amount. Choose a line item, fiscal years or quarters, and how long after the first filing a change still
          counts; sort by rate either way to see who restates most and whose numbers stood.
        </Typography>
      </Box>

      <Paper sx={{ p: 2 }}>
        <FilterBar />
      </Paper>

      {error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
          Couldn&apos;t load the screener: {"message" in error ? error.message : "unknown error"}
        </Alert>
      )}

      <Box
        sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", md: "repeat(5, minmax(0,1fr))" }, gap: 1.5 }}
        aria-live="polite"
      >
        <Tile label="Companies" value={`${t.companies} / ${reporting}`} hint="shown / reporting these figures" testId="shown-count" />
        <Tile label="Figures reported" value={t.figures.toLocaleString("en-US")} />
        <Tile label="Later changed" value={formatPercent(t.rate)} hint={`${t.revised.toLocaleString("en-US")} figures`} testId="pooled-rate" />
        <Tile label="Never changed any" value={String(t.untouched)} hint={t.untouched === 1 ? "company" : "companies"} />
        <Tile label="Median delay" value={t.medianLagDays === null ? "—" : `${Math.round(t.medianLagDays)} days`} hint="first filing → the change" />
      </Box>

      <RevisionTable rows={rows} loading={isLoading} allLineItems={allLineItems} />

      <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 820 }}>
        A change counts when it is at least 0.5% of the figure and at least $1M (or $0.01 per share); per-share values
        rescaled by a stock split are not counted, and neither are quarters derived from year-to-date totals. A figure
        changed twice counts once, by its first change. Rates on a handful of figures are noisy: read the Reported
        column with the rate. A changed figure is usually a restated comparative after a divestiture or an accounting
        change, not an error.
      </Typography>
    </Stack>
  );
}
