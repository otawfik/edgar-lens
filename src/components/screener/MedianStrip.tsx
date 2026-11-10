"use client";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { RATIOS, type RatioId } from "@/lib/finance/ratios";
import { formatRatio } from "@/lib/format";
import { selectFilteredMedians } from "@/store/selectors";
import { useAppSelector } from "@/store/store";
import { figures } from "@/theme/theme";

const TILES: RatioId[] = ["revenueGrowth", "operatingMargin", "fcfMargin", "roe"];

/** Headline numbers for whatever is on screen: count + medians. */
export function MedianStrip({ shown, total }: { shown: number; total: number }) {
  const medians = useAppSelector(selectFilteredMedians);
  return (
    <Box
      sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(5, 1fr)" }, gap: 1.5 }}
      aria-live="polite"
    >
      <Paper sx={{ p: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          Companies
        </Typography>
        <Typography sx={{ ...figures, fontSize: "1.4rem", fontWeight: 500 }} data-testid="shown-count">
          {shown}
          <Box component="span" sx={{ fontSize: "0.9rem", color: "text.secondary" }}>
            {" "}/ {total}
          </Box>
        </Typography>
      </Paper>
      {TILES.map((id) => (
        <Paper key={id} sx={{ p: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Median {RATIOS[id].label.toLowerCase()}
          </Typography>
          <Typography sx={{ ...figures, fontSize: "1.4rem", fontWeight: 500 }}>
            {formatRatio(medians[id], RATIOS[id].format)}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
}
