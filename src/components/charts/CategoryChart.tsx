"use client";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import Box from "@mui/material/Box";
import { SERIES } from "@/theme/theme";
import { fraction, labelEvery, valueAxis } from "./scale";

export interface ChartSeries {
  id: string;
  label: string;
  /** One value per category; null leaves a gap. */
  values: (number | null)[];
}

interface Props {
  kind: "bar" | "line";
  /** Accessible name of the whole chart. */
  title: string;
  /** Category labels along the x axis (fiscal years or quarters). */
  labels: string[];
  series: ChartSeries[];
  height: number;
  /** Values in tooltips and in each category's accessible name. */
  format: (v: number | null) => string;
  /** Tick labels on the value axis; defaults to `format`. */
  axisFormat?: (v: number) => string;
  showLegend?: boolean;
}

const FONT = 11;
const CHAR = 6.4; // average glyph width at 11px, for sizing the axis gutter
const TOP = 10;
const BOTTOM = 24;
const FALLBACK_WIDTH = 640; // where layout cannot be measured (tests)

/** Width of the element in CSS pixels, tracked with a ResizeObserver. */
function useWidth() {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    setWidth(el.clientWidth || FALLBACK_WIDTH);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth || FALLBACK_WIDTH));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A bar from the zero line to its value, rounded only at the value end. */
function barPath(x: number, zero: number, end: number, w: number): string {
  const r = Math.min(3, w / 2, Math.abs(end - zero));
  const s = end < zero ? -1 : 1; // which way the bar grows in y: up for a positive value
  return `M${x},${zero}V${end - s * r}Q${x},${end} ${x + r},${end}H${x + w - r}Q${x + w},${end} ${x + w},${end - s * r}V${zero}Z`;
}

/**
 * A bar or line chart over categories, drawn as plain SVG: round ticks on the
 * value axis, a tooltip for the category under the pointer, and one tab stop
 * from which ←/→/Home/End walk the categories. Each category is exposed to
 * assistive technology as an image named with its values, so nothing is only
 * in the picture. Colours are CSS variables switched by the theme class, so
 * the chart never renders in the wrong scheme.
 */
