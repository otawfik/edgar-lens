"use client";
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
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import { useAppSelector } from "@/store/store";
import { formatDate } from "@/lib/edgar/periods";
import { ColorModeToggle } from "./ColorModeToggle";
import { CompareTray } from "./CompareTray";
import { WatchlistDrawer } from "./WatchlistDrawer";

const NAV = [
  { href: "/", label: "Screener", icon: <TableChartOutlinedIcon fontSize="small" /> },
  { href: "/compare", label: "Compare", icon: <CompareArrowsIcon fontSize="small" /> },
  { href: "/filings", label: "Latest filings", icon: <DescriptionOutlinedIcon fontSize="small" /> },
];

function Logo() {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      aria-hidden
      sx={{ width: 26, height: 26, color: "primary.main", flexShrink: 0 }}
    >
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
  const watchCount = useAppSelector((s) => s.watchlist.tickers.length);
  const compareCount = useAppSelector((s) => s.compare.tickers.length);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Box
        component="a"
        href="#main"
        sx={{
          position: "absolute",
          left: -9999,
          "&:focus": { left: 16, top: 12, zIndex: 2000, bgcolor: "background.paper", p: 1, borderRadius: 1 },
        }}
      >
        Skip to content
      </Box>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}
      >
        <Toolbar sx={{ gap: { xs: 0.5, sm: 1.5 }, minHeight: { xs: 56 } }}>
          <Box
            component={Link}
            href="/"
            sx={{ display: "flex", alignItems: "center", gap: 1, textDecoration: "none", mr: { xs: 0.5, sm: 2 } }}
          >
            <Logo />
            <Typography
              component="span"
              sx={{ fontWeight: 700, letterSpacing: "-0.01em", display: { xs: "none", sm: "inline" } }}
            >
              EDGAR Lens
            </Typography>
          </Box>
          <Box component="nav" aria-label="Main" sx={{ display: "flex", gap: 0.5, flexGrow: 1, minWidth: 0 }}>
            {NAV.map((item) => {
              const active = isActive(item.href);
              const count = item.href === "/compare" ? compareCount : 0;
              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  color={active ? "primary" : "inherit"}
                  startIcon={
                    <Badge badgeContent={count} color="secondary" max={9}>
                      {item.icon}
                    </Badge>
                  }
                  sx={{
                    px: { xs: 1, sm: 1.5 },
                    minWidth: 0,
                    bgcolor: active ? "action.selected" : "transparent",
                    "& .MuiButton-startIcon": { mr: { xs: 0, md: 1 } },
                  }}
                  aria-label={item.label}
                >
                  <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
                    {item.label}
                  </Box>
                </Button>
              );
            })}
          </Box>
          <Tooltip title="Watchlist">
            <IconButton onClick={() => setWatchOpen(true)} aria-label={`Watchlist, ${watchCount} companies`}>
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

      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", py: 2.5, px: { xs: 2, sm: 3 }, mt: 4, pb: compareCount ? 11 : 2.5 }}>
        <Typography variant="body2" color="text.secondary">
          {companies} companies from{" "}
          <a href="https://www.sec.gov/search-filings/edgar-application-programming-interfaces" target="_blank" rel="noreferrer">
            SEC EDGAR XBRL company facts
          </a>{" "}
          (public domain), snapshot of {formatDate(snapshotDate.slice(0, 10))}. Figures are as filed and as later
          revised by the companies; not investment advice.
        </Typography>
      </Box>

      <CompareTray />
      <WatchlistDrawer open={watchOpen} onClose={() => setWatchOpen(false)} />
    </Box>
  );
}
