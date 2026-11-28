"use client";
import Link from "next/link";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useCompanyQuery } from "@/store/api";
import { resetRewind, setPeriod, type Period } from "@/store/rewindSlice";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { toggleWatch } from "@/store/watchlistSlice";
import { figures } from "@/theme/theme";
import { DateScrubber } from "./DateScrubber";
import { DiffPanel, RevisionTable } from "./DiffPanel";
import { LineItemTable } from "./LineItemTable";
import { MarginChart, MetricChart } from "./MetricChart";
import { RestatementTimeline } from "./RestatementTimeline";
import { useRewindUrl } from "./useRewindUrl";

const LAST = { annual: 10, quarterly: 12 } as const;

export function RewindView({ ticker }: { ticker: string }) {
  useRewindUrl();
  const dispatch = useAppDispatch();
  const { asOf, period } = useAppSelector((s) => s.rewind);
  const watched = useAppSelector((s) => s.watchlist.tickers.includes(ticker));
  const periodEnum = period === "quarterly" ? "QUARTERLY" : "ANNUAL";

  // Two reads: the as-of view and today's, so every figure can be compared
  // with what it became. With no as-of date they are the same cache entry.
  const asOfQ = useCompanyQuery({ ticker, period: periodEnum, asOf, last: LAST[period] });
  const latestQ = useCompanyQuery({ ticker, period: periodEnum, asOf: null, last: LAST[period] });
  const company = asOfQ.data?.company;
  const latest = latestQ.data?.company ?? undefined;
  const [showAllRevisions, setShowAllRevisions] = useState(false);

  if (asOfQ.isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="text" width={360} height={48} />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={320} />
      </Stack>
    );
  }
  if (asOfQ.error) return <Alert severity="error">Couldn&apos;t load {ticker}: {"message" in asOfQ.error ? asOfQ.error.message : "unknown error"}</Alert>;
  if (asOfQ.data && company === null) {
    return (
      <Alert severity="warning" action={<Button component={Link} href="/">Home</Button>}>
        No company with ticker <strong>{ticker}</strong> in this snapshot.
      </Alert>
    );
  }
  if (!company) return null;

  const empty = company.lineItems.length === 0;
  const revisions = company.revisions;
  const shownRevisions = showAllRevisions ? revisions : revisions.slice(0, 8);

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="h1" component="h1">
              {company.name}
            </Typography>
            <Chip label={company.ticker} size="small" sx={{ ...figures, fontWeight: 700 }} />
            <Tooltip title={watched ? "Remove from watchlist" : "Add to watchlist"}>
              <IconButton
                size="small"
                onClick={() => dispatch(toggleWatch(ticker))}
                aria-pressed={watched}
                aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
              >
                {watched ? <StarIcon color="secondary" /> : <StarBorderIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
            {company.sector} · {company.industry} · fiscal year ends{" "}
            {company.fiscalYearEnd ? `${company.fiscalYearEnd.slice(0, 2)}/${company.fiscalYearEnd.slice(2)}` : "—"} · CIK {company.cik} ·{" "}
            <MuiLink href={company.secUrl} target="_blank" rel="noreferrer">
              EDGAR filings
            </MuiLink>
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={period}
          onChange={(_, v: Period | null) => v && dispatch(setPeriod(v))}
          aria-label="Period"
        >
          <ToggleButton value="annual" sx={{ textTransform: "none", px: 1.5 }}>
            Fiscal years
          </ToggleButton>
          <ToggleButton value="quarterly" sx={{ textTransform: "none", px: 1.5 }}>
            Quarters
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Paper sx={{ p: 2 }}>
        <DateScrubber stops={company.filingDates} filings={company.filings} />
      </Paper>

      {empty ? (
        <Alert severity="info">
          {company.name} had not filed anything in this snapshot by that date. Move the scrubber forward or{" "}
          <MuiLink component="button" onClick={() => dispatch(resetRewind())} sx={{ verticalAlign: "baseline" }}>
            jump to today
          </MuiLink>
          .
        </Alert>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,3fr) minmax(0,2fr)" }, gap: 2.5 }}>
            <MetricChart asOfData={company} latestData={latest} asOf={asOf} period={period === "quarterly" ? "quarter" : "fiscal year"} />
            <MarginChart data={company} period={period === "quarterly" ? "quarter" : "fiscal year"} />
          </Box>
        </>
      )}

      <RestatementTimeline ticker={ticker} filingDates={company.filingDates} />
      <DiffPanel ticker={ticker} filingDates={company.filingDates} />

      {!empty && <LineItemTable asOfData={company} latestData={latest} asOf={asOf} />}

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "baseline", mb: 1 }}>
          <Typography variant="h3" sx={{ flexGrow: 1 }}>
            Revision log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {company.revisionCount} material change{company.revisionCount === 1 ? "" : "s"} to reported figures across all filings in the snapshot
            {company.revisionCount > revisions.length ? `; newest ${revisions.length} listed` : ""}
          </Typography>
        </Box>
        {revisions.length ? (
          <>
            <RevisionTable rows={shownRevisions} />
            {revisions.length > 8 && (
              <Button size="small" onClick={() => setShowAllRevisions((v) => !v)} sx={{ mt: 1 }}>
                {showAllRevisions ? "Show fewer" : `Show all ${revisions.length}`}
              </Button>
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            None of this company&apos;s reported figures changed materially between filings.
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}
