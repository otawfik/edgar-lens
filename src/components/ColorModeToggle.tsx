"use client";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useColorScheme } from "@mui/material/styles";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";

/** Toggles light/dark; the first visit follows the OS setting. */
export function ColorModeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolved = mode === "system" ? systemMode : mode;
  if (!resolved) {
    // Not mounted yet: keep the slot so the toolbar doesn't shift.
    return <IconButton disabled aria-hidden sx={{ visibility: "hidden" }}><DarkModeOutlinedIcon /></IconButton>;
  }
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <Tooltip title={`Switch to ${next} mode`}>
      <IconButton onClick={() => setMode(next)} aria-label={`Switch to ${next} mode`} data-testid="color-mode">
        {resolved === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
      </IconButton>
    </Tooltip>
  );
}
