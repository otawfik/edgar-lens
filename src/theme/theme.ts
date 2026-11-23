"use client";
import { createTheme } from "@mui/material/styles";

/**
 * "Ledger" theme: deep green ink and brass on warm paper, a near-black green
 * at night. Figures use IBM Plex Mono with tabular numerals so columns of
 * numbers line up. Both schemes are emitted as CSS variables and switched with
 * a class on <html>, so there is no flash of the wrong theme on load.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#0F5B4A", light: "#3E8572", dark: "#0A3F33", contrastText: "#FFFFFF" },
        secondary: { main: "#9A5F12", contrastText: "#FFFFFF" },
        success: { main: "#1E7A43" },
        error: { main: "#B3261E" },
        warning: { main: "#9A5F12" },
        background: { default: "#F4F3EE", paper: "#FFFFFF" },
        text: { primary: "#17201C", secondary: "#4D5A54" },
        divider: "rgba(23, 32, 28, 0.12)",
      },
    },
    dark: {
      palette: {
        primary: { main: "#5CC8A8", light: "#8EDCC3", dark: "#2E9A7B", contrastText: "#06120E" },
        secondary: { main: "#E3AA55", contrastText: "#140C02" },
        success: { main: "#6FCF8F" },
        error: { main: "#F2847B" },
        warning: { main: "#E3AA55" },
        background: { default: "#0C1311", paper: "#131C19" },
        text: { primary: "#E4EBE8", secondary: "#A9B7B1" },
        divider: "rgba(228, 235, 232, 0.12)",
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    h1: { fontSize: "1.75rem", fontWeight: 650, letterSpacing: "-0.01em" },
    h2: { fontSize: "1.25rem", fontWeight: 650 },
    h3: { fontSize: "1.05rem", fontWeight: 600 },
    overline: { fontWeight: 600, letterSpacing: "0.08em" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      defaultProps: { variant: "outlined" },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 500 } },
    },
    MuiToggleButton: {
      // The default unselected colour (54% black) is 4.47:1 on the page ground.
      styleOverrides: { root: { color: "var(--mui-palette-text-secondary)" } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
  },
});

/** Tabular figures for any element showing numbers. */
export const figures = {
  fontFamily: "var(--font-mono), ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
} as const;

/**
 * Categorical series colours, in fixed order: ledger green, brass, slate blue,
 * then two quieter slots. The first three are the only ones any chart uses
 * together; they differ in lightness as well as hue, and each clears 3:1
 * against its paper (light 8.0 / 3.7 / 5.0, dark 8.5 / 8.4 / 7.9).
 */
export const SERIES = {
  light: ["#0F5B4A", "#C2731A", "#4C6FB0", "#8A5A9E", "#7A8B84"],
  dark: ["#5CC8A8", "#E3AA55", "#8FB0EA", "#C59BD6", "#A9B7B1"],
} as const;
