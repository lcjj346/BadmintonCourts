import { render, screen } from "@testing-library/react";
import { ListingCard } from "@/components/ListingCard";

const listing = {
  id: "l1", date: new Date("2026-07-11T00:00:00Z"), startTime: "08:00", endTime: "10:00",
  priceCents: 1600, notes: null, status: "AVAILABLE" as const, createdAt: new Date(),
  venue: { id: "v1", name: "Choa Chu Kang Sport Hall", region: "WEST" as const,
    venueType: "SPORTS_HALL" as const, availabilityNote: null },
};

describe("ListingCard", () => {
  it("shows venue, time, region, price and links to detail", () => {
    render(<ListingCard listing={listing} />);
    expect(screen.getByText("Choa Chu Kang Sport Hall")).toBeInTheDocument();
    expect(screen.getByText(/08:00.*10:00/)).toBeInTheDocument();
    expect(screen.getByText("$16")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/listing/l1");
  });

  it("renders Free, SOLD badge, and school availability note", () => {
    render(<ListingCard listing={{
      ...listing, priceCents: 0, status: "SOLD" as const,
      venue: { ...listing.venue, venueType: "SCHOOL" as const, availabilityNote: "Weekends & school holidays only" },
    }} />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("SOLD")).toBeInTheDocument();
    expect(screen.getByText(/Weekends & school holidays/)).toBeInTheDocument();
  });
});
