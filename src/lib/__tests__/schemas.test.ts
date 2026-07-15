/** @jest-environment node */
import dayjs from "dayjs";
import { createListingSchema, createSessionSchema, boardFilterSchema } from "@/lib/schemas";
import { todaySgt } from "@/lib/time";

const tomorrow = dayjs(todaySgt()).add(1, "day").format("YYYY-MM-DD");

const base = {
  venueId: "3f0e37f5-2f3a-4a4a-9d4a-111111111111",
  date: tomorrow,
  startTime: "08:00",
  endTime: "10:00",
  phone: "+6591234567",
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

  it("accepts SG, MY and other regional phones", () => {
    for (const phone of [
      "+6591234567", "+6581234567", "+60123456789", "+601234567890",
      "+62812345678", "+85251234567", "+15551234567",
    ]) {
      expect(createListingSchema.safeParse({ ...base, phone, priceCents: 0 }).success).toBe(true);
    }
  });

  it("rejects invalid phones", () => {
    for (const phone of [
      "1234567", "612345678", "9123456", "91234567", "+65712345", "+6071234567",
      "+999123456", "+65 9123", "60123456789",
    ]) {
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

  it("rejects a today start time that has already passed, accepts the same time tomorrow", () => {
    const past = createListingSchema.safeParse({ ...base, date: todaySgt(), startTime: "00:00", priceCents: 0 });
    expect(past.success).toBe(false);
    if (!past.success) {
      expect(past.error.issues[0].message).toBe(
        "That start time has already passed — pick a later time or another day",
      );
      expect(past.error.issues[0].path).toEqual(["startTime"]);
    }
    expect(createListingSchema.safeParse({ ...base, date: tomorrow, startTime: "00:00", priceCents: 0 }).success).toBe(true);
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
      ...base, playersNeeded: 2, skillLevel: "MID_INTERMEDIATE", pricePerPlayerCents: 400,
    });
    expect(r.success).toBe(true);
  });

  it("rejects playersNeeded out of range", () => {
    for (const playersNeeded of [0, 51]) {
      expect(createSessionSchema.safeParse({
        ...base, playersNeeded, skillLevel: "LOW_BEGINNER", pricePerPlayerCents: null,
      }).success).toBe(false);
    }
  });

  it("accepts playersNeeded up to 50", () => {
    expect(createSessionSchema.safeParse({
      ...base, playersNeeded: 50, skillLevel: "LOW_BEGINNER", pricePerPlayerCents: null,
    }).success).toBe(true);
  });

  it("accepts all seven skill levels", () => {
    for (const skillLevel of [
      "LOW_BEGINNER", "MID_BEGINNER", "HIGH_BEGINNER", "LOW_INTERMEDIATE",
      "MID_INTERMEDIATE", "HIGH_INTERMEDIATE", "ADVANCED",
    ]) {
      expect(createSessionSchema.safeParse({
        ...base, playersNeeded: 2, skillLevel, pricePerPlayerCents: null,
      }).success).toBe(true);
    }
  });

  it("rejects an old three-value skill level", () => {
    expect(createSessionSchema.safeParse({
      ...base, playersNeeded: 2, skillLevel: "INTERMEDIATE", pricePerPlayerCents: null,
    }).success).toBe(false);
  });
});

describe("boardFilterSchema", () => {
  it("parses empty filters", () => {
    expect(boardFilterSchema.parse({})).toEqual({});
  });

  it("drops invalid values rather than crashing the board, keeping valid siblings", () => {
    const r = boardFilterSchema.safeParse({ region: "MOON", timeFrom: "08:00" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.region).toBeUndefined();
      expect(r.data.timeFrom).toBe("08:00");
    }
  });

  it("accepts timeFrom/timeTo range and drops malformed times", () => {
    const r = boardFilterSchema.safeParse({ timeFrom: "08:00", timeTo: "18:00" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.timeFrom).toBe("08:00");
      expect(r.data.timeTo).toBe("18:00");
    }
    const bad = boardFilterSchema.safeParse({ timeFrom: "25:99" });
    expect(bad.success).toBe(true);
    if (bad.success) expect(bad.data.timeFrom).toBeUndefined();
  });

  it("accepts the available flag", () => {
    const r = boardFilterSchema.safeParse({ available: "1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.available).toBe("1");
  });
});
