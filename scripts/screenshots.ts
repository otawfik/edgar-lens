/**
 * Capture the README screenshots from a running production build.
 *
 *   npm run build && npx next start -p 3210 &
 *   npm run screenshots            # writes docs/screenshots/*.png
 *
 * BASE_URL overrides the default http://localhost:3210.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3210";
const OUT = path.resolve(process.env.SHOTS_DIR ?? "docs/screenshots");

interface Shot {
  name: string;
  url: string;
  width: number;
  height: number;
  dark?: boolean;
  fullPage?: boolean;
  /** Wait for this before the shot. */
  ready: (page: Page) => Promise<unknown>;
}

const SHOTS: Shot[] = [
  {
    name: "home",
    url: "/",
    width: 1440,
    height: 900,
    fullPage: true,
    ready: (p) => p.getByRole("table", { name: "Most-revised companies" }).waitFor(),
  },
  {
    name: "screener",
    url: "/screener?item=revenue&period=annual",
    width: 1440,
    height: 900,
    ready: (p) => p.getByRole("table", { name: "Companies by share of reported figures later changed" }).getByRole("row").nth(1).waitFor(),
  },
  {
    name: "rewind",
    url: "/company/GE?asOf=2019-06-30",
    width: 1440,
    height: 900,
    fullPage: true,
    ready: (p) => p.getByRole("table", { name: "Financial line items by period" }).waitFor(),
  },
  {
    name: "diff",
    url: "/company/GE?asOf=2020-06-30&vs=2019-06-30",
    width: 1440,
    height: 900,
    ready: async (p) => {
      const panel = p.getByTestId("diff-panel");
      await panel.getByTestId("material-count").waitFor();
      await panel.scrollIntoViewIfNeeded();
    },
  },
  {
    name: "rewind-dark",
    url: "/company/IBM?asOf=2021-06-30",
    width: 1440,
    height: 900,
    dark: true,
    ready: (p) => p.getByRole("table", { name: "Financial line items by period" }).waitFor(),
  },
  {
    name: "rewind-phone",
    url: "/company/GE?asOf=2019-06-30",
    width: 375,
    height: 812,
    ready: (p) => p.getByRole("table", { name: "Financial line items by period" }).waitFor(),
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const only = process.argv.slice(2);
  const browser = await chromium.launch();
  for (const shot of SHOTS) {
    if (only.length && !only.includes(shot.name)) continue;
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: shot.width < 600 ? 2 : 1,
      colorScheme: shot.dark ? "dark" : "light",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(BASE + shot.url);
    await shot.ready(page);
    await page.waitForTimeout(800); // charts settle
    const file = path.join(OUT, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: shot.fullPage });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log(`${shot.name}: ${file} (scrollWidth ${scrollWidth} at ${shot.width}px)`);
    await context.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
