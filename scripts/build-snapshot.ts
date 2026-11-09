/**
 * Normalise the raw SEC cache (.cache/sec, from fetch-sec.ts) into the compact
 * snapshot the app serves: data/snapshot.json.
 *
 *   npm run data:build
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCompany,
  type CompanyFactsJson,
  type SubmissionsJson,
} from "../src/lib/edgar/normalize";
import type { Snapshot } from "../src/lib/edgar/snapshot";
import { PREDECESSOR_CIKS, UNIVERSE } from "../src/lib/universe";

const CACHE = path.resolve(".cache/sec");
const OUT = path.resolve("data/snapshot.json");
const pad = (cik: number) => String(cik).padStart(10, "0");
const readJson = async <T>(file: string): Promise<T> =>
  JSON.parse(await readFile(path.join(CACHE, file), "utf8")) as T;

async function main() {
  const tickers = await readJson<Record<string, { cik_str: number; ticker: string }>>(
    "company_tickers.json",
  );
  const byTicker = new Map(Object.values(tickers).map((t) => [t.ticker, t.cik_str]));

  const snapshot: Snapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: "SEC EDGAR XBRL company facts (data.sec.gov), public domain",
    stats: { companies: 0, rawFactsScanned: 0, points: 0, filings: 0, revisions: 0 },
    companies: [],
  };

  for (const entry of UNIVERSE) {
    const cik = byTicker.get(entry.ticker);
    if (!cik) throw new Error(`No CIK for ${entry.ticker}; run npm run data:fetch`);
    const ciks = [cik, ...(PREDECESSOR_CIKS[entry.ticker] ?? [])];
    const facts = await Promise.all(
      ciks.map((c) => readJson<CompanyFactsJson>(`companyfacts/CIK${pad(c)}.json`)),
    );
    const subs = await Promise.all(
      ciks.map((c) => readJson<SubmissionsJson>(`submissions/CIK${pad(c)}.json`)),
    );
    const { company, rawFacts } = buildCompany(entry, cik, facts, subs);
    snapshot.companies.push(company);
    snapshot.stats.rawFactsScanned += rawFacts;
    snapshot.stats.points +=
      Object.values(company.annual).reduce((n, p) => n + p.length, 0) +
      Object.values(company.quarterly).reduce((n, p) => n + p.length, 0);
    snapshot.stats.filings += company.filings.length;
    snapshot.stats.revisions += company.revisions.length;
  }
  snapshot.stats.companies = snapshot.companies.length;

  const json = JSON.stringify(snapshot);
  await writeFile(OUT, json);
  console.log(
    `Wrote ${OUT} (${(json.length / 1e6).toFixed(2)} MB): ` + JSON.stringify(snapshot.stats),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
