import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VenuePicker } from "@/components/VenuePicker";

const venues = [
  { id: "v1", name: "Our Tampines Hub", region: "EAST", venueType: "COMMUNITY_CENTRE", availabilityNote: null },
  { id: "v2", name: "Choa Chu Kang Sport Hall", region: "WEST", venueType: "SPORTS_HALL", availabilityNote: null },
  { id: "v3", name: "Dunman High (DUS)", region: "EAST", venueType: "SCHOOL", availabilityNote: "Weekends only" },
];

describe("VenuePicker", () => {
  it("filters by search text", async () => {
    render(<VenuePicker venues={venues} selectedId={null} onSelect={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText(/search/i), "tamp");
    expect(screen.getByText("Our Tampines Hub")).toBeInTheDocument();
    expect(screen.queryByText("Choa Chu Kang Sport Hall")).not.toBeInTheDocument();
  });

  it("calls onSelect with the venue id", async () => {
    const onSelect = jest.fn();
    render(<VenuePicker venues={venues} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("Choa Chu Kang Sport Hall"));
    expect(onSelect).toHaveBeenCalledWith("v2");
  });
});
