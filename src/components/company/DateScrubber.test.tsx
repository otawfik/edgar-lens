import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { makeStore } from "@/store/store";
import { setAsOf } from "@/store/rewindSlice";
import { DateScrubber, stopIndex } from "./DateScrubber";

const stops = ["2023-02-15", "2023-05-01", "2024-02-15"];
const filings = [
  { filed: "2023-02-15", form: "10-K" },
  { filed: "2023-05-01", form: "10-Q" },
  { filed: "2024-02-15", form: "10-K" },
];

describe("stopIndex", () => {
  it("maps an as-of date to the last filing on or before it", () => {
    expect(stopIndex(stops, null)).toBe(3);
    expect(stopIndex(stops, "2023-05-01")).toBe(1);
    expect(stopIndex(stops, "2023-12-31")).toBe(1);
    expect(stopIndex(stops, "2022-01-01")).toBe(-1);
  });
});

describe("DateScrubber", () => {
  it("shows today by default and steps back through filings with the buttons", async () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <DateScrubber stops={stops} filings={filings} />
      </Provider>,
    );
    expect(screen.getByTestId("as-of-label")).toHaveTextContent("Today");
    await userEvent.click(screen.getByRole("button", { name: "Previous filing" }));
    expect(store.getState().rewind.asOf).toBe("2024-02-15");
    expect(screen.getByTestId("as-of-label")).toHaveTextContent("Feb 15, 2024");
    expect(screen.getByText("10-K")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous filing" }));
    expect(store.getState().rewind.asOf).toBe("2023-05-01");
    await userEvent.click(screen.getByRole("button", { name: "Jump to today" }));
    expect(store.getState().rewind.asOf).toBeNull();
  });

  it("reflects a date set elsewhere (URL hydration) and explains an empty past", () => {
    const store = makeStore();
    store.dispatch(setAsOf("2020-01-01"));
    render(
      <Provider store={store}>
        <DateScrubber stops={stops} filings={filings} />
      </Provider>,
    );
    expect(screen.getByTestId("as-of-label")).toHaveTextContent("nothing filed yet");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "Feb 15, 2023");
  });
});
