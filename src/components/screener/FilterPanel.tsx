"use client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import { SECTORS } from "@/lib/universe";
import {
  PRESETS,
  applyPreset,
  resetFilters,
  setSearch,
  setWatchlistOnly,
  toggleSector,
} from "@/store/screenerSlice";
import { selectActiveFilterCount, selectSectorCounts } from "@/store/selectors";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { BoundSlider } from "./BoundSlider";
import { FILTER_RATIOS } from "./ratioColumns";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Typography component="legend" variant="overline" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export function FilterPanel() {
  const dispatch = useAppDispatch();
  const s = useAppSelector((st) => st.screener);
  const counts = useAppSelector(selectSectorCounts);
  const active = useAppSelector(selectActiveFilterCount);
  const watchCount = useAppSelector((st) => st.watchlist.tickers.length);

  return (
    <Stack spacing={2.5} component="form" role="search" aria-label="Screener filters" onSubmit={(e) => e.preventDefault()}>
      <TextField
        size="small"
        label="Search ticker or name"
        value={s.search}
        onChange={(e) => dispatch(setSearch(e.target.value))}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <Section title="Presets">
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {PRESETS.map((p) => (
            <Tooltip key={p.id} title={p.description} describeChild>
              <Chip label={p.label} variant="outlined" onClick={() => dispatch(applyPreset(p.id))} />
            </Tooltip>
          ))}
        </Stack>
      </Section>

      <Section title="Sector">
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
      </Section>

      <Section title="Latest fiscal year">
        <Stack spacing={1}>
          {FILTER_RATIOS.map((r) => (
            <BoundSlider
              key={`${r.id}:${s.bounds[r.id]?.min ?? ""}:${s.bounds[r.id]?.max ?? ""}`}
              id={r.id} domain={r.domain} step={r.step} bound={s.bounds[r.id]} />
          ))}
        </Stack>
      </Section>

      <Divider />
      <FormControlLabel
        control={
          <Switch
            checked={s.watchlistOnly}
            onChange={(e) => dispatch(setWatchlistOnly(e.target.checked))}
            disabled={watchCount === 0 && !s.watchlistOnly}
          />
        }
        label={`Watchlist only (${watchCount})`}
      />
      <Button variant="outlined" color="inherit" onClick={() => dispatch(resetFilters())} disabled={active === 0}>
        Reset filters{active ? ` (${active})` : ""}
      </Button>
    </Stack>
  );
}
