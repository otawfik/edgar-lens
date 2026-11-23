"use client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import NativeSelect from "@mui/material/NativeSelect";
import OutlinedInput from "@mui/material/OutlinedInput";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { DiffQuery } from "@/graphql/types.generated";
import { formatDate } from "@/lib/edgar/periods";
import { formatChange, formatEps, formatMoney } from "@/lib/format";
import { useDiffQuery } from "@/store/api";
import { setCompareFrom } from "@/store/rewindSlice";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { figures } from "@/theme/theme";

type Revision = NonNullable<DiffQuery["company"]>["diff"]["revised"][number];

const fmt = (metric: string, v: number) => (metric === "EPS_DILUTED" ? formatEps(v) : formatMoney(v));

export function FilingLink({ filing, children }: { filing: { indexUrl: string; form: string; filed: string }; children?: React.ReactNode }) {
  return (
    <Link href={filing.indexUrl} target="_blank" rel="noreferrer" underline="hover" sx={{ whiteSpace: "nowrap" }}>
      {children ?? `${filing.form} · ${formatDate(filing.filed)}`}
    </Link>
  );
}

export function RevisionTable({ rows, showLag = true }: { rows: Revision[]; showLag?: boolean }) {
  return (
    <TableContainer>
      <Table size="small" aria-label="Revised figures" sx={{ minWidth: 720 }}>
        <TableHead>
          <TableRow>
            <TableCell>Line item</TableCell>
            <TableCell>Period</TableCell>
            <TableCell align="right">First reported</TableCell>
            <TableCell align="right">Later value</TableCell>
            <TableCell align="right">Change</TableCell>
            {showLag && <TableCell align="right">After</TableCell>}
            <TableCell>Filed in</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.metric}-${r.period}-${r.end}-${i}`} hover sx={{ "& td": { color: r.material && !r.likelySplit && !r.derived ? undefined : "text.secondary" } }}>
              <TableCell sx={{ fontWeight: 500 }}>
                {r.label}
                {r.likelySplit && <Chip size="small" label="split" sx={{ ml: 1 }} />}
                {!r.likelySplit && r.derived && (
                  <Tooltip title="Computed from other lines (for example operating cash flow − capex), so it moved because they did. Not counted as a revision.">
                    <Chip size="small" label="derived" variant="outlined" sx={{ ml: 1 }} />
                  </Tooltip>
                )}
                {!r.material && !r.likelySplit && !r.derived && <Chip size="small" label="minor" variant="outlined" sx={{ ml: 1 }} />}
              </TableCell>
              <TableCell sx={figures}>{r.periodLabel}</TableCell>
              <TableCell align="right" sx={figures}>
                <Box component="span" title={`${r.firstReported.form} filed ${formatDate(r.firstReported.filed)}`}>{fmt(r.metric, r.from)}</Box>
              </TableCell>
              <TableCell align="right" sx={{ ...figures, fontWeight: 600 }}>{fmt(r.metric, r.to)}</TableCell>
              <TableCell align="right" sx={figures}>
                <Box component="span" sx={{ color: (r.change ?? 0) < 0 ? "error.main" : "success.main" }}>{formatChange(r.change)}</Box>
              </TableCell>
              {showLag && <TableCell align="right" sx={figures}>{r.lagDays} d</TableCell>}
              <TableCell>
                <FilingLink filing={r.revisedIn} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/**
 * "What changed between two dates": pick an earlier filing date; every figure
 * whose in-force value differs between then and the as-of date is listed with
 * the filing that changed it, plus the figures that were new.
 */
export function DiffPanel({ ticker, filingDates }: { ticker: string; filingDates: string[] }) {
  const dispatch = useAppDispatch();
  const { asOf, compareFrom } = useAppSelector((s) => s.rewind);
  const to = asOf ?? new Date().toISOString().slice(0, 10);
  const earlier = filingDates.filter((d) => d < to);
  // A date from the URL need not be a filing date; keep it selectable so the control shows it.
  const options = compareFrom && !earlier.includes(compareFrom) ? [...earlier, compareFrom].sort() : earlier;
  const { data, isFetching, error } = useDiffQuery({ ticker, from: compareFrom ?? "", to }, { skip: !compareFrom });
  const diff = data?.company?.diff;
  const derivedCount = diff?.revised.filter((r) => r.derived && r.material && !r.likelySplit).length ?? 0;

  return (
    <Paper sx={{ p: 2 }} data-testid="diff-panel">
      <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, alignItems: { md: "center" }, mb: diff ? 2 : 0 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h3">What changed</Typography>
          <Typography variant="body2" color="text.secondary">
            Compare the figures known on {asOf ? formatDate(asOf) : "today"} with what had been filed on an earlier date.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel htmlFor="compare-from" shrink>
            Earlier date
          </InputLabel>
          <NativeSelect
            value={compareFrom ?? ""}
            onChange={(e) => dispatch(setCompareFrom(e.target.value || null))}
            input={<OutlinedInput label="Earlier date" notched />}
            inputProps={{ id: "compare-from" }}
            sx={figures}
          >
            <option value="">None</option>
            {[...options].reverse().map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </NativeSelect>
        </FormControl>
        {earlier.length > 4 && !compareFrom && (
          <Button size="small" variant="outlined" onClick={() => dispatch(setCompareFrom(earlier[Math.max(0, earlier.length - 5)]))}>
            One year back
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error">Couldn&apos;t load the comparison.</Alert>}
      {compareFrom && isFetching && !diff && <Skeleton variant="rounded" height={120} />}
      {diff && (
        <Stack spacing={2}>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
            <Chip color="secondary" label={`${diff.materialCount} material revision${diff.materialCount === 1 ? "" : "s"}`} data-testid="material-count" />
            {derivedCount > 0 && <Chip variant="outlined" label={`${derivedCount} derived`} />}
            <Chip variant="outlined" label={`${diff.revised.length - diff.materialCount - derivedCount} minor / split-adjusted`} />
            <Chip variant="outlined" label={`${diff.added.length} new figures`} />
            <Chip variant="outlined" label={`${diff.filingsBetween.length} filings between`} />
          </Stack>
          {diff.filingsBetween.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              <span>Filings {formatDate(diff.from)} → {formatDate(diff.to)}:</span>
              {diff.filingsBetween.map((f) => (
                <FilingLink key={f.accession} filing={f} />
              ))}
            </Typography>
          )}
          {diff.revised.length ? (
            <RevisionTable rows={diff.revised} showLag={false} />
          ) : (
            <Alert severity="success" variant="outlined">
              No figure known on {formatDate(diff.from)} was changed by {formatDate(diff.to)}.
            </Alert>
          )}
          {diff.added.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              New periods first filed in this window:{" "}
              {[...new Set(diff.added.map((a) => a.label))].join(", ")}.
            </Typography>
          )}
        </Stack>
      )}
    </Paper>
  );
}
