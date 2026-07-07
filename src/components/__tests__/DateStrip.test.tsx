import { render, screen } from "@testing-library/react";
import { DateStrip } from "@/components/DateStrip";
import { todaySgt } from "@/lib/time";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

describe("DateStrip", () => {
  it("renders Today first and 14 day pills", () => {
    render(<DateStrip selected={todaySgt()} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Tmrw")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(14);
    expect(screen.getByLabelText("Jump to date")).toBeInTheDocument();
  });
});
