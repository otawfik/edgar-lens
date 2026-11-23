"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import HistoryIcon from "@mui/icons-material/History";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import { useAppSelector } from "@/store/store";
import { formatDate } from "@/lib/edgar/periods";
import { ColorModeToggle } from "./ColorModeToggle";
import { CompanySearch } from "./CompanySearch";

// The drawer (and MUI's modal machinery under it) loads the first time it is opened.
const WatchlistDrawer = dynamic(() => import("./WatchlistDrawer").then((m) => m.WatchlistDrawer), { ssr: false });

const NAV = [
  { href: "/", label: "Revisions", icon: <HistoryIcon fontSize="small" /> },
  { href: "/screener", label: "Screener", icon: <TableChartOutlinedIcon fontSize="small" /> },
];

function Logo() {
  return (
    <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={{ width: 26, height: 26, color: "primary.main", flexShrink: 0 }}>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor" />
      <path d="M7 16.5V12M11 16.5V8.5M15 16.5V10.5M19 16.5V6.5" stroke="var(--mui-palette-background-paper)" strokeWidth="2" strokeLinecap="round" />
    </Box>
  );
}

export function AppShell({
  children,
  snapshotDate,
  companies,
}: {
  children: React.ReactNode;
  snapshotDate: string;
  companies: number;
}) {
  const pathname = usePathname();
  const [watchOpen, setWatchOpen] = useState(false);
  const [watchLoaded, setWatchLoaded] = useState(false);
  const watchCount = useAppSelector((s) => s.watchlist.tickers.length);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Box
        component="a"
        href="#main"
        sx={{ position: "absolute", left: -9999, "&:focus": { left: 16, top: 12, zIndex: 2000, bgcolor: "background.paper", p: 1, borderRadius: 1 } }}
      >
        Skip to content
      </Box>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Toolbar sx={{ gap: { xs: 0.5, sm: 1.5 }, minHeight: { xs: 56 } }}>
          <Box component={Link} href="/" aria-label="EDGAR Lens, home" sx={{ display: "flex", alignItems: "center", gap: 1, textDecoration: "none", mr: { xs: 0.5, sm: 1 } }}>
            <Logo />
            <Typography component="span" sx={{ fontWeight: 700, letterSpacing: "-0.01em", display: { xs: "none", sm: "inline" } }}>
              EDGAR Lens
            </Typography>
          </Box>
          <Box component="nav" aria-label="Main" sx={{ display: "flex", gap: 0.5 }}>
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  color={active ? "primary" : "inherit"}
                  startIcon={item.icon}
                  aria-label={item.label}
                  sx={{
                    px: { xs: 1, sm: 1.5 },
                    minWidth: 0,
                    bgcolor: active ? "action.selected" : "transparent",
                    "& .MuiButton-startIcon": { mr: { xs: 0, md: 1 } },
                  }}
                >
                  <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
                    {item.label}
                  </Box>
                </Button>
              );
            })}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", justifyContent: "center", px: { xs: 0.5, sm: 2 } }}>
            <CompanySearch />
          </Box>
          <Tooltip title="Watchlist">
            <IconButton
              onClick={() => {
                setWatchLoaded(true);
                setWatchOpen(true);
              }}
              aria-label={`Watchlist, ${watchCount} ${watchCount === 1 ? "company" : "companies"}`}
            >
              <Badge badgeContent={watchCount} color="secondary" max={99}>
                <StarBorderIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <ColorModeToggle />
        </Toolbar>
      </AppBar>

      <Container component="main" id="main" maxWidth="xl" sx={{ flexGrow: 1, py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
        {children}
      </Container>

      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", py: 2.5, px: { xs: 2, sm: 3 }, mt: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {companies} companies from{" "}
          <a href="https://www.sec.gov/search-filings/edgar-application-programming-interfaces" target="_blank" rel="noreferrer">
            SEC EDGAR XBRL company facts
          </a>{" "}
          (public domain), fetched {formatDate(snapshotDate.slice(0, 10))}. Every figure is shown as the company filed it,
          and as it later changed it; not investment advice.
        </Typography>
      </Box>

      {watchLoaded && <WatchlistDrawer open={watchOpen} onClose={() => setWatchOpen(false)} />}
    </Box>
  );
}
