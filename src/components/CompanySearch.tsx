"use client";
import { useRouter } from "next/navigation";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import OutlinedInput from "@mui/material/OutlinedInput";
import { useCompanyListQuery } from "@/store/api";

type Option = { ticker: string; name: string; sector: string };

/** Jump to any company: ticker or name, keyboard-navigable. */
export function CompanySearch({ autoFocus = false, size = "small" }: { autoFocus?: boolean; size?: "small" | "medium" }) {
  const router = useRouter();
  const { data, isLoading } = useCompanyListQuery();
  const options: Option[] = data?.companies ?? [];
  return (
    <Autocomplete
      size={size}
      sx={{ width: "100%", maxWidth: size === "medium" ? 640 : 420 }}
      options={options}
      loading={isLoading}
      autoHighlight
      blurOnSelect
      value={null}
      getOptionLabel={(o) => `${o.ticker} ${o.name}`}
      filterOptions={(opts, { inputValue }) => {
        const q = inputValue.trim().toLowerCase();
        if (!q) return opts.slice(0, 12);
        const starts = opts.filter((o) => o.ticker.toLowerCase().startsWith(q));
        const rest = opts.filter((o) => !starts.includes(o) && (o.ticker.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)));
        return [...starts, ...rest].slice(0, 12);
      }}
      onChange={(_, o) => {
        if (o) router.push(`/company/${o.ticker}`);
      }}
      renderOption={(props, o) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ display: "flex", gap: 1.5, alignItems: "baseline" }}>
            <Box component="span" sx={{ fontWeight: 700, minWidth: 56 }}>{o.ticker}</Box>
            <Box component="span" sx={{ flexGrow: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</Box>
            <Box component="span" sx={{ color: "text.secondary", fontSize: "0.75rem", display: { xs: "none", sm: "inline" } }}>{o.sector}</Box>
          </Box>
        );
      }}
      // A bare OutlinedInput rather than TextField: TextField also bundles
      // Select, Menu and Modal, which this input never shows.
      renderInput={(params) => (
        <OutlinedInput
          {...params.slotProps.input}
          id={params.id}
          disabled={params.disabled}
          fullWidth
          size={params.size}
          autoFocus={autoFocus}
          placeholder={size === "medium" ? "Search a company — Apple, JPM, GE…" : "Find a company"}
          inputProps={{ ...params.slotProps.htmlInput, "aria-label": "Find a company" }}
          sx={{ bgcolor: "background.default" }}
        />
      )}
    />
  );
}
