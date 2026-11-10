"use client";
import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { formatDate } from "@/lib/edgar/periods";
import { setAsOf } from "@/store/rewindSlice";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { figures } from "@/theme/theme";

export interface FilingStop {
  filed: string;
  forms: string[];
}

/** Index of the stop in force on `asOf`: the last filing date <= asOf, or `stops.length` for "today". */
export function stopIndex(dates: readonly string[], asOf: string | null): number {
  if (!asOf) return dates.length;
  let i = -1;
  for (let k = 0; k < dates.length; k++) if (dates[k] <= asOf) i = k;
  return i;
}

/**
 * The time machine. One stop per filing date plus "today"; dragging re-queries
 * everything on the page as of that date. Redux holds the date, the URL
 * mirrors it, RTK Query caches each stop so scrubbing back is instant.
 */
export function DateScrubber({ stops, filings }: { stops: string[]; filings: { filed: string; form: string }[] }) {
  const dispatch = useAppDispatch();
  const asOf = useAppSelector((s) => s.rewind.asOf);
  const formsByDate = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const f of filings) m.set(f.filed, [...(m.get(f.filed) ?? []), f.form]);
    return m;
  }, [filings]);

  const max = stops.length;
  const index = stopIndex(stops, asOf);
  const before = index < 0;
  const value = before ? 0 : index;
  const select = (i: number) => dispatch(setAsOf(i >= max ? null : stops[i]));
  const label = (i: number) => (i >= max ? "Today" : formatDate(stops[i]));
  const years = useMemo(() => {
    const seen = new Set<string>();
    const marks: { value: number; label: string }[] = [];
    stops.forEach((d, i) => {
      const y = d.slice(0, 4);
      if (!seen.has(y) && (i === 0 || Number(y) % 2 === 0)) {
        seen.add(y);
        marks.push({ value: i, label: y });
      }
    });
    marks.push({ value: max, label: "Now" });
    return marks;
  }, [stops, max]);

  return (
    <Box data-testid="date-scrubber">
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { sm: "baseline" }, gap: 1, mb: 0.5 }}>
        <Typography variant="overline" color="text.secondary">
          As known on
        </Typography>
        <Typography component="div" sx={{ ...figures, fontSize: "1.35rem", fontWeight: 500 }} data-testid="as-of-label">
          {asOf ? (before ? `${formatDate(asOf)} — nothing filed yet` : formatDate(asOf)) : "Today (latest filings)"}
        </Typography>
        {asOf && !before && (
          <Stack direction="row" spacing={0.5}>
            {(formsByDate.get(stops[index]) ?? []).map((f, i) => (
              <Chip key={i} size="small" label={f} variant="outlined" />
            ))}
          </Stack>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Tooltip title="Previous filing">
            <span>
              <IconButton size="small" aria-label="Previous filing" disabled={value <= 0} onClick={() => select(value - 1)}>
                <ChevronLeftIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Next filing">
            <span>
              <IconButton size="small" aria-label="Next filing" disabled={index >= max} onClick={() => select(value + 1)}>
                <ChevronRightIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button size="small" variant={asOf ? "outlined" : "text"} disabled={!asOf} onClick={() => select(max)}>
            Jump to today
          </Button>
        </Stack>
      </Stack>
      <Box sx={{ px: 1 }}>
        <Slider
          value={value}
          min={0}
          max={max}
          step={1}
          marks={years}
          onChange={(_, v) => select(v as number)}
          valueLabelDisplay="auto"
          valueLabelFormat={label}
          getAriaValueText={label}
          aria-label="Filing date to rewind to"
          sx={{
            "& .MuiSlider-markLabel": { fontSize: "0.7rem", ...figures },
            "& .MuiSlider-mark": { width: 2, height: 6 },
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary">
        {stops.length} filing dates, {formatDate(stops[0])} to {formatDate(stops[stops.length - 1])}. Drag, or use ←/→ with
        the slider focused; every figure below re-renders as filed up to that date.
      </Typography>
    </Box>
  );
}
