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

  it("an entry added via '+ Add another court' starts at the next valid slot, not the stale 08:00 default", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<PostForm kind="court" venues={[]} />);
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    await user.click(screen.getByRole("button", { name: /add another court/i }));

    // 22:07 SGT — a second entry born with the static "08:00" default would silently
    // submit a past time; it must be created already bumped to the next slot.
    const starts = screen.getAllByLabelText("Start time") as HTMLSelectElement[];
    expect(starts).toHaveLength(2);
    expect(starts[1].value).toBe("22:30");
  });

  it("switching an entry's date back to today bumps a startTime that has already passed", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<PostForm kind="court" venues={[]} />);
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    // Move to tomorrow, where an early slot is legitimate, and pick one.
    await user.click(screen.getByLabelText("Date"));
    await user.click(screen.getByRole("button", { name: "17 July 2026" }));
    await user.selectOptions(screen.getByLabelText("Start time"), "08:00");

    // Back to today (22:07 SGT): 08:00 is now in the past and must be normalized in
    // the same change, not left stranded until the next 30s clock tick.
    await user.click(screen.getByLabelText("Date"));
    await user.click(screen.getByRole("button", { name: "16 July 2026" }));
    expect((screen.getByLabelText("Start time") as HTMLSelectElement).value).toBe("22:30");
  });

  it("sends the honeypot field's real DOM value, so a bot autofilling the form is caught", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { container } = render(<PostForm kind="court" venues={[]} />);
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    await user.click(screen.getByRole("button", { name: /enter it and post now/i }));
    await user.type(screen.getByPlaceholderText("Venue name"), "Test Hall");
    await user.selectOptions(screen.getByLabelText("Venue region"), "EAST");
    await user.type(screen.getByPlaceholderText("9123 4567"), "91234567");

    // Bots autofill via the DOM, invisibly to React — the input is uncontrolled,
    // so setting .value directly is exactly what the submit handler must pick up.
    const honeypot = container.querySelector('input[name="website"]') as HTMLInputElement;
    honeypot.value = "https://spam.example";

    await user.click(screen.getByRole("button", { name: /post court/i }));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body as string).website).toBe("https://spam.example");
  });
});
