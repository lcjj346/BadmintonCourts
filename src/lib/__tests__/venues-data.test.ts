/** @jest-environment node */
import venues from "../../../prisma/venues.json";

const REGIONS = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"];
const TYPES = ["SPORTS_HALL", "COMMUNITY_CENTRE", "SCHOOL", "OTHER"];

describe("venues.json", () => {
  it("has a meaningful set of venues", () => {
    expect(venues.length).toBeGreaterThanOrEqual(40);
  });

  it("every venue is well-formed", () => {
    for (const v of venues) {
      expect(v.name.length).toBeGreaterThan(2);
      expect(v.postalCode).toMatch(/^\d{6}$/);
      expect(REGIONS).toContain(v.region);
      expect(TYPES).toContain(v.venueType);
    }
  });

  it("schools carry an availability note", () => {
    for (const v of venues.filter((v) => v.venueType === "SCHOOL")) {
      expect(v.availabilityNote).toBeTruthy();
    }
  });

  it("has no duplicate names", () => {
    const names = venues.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
