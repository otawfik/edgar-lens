import { expect, test } from "@playwright/test";

test.describe("home", () => {
  test("shows revision statistics and leads to a company", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Rewind any company");
    await expect(page.getByText("Reported figures", { exact: true })).toBeVisible();
    const league = page.getByRole("table", { name: "Most-revised companies" });
    await expect(league).toBeVisible();
    // Sorted by rate; the first ticker is a link to the company page.
    const first = league.getByRole("row").nth(1).getByRole("link").first();
    const ticker = (await first.textContent())!.trim();
    await first.click();
    await expect(page).toHaveURL(new RegExp(`/company/${ticker}`));
    await expect(page.getByTestId("date-scrubber")).toBeVisible();
  });

  test("search jumps to a company by ticker", async ({ page }) => {
    await page.goto("/");
    const box = page.getByRole("combobox", { name: "Find a company" }).first();
    await box.fill("ibm");
    await page.getByRole("option", { name: /IBM/ }).first().click();
    await expect(page).toHaveURL(/\/company\/IBM/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/international business machines/i);
  });
});

test.describe("company rewind", () => {
  test("rewinds figures with the scrubber and syncs the URL", async ({ page }) => {
    await page.goto("/company/GE");
    await expect(page.getByTestId("as-of-label")).toHaveText(/Today/);
    const table = page.getByRole("table", { name: "Financial line items by period" });
    await expect(table).toBeVisible();
    const todayFirstCell = await table.getByRole("row").nth(1).getByRole("cell").nth(1).textContent();

    // Step back to the previous filing: the as-of date, the URL and the figures change.
    await page.getByRole("button", { name: "Previous filing" }).click();
    await expect(page.getByTestId("as-of-label")).not.toHaveText(/Today/);
    await expect(page).toHaveURL(/asOf=\d{4}-\d{2}-\d{2}/);

    // Rewind far enough that restated history differs from today's.
    await page.goto("/company/GE?asOf=2019-06-30");
    await expect(page.getByTestId("as-of-label")).toHaveText("Jun 30, 2019");
    await expect(table).toBeVisible();
    const rewoundFirstCell = await table.getByRole("row").nth(1).getByRole("cell").nth(1).textContent();
    expect(rewoundFirstCell).not.toEqual(todayFirstCell);
    // Cells later changed by the company are marked.
    expect(await table.locator("td[data-changed]").count()).toBeGreaterThan(0);
    await expect(page.getByText(/periods later changed/)).toBeVisible();

    // Jump to today clears the date from the URL.
    await page.getByRole("button", { name: "Jump to today" }).click();
    await expect(page.getByTestId("as-of-label")).toHaveText(/Today/);
    await expect(page).not.toHaveURL(/asOf=/);
  });

  test("keyboard: the slider moves with arrow keys", async ({ page }) => {
    await page.goto("/company/AAPL");
    const slider = page.getByRole("slider", { name: "Filing date to rewind to" });
    await slider.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/asOf=/);
    await expect(page.getByTestId("as-of-label")).not.toHaveText(/Today/);
  });

  test("diffs two dates and links each revision to its EDGAR filing", async ({ page }) => {
    await page.goto("/company/GE?asOf=2020-06-30&vs=2019-06-30");
    const panel = page.getByTestId("diff-panel");
    await expect(panel.getByTestId("material-count")).toContainText(/\d+ material revisions?/);
    const rows = panel.getByRole("table", { name: "Revised figures" }).getByRole("row");
    expect(await rows.count()).toBeGreaterThan(1);
    const link = rows.nth(1).getByRole("link").first();
    await expect(link).toHaveAttribute("href", /sec\.gov\/Archives\/edgar\/data\/\d+\/\d+\/.*-index\.htm$/);
  });

  test("quarterly view and period in the URL", async ({ page }) => {
    await page.goto("/company/AAPL?period=quarterly");
    await expect(page.getByRole("button", { name: "Quarters", pressed: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Financial line items by period" }).getByRole("columnheader", { name: /\w{3} \d{4}/ }).first()).toBeVisible();
    await page.getByRole("button", { name: "Fiscal years" }).click();
    await expect(page).not.toHaveURL(/period=quarterly/);
  });

  test("unknown ticker explains itself", async ({ page }) => {
    await page.goto("/company/NOPE");
    await expect(page.getByText(/No company with ticker/)).toBeVisible();
  });
});

test.describe("revision screener", () => {
  const table = "Companies by share of reported figures later changed";

  test("narrows by line item, period and sector, synced to the URL", async ({ page }) => {
    await page.goto("/screener");
    const count = page.getByTestId("shown-count");
    await expect(count).not.toHaveText(/^0 /);
    const before = Number((await count.textContent())!.split("/")[0]);
    const pooled = await page.getByTestId("pooled-rate").textContent();

    await page.getByLabel("Line item").selectOption({ label: "Revenue" });
    await expect(page).toHaveURL(/item=revenue/);
    await page.getByRole("button", { name: "Fiscal years" }).click();
    await expect(page).toHaveURL(/period=annual/);
    await expect(page.getByTestId("pooled-rate")).not.toHaveText(pooled!);

    await page.getByRole("button", { name: /^Energy · \d+$/ }).click();
    await expect(page).toHaveURL(/sector=Energy/);
    const after = Number((await count.textContent())!.split("/")[0]);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
    await expect(page.getByRole("table", { name: table }).getByRole("row")).toHaveCount(after + 1);
  });

  test("sorts either way from the column header and opens a shared link as it was left", async ({ page }) => {
    await page.goto("/screener?item=revenue&period=annual&lag=after1y");
    await expect(page.getByLabel("Line item")).toHaveValue("revenue");
    await expect(page.getByRole("button", { name: "Over a year later", pressed: true })).toBeVisible();
    const rows = page.getByRole("table", { name: table }).getByRole("row");
    const rates = async () => (await rows.locator("td[data-col=rate]").allTextContents()).map((t) => Number.parseFloat(t));
    await expect(rows.locator("td[data-col=rate]").first()).toBeVisible();
    const desc = await rates();
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(desc[0]).toBeGreaterThan(0);

    await page.getByRole("columnheader", { name: "Rate" }).getByRole("button").click();
    await expect(page).toHaveURL(/sort=rate/);
    await expect(page.getByRole("columnheader", { name: "Rate" })).toHaveAttribute("aria-sort", "ascending");
    const asc = await rates();
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(asc[0]).toBe(0);
  });

  test("stars a company from the keyboard; the watchlist opens with its record and survives a reload", async ({ page }) => {
    await page.goto("/screener?q=apple");
    const star = page.getByRole("button", { name: "Add AAPL to watchlist" });
    await star.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Remove AAPL from watchlist" }).first()).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await page.getByRole("button", { name: "Watchlist, 1 company" }).click();
    const drawer = page.getByRole("region", { name: "Watchlist" });
    await expect(drawer.getByRole("link", { name: /AAPL/ })).toContainText(/\d+ of \d+ figures later changed/);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("home links into the screener for a line item", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("table", { name: "Revision rate by line item" }).getByRole("link").first().click();
    await expect(page).toHaveURL(/\/screener\?item=\w+/);
    await expect(page.getByLabel("Line item")).not.toHaveValue("");
  });
});

test.describe("accessibility & responsiveness", () => {
  test("dark mode toggles and no horizontal overflow at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/company/MSFT?asOf=2022-01-01");
    await expect(page.getByTestId("date-scrubber")).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBe(375);
    await page.getByTestId("color-mode").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});
