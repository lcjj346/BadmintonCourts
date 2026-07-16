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

  it("opens a calendar sheet on Pick, and picking a day navigates to it", async () => {
    render(<DateStrip />);
    await userEvent.click(screen.getByText("Pick"));
    expect(screen.getByRole("dialog", { name: "Jump to date" })).toBeInTheDocument();

    const today = todaySgt();
    const dayLabel = dayjs(today).format("D MMMM YYYY");
    await userEvent.click(screen.getByRole("button", { name: dayLabel }));

    expect(replace).toHaveBeenCalledWith(expect.stringContaining(`date=${today}`));
  });
});
