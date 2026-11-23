"use client";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import MuiLink from "@mui/material/Link";
import type { HomeQuery } from "@/graphql/types.generated";
import { formatDate } from "@/lib/edgar/periods";
import { formatChange, formatPercent } from "@/lib/format";
import { useHomeQuery } from "@/store/api";
import { fromEnum } from "@/lib/enums";
import { figures } from "@/theme/theme";
import { CompanySearch } from "../CompanySearch";

type Stats = HomeQuery["revisionStats"];

const TOP = 10;

/** Four numbers do not need a charting library: one bar per delay bucket, scaled to the largest. */
function LagBars({ buckets }: { buckets: Stats["lagBuckets"] }) {
  const max = Math.max(1, ...buckets.map((b) => b.changes));
  return (
    <Table size="small" aria-label="Material changes by delay after the original filing" sx={{ "& td, & th": { borderBottom: 0, py: 0.75 } }}>
      <TableBody>
        {buckets.map((b) => (
          <TableRow key={b.label}>
            <TableCell component="th" scope="row" sx={{ whiteSpace: "nowrap", width: "1%", pl: 0, fontWeight: 400 }}>
              {b.label}
            </TableCell>
            <TableCell aria-hidden sx={{ px: 1 }}>
              <Box sx={{ width: `${(b.changes / max) * 100}%`, minWidth: 2, height: 18, borderRadius: 0.5, bgcolor: "primary.main" }} />
            </TableCell>
            <TableCell align="right" sx={{ ...figures, width: "1%", pr: 0 }}>
              {b.changes.toLocaleString("en-US")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ ...figures, fontSize: "1.6rem", fontWeight: 500, lineHeight: 1.2 }}>{value}</Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

export function RevisionsHome() {
  const { data, isLoading, error, refetch } = useHomeQuery();

  return (
    <Stack spacing={3}>
      <Box sx={{ py: { xs: 2, md: 4 }, maxWidth: 820 }}>
        <Typography variant="h1" component="h1" sx={{ fontSize: { xs: "1.9rem", md: "2.5rem" }, mb: 1.5 }}>
          Rewind any company&apos;s financials to what was known on any past date
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3, fontSize: "1.05rem" }}>
          Every figure in a 10-K or 10-Q can be quietly changed in a later filing. EDGAR Lens keeps each value&apos;s
          history, shows a company&apos;s statements as they stood on any filing date, and lists exactly which numbers
          were revised, by how much, and where.
        </Typography>
        <CompanySearch autoFocus size="medium" />
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 2 }}>
          {[
            ["GE", "GE — a decade of divestiture restatements"],
            ["IBM", "IBM — FY2019 revenue after the Kyndryl spin"],
            ["AAPL", "AAPL — a clean record"],
          ].map(([t, label]) => (
            <Chip key={t} component={Link} href={`/company/${t}?asOf=2019-06-30`} clickable label={label} variant="outlined" />
          ))}
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
          Couldn&apos;t load revision statistics.
        </Alert>
      )}
      {isLoading && <Skeleton variant="rounded" height={120} />}

      {data && (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(5, 1fr)" }, gap: 1.5 }}>
            <Stat label="Companies" value={String(data.dataset.companies)} hint={`${data.dataset.filings.toLocaleString("en-US")} 10-K/10-Q filings`} />
            <Stat label="Reported figures" value={data.dataset.figures.toLocaleString("en-US")} hint={`${data.dataset.vintages.toLocaleString("en-US")} distinct values over time`} />
            <Stat label="Later changed" value={formatPercent(data.revisionStats.rate)} hint={`${data.revisionStats.revised.toLocaleString("en-US")} figures, ${data.revisionStats.revisedTwice} of them twice`} />
            <Stat label="Median lag" value={data.revisionStats.medianLagDays === null ? "—" : `${Math.round(data.revisionStats.medianLagDays)} days`} hint="first filing → the filing that changed it" />
            <Stat label="Filings span" value={`${data.dataset.earliestFiled.slice(0, 4)}–${data.dataset.latestFiled.slice(0, 4)}`} hint={`latest ${formatDate(data.dataset.latestFiled)}`} />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,1fr) minmax(0,1fr)" }, gap: 2.5, alignItems: "start" }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h3">How long after the original filing</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Material changes by delay; most arrive with the next year&apos;s 10-K as a restated comparative.
              </Typography>
              <LagBars buckets={data.revisionStats.lagBuckets} />
              <Typography variant="caption" color="text.secondary">
                Carried in: {data.revisionStats.byForm.map((f) => `${f.form} ${f.changes}`).join(" · ")}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h3" sx={{ mb: 1 }}>
                Which line items get revised
              </Typography>
              <TableContainer>
                <Table size="small" aria-label="Revision rate by line item">
                  <TableHead>
                    <TableRow>
                      <TableCell>Line item</TableCell>
                      <TableCell align="right">Revised</TableCell>
                      <TableCell align="right">Figures</TableCell>
                      <TableCell align="right">Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.revisionStats.metrics.slice(0, 9).map((m) => (
                      <TableRow key={m.metric}>
                        <TableCell component="th" scope="row" sx={{ fontWeight: 400 }}>
                          <MuiLink component={Link} href={`/screener?item=${fromEnum(m.metric)}`} prefetch={false} underline="hover" color="inherit">
                            {m.label}
                          </MuiLink>
                        </TableCell>
                        <TableCell align="right" sx={figures}>{m.revised}</TableCell>
                        <TableCell align="right" sx={figures}>{m.figures}</TableCell>
                        <TableCell align="right" sx={figures}>{formatPercent(m.rate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,3fr) minmax(0,2fr)" }, gap: 2.5, alignItems: "start" }}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 1 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h3">Who revises most</Typography>
                  <Typography variant="body2" color="text.secondary">
                    The {TOP} companies with the largest share of reported figures changed by a later filing.
                  </Typography>
                </Box>
                <Button component={Link} href="/screener" variant="outlined" size="small">
                  Screen all {data.revisionStats.companies.length} companies
                </Button>
              </Box>
              <TableContainer>
                <Table size="small" aria-label="Most-revised companies">
                  <TableHead>
                    <TableRow>
                      <TableCell>Ticker</TableCell>
                      <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Company</TableCell>
                      <TableCell align="right">Changed</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Largest change</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.revisionStats.companies.slice(0, TOP).map((r) => (
                      <TableRow key={r.ticker}>
                        <TableCell component="th" scope="row">
                          <Box component={Link} href={`/company/${r.ticker}`} sx={{ fontWeight: 700, color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                            {r.ticker}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{r.name}</TableCell>
                        <TableCell align="right" sx={{ ...figures, whiteSpace: "nowrap" }}>
                          {r.revised} of {r.figures}
                        </TableCell>
                        <TableCell align="right" sx={figures}>{formatPercent(r.rate)}</TableCell>
                        <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                          {r.largest ? (
                            <>
                              {r.largest.label} {r.largest.periodLabel}{" "}
                              <Box component="span" sx={{ ...figures, color: (r.largest.change ?? 0) < 0 ? "error.main" : "success.main" }}>
                                {formatChange(r.largest.change)}
                              </Box>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h3" sx={{ mb: 1 }}>
                By sector
              </Typography>
              <TableContainer>
                <Table size="small" aria-label="Revision rate by sector">
                  <TableHead>
                    <TableRow>
                      <TableCell>Sector</TableCell>
                      <TableCell align="right">Companies</TableCell>
                      <TableCell align="right">Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.revisionStats.sectors.map((s) => (
                      <TableRow key={s.sector}>
                        <TableCell component="th" scope="row" sx={{ fontWeight: 400 }}>
                          <MuiLink component={Link} href={`/screener?sector=${encodeURIComponent(s.sector)}`} prefetch={false} underline="hover" color="inherit">
                            {s.sector}
                          </MuiLink>
                        </TableCell>
                        <TableCell align="right" sx={figures}>{s.companies}</TableCell>
                        <TableCell align="right" sx={figures}>{formatPercent(s.rate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        </>
      )}
    </Stack>
  );
}
