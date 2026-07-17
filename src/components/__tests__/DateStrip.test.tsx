import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
import { DateStrip } from "@/components/DateStrip";
import { todaySgt } from "@/lib/time";

const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

describe("DateStrip", () => {
  afterEach(() => replace.mockClear());

  it("renders an All pill, Today, 13 more days, and no Tmrw", () => {
    render(<DateStrip />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.queryByText("Tmrw")).not.toBeInTheDocument();
    // Pick (calendar) + All + Today + next 13 days = 16 buttons.
    expect(screen.getAllByRole("button")).toHaveLength(16);
    expect(screen.getByText("Pick")).toBeInTheDocument();
  });

  it("marks All active by default when no date param is set", () => {
    render(<DateStrip />);
    const all = screen.getByText("All").closest("button");
    expect(all?.className).toContain("bg-court");
  });

  it("tapping a day chip toggles it into the date filter", async () => {
    render(<DateStrip />);
    await userEvent.click(screen.getByText("Today"));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining(`date=${todaySgt()}`));
  });

  it("opens a calendar sheet on Pick; a single tap lights up that day and offers to use it, without navigating yet", async () => {
    render(<DateStrip />);
    await userEvent.click(screen.getByText("Pick"));
    expect(screen.getByRole("dialog", { name: "Pick a date, or two for a range" })).toBeInTheDocument();

    const today = todaySgt();
    const dayLabel = dayjs(today).format("D MMMM YYYY");
    await userEvent.click(screen.getByRole("button", { name: dayLabel }));

    // First tap only starts the range — no navigation yet, sheet re-titles to prompt
    // for an end date, and the tapped day is highlighted (filled, not just outlined).
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Tap an end date, or use just this day" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: dayLabel }).className).toContain("bg-court");
    expect(screen.getByRole("button", { name: /^Use Today$/ })).toBeInTheDocument();
  });

  it("tapping the same day twice, then confirming, selects just that single day", async () => {
    render(<DateStrip />);
    await userEvent.click(screen.getByText("Pick"));

    const today = todaySgt();
    const dayLabel = dayjs(today).format("D MMMM YYYY");
    await userEvent.click(screen.getByRole("button", { name: dayLabel }));
    await userEvent.click(screen.getByRole("button", { name: dayLabel }));
    await userEvent.click(screen.getByRole("button", { name: /^Use Today$/ }));

    expect(replace).toHaveBeenCalledTimes(1);
    const url = replace.mock.calls[0][0] as string;
    expect(url).toContain(`date=${today}`);
    expect(url.match(/date=/g)).toHaveLength(1);
  });

  it("tapping two different days highlights the range and applies all days in between on confirm", async () => {
    render(<DateStrip />);
    await userEvent.click(screen.getByText("Pick"));

    const start = dayjs(todaySgt()).add(2, "day");
    const end = dayjs(todaySgt()).add(4, "day");
    await userEvent.click(screen.getByRole("button", { name: start.format("D MMMM YYYY") }));
    await userEvent.click(screen.getByRole("button", { name: end.format("D MMMM YYYY") }));

    // Still hasn't navigated — the range is only highlighted, awaiting confirmation.
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Date range" })).toBeInTheDocument();
    // The day strictly between start and end lights up too (the connecting span).
    const middleLabel = start.add(1, "day").format("D MMMM YYYY");
    expect(screen.getByRole("button", { name: middleLabel }).className).toContain("bg-court-light");

    await userEvent.click(screen.getByRole("button", { name: "Use these 3 days" }));

    expect(replace).toHaveBeenCalledTimes(1);
    const url = replace.mock.calls[0][0] as string;
    for (const d of [start, start.add(1, "day"), end]) {
      expect(url).toContain(`date=${d.format("YYYY-MM-DD")}`);
    }
    expect(url.match(/date=/g)).toHaveLength(3);
  });
});
