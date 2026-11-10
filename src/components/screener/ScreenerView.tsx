"use client";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TuneIcon from "@mui/icons-material/Tune";
import { useScreenerQuery } from "@/store/api";
import { hydrateScreener } from "@/store/screenerSlice";
import { selectActiveFilterCount, selectAllRows, selectFilteredRows } from "@/store/selectors";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/store";
import { parseScreener, serializeScreener } from "@/store/urlState";
import { useUrlState } from "../useUrlState";
import { FilterPanel } from "./FilterPanel";
import { MedianStrip } from "./MedianStrip";
import { ScreenerGrid } from "./ScreenerGrid";

export function ScreenerView() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { isLoading, error, data } = useScreenerQuery();
  const all = useAppSelector(selectAllRows);
  const rows = useAppSelector(selectFilteredRows);
  const active = useAppSelector(selectActiveFilterCount);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useUrlState(
    (search) => dispatch(hydrateScreener(parseScreener(search))),
    () => {
      const q = serializeScreener(store.getState().screener);
      if (q) window.history.replaceState(window.history.state, "", `/?${q}`);
    },
  );

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h1">US large-cap screener</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
            {data ? `${data.dataset.companies} companies, ${data.dataset.dataPoints.toLocaleString("en-US")} reported data points` : "Loading"}{" "}
            normalised from SEC XBRL filings. Ratios are for each company&apos;s latest fiscal year; click a row for
            trends, peer ranks and what changed in its latest filing.
          </Typography>
        </Box>
        <Button
          sx={{ display: { md: "none" } }}
          variant="outlined"
          startIcon={
            <Badge badgeContent={active} color="primary">
              <TuneIcon />
            </Badge>
          }
          onClick={() => setFiltersOpen(true)}
        >
          Filters
        </Button>
      </Box>

      {error && <Alert severity="error">Couldn&apos;t load the screener: {"message" in error ? error.message : "unknown error"}</Alert>}

      <MedianStrip shown={rows.length} total={all.length} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "280px minmax(0,1fr)" }, gap: 2.5, alignItems: "start" }}>
        <Paper sx={{ p: 2, display: { xs: "none", md: "block" }, position: "sticky", top: 80 }}>
          <FilterPanel />
        </Paper>
        <ScreenerGrid rows={rows} loading={isLoading} />
      </Box>

      <Drawer anchor="bottom" open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <Box sx={{ p: 2, maxHeight: "85vh", overflowY: "auto" }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Typography variant="h2" sx={{ flexGrow: 1 }}>
              Filters
            </Typography>
            <Button onClick={() => setFiltersOpen(false)}>Show {rows.length} companies</Button>
          </Box>
          <FilterPanel />
        </Box>
      </Drawer>
    </Stack>
  );
}
