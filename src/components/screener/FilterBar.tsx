"use client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { MetricId } from "@/lib/edgar/metricIds";
import type { LagFilter } from "@/lib/edgar/revisionScreen";
import type { PeriodType } from "@/lib/edgar/snapshot";
import { SECTORS } from "@/lib/universe";
import {
  resetFilters,
  setLag,
  setMetric,
  setPeriod,
  setSearch,
  setWatchlistOnly,
  toggleSector,
} from "@/store/screenerSlice";
import { selectActiveFilterCount, selectMetricOptions, selectSectorCounts } from "@/store/selectors";
import { useAppDispatch, useAppSelector } from "@/store/store";

const toggle = { textTransform: "none", px: 1.25, py: 0.5 } as const;

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Typography component="legend" variant="overline" color="text.secondary" sx={{ display: "block", p: 0, mb: 0.5, lineHeight: 1.6 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

/** The question being asked: which figures, and how late a change still counts. */
export function FilterBar() {
  const dispatch = useAppDispatch();
  const s = useAppSelector((st) => st.screener);
  const metrics = useAppSelector(selectMetricOptions);
  const counts = useAppSelector(selectSectorCounts);
  const active = useAppSelector(selectActiveFilterCount);
  const watchCount = useAppSelector((st) => st.watchlist.tickers.length);

  return (
    <Stack spacing={2} component="form" role="search" aria-label="Screener filters" onSubmit={(e) => e.preventDefault()}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-end" }}>
        <TextField
          select
          size="small"
          label="Line item"
          value={s.metric ?? ""}
          onChange={(e) => dispatch(setMetric((e.target.value || null) as MetricId | null))}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          sx={{ minWidth: 220, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}
        >
          <option value="">All line items</option>
          {/* Keep a line item from the URL selectable while the list is still loading. */}
          {s.metric && !metrics.some((m) => m.id === s.metric) && <option value={s.metric}>{s.metric}</option>}
          {metrics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </TextField>
        <Group label="Figures">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={s.period ?? "all"}
            onChange={(_, v: PeriodType | "all" | null) => v && dispatch(setPeriod(v === "all" ? null : v))}
            aria-label="Figures"
          >
            <ToggleButton value="all" sx={toggle}>All</ToggleButton>
            <ToggleButton value="annual" sx={toggle}>Fiscal years</ToggleButton>
            <ToggleButton value="quarterly" sx={toggle}>Quarters</ToggleButton>
          </ToggleButtonGroup>
        </Group>
        <Group label="Changed">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={s.lag}
            onChange={(_, v: LagFilter | null) => v && dispatch(setLag(v))}
            aria-label="Changed"
          >
            <ToggleButton value="any" sx={toggle}>At any time</ToggleButton>
            <ToggleButton value="within1y" sx={toggle}>Within a year</ToggleButton>
            <ToggleButton value="after1y" sx={toggle}>Over a year later</ToggleButton>
          </ToggleButtonGroup>
        </Group>
        <TextField
          size="small"
          label="Ticker or name"
          value={s.search}
          onChange={(e) => dispatch(setSearch(e.target.value))}
          sx={{ minWidth: 180, flex: { xs: "1 1 100%", sm: "0 1 220px" } }}
        />
      </Box>

      <Group label="Sector">
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
          {SECTORS.map((sector) => {
            const selected = s.sectors.includes(sector);
            return (
              <Chip
                key={sector}
                size="small"
                label={`${sector} · ${counts.get(sector) ?? 0}`}
                color={selected ? "primary" : "default"}
                variant={selected ? "filled" : "outlined"}
                onClick={() => dispatch(toggleSector(sector))}
                aria-pressed={selected}
              />
            );
          })}
        </Stack>
      </Group>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={s.watchlistOnly}
              onChange={(e) => dispatch(setWatchlistOnly(e.target.checked))}
              disabled={watchCount === 0 && !s.watchlistOnly}
            />
          }
          label={`Watchlist only (${watchCount})`}
          sx={{ ml: 0, gap: 0.5 }}
        />
        <Button size="small" variant="outlined" color="inherit" onClick={() => dispatch(resetFilters())} disabled={active === 0}>
          Reset{active ? ` (${active})` : ""}
        </Button>
      </Box>
    </Stack>
  );
}
