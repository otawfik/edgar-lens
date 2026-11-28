"use client";
import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { CompanyQuery, Metric } from "@/graphql/types.generated";
import { formatDate } from "@/lib/edgar/periods";
import { formatEps, formatMoney, formatPercent } from "@/lib/format";
import { CategoryChart } from "../charts/CategoryChart";

type Company = NonNullable<CompanyQuery["company"]>;
/** How the x axis is described to a screen reader. */
type PeriodName = "fiscal year" | "quarter";

const CHOICES: { metric: Metric; label: string }[] = [
  { metric: "REVENUE", label: "Revenue" },
  { metric: "OPERATING_INCOME", label: "Operating income" },
  { metric: "NET_INCOME", label: "Net income" },
  { metric: "OPERATING_CASH_FLOW", label: "Operating cash flow" },
  { metric: "FREE_CASH_FLOW", label: "Free cash flow" },
  { metric: "EPS_DILUTED", label: "Diluted EPS" },
];

/**
 * One metric, two vintages: bars for the values known on the as-of date and,
 * when rewound, a second series for what the same periods say today — the gap
 * between them is the restatement.
 */
export function MetricChart({ asOfData, latestData, asOf, period }: { asOfData: Company; latestData: Company | undefined; asOf: string | null; period: PeriodName }) {
  const available = CHOICES.filter((c) => asOfData.lineItems.some((li) => li.metric === c.metric && li.points.length));
  const [metric, setMetric] = useState<Metric>("REVENUE");
  const chosen = available.find((c) => c.metric === metric) ?? available[0];
  if (!chosen) return null;
  const isEps = chosen.metric === "EPS_DILUTED";
  const fmt = (v: number | null) => (isEps ? formatEps(v) : formatMoney(v));

  const asOfPoints = asOfData.lineItems.find((li) => li.metric === chosen.metric)?.points ?? [];
  const latestPoints = latestData?.lineItems.find((li) => li.metric === chosen.metric)?.points ?? [];
  const labels = asOfPoints.map((p) => p.label);
  const latestByEnd = new Map(latestPoints.map((p) => [p.end, p.value]));
  const nowSeries = asOf ? asOfPoints.map((p) => latestByEnd.get(p.end) ?? null) : null;
  const changed = nowSeries ? nowSeries.filter((v, i) => v !== null && v !== asOfPoints[i].value).length : 0;

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1 }}>
        <Typography variant="h3" sx={{ flexGrow: 1 }}>
          {chosen.label}
          {asOf && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {changed ? `${changed} of ${labels.length} periods later changed` : "no period later changed"}
            </Typography>
          )}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={chosen.metric}
          onChange={(_, v: Metric | null) => v && setMetric(v)}
          aria-label="Metric to chart"
          sx={{ flexWrap: "wrap" }}
        >
          {available.map((c) => (
            <ToggleButton key={c.metric} value={c.metric} sx={{ px: 1.25, py: 0.5, textTransform: "none" }}>
              {c.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <CategoryChart
        kind="bar"
        title={`${chosen.label} by ${period}${asOf ? `, as known on ${formatDate(asOf)} and as reported today` : ""}`}
        height={300}
        labels={labels}
        format={fmt}
        showLegend={!!asOf}
        series={[
          { id: "asOf", label: asOf ? `As known on ${formatDate(asOf)}` : "As reported", values: asOfPoints.map((p) => p.value) },
          ...(nowSeries ? [{ id: "now", label: "As reported today", values: nowSeries }] : []),
        ]}
      />
    </Paper>
  );
}

const RATIO_SERIES: { key: "operatingMargin" | "netMargin" | "fcfMargin" | "efficiencyRatio"; label: string }[] = [
  { key: "operatingMargin", label: "Operating margin" },
  { key: "netMargin", label: "Net margin" },
  { key: "fcfMargin", label: "FCF margin" },
  { key: "efficiencyRatio", label: "Efficiency ratio" },
];

export function MarginChart({ data, period }: { data: Company; period: PeriodName }) {
  const series = RATIO_SERIES.filter((r) => data[r.key].some((p) => p.value !== null));
  if (!series.length) return null;
  const labels = data[series[0].key].map((p) => p.label);
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h3" sx={{ mb: 1 }}>
        Margins
      </Typography>
      <CategoryChart
        kind="line"
        title={`Margins by ${period}`}
        height={260}
        labels={labels}
        format={(v) => formatPercent(v)}
        axisFormat={(v) => formatPercent(v, 0)}
        series={series.map((r) => ({ id: r.key, label: r.label, values: data[r.key].map((p) => p.value) }))}
      />
    </Paper>
  );
}
