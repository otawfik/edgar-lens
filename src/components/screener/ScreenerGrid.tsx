"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { DataGrid, type GridColDef, type GridSortModel } from "@mui/x-data-grid";
import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { formatDate } from "@/lib/edgar/periods";
import { RATIOS } from "@/lib/finance/ratios";
import { formatMoney, formatRatio } from "@/lib/format";
import { MAX_COMPARE, toggleCompare } from "@/store/compareSlice";
import { setSort, initialScreenerState, type SortField } from "@/store/screenerSlice";
import type { ScreenerRow } from "@/store/selectors";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { toggleWatch } from "@/store/watchlistSlice";
import { figures } from "@/theme/theme";
import { nullsLast } from "../nullsLast";
import { GRID_RATIOS } from "./ratioColumns";

const num = { type: "number" as const, getSortComparator: nullsLast, headerAlign: "right" as const, align: "right" as const };

export function ScreenerGrid({ rows, loading }: { rows: ScreenerRow[]; loading: boolean }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const sort = useAppSelector((s) => s.screener.sort);
  const watch = useAppSelector((s) => s.watchlist.tickers);
  const compare = useAppSelector((s) => s.compare.tickers);
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const tablet = useMediaQuery(theme.breakpoints.down("lg"));

  const columns = useMemo<GridColDef<ScreenerRow>[]>(() => {
    const watched = new Set(watch);
    const comparing = new Set(compare);
    return [
      {
        field: "watch",
        headerName: "",
        width: 48,
        sortable: false,
        disableColumnMenu: true,
        renderHeader: () => <span className="sr-only" style={{ position: "absolute", left: -9999 }}>Watch</span>,
        renderCell: ({ row }) => {
          const on = watched.has(row.ticker);
          return (
            <IconButton
              size="small"
              aria-label={on ? `Remove ${row.ticker} from watchlist` : `Add ${row.ticker} to watchlist`}
              aria-pressed={on}
              onClick={(e) => {
                e.stopPropagation();
                dispatch(toggleWatch(row.ticker));
              }}
            >
              {on ? <StarIcon fontSize="small" color="secondary" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          );
        },
      },
      {
        field: "ticker",
        headerName: "Ticker",
        width: 92,
        renderCell: ({ row }) => (
          <Box
            component={Link}
            href={`/company/${row.ticker}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            sx={{ fontWeight: 700, color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          >
            {row.ticker}
          </Box>
        ),
      },
      { field: "name", headerName: "Company", flex: 1, minWidth: 170 },
      { field: "sector", headerName: "Sector", width: 180 },
      {
        field: "revenue",
        headerName: "Revenue",
        width: 104,
        ...num,
        valueFormatter: (v: number | null) => formatMoney(v),
      },
      ...GRID_RATIOS.map<GridColDef<ScreenerRow>>((id) => ({
        field: id,
        headerName: RATIOS[id].short,
        description: `${RATIOS[id].label} (latest fiscal year). ${RATIOS[id].description}`,
        width: 96,
        ...num,
        valueFormatter: (v: number | null) => formatRatio(v, RATIOS[id].format),
      })),
      {
        field: "latestFiled",
        headerName: "Latest filing",
        width: 150,
        renderCell: ({ row }) =>
          row.latestFiled ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <span>
                {row.latestForm} · {formatDate(row.latestFiled)}
              </span>
              {row.lagging && (
                <Tooltip title="SEC's XBRL feed doesn't have this filing's figures yet; numbers are from the previous one.">
                  <WarningAmberIcon fontSize="inherit" color="warning" aria-label="XBRL data lagging" />
                </Tooltip>
              )}
            </Box>
          ) : (
            "—"
          ),
      },
      {
        field: "compare",
        headerName: "",
        width: 48,
        sortable: false,
        disableColumnMenu: true,
        renderHeader: () => <span style={{ position: "absolute", left: -9999 }}>Compare</span>,
        renderCell: ({ row }) => {
          const on = comparing.has(row.ticker);
          const full = !on && comparing.size >= MAX_COMPARE;
          return (
            <Tooltip title={full ? `Compare holds ${MAX_COMPARE}` : on ? "Remove from compare" : "Add to compare"}>
              <span>
                <IconButton
                  size="small"
                  disabled={full}
                  aria-label={on ? `Remove ${row.ticker} from compare` : `Add ${row.ticker} to compare`}
                  aria-pressed={on}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch(toggleCompare(row.ticker));
                  }}
                >
                  {on ? <CheckBoxIcon fontSize="small" color="primary" /> : <AddBoxOutlinedIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          );
        },
      },
    ];
  }, [watch, compare, dispatch]);

  const sortModel: GridSortModel = [{ field: sort.field, sort: sort.direction }];

  const hidden = useMemo(() => {
    const v: Record<string, boolean> = { revenueCagr3y: false, rdIntensity: false, sbcToRevenue: false, capitalReturn: false, efficiencyRatio: false };
    if (tablet) Object.assign(v, { sector: false, grossMargin: false, latestFiled: false });
    if (phone) Object.assign(v, { name: false, fcfMargin: false, roe: false, debtToEquity: false, watch: false });
    return v;
  }, [phone, tablet]);

  return (
    <Box sx={{ height: { xs: 560, md: 720 }, width: "100%", minWidth: 0 }}>
      <DataGrid
        key={`${phone}-${tablet}`}
        label="Companies matching the filters"
        rows={rows}
        columns={columns}
        getRowId={(r) => r.ticker}
        loading={loading}
        density="compact"
        disableRowSelectionOnClick
        sortingOrder={["desc", "asc"]}
        sortModel={sortModel}
        onSortModelChange={(m) => {
          const first = m[0];
          dispatch(
            setSort(
              first?.sort
                ? { field: first.field as SortField, direction: first.sort }
                : initialScreenerState.sort,
            ),
          );
        }}
        initialState={{ columns: { columnVisibilityModel: hidden }, pagination: { paginationModel: { pageSize: 50 } } }}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={({ row }) => router.push(`/company/${row.ticker}`)}
        sx={{
          bgcolor: "background.paper",
          "& .MuiDataGrid-row": { cursor: "pointer" },
          "& .MuiDataGrid-cell--textRight, & .MuiDataGrid-cell[data-field='revenue']": figures,
        }}
      />
    </Box>
  );
}
