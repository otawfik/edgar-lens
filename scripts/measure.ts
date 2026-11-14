/**
 * The numbers quoted in the README, measured against a running production
 * build (npm run build && npx next start -p 3210):
 *
 *   npm run measure
 *
 * 1. GraphQL latency: the three documents the UI sends (Home, Company as of a
 *    random filing date, Diff between two random dates), sequentially over
 *    HTTP on localhost, after a warm-up. Reports p50/p95/max per document.
 * 2. First-load JavaScript: every script a cold browser downloads to render a
 *    route, summed as transferred (gzip) and decoded bytes.
 */
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";
import { COMPANY, DIFF, HOME } from "../src/graphql/operations";
import { loadSnapshot } from "../src/server/dataset";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const N = Number(process.env.N ?? 500);

// Deterministic pseudo-random picks, so two runs issue the same requests.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];

async function post(query: string, variables: Record<string, unknown>): Promise<number> {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { errors?: unknown };
  const ms = performance.now() - t0;
  if (!res.ok || body.errors) throw new Error(`GraphQL error: ${JSON.stringify(body.errors ?? res.status)}`);
  return ms;
}

function summary(name: string, samples: number[]) {
  const s = [...samples].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
  console.log(
    `${name.padEnd(8)} n=${s.length}  p50 ${q(0.5).toFixed(1)} ms  p95 ${q(0.95).toFixed(1)} ms  max ${s[s.length - 1].toFixed(1)} ms`,
  );
}

async function latency() {
  const companies = loadSnapshot().companies.map((c) => ({
    ticker: c.ticker,
    dates: [...new Set(c.filings.map((f) => f.filed))].sort(),
  }));
  const company = () => {
    const c = pick(companies);
    return { ticker: c.ticker, period: pick(["ANNUAL", "QUARTERLY"]), asOf: pick(c.dates), last: 10 };
  };
  const diff = () => {
    const c = pick(companies);
    const [from, to] = [pick(c.dates), pick(c.dates)].sort();
    return { ticker: c.ticker, from, to };
  };
  for (let i = 0; i < 50; i++) await post(COMPANY, company()); // warm-up, discarded
  await post(HOME, {});

  const home: number[] = [];
  const comp: number[] = [];
  const dif: number[] = [];
  for (let i = 0; i < N; i++) {
    comp.push(await post(COMPANY, company()));
    dif.push(await post(DIFF, diff()));
    if (i % 5 === 0) home.push(await post(HOME, {}));
  }
  console.log(`GraphQL over HTTP on localhost, sequential, ${BASE}`);
  summary("Home", home);
  summary("Company", comp);
  summary("Diff", dif);
  summary("All", [...home, ...comp, ...dif]);
}

async function firstLoad() {
  const browser = await chromium.launch();
  console.log("\nFirst-load JavaScript (cold cache)");
  for (const route of ["/", "/company/GE", "/screener"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    const scripts = new Set<string>();
    let transferred = 0;
    let decoded = 0;
    cdp.on("Network.responseReceived", (e) => {
      if (e.type === "Script") scripts.add(e.requestId);
    });
    cdp.on("Network.loadingFinished", (e) => {
      if (scripts.has(e.requestId)) transferred += e.encodedDataLength;
    });
    cdp.on("Network.dataReceived", (e) => {
      if (scripts.has(e.requestId)) decoded += e.dataLength;
    });
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    console.log(
      `${route.padEnd(12)} ${scripts.size} scripts  ${(transferred / 1024).toFixed(0)} kB transferred (gzip)  ${(decoded / 1024).toFixed(0)} kB decoded`,
    );
    await context.close();
  }
  await browser.close();
}

async function main() {
  await latency();
  await firstLoad();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
