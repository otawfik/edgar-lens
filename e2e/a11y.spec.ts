import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated accessibility pass: axe-core's WCAG 2 A/AA rules (contrast,
 * names, roles, labels) against each page once its data has rendered, in both
 * colour schemes and at phone width. It cannot judge everything — keyboard
 * use of the scrubber and the screener is tested by hand-written cases.
 */
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

interface Violation {
  id: string;
  impact: string | null;
  nodes: { target: string[]; failureSummary: string }[];
}

async function violations(page: Page): Promise<string[]> {
  await page.evaluate(axeSource);
  const found = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: Violation[] }> } }).axe;
    const result = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
    return result.violations;
  });
  return found.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(" ")} — ${n.failureSummary.split("\n").slice(0, 2).join(" ")}`));
}

const PAGES: { name: string; url: string; ready: (page: Page) => Promise<unknown> }[] = [
  { name: "home", url: "/", ready: (p) => p.getByRole("table", { name: "Most-revised companies" }).waitFor() },
  {
    name: "company, rewound with a diff",
    url: "/company/GE?asOf=2020-06-30&vs=2019-06-30",
    ready: async (p) => {
      await p.getByTestId("material-count").waitFor();
      await p.getByRole("group", { name: /^Revenue by fiscal year/ }).waitFor();
      await p.getByTestId("restatement-timeline").getByRole("link").first().waitFor();
    },
  },
  {
    name: "screener",
    url: "/screener?item=revenue&period=annual",
    ready: (p) => p.locator("td[data-col=rate]").first().waitFor(),
  },
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe, ${scheme}`, () => {
    test.use({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const pg of PAGES) {
      test(pg.name, async ({ page }) => {
        await page.goto(pg.url);
        await pg.ready(page);
        expect(await violations(page)).toEqual([]);
      });
    }
  });
}

test.describe("axe, phone width", () => {
  test.use({ viewport: { width: 375, height: 800 }, reducedMotion: "reduce" });
  for (const pg of PAGES) {
    test(pg.name, async ({ page }) => {
      await page.goto(pg.url);
      await pg.ready(page);
      expect(await violations(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    });
  }
});
