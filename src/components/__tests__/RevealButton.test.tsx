import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RevealButton } from "@/components/RevealButton";

describe("RevealButton", () => {
  afterEach(() => jest.restoreAllMocks());

  it("reveals the phone with tel and WhatsApp links", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { phone: "91234567" }, error: null }),
    }) as jest.Mock;

    render(<RevealButton endpoint="/api/listings/l1/reveal" />);
    await userEvent.click(screen.getByRole("button", { name: /reveal/i }));

    expect(await screen.findByText("9123 4567")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /call/i })).toHaveAttribute("href", "tel:+6591234567");
    expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute(
      "href", "https://wa.me/6591234567",
    );
    expect(global.fetch).toHaveBeenCalledWith("/api/listings/l1/reveal", { method: "POST" });
  });

  it("shows rate-limit message on 429", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ data: null, error: "Too many requests — try again later" }),
    }) as jest.Mock;

    render(<RevealButton endpoint="/api/listings/l1/reveal" />);
    await userEvent.click(screen.getByRole("button", { name: /reveal/i }));
    expect(await screen.findByText(/too many requests/i)).toBeInTheDocument();
  });
});
