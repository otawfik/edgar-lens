"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { MAX_COMPARE, clearCompare, toggleCompare } from "@/store/compareSlice";
import { serializeCompare } from "@/store/urlState";
import { useAppDispatch, useAppSelector } from "@/store/store";

/** Floating bar listing the compare set, everywhere except the compare page. */
export function CompareTray() {
  const pathname = usePathname();
  const compare = useAppSelector((s) => s.compare);
  const dispatch = useAppDispatch();
  if (!compare.tickers.length || pathname === "/compare") return null;
  return (
    <Paper
      role="region"
      aria-label="Compare set"
      elevation={0}
      sx={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 16,
        zIndex: (t) => t.zIndex.appBar,
        px: 2,
        py: 1.25,
        width: "min(720px, calc(100vw - 32px))",
        boxShadow: "0 8px 30px rgba(0,0,0,.18)",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mr: 0.5 }}>
          Compare {compare.tickers.length}/{MAX_COMPARE}
        </Typography>
        {compare.tickers.map((t) => (
          <Chip key={t} label={t} size="small" onDelete={() => dispatch(toggleCompare(t))} />
        ))}
        <Stack direction="row" spacing={1} sx={{ ml: "auto !important" }}>
          <Button size="small" color="inherit" onClick={() => dispatch(clearCompare())}>
            Clear
          </Button>
          <Button
            size="small"
            variant="contained"
            component={Link}
            href={`/compare?${serializeCompare(compare)}`}
            disabled={compare.tickers.length < 2}
          >
            Compare
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
