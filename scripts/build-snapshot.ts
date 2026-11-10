/**
 * Normalise the raw SEC cache (.cache/sec, from fetch-sec.ts) into the compact
 * snapshot the app serves: data/snapshot.json, with every figure's
 * point-in-time history and the snapshot-wide revision league tables.
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
import { computeRevisionStats, countFigures } from "../src/lib/edgar/revisionStats";
import type { Snapshot, SnapshotCompany } from "../src/lib/edgar/snapshot";
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

  const companies: SnapshotCompany[] = [];
  let rawFactsScanned = 0;
  let figures = 0;
  let vintages = 0;
  let filings = 0;
  let earliestFiled = "9999-99-99";
  let latestFiled = "";

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
    companies.push(company);
    rawFactsScanned += rawFacts;
    figures += countFigures(company);
    for (const series of [company.annual, company.quarterly]) {
      for (const pts of Object.values(series)) for (const [, history] of pts) vintages += history.length;
    }
    filings += company.filings.length;
    for (const f of company.filings) {
      if (f.filed < earliestFiled) earliestFiled = f.filed;
      if (f.filed > latestFiled) latestFiled = f.filed;
    }
  }

  const snapshot: Snapshot = {
    version: 2,
    generatedAt: new Date().toISOString(),
    source: "SEC EDGAR XBRL company facts (data.sec.gov), public domain",
    stats: { companies: companies.length, rawFactsScanned, figures, vintages, filings, earliestFiled, latestFiled },
    revisions: computeRevisionStats(companies),
    companies,
  };

  const json = JSON.stringify(snapshot);
  await writeFile(OUT, json);
  const r = snapshot.revisions;
  console.log(`Wrote ${OUT} (${(json.length / 1e6).toFixed(2)} MB)`);
  console.log(JSON.stringify(snapshot.stats));
  console.log(
    `Revisions: ${r.revised}/${r.figures} figures (${(r.rate * 100).toFixed(1)}%), ` +
      `${r.revisedTwice} changed twice, median lag ${r.medianLagDays} days`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
