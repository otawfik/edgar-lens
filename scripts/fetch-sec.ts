/**
 * Download raw SEC EDGAR data for the coverage universe into .cache/sec/.
 *
 *   SEC_USER_AGENT="Your Name you@example.com" npm run data:fetch
 *
 * SEC asks every client to identify itself with a contact User-Agent and to
 * stay under 10 requests/second. We read the UA from the environment (never
 * committed) and pace requests at <= 5/s. Responses are cached on disk, so a
 * re-run only fetches what is missing unless --force is passed.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PREDECESSOR_CIKS, UNIVERSE } from "../src/lib/universe";

const CACHE = path.resolve(".cache/sec");
const MIN_INTERVAL_MS = 220; // ~4.5 requests/second, under SEC's ceiling
const force = process.argv.includes("--force");

const userAgent = process.env.SEC_USER_AGENT;
if (!userAgent || !/\S+@\S+/.test(userAgent)) {
  console.error(
    'SEC_USER_AGENT must be set to "Name email@example.com" (SEC fair-access policy).',
  );
  process.exit(1);
}

let last = 0;
async function politeFetch(url: string, attempt = 1): Promise<string> {
  const wait = last + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": userAgent!, "Accept-Encoding": "gzip, deflate" },
  });
  if (res.ok) return res.text();
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const backoff = 1000 * 2 ** attempt;
    console.warn(`  ${res.status} on ${url}; retrying in ${backoff}ms`);
    await new Promise((r) => setTimeout(r, backoff));
    return politeFetch(url, attempt + 1);
  }
  throw new Error(`${res.status} ${res.statusText} for ${url}`);
}

async function cached(file: string, url: string): Promise<string> {
  const target = path.join(CACHE, file);
  if (!force) {
    try {
      await stat(target);
      return readFile(target, "utf8");
    } catch {
      /* not cached yet */
    }
  }
  const body = await politeFetch(url);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
  return body;
}

const pad = (cik: number) => String(cik).padStart(10, "0");

async function main() {
  const tickers = JSON.parse(
    await cached("company_tickers.json", "https://www.sec.gov/files/company_tickers.json"),
  ) as Record<string, { cik_str: number; ticker: string; title: string }>;
  const byTicker = new Map(
    Object.values(tickers).map((t) => [t.ticker.toUpperCase(), t.cik_str]),
  );

  const missing: string[] = [];
  let done = 0;
  for (const { ticker } of UNIVERSE) {
    const cik = byTicker.get(ticker);
    if (!cik) {
      missing.push(ticker);
      continue;
    }
    for (const c of [cik, ...(PREDECESSOR_CIKS[ticker] ?? [])]) {
      const id = pad(c);
      await cached(
        `companyfacts/CIK${id}.json`,
        `https://data.sec.gov/api/xbrl/companyfacts/CIK${id}.json`,
      );
      await cached(
        `submissions/CIK${id}.json`,
        `https://data.sec.gov/submissions/CIK${id}.json`,
      );
    }
    done += 1;
    if (done % 10 === 0) console.log(`  ${done}/${UNIVERSE.length} companies`);
  }
  console.log(`Fetched ${done} companies into ${CACHE}`);
  if (missing.length) {
    console.error(`No CIK found for: ${missing.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
