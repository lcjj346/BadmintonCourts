import { render, screen } from "@testing-library/react";
import { DateStrip } from "@/components/DateStrip";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

describe("DateStrip", () => {
  it("renders an All pill, Today, 13 more days, and no Tmrw", () => {
    render(<DateStrip />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.queryByText("Tmrw")).not.toBeInTheDocument();
    // All + Today + next 13 days = 15 buttons.
    expect(screen.getAllByRole("button")).toHaveLength(15);
    expect(screen.getByLabelText("Jump to date")).toBeInTheDocument();
  });

  it("marks All active by default when no date param is set", () => {
    render(<DateStrip />);
    const all = screen.getByText("All").closest("button");
    expect(all?.className).toContain("bg-court");
  });
});
