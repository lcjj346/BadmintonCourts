import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostForm } from "@/components/PostForm";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe("PostForm", () => {
  beforeEach(() => {
    // 2026-07-16T14:07:00Z = 22:07 SGT — well past the "08:00" a fresh entry defaults to.
    jest.useFakeTimers({ now: new Date("2026-07-16T14:07:00.000Z") });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { batchToken: "t", ids: ["1"] } }),
    } as Response);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("posts a today entry using a still-valid future start time instead of the stale default that has already passed", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<PostForm kind="court" venues={[]} />);

    // Flush the effect that reads the live SGT clock and corrects any entry
    // whose default startTime ("08:00") has already passed today.
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    await user.click(screen.getByRole("button", { name: /enter it and post now/i }));
    await user.type(screen.getByPlaceholderText("Venue name"), "Test Hall");
    await user.selectOptions(screen.getByLabelText("Venue region"), "EAST");
    await user.type(screen.getByPlaceholderText("9123 4567"), "91234567");
    await user.click(screen.getByRole("button", { name: /post court/i }));

    // If the bug were present, the stale "08:00" state would trip the
    // client-side "already passed" guard and block the fetch entirely.
    expect(screen.queryByText(/already passed/i)).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.items[0].startTime).not.toBe("08:00");
    expect(body.items[0].startTime > "22:07").toBe(true);
  });
});
