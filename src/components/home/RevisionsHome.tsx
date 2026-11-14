"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
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
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useColorScheme } from "@mui/material/styles";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { BarChart } from "@mui/x-charts/BarChart";
import type { HomeQuery } from "@/graphql/types.generated";
import { formatDate } from "@/lib/edgar/periods";
import { formatChange, formatPercent } from "@/lib/format";
import { useHomeQuery } from "@/store/api";
import { SERIES, figures } from "@/theme/theme";
import { CompanySearch } from "../CompanySearch";
import { nullsLast } from "../nullsLast";

type Row = HomeQuery["revisionStats"]["companies"][number] & { id: string };

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
  const { data, isLoading, error } = useHomeQuery();
  const { mode, systemMode } = useColorScheme();
  const colors = (mode === "system" ? systemMode : mode) === "dark" ? SERIES.dark : SERIES.light;
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);

  const rows = useMemo<Row[]>(
    () => (data?.revisionStats.companies ?? []).filter((r) => !sectorFilter || r.sector === sectorFilter).map((r) => ({ ...r, id: r.ticker })),
    [data, sectorFilter],
  );

  const columns: GridColDef<Row>[] = [
    {
      field: "ticker",
      headerName: "Ticker",
      width: 90,
      renderCell: ({ row }) => (
        <Box component={Link} href={`/company/${row.ticker}`} sx={{ fontWeight: 700, color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
          {row.ticker}
        </Box>
      ),
    },
    { field: "name", headerName: "Company", flex: 1, minWidth: 180 },
    { field: "sector", headerName: "Sector", width: 190 },
    { field: "revised", headerName: "Revised", type: "number", width: 90, description: "Reported figures with a material later change" },
    { field: "figures", headerName: "Figures", type: "number", width: 90, description: "Reported (metric, period) figures in the snapshot" },
    {
      field: "rate",
      headerName: "Rate",
      type: "number",
      width: 90,
      valueFormatter: (v: number) => formatPercent(v),
      description: "Revised ÷ figures",
    },
    {
      field: "medianLagDays",
      headerName: "Median lag",
      type: "number",
      width: 110,
      getSortComparator: nullsLast,
      valueFormatter: (v: number | null) => (v === null ? "—" : `${Math.round(v)} d`),
      description: "Days from the first filing of a figure to the filing that changed it",
    },
    {
      field: "largest",
      headerName: "Largest change",
      flex: 1.2,
      minWidth: 260,
      sortable: false,
      valueGetter: (_v, row) => row.largest?.change ?? null,
      renderCell: ({ row }) =>
        row.largest ? (
          <span>
            {row.largest.label} {row.largest.periodLabel}{" "}
            <Box component="span" sx={{ ...figures, color: (row.largest.change ?? 0) < 0 ? "error.main" : "success.main" }}>
              {formatChange(row.largest.change)}
            </Box>
          </span>
        ) : (
          "—"
        ),
    },
  ];

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

      {error && <Alert severity="error">Couldn&apos;t load revision statistics.</Alert>}
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

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,1fr) minmax(0,1fr)" }, gap: 2.5 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h3">How long after the original filing</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Material changes by delay; most arrive with the next year&apos;s 10-K as a restated comparative.
              </Typography>
              <BarChart
                height={220}
                colors={[colors[0]]}
                xAxis={[{ scaleType: "band", data: data.revisionStats.lagBuckets.map((b) => b.label) }]}
                yAxis={[{ width: 48 }]}
                series={[{ data: data.revisionStats.lagBuckets.map((b) => b.changes), label: "Changes", valueFormatter: (v) => `${v} changes` }]}
                grid={{ horizontal: true }}
                borderRadius={3}
                hideLegend
                margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
              />
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
                        <TableCell>{m.label}</TableCell>
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

          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 1.5 }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h3">Revisions league table</Typography>
                <Typography variant="body2" color="text.secondary">
                  Every company, ranked by the share of its reported figures that a later filing changed. Click a ticker to rewind it.
                </Typography>
              </Box>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={sectorFilter ?? "all"}
                onChange={(_, v: string | null) => setSectorFilter(v && v !== "all" ? v : null)}
                aria-label="Sector"
                sx={{ flexWrap: "wrap" }}
              >
                <ToggleButton value="all" sx={{ textTransform: "none", px: 1.25, py: 0.5 }}>
                  All
                </ToggleButton>
                {data.revisionStats.sectors.map((s) => (
                  <ToggleButton key={s.sector} value={s.sector} sx={{ textTransform: "none", px: 1.25, py: 0.5 }}>
                    {s.sector} {formatPercent(s.rate, 0)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box sx={{ height: 560 }}>
              <DataGrid
                label="Revision league table"
                rows={rows}
                columns={columns}
                density="compact"
                disableRowSelectionOnClick
                initialState={{ sorting: { sortModel: [{ field: "rate", sort: "desc" }] }, pagination: { paginationModel: { pageSize: 25 } } }}
                pageSizeOptions={[25, 50, 100]}
                sx={{ "& .MuiDataGrid-cell--textRight": figures }}
              />
            </Box>
          </Paper>
        </>
      )}
    </Stack>
  );
}
