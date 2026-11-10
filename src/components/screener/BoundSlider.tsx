"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import { RATIOS, type RatioId } from "@/lib/finance/ratios";
import { formatRatio } from "@/lib/format";
import { setBound, type Bound } from "@/store/screenerSlice";
import { useAppDispatch } from "@/store/store";
import { figures } from "@/theme/theme";

/** Describe a bound in words: "Any", "≥ 20.0%", "≤ 0.50×", "10.0% – 40.0%". */
export function describeBound(id: RatioId, b: Bound | undefined): string {
  const f = (v: number) => formatRatio(v, RATIOS[id].format);
  if (!b || (b.min === undefined && b.max === undefined)) return "Any";
  if (b.min !== undefined && b.max !== undefined) return `${f(b.min)} – ${f(b.max)}`;
  return b.min !== undefined ? `≥ ${f(b.min)}` : `≤ ${f(b.max!)}`;
}

/**
 * A range slider over a ratio. Thumbs parked at either end of the domain mean
 * "unbounded" on that side, so the full range is "Any". Redux is only updated
 * when a drag is committed, keeping the grid from re-filtering 60×/second.
 */
export function BoundSlider({
  id,
  domain,
  step,
  bound,
}: {
  id: RatioId;
  domain: [number, number];
  step: number;
  bound: Bound | undefined;
}) {
  const dispatch = useAppDispatch();
  // The parent keys this component on the bound, so external changes
  // (presets, reset, URL hydration) remount it with fresh local state.
  const [value, setValue] = useState<[number, number]>(() => [
    bound?.min ?? domain[0],
    bound?.max ?? domain[1],
  ]);

  const toBound = ([lo, hi]: [number, number]): Bound | null => {
    const b: Bound = {};
    if (lo > domain[0]) b.min = Number(lo.toFixed(4));
    if (hi < domain[1]) b.max = Number(hi.toFixed(4));
    return b.min === undefined && b.max === undefined ? null : b;
  };
  const def = RATIOS[id];
  const labelId = `bound-${id}`;
  const live = toBound(value) ?? undefined;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Typography id={labelId} variant="body2" sx={{ fontWeight: 500 }}>
          {def.label}
        </Typography>
        <Typography variant="caption" color={live ? "primary" : "text.secondary"} sx={figures}>
          {describeBound(id, live)}
        </Typography>
      </Box>
      <Slider
        size="small"
        value={value}
        min={domain[0]}
        max={domain[1]}
        step={step}
        disableSwap
        onChange={(_, v) => setValue(v as [number, number])}
        onChangeCommitted={(_, v) => dispatch(setBound({ ratio: id, bound: toBound(v as [number, number]) }))}
        getAriaLabel={(i) => `${def.label} ${i === 0 ? "minimum" : "maximum"}`}
        getAriaValueText={(v, i) =>
          (i === 0 && v <= domain[0]) || (i === 1 && v >= domain[1]) ? "no limit" : formatRatio(v, def.format)
        }
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => formatRatio(v, def.format)}
        aria-labelledby={labelId}
      />
    </Box>
  );
}
