/**
 * The coverage universe: large-cap US filers modelled on the S&P 100, tagged
 * with their GICS sector. CIKs are resolved from SEC's ticker map at fetch time
 * and pinned into the snapshot, so this file only carries what SEC can't tell us.
 */
export const SECTORS = [
  "Information Technology",
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Health Care",
  "Financials",
  "Industrials",
  "Energy",
  "Utilities",
  "Real Estate",
  "Materials",
] as const;

export type Sector = (typeof SECTORS)[number];

const BY_SECTOR: Record<Sector, string[]> = {
  "Information Technology": [
    "AAPL", "ACN", "ADBE", "AMD", "AVGO", "CRM", "CSCO", "IBM", "INTC",
    "INTU", "MSFT", "NOW", "NVDA", "ORCL", "PLTR", "QCOM", "TXN",
  ],
  "Communication Services": [
    "CHTR", "CMCSA", "DIS", "GOOGL", "META", "NFLX", "T", "TMUS", "VZ",
  ],
  "Consumer Discretionary": [
    "AMZN", "BKNG", "F", "GM", "HD", "LOW", "MCD", "NKE", "SBUX", "TSLA",
  ],
  "Consumer Staples": [
    "CL", "COST", "KO", "MDLZ", "MO", "PEP", "PG", "PM", "TGT", "WMT",
  ],
  "Health Care": [
    "ABBV", "ABT", "AMGN", "BMY", "CVS", "DHR", "GILD", "ISRG", "JNJ",
    "LLY", "MDT", "MRK", "PFE", "TMO", "UNH",
  ],
  Financials: [
    "AIG", "AXP", "BAC", "BLK", "BNY", "BRK-B", "C", "COF", "GS", "JPM",
    "MA", "MET", "MS", "PYPL", "SCHW", "USB", "V", "WFC",
  ],
  Industrials: [
    "BA", "CAT", "DE", "EMR", "FDX", "GD", "GE", "HON", "LMT", "MMM",
    "RTX", "UBER", "UNP", "UPS",
  ],
  Energy: ["COP", "CVX", "XOM"],
  Utilities: ["DUK", "NEE", "SO"],
  "Real Estate": ["AMT", "SPG"],
  Materials: ["LIN"],
};

/**
 * How the business makes money, which decides which ratios mean anything.
 * A bank's operating cash flow swings with its trading book and loan funding,
 * so free-cash-flow margin and cash conversion are reported as "n/m" for banks
 * and insurers instead of ranking them against Apple.
 */
export type BusinessModel = "general" | "bank" | "insurer";

const MODEL: Record<string, BusinessModel> = {
  AXP: "bank", BAC: "bank", BNY: "bank", C: "bank", COF: "bank", GS: "bank",
  JPM: "bank", MS: "bank", SCHW: "bank", USB: "bank", WFC: "bank",
  AIG: "insurer", MET: "insurer", "BRK-B": "insurer",
};

/**
 * Registrants that replaced an earlier filer. ExxonMobil moved to a new holding
 * company in 2026: the new CIK has only two quarters of history, the old one
 * has everything before. Facts are merged, newest filing wins.
 */
export const PREDECESSOR_CIKS: Record<string, number[]> = {
  XOM: [34088],
};

export interface UniverseEntry {
  ticker: string;
  sector: Sector;
  model: BusinessModel;
}

export const UNIVERSE: UniverseEntry[] = SECTORS.flatMap((sector) =>
  BY_SECTOR[sector].map((ticker) => ({
    ticker,
    sector,
    model: MODEL[ticker] ?? "general",
  })),
);
