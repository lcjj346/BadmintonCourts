/** @jest-environment node */
import { createListingSchema, createSessionSchema, boardFilterSchema } from "@/lib/schemas";
import { todaySgt } from "@/lib/time";

const base = {
  venueId: "3f0e37f5-2f3a-4a4a-9d4a-111111111111",
  date: todaySgt(),
  startTime: "08:00",
  endTime: "10:00",
  phone: "91234567",
  website: "",
};

describe("createListingSchema", () => {
  it("accepts a valid listing", () => {
    const r = createListingSchema.safeParse({ ...base, priceCents: 1600 });
    expect(r.success).toBe(true);
  });

  it("accepts free (0) and negotiable (null) prices", () => {
    expect(createListingSchema.safeParse({ ...base, priceCents: 0 }).success).toBe(true);
    expect(createListingSchema.safeParse({ ...base, priceCents: null }).success).toBe(true);
  });

  it("rejects non-SG phones", () => {
    for (const phone of ["1234567", "612345678", "9123456", "+6591234567"]) {
      expect(createListingSchema.safeParse({ ...base, phone, priceCents: 0 }).success).toBe(false);
    }
  });

  it("rejects past dates and dates beyond 8 weeks", () => {
    expect(createListingSchema.safeParse({ ...base, date: "2020-01-01", priceCents: 0 }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...base, date: "2099-01-01", priceCents: 0 }).success).toBe(false);
  });

  it("rejects endTime <= startTime", () => {
    expect(createListingSchema.safeParse({ ...base, startTime: "10:00", endTime: "08:00", priceCents: 0 }).success).toBe(false);
  });

  it("rejects filled honeypot", () => {
    expect(createListingSchema.safeParse({ ...base, website: "spam.com", priceCents: 0 }).success).toBe(false);
  });

  it("caps notes at 300 chars", () => {
    expect(createListingSchema.safeParse({ ...base, notes: "x".repeat(301), priceCents: 0 }).success).toBe(false);
  });
});

describe("createSessionSchema", () => {
  it("accepts a valid session", () => {
    const r = createSessionSchema.safeParse({
      ...base, playersNeeded: 2, skillLevel: "INTERMEDIATE", pricePerPlayerCents: 400,
    });
    expect(r.success).toBe(true);
  });

  it("rejects playersNeeded out of range", () => {
    for (const playersNeeded of [0, 21]) {
      expect(createSessionSchema.safeParse({
        ...base, playersNeeded, skillLevel: "BEGINNER", pricePerPlayerCents: null,
      }).success).toBe(false);
    }
  });
});

describe("boardFilterSchema", () => {
  it("parses empty filters", () => {
    expect(boardFilterSchema.parse({})).toEqual({});
  });

  it("drops invalid values rather than crashing the board, keeping valid siblings", () => {
    const r = boardFilterSchema.safeParse({ region: "MOON", time: "EVENING" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.region).toBeUndefined();
      expect(r.data.time).toBe("EVENING");
    }
  });
});
