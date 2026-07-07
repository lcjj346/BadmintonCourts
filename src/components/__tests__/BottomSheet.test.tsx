import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomSheet } from "@/components/BottomSheet";

describe("BottomSheet", () => {
  it("renders children when open, nothing when closed", () => {
    const { rerender } = render(<BottomSheet open onClose={() => {}} title="Region">hi</BottomSheet>);
    expect(screen.getByText("hi")).toBeInTheDocument();
    rerender(<BottomSheet open={false} onClose={() => {}} title="Region">hi</BottomSheet>);
    expect(screen.queryByText("hi")).not.toBeInTheDocument();
  });

  it("calls onClose on backdrop click", async () => {
    const onClose = jest.fn();
    render(<BottomSheet open onClose={onClose} title="Region">hi</BottomSheet>);
    await userEvent.click(screen.getByTestId("sheet-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });
});
