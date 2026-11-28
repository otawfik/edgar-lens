// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import { theme } from "@/theme/theme";
import { CategoryChart, type ChartSeries } from "./CategoryChart";

const labels = ["FY2016", "FY2017", "FY2018"];
const money = (v: number | null) => (v === null ? "—" : `$${v}B`);
const two: ChartSeries[] = [
  { id: "asOf", label: "As known on Jun 30, 2019", values: [119, 118, 122] },
  { id: "now", label: "As reported today", values: [119, 99, 97] },
];

function chart(kind: "bar" | "line", series: ChartSeries[], showLegend = true) {
  return render(
    <ThemeProvider theme={theme}>
      <CategoryChart kind={kind} title="Revenue by fiscal year" labels={labels} series={series} height={300} format={money} showLegend={showLegend} />
    </ThemeProvider>,
  );
}

/** The y coordinates a bar's outline runs to. */
function verticals(d: string): number[] {
  return d
    .split("V")
    .slice(1)
    .map((part) => Number.parseFloat(part));
}

describe("CategoryChart", () => {
  it("names the chart and gives every category its values as text", () => {
    chart("bar", two);
    const group = screen.getByRole("group", { name: "Revenue by fiscal year" });
    const categories = within(group).getAllByRole("img");
    expect(categories.map((c) => c.getAttribute("aria-label"))).toEqual([
      "FY2016: As known on Jun 30, 2019 $119B; As reported today $119B",
      "FY2017: As known on Jun 30, 2019 $118B; As reported today $99B",
      "FY2018: As known on Jun 30, 2019 $122B; As reported today $97B",
    ]);
    // Two bars per category, a tick label per round value, a legend entry per series.
    expect(group.querySelectorAll(".category path")).toHaveLength(6);
    expect(within(group).getByText("$125B")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Series" })).getAllByRole("listitem")).toHaveLength(2);
  });

  it("is one tab stop; arrow keys, Home and End walk the categories and show the tooltip", async () => {
    const user = userEvent.setup();
    chart("bar", two);
    const [first, second, third] = screen.getAllByRole("img");
    expect([first, second, third].map((c) => c.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    expect(screen.queryByTestId("chart-tooltip")).toBeNull();

    await user.tab();
    expect(first).toHaveFocus();
    expect(screen.getByTestId("chart-tooltip")).toHaveTextContent("FY2016");

    await user.keyboard("{ArrowRight}");
    expect(second).toHaveFocus();
    expect(screen.getByTestId("chart-tooltip")).toHaveTextContent("FY2017As known on Jun 30, 2019$118BAs reported today$99B");
    await user.keyboard("{End}");
    expect(third).toHaveFocus();
    await user.keyboard("{ArrowRight}"); // already at the end
    expect(third).toHaveFocus();
    await user.keyboard("{Home}");
    expect(first).toHaveFocus();
    // The stop moved with the focus, so tabbing back in returns to the same place.
    expect(first).toHaveAttribute("tabindex", "0");

    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("chart-tooltip")).toBeNull();
  });

  it("shows the tooltip for the category under the pointer", async () => {
    const user = userEvent.setup();
    chart("bar", two);
    await user.hover(screen.getAllByRole("img")[2]);
    expect(screen.getByTestId("chart-tooltip")).toHaveTextContent("FY2018");
  });

  it("breaks a line at a missing value, reads it as a dash and marks a point with no neighbours", () => {
    chart("line", [{ id: "m", label: "Operating margin", values: [12, null, 15] }]);
    const group = screen.getByRole("group");
    // Two separate one-point segments: two move commands, no line command.
    const d = group.querySelector("path")!.getAttribute("d")!;
    expect(d.split("M")).toHaveLength(3);
    expect(d).not.toContain("L");
    expect(group.querySelectorAll("circle")).toHaveLength(2);
    expect(screen.getAllByRole("img")[1]).toHaveAccessibleName("FY2017: Operating margin —");
  });

  it("draws a negative bar below the zero line and can hide the legend", () => {
    chart("bar", [{ id: "ni", label: "Net income", values: [8, -22, 5] }], false);
    const [up, down] = [...screen.getByRole("group").querySelectorAll(".category path")].map((p) => p.getAttribute("d")!);
    const zero = Number.parseFloat(up.split(",")[1]);
    expect(Math.min(...verticals(up))).toBeLessThan(zero);
    expect(Math.max(...verticals(down))).toBeGreaterThan(zero);
    expect(screen.queryByRole("list", { name: "Series" })).toBeNull();
  });
});
