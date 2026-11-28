/**
 * The numbers quoted in the README, measured against a running production
 * build (npm run build && npx next start -p 3210):
 *
 *   npm run measure
 *
 * 1. GraphQL latency: the four documents the UI sends (Home, Company as of a
 *    random filing date, Diff between two random dates, a company's
 *    restatement timeline), sequentially over HTTP on localhost, after a
 *    warm-up. Reports p50/p95/max per document.
 * 2. First-load JavaScript: every script a cold browser downloads to render a
 *    route, summed as transferred (gzip) and decoded bytes. `SCRIPTS=1` also
 *    lists each script, largest first, to see where the bytes are.
 *
 * 3. Server function size: the files `next build` traced for each on-demand
 *    route plus the Next server runtime, uncompressed, which is what a
 *    serverless host has to fit in one function (Vercel's limit is 250 MB).
 *    Read from .next, so it needs the build but not the running server.
 *
 * `N=0` skips the latency run.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";
import { COMPANY, DIFF, HOME, RESTATEMENTS } from "../src/graphql/operations";
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
    `${name.padEnd(9)} n=${s.length}  p50 ${q(0.5).toFixed(1)} ms  p95 ${q(0.95).toFixed(1)} ms  max ${s[s.length - 1].toFixed(1)} ms`,
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
  const timeline: number[] = [];
  for (let i = 0; i < N; i++) {
    comp.push(await post(COMPANY, company()));
    dif.push(await post(DIFF, diff()));
    if (i % 5 === 0) home.push(await post(HOME, {}));
    // One per company page opened; computed on the first request for a company, then served from memory.
    if (i % 5 === 0) timeline.push(await post(RESTATEMENTS, { ticker: pick(companies).ticker }));
  }
  console.log(`GraphQL over HTTP on localhost, sequential, ${BASE}`);
  summary("Home", home);
  summary("Company", comp);
  summary("Diff", dif);
  summary("Timeline", timeline);
  summary("All", [...home, ...comp, ...dif, ...timeline]);
}

async function firstLoad() {
  const browser = await chromium.launch();
  console.log("\nFirst-load JavaScript (cold cache)");
  for (const route of ["/", "/company/GE", "/screener"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    const scripts = new Map<string, { url: string; bytes: number }>();
    let transferred = 0;
    let decoded = 0;
    cdp.on("Network.responseReceived", (e) => {
      if (e.type === "Script") scripts.set(e.requestId, { url: e.response.url, bytes: 0 });
    });
    cdp.on("Network.loadingFinished", (e) => {
      const script = scripts.get(e.requestId);
      if (!script) return;
      script.bytes = e.encodedDataLength;
      transferred += e.encodedDataLength;
    });
    cdp.on("Network.dataReceived", (e) => {
      if (scripts.has(e.requestId)) decoded += e.dataLength;
    });
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    console.log(
      `${route.padEnd(12)} ${scripts.size} scripts  ${(transferred / 1024).toFixed(0)} kB transferred (gzip)  ${(decoded / 1024).toFixed(0)} kB decoded`,
    );
    if (process.env.SCRIPTS) {
      for (const sc of [...scripts.values()].sort((a, b) => b.bytes - a.bytes)) {
        console.log(`  ${(sc.bytes / 1024).toFixed(1).padStart(6)} kB  ${sc.url.replace(BASE, "")}`);
      }
    }
    await context.close();
  }
  await browser.close();
}

/** Files traced into a route's function: its own trace plus the Next server's, each file counted once. */
function functionSize() {
  const dir = path.resolve(".next");
  const runtime = path.join(dir, "next-server.js.nft.json");
  if (!existsSync(runtime)) return console.log("\nServer function size: no .next build output here, skipped");
  const traced = (nft: string) => {
    const { files } = JSON.parse(readFileSync(nft, "utf8")) as { files: string[] };
    return files.map((f) => path.resolve(path.dirname(nft), f));
  };
  console.log("\nServer function size (traced files, uncompressed)");
  for (const route of ["app/api/graphql/route.js", "app/company/[ticker]/page.js"]) {
    const entry = path.join(dir, "server", route);
    const files = new Set([entry, ...traced(`${entry}.nft.json`), ...traced(runtime)]);
    let bytes = 0;
    let snapshot = 0;
    for (const f of files) {
      if (!existsSync(f) || !statSync(f).isFile()) continue;
      bytes += statSync(f).size;
      if (f.endsWith(path.join("data", "snapshot.json"))) snapshot = statSync(f).size;
    }
    console.log(
      `${("/" + route.replace(/^app\//, "").replace(/\/(route|page)\.js$/, "")).padEnd(18)} ${files.size} files  ${(bytes / 1e6).toFixed(1)} MB  (snapshot ${(snapshot / 1e6).toFixed(1)} MB)`,
    );
  }
}

async function main() {
  if (N > 0) await latency();
  await firstLoad();
  functionSize();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
