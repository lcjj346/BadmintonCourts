import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingTour } from "@/components/OnboardingTour";

const STORAGE_KEY = "badmintonsg_tour_seen";

function renderWithTargets() {
  document.body.innerHTML = `
    <div data-tour="tabs"></div>
    <div data-tour="date-strip"></div>
    <div data-tour="filters"></div>
    <a data-tour="post-button"></a>
    <a data-tour="faq"></a>
    <div id="root"></div>
  `;
  return render(<OnboardingTour />, { container: document.getElementById("root")! });
}

beforeEach(() => {
  localStorage.clear();
});

describe("OnboardingTour", () => {
  it("auto-opens on first visit and walks through all 5 steps", async () => {
    const user = userEvent.setup();
    renderWithTargets();

    expect(await screen.findByText("Courts & Players")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Pick a date")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Narrow it down")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Post in seconds")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Need more help?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("does not auto-open on a repeat visit", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    renderWithTargets();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("skip tutorial closes it and marks it seen", async () => {
    const user = userEvent.setup();
    renderWithTargets();
    await screen.findByRole("dialog");
    await user.click(screen.getByText("Skip tutorial"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("the replay button reopens the tour after it was seen", async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, "1");
    renderWithTargets();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Replay tutorial" }));
    expect(await screen.findByText("Courts & Players")).toBeInTheDocument();
  });
});
