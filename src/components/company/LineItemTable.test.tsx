// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { CompanyQuery } from "@/graphql/types.generated";
import { LineItemTable } from "./LineItemTable";

type Company = NonNullable<CompanyQuery["company"]>;
type Point = Company["lineItems"][number]["points"][number];

const B = 1e9;
const filing = (filed: string) => ({ accession: `A-${filed}`, form: "10-K", filed, period: filed, url: "https://example.test/doc", indexUrl: "https://example.test/index" });

/** A figure first filed at `first` and, when `then` is given, restated to it a year later. */
function point(year: number, first: number, then?: number): Point {
  const history = [{ value: first, filing: filing(`${year + 1}-02-15`) }, ...(then === undefined ? [] : [{ value: then, filing: filing(`${year + 2}-02-15`) }])];
  return {
    end: `${year}-12-31`,
    label: `FY${year}`,
    fiscalYear: year,
    value: first,
    derived: false,
    vintages: 1,
    revised: false,
    vintage: history[0],
    first: history[0],
    history,
  };
}

const item = (metric: Company["lineItems"][number]["metric"], label: string, points: Point[]) => ({ metric, label, unit: "USD", points });

// Net income has no FY2017 figure, so the grid has a hole in the middle.
const asOfData = {
  lineItems: [
    item("REVENUE", "Revenue", [point(2016, 119 * B), point(2017, 118 * B, 99 * B), point(2018, 122 * B, 97 * B)]),
    item("NET_INCOME", "Net income", [point(2016, 8 * B), point(2018, -22 * B)]),
  ],
} as unknown as Company;
const latestData = {
  lineItems: [
    item("REVENUE", "Revenue", [{ ...point(2016, 119 * B) }, { ...point(2017, 118 * B), value: 99 * B }, { ...point(2018, 122 * B), value: 97 * B }]),
    item("NET_INCOME", "Net income", [point(2016, 8 * B), point(2018, -22 * B)]),
  ],
} as unknown as Company;

const mount = () => render(<LineItemTable asOfData={asOfData} latestData={latestData} asOf="2019-06-30" />);
const figure = (name: RegExp) => screen.getByRole("button", { name });

// That the history tooltip opens on keyboard focus needs a real browser's :focus-visible; e2e/rewind.spec.ts checks it.
describe("LineItemTable keyboard", () => {
  it("names every figure with its line item and period, and whether it later changed", () => {
    mount();
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Revenue, FY2016: $119.0B",
      "Revenue, FY2017: $118.0B, later changed",
      "Revenue, FY2018: $122.0B, later changed",
      "Net income, FY2016: $8.0B",
      "Net income, FY2018: -$22.0B",
    ]);
  });

  it("is a single tab stop and the arrow keys move between figures, skipping empty cells", async () => {
    const user = userEvent.setup();
    mount();
    expect(screen.getAllByRole("button").filter((b) => b.tabIndex === 0)).toHaveLength(1);

    await user.tab(); // the scrollable region
    await user.tab();
    expect(figure(/Revenue, FY2016/)).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(figure(/Revenue, FY2017/)).toHaveFocus();
    await user.keyboard("{ArrowDown}"); // no net income for FY2017: nothing below, focus stays
    expect(figure(/Revenue, FY2017/)).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(figure(/Net income, FY2018/)).toHaveFocus();
    await user.keyboard("{ArrowLeft}"); // jumps the FY2017 gap
    expect(figure(/Net income, FY2016/)).toHaveFocus();
    await user.keyboard("{End}");
    expect(figure(/Net income, FY2018/)).toHaveFocus();
    await user.keyboard("{ArrowUp}{Home}");
    expect(figure(/Revenue, FY2016/)).toHaveFocus();
    // The stop follows the focus, so leaving and returning lands on the same figure.
    await user.keyboard("{ArrowRight}");
    expect(figure(/Revenue, FY2017/)).toHaveAttribute("tabindex", "0");
    expect(screen.getAllByRole("button").filter((b) => b.tabIndex === 0)).toHaveLength(1);
  });
});