export function CategoryChart({ kind, title, labels, series, height, format, axisFormat = format, showLegend = true }: Props) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const [tabStop, setTabStop] = useState(0);
  const groups = useRef<(SVGGElement | null)[]>([]);

  const n = labels.length;
  const axis = valueAxis(series.flatMap((s) => s.values), 5, kind === "bar");
  const tickLabels = axis.ticks.map(axisFormat);
  const left = Math.ceil(Math.max(...tickLabels.map((t) => t.length)) * CHAR) + 12;
  const right = kind === "line" ? 16 : 8;
  const plotW = Math.max(0, width - left - right);
  const plotH = height - TOP - BOTTOM;
  const band = n ? plotW / n : 0;
  const y = (v: number) => TOP + plotH * (1 - fraction(axis, v));
  const cx = (i: number) => left + band * (i + 0.5);
  const every = labelEvery(band, Math.max(...labels.map((l) => l.length), 1) * CHAR + 8);
  const current = Math.min(tabStop, Math.max(0, n - 1));

  const describe = (i: number) => `${labels[i]}: ${series.map((s) => `${s.label} ${format(s.values[i] ?? null)}`).join("; ")}`;

  const onKeyDown = (e: KeyboardEvent<SVGGElement>, i: number) => {
    if (e.key === "Escape") return setActive(null);
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (to === null || to < 0 || to >= n) return;
    e.preventDefault();
    setTabStop(to);
    groups.current[to]?.focus();
  };

  // Bars share the band; a lone series gets a narrower band so it is not a slab.
  const barW = Math.min(44, (band * (series.length > 1 ? 0.76 : 0.56)) / Math.max(1, series.length));
  const barX = (i: number, k: number) => cx(i) - (barW * series.length) / 2 + barW * k;

  /** Line segments, broken at missing values. */
  const linePath = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v !== null) d += `${pen ? "L" : "M"}${cx(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = v !== null;
    });
    return d;
  };
  const isolated = (values: (number | null)[], i: number) => values[i] !== null && (values[i - 1] ?? null) === null && (values[i + 1] ?? null) === null;

  return (
    <Box
      sx={(theme) => ({
        ...Object.fromEntries(SERIES.light.map((c, i) => [`--series-${i}`, c])),
        ...theme.applyStyles("dark", Object.fromEntries(SERIES.dark.map((c, i) => [`--series-${i}`, c]))),
      })}
    >
      <Box ref={ref} sx={{ position: "relative", height }} onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <Box
            component="svg"
            role="group"
            aria-label={title}
            width={width}
            height={height}
            sx={{
              display: "block",
              fontSize: FONT,
              "& text": { fill: "var(--mui-palette-text-secondary)" },
              "& .grid": { stroke: "var(--mui-palette-divider)" },
              "& .zero": { stroke: "var(--mui-palette-text-secondary)", strokeOpacity: 0.6 },
              "& .category": { outline: "none" },
              "& .hit": { fill: "transparent" },
              "& .category[data-active] .hit": { fill: "var(--mui-palette-action-hover)" },
              "& .category:focus-visible .hit": { stroke: "var(--mui-palette-primary-main)", strokeWidth: 2 },
            }}
          >
            <g aria-hidden>
              {axis.ticks.map((t, i) => (
                <g key={t}>
                  <line className={t === 0 && axis.min < 0 ? "zero" : "grid"} x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} />
                  <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                    {tickLabels[i]}
                  </text>
                </g>
              ))}
              {labels.map((label, i) =>
                // Count back from the newest period, so the latest label always shows.
                (n - 1 - i) % every === 0 ? (
                  <text key={label} x={cx(i)} y={height - 7} textAnchor="middle">
                    {label}
                  </text>
                ) : null,
              )}
              {kind === "line" &&
                series.map((s, k) => (
                  <path key={s.id} d={linePath(s.values)} fill="none" stroke={`var(--series-${k})`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ))}
            </g>
            {labels.map((label, i) => (
              <g
                key={label}
                ref={(el) => {
                  groups.current[i] = el;
                }}
                className="category"
                role="img"
                aria-label={describe(i)}
                tabIndex={i === current ? 0 : -1}
                data-active={active === i || undefined}
                onMouseEnter={() => setActive(i)}
                onFocus={() => {
                  setActive(i);
                  setTabStop(i);
                }}
                onBlur={() => setActive(null)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <rect className="hit" x={left + band * i + 1} y={TOP} width={Math.max(0, band - 2)} height={plotH} rx={3} />
                {series.map((s, k) => {
                  const v = s.values[i];
                  if (v === null || v === undefined) return null;
                  if (kind === "bar") return <path key={s.id} d={barPath(barX(i, k), y(0), y(v), Math.max(1, barW - 2))} fill={`var(--series-${k})`} />;
                  // Lines carry no marks, except where a point has no neighbours or is being read.
                  return active === i || isolated(s.values, i) ? (
                    <circle key={s.id} cx={cx(i)} cy={y(v)} r={active === i ? 4 : 2.5} fill={`var(--series-${k})`} stroke="var(--mui-palette-background-paper)" strokeWidth={active === i ? 1.5 : 0} />
                  ) : null;
                })}
              </g>
            ))}
          </Box>
        )}
        {active !== null && active < n && (
          <Box
            aria-hidden
            data-testid="chart-tooltip"
            sx={{
              position: "absolute",
              top: 0,
              // Beside the category, on whichever side has room, so it never covers what it describes.
              ...(cx(active) > width / 2 ? { right: width - cx(active) + band / 2 + 6 } : { left: cx(active) + band / 2 + 6 }),
              zIndex: 1,
              pointerEvents: "none",
              px: 1.25,
              py: 1,
              borderRadius: 1,
              border: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
              boxShadow: 3,
              fontSize: "0.75rem",
              whiteSpace: "nowrap",
            }}
          >
            <Box sx={{ fontWeight: 600, mb: 0.25 }}>{labels[active]}</Box>
            {series.map((s, k) => (
              <Box key={s.id} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Swatch index={k} line={kind === "line"} />
                <Box component="span" sx={{ color: "text.secondary", flexGrow: 1, pr: 1.5 }}>
                  {s.label}
                </Box>
                <Box component="span" sx={{ fontFamily: "var(--font-mono), ui-monospace, monospace", fontVariantNumeric: "tabular-nums" }}>
                  {format(s.values[active] ?? null)}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
      {showLegend && (
        <Box component="ul" aria-label="Series" sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: 2, rowGap: 0.25, m: 0, mt: 0.5, p: 0, listStyle: "none", fontSize: "0.75rem", color: "text.secondary" }}>
          {series.map((s, k) => (
            <Box component="li" key={s.id} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Swatch index={k} line={kind === "line"} />
              {s.label}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function Swatch({ index, line }: { index: number; line: boolean }) {
  return <Box component="span" aria-hidden sx={{ flex: "none", width: 12, height: line ? 3 : 10, borderRadius: line ? 1 : 0.5, bgcolor: `var(--series-${index})` }} />;
}
