// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setAsOf, setPeriod } from "@/store/rewindSlice";
import { makeStore } from "@/store/store";
import { RestatementTimeline, largestChange, timelineScale, type RestatementEvent } from "./RestatementTimeline";

const B = 1e9;
const event = (previous: string, filed: string, count: number, from: number, to: number): RestatementEvent => ({
  filed,
  previous,
  count,
  filings: [{ form: "10-K" }],
  largest: { metric: "REVENUE", label: "Revenue", periodLabel: "FY2018", from, to, change: (to - from) / Math.abs(from) },
});
const EVENTS = [
  event("2018-10-30", "2019-02-26", 4, 100 * B, 104 * B),
  event("2019-10-30", "2020-02-24", 46, 121.6 * B, 97 * B),
  event("2020-10-28", "2021-02-12", 1, 95 * B, 75 * B),
];
const DATES = ["2012-02-24", "2018-10-30", "2019-02-26", "2019-10-30", "2020-02-24", "2020-10-28", "2021-02-12", "2022-02-24"];

function mount(events: RestatementEvent[] = EVENTS) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: { company: { ticker: "GE", restatements: events } } }), { headers: { "content-type": "application/json" } })),
  );
  const store = makeStore();
  render(
    <Provider store={store}>
      <RestatementTimeline ticker="GE" filingDates={DATES} />
    </Provider>,
  );
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe("timelineScale", () => {
  it("places dates by calendar time between the first and last filing, with a tick each 1 January", () => {
    const { at, years } = timelineScale(["2020-01-01", "2022-01-01"]);
    expect(at("2020-01-01")).toBe(0);
    expect(at("2022-01-01")).toBe(1);
    expect(at("2021-01-01")).toBeCloseTo(0.5, 2);
    expect(at("2030-01-01")).toBe(1); // clamped
    // 2022 would start at the very end of the track, where its label has no room.
    expect(years.map((y) => y.year)).toEqual([2021]);
  });
  it("copes with one filing date or none", () => {
    expect(timelineScale(["2020-01-01"]).at("2020-01-01")).toBe(0.5);
    expect(timelineScale([]).years).toEqual([]);
  });
});

describe("largestChange", () => {
  it("writes the figure, both values and the relative change", () => {
    expect(largestChange(EVENTS[1])).toBe("Revenue FY2018 $121.6B → $97.0B (−20.2%)");
    const eps: RestatementEvent = { ...EVENTS[0], largest: { ...EVENTS[0].largest, metric: "EPS_DILUTED", label: "Diluted EPS", from: 1.5, to: 1.2, change: -0.2 } };
    expect(largestChange(eps)).toBe("Diluted EPS FY2018 $1.50 → $1.20 (−20.0%)");
  });
});

describe("RestatementTimeline", () => {
  it("draws one link per restatement, named with its date and size, pointing at a permalink", async () => {
    mount();
    const list = await screen.findByRole("list", { name: "Restatements by filing date" });
    const links = within(list).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("aria-label"))).toEqual([
      "Feb 26, 2019, 10-K: 4 figures changed",
      "Feb 24, 2020, 10-K: 46 figures changed",
      "Feb 12, 2021, 10-K: 1 figure changed",
    ]);
    expect(links[1]).toHaveAttribute("href", "?asOf=2020-02-24&vs=2019-10-30");
    expect(screen.getByText(/3 filing dates changed 51 figures already on file/)).toBeInTheDocument();
    // Bar heights are proportional to the count, tallest at full height.
    const heights = links.map((l) => Number.parseFloat(getComputedStyle(l.firstElementChild!).height));
    expect(heights[1]).toBe(72);
    expect(heights[0]).toBe(Math.round((4 / 46) * 72));
    expect(heights[2]).toBe(3); // never thinner than three pixels
    expect(screen.getByTestId("restatement-selected")).toHaveTextContent("Largest: Feb 24, 2020, 46 figures changed.");
  });

  it("selecting one sets the as-of date to the filing and the comparison to the filing date before it", async () => {
    const user = userEvent.setup();
    const store = mount();
    const link = await screen.findByRole("link", { name: /Feb 24, 2020/ });
    await user.click(link);
    expect(store.getState().rewind).toMatchObject({ asOf: "2020-02-24", compareFrom: "2019-10-30" });
    expect(link).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("restatement-selected")).toHaveTextContent(
      "Feb 24, 2020 · 10-K · 46 figures changed since Oct 30, 2019 · largest: Revenue FY2018 $121.6B → $97.0B (−20.2%)",
    );
  });

  it("opens from the keyboard and steps to the earlier and later restatement", async () => {
    const user = userEvent.setup();
    const store = mount();
    const first = await screen.findByRole("link", { name: /Feb 26, 2019/ });
    const earlier = screen.getByRole("button", { name: "Earlier restatement" });
    const later = screen.getByRole("button", { name: "Later restatement" });
    // Nothing open and no as-of date: "earlier" starts from the newest, there is nothing later.
    expect(later).toBeDisabled();
    await user.click(earlier);
    expect(store.getState().rewind.asOf).toBe("2021-02-12");
    await user.click(earlier);
    expect(store.getState().rewind).toMatchObject({ asOf: "2020-02-24", compareFrom: "2019-10-30" });
    await user.click(later);
    expect(store.getState().rewind.asOf).toBe("2021-02-12");
    expect(later).toBeDisabled();

    first.focus();
    await user.keyboard("{Enter}");
    expect(store.getState().rewind).toMatchObject({ asOf: "2019-02-26", compareFrom: "2018-10-30" });
    expect(earlier).toBeDisabled();
  });

  it("steps relative to the as-of date when no restatement is open, and keeps the period in the link", async () => {
    const user = userEvent.setup();
    const store = mount();
    await screen.findByRole("link", { name: /Feb 26, 2019/ });
    store.dispatch(setAsOf("2019-12-31"));
    store.dispatch(setPeriod("quarterly"));
    expect(await screen.findByRole("link", { name: /Feb 12, 2021/ })).toHaveAttribute("href", "?asOf=2021-02-12&vs=2020-10-28&period=quarterly");
    await user.click(screen.getByRole("button", { name: "Later restatement" }));
    expect(store.getState().rewind.asOf).toBe("2020-02-24");
  });

  it("says so when no filing changed anything", async () => {
    mount([]);
    expect(await screen.findByText(/No filing in the snapshot materially changed a figure/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
