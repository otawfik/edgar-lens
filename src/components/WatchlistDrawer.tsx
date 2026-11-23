"use client";
import Link from "next/link";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { summarise } from "@/lib/edgar/revisionScreen";
import { formatPercent } from "@/lib/format";
import { useScreenerQuery } from "@/store/api";
import { selectCompanies } from "@/store/selectors";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { removeWatch } from "@/store/watchlistSlice";
import { figures } from "@/theme/theme";

export function WatchlistDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tickers = useAppSelector((s) => s.watchlist.tickers);
  const dispatch = useAppDispatch();
  useScreenerQuery(undefined, { skip: !open });
  const companies = useAppSelector(selectCompanies);
  const byTicker = new Map(companies.map((c) => [c.ticker, c]));

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: "88vw", sm: 360 }, p: 2 }} role="region" aria-label="Watchlist">
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Typography variant="h2" sx={{ flexGrow: 1 }}>
            Watchlist
          </Typography>
          <IconButton onClick={onClose} aria-label="Close watchlist">
            <CloseIcon />
          </IconButton>
        </Box>
        {tickers.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            Star a company in the screener or on its page to keep it here. The list is saved in this browser.
          </Typography>
        ) : (
          <List dense disablePadding>
            {tickers.map((t) => {
              const r = byTicker.get(t);
              const all = r ? summarise(r.cells, { metric: null, period: null, lag: "any" }) : null;
              return (
                <ListItem
                  key={t}
                  disablePadding
                  secondaryAction={
                    <IconButton edge="end" aria-label={`Remove ${t} from watchlist`} onClick={() => dispatch(removeWatch(t))}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemButton component={Link} href={`/company/${t}`} onClick={onClose}>
                    <ListItemText
                      primary={
                        <>
                          <Box component="span" sx={{ fontWeight: 700, mr: 1 }}>{t}</Box>
                          {r?.name}
                        </>
                      }
                      secondary={
                        all ? (
                          <Box component="span" sx={figures}>
                            {all.revised} of {all.figures} figures later changed · {formatPercent(all.rate)}
                          </Box>
                        ) : null
                      }
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>
    </Drawer>
  );
}
