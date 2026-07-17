/** @jest-environment node */
import dayjs from "dayjs";
import {
  createListingSchema, createSessionSchema, editListingSchema, editSessionSchema,
  boardFilterSchema, MAX_BATCH_ITEMS,
} from "@/lib/schemas";
import { todaySgt } from "@/lib/time";

const tomorrow = dayjs(todaySgt()).add(1, "day").format("YYYY-MM-DD");

const item = {
  venueId: "3f0e37f5-2f3a-4a4a-9d4a-111111111111",
  date: tomorrow,
  startTime: "08:00",
  endTime: "10:00",
};

const batch = (items: object[]) => ({ items, phone: "+6591234567", website: "" });

describe("createListingSchema", () => {
  it("accepts a valid single-item batch", () => {
    const r = createListingSchema.safeParse(batch([{ ...item, priceCents: 1600 }]));
    expect(r.success).toBe(true);
  });

  it("accepts a multi-item batch under one phone", () => {
    const r = createListingSchema.safeParse(
      batch([{ ...item, priceCents: 1600 }, { ...item, startTime: "18:00", endTime: "20:00", priceCents: 2000 }]),
    );
    expect(r.success).toBe(true);
  });

  it("rejects an empty items array", () => {
    expect(createListingSchema.safeParse(batch([])).success).toBe(false);
  });

  it(`rejects more than ${MAX_BATCH_ITEMS} items`, () => {
    const items = Array.from({ length: MAX_BATCH_ITEMS + 1 }, () => ({ ...item, priceCents: 0 }));
    expect(createListingSchema.safeParse(batch(items)).success).toBe(false);
  });

  it(`accepts exactly ${MAX_BATCH_ITEMS} items`, () => {
    const items = Array.from({ length: MAX_BATCH_ITEMS }, () => ({ ...item, priceCents: 0 }));
    expect(createListingSchema.safeParse(batch(items)).success).toBe(true);
  });

  it("accepts free (0) and negotiable (null) prices", () => {
    expect(createListingSchema.safeParse(batch([{ ...item, priceCents: 0 }])).success).toBe(true);
    expect(createListingSchema.safeParse(batch([{ ...item, priceCents: null }])).success).toBe(true);
  });

  it("accepts SG, MY and other regional phones", () => {
    for (const phone of [
      "+6591234567", "+6581234567", "+60123456789", "+601234567890",
      "+62812345678", "+85251234567", "+15551234567",
    ]) {
      expect(createListingSchema.safeParse({ ...batch([{ ...item, priceCents: 0 }]), phone }).success).toBe(true);
    }
  });

  it("rejects invalid phones", () => {
    for (const phone of [
      "1234567", "612345678", "9123456", "91234567", "+65712345", "+6071234567",
      "+999123456", "+65 9123", "60123456789",
    ]) {
      expect(createListingSchema.safeParse({ ...batch([{ ...item, priceCents: 0 }]), phone }).success).toBe(false);
    }
  });

  it("rejects past dates and dates beyond 8 weeks", () => {
    expect(createListingSchema.safeParse(batch([{ ...item, date: "2020-01-01", priceCents: 0 }])).success).toBe(false);
    expect(createListingSchema.safeParse(batch([{ ...item, date: "2099-01-01", priceCents: 0 }])).success).toBe(false);
  });

  it("rejects endTime <= startTime", () => {
    expect(
      createListingSchema.safeParse(batch([{ ...item, startTime: "10:00", endTime: "08:00", priceCents: 0 }])).success,
    ).toBe(false);
  });

  it("rejects a today start time that has already passed, accepts the same time tomorrow", () => {
    const past = createListingSchema.safeParse(batch([{ ...item, date: todaySgt(), startTime: "00:00", priceCents: 0 }]));
    expect(past.success).toBe(false);
    if (!past.success) {
      expect(past.error.issues[0].message).toBe(
        "That start time has already passed — pick a later time or another day",
      );
    }
    expect(
      createListingSchema.safeParse(batch([{ ...item, date: tomorrow, startTime: "00:00", priceCents: 0 }])).success,
    ).toBe(true);
  });

  it("rejects filled honeypot", () => {
    expect(
      createListingSchema.safeParse({ ...batch([{ ...item, priceCents: 0 }]), website: "spam.com" }).success,
    ).toBe(false);
  });

  it("accepts a custom venue (name + region) in place of venueId", () => {
    const { venueId, ...withoutVenueId } = item;
    void venueId;
    const r = createListingSchema.safeParse(
      batch([{ ...withoutVenueId, customVenueName: "Some Private Hall", customRegion: "EAST", priceCents: 0 }]),
    );
    expect(r.success).toBe(true);
  });

  it("rejects both venueId and a custom venue set together", () => {
    const r = createListingSchema.safeParse(
      batch([{ ...item, customVenueName: "Some Private Hall", customRegion: "EAST", priceCents: 0 }]),
    );
    expect(r.success).toBe(false);
  });

  it("rejects a custom venue missing its region", () => {
    const { venueId, ...withoutVenueId } = item;
    void venueId;
    const r = createListingSchema.safeParse(
      batch([{ ...withoutVenueId, customVenueName: "Some Private Hall", priceCents: 0 }]),
    );
    expect(r.success).toBe(false);
  });

  it("rejects neither venueId nor a custom venue", () => {
    const { venueId, ...withoutVenueId } = item;
    void venueId;
    const r = createListingSchema.safeParse(batch([{ ...withoutVenueId, priceCents: 0 }]));
    expect(r.success).toBe(false);
  });

  it("accepts a Telegram handle in place of phone", () => {
    const { phone: _phone, ...withoutPhone } = batch([{ ...item, priceCents: 0 }]);
    const r = createListingSchema.safeParse({ ...withoutPhone, telegramHandle: "some_user" });
    expect(r.success).toBe(true);
  });

  it("accepts both phone and Telegram handle", () => {
    const r = createListingSchema.safeParse({
      ...batch([{ ...item, priceCents: 0 }]), telegramHandle: "some_user",
    });
    expect(r.success).toBe(true);
  });

  it("rejects neither phone nor Telegram handle", () => {
    const { phone: _phone, ...withoutPhone } = batch([{ ...item, priceCents: 0 }]);
    expect(createListingSchema.safeParse(withoutPhone).success).toBe(false);
  });

  it("rejects an invalid Telegram handle", () => {
    const { phone: _phone, ...withoutPhone } = batch([{ ...item, priceCents: 0 }]);
    for (const telegramHandle of ["abc", "1abc", "has space", "-leading-dash"]) {
      expect(createListingSchema.safeParse({ ...withoutPhone, telegramHandle }).success).toBe(false);
    }
  });

  it("caps notes at 300 chars", () => {
    expect(
      createListingSchema.safeParse(batch([{ ...item, notes: "x".repeat(301), priceCents: 0 }])).success,
    ).toBe(false);
  });
});

describe("createSessionSchema", () => {
  const sessionItem = (over: object = {}) => ({
    ...item, playersNeeded: 2, maxPax: 6, skillMin: "MID_INTERMEDIATE", skillMax: "MID_INTERMEDIATE",
    pricePerPlayerCents: 400, ...over,
  });

  it("accepts a valid session batch", () => {
    expect(createSessionSchema.safeParse(batch([sessionItem()])).success).toBe(true);
  });

  it("rejects playersNeeded out of range", () => {
    for (const playersNeeded of [0, 31]) {
      expect(createSessionSchema.safeParse(batch([sessionItem({ playersNeeded, maxPax: 30 })])).success).toBe(false);
    }
  });

  it("accepts playersNeeded up to 30", () => {
    expect(createSessionSchema.safeParse(batch([sessionItem({ playersNeeded: 30, maxPax: 30 })])).success).toBe(true);
  });

  it("rejects maxPax over 30", () => {
    expect(createSessionSchema.safeParse(batch([sessionItem({ playersNeeded: 2, maxPax: 31 })])).success).toBe(false);
  });

  it("rejects maxPax below playersNeeded, accepts equal", () => {
    expect(createSessionSchema.safeParse(batch([sessionItem({ playersNeeded: 4, maxPax: 3 })])).success).toBe(false);
    expect(createSessionSchema.safeParse(batch([sessionItem({ playersNeeded: 4, maxPax: 4 })])).success).toBe(true);
  });

  it("accepts all seven skill levels", () => {
    for (const skillLevel of [
      "LOW_BEGINNER", "MID_BEGINNER", "HIGH_BEGINNER", "LOW_INTERMEDIATE",
      "MID_INTERMEDIATE", "HIGH_INTERMEDIATE", "ADVANCED",
    ]) {
      expect(
        createSessionSchema.safeParse(batch([sessionItem({ skillMin: skillLevel, skillMax: skillLevel })])).success,
      ).toBe(true);
    }
  });

  it("rejects an old three-value skill level", () => {
    expect(
      createSessionSchema.safeParse(batch([sessionItem({ skillMin: "INTERMEDIATE", skillMax: "INTERMEDIATE" })])).success,
    ).toBe(false);
  });

  it("accepts a skill range where max is higher than min", () => {
    expect(
      createSessionSchema.safeParse(batch([sessionItem({ skillMin: "MID_BEGINNER", skillMax: "LOW_INTERMEDIATE" })])).success,
    ).toBe(true);
  });

  it("rejects a skill range where max is lower than min", () => {
    expect(
      createSessionSchema.safeParse(batch([sessionItem({ skillMin: "LOW_INTERMEDIATE", skillMax: "MID_BEGINNER" })])).success,
    ).toBe(false);
  });
});

describe("editListingSchema", () => {
  it("accepts valid edit fields (venue isn't editable, phone is)", () => {
    expect(editListingSchema.safeParse({ ...item, priceCents: 1600, phone: "+6591234567" }).success).toBe(true);
  });

  it("rejects endTime <= startTime", () => {
    expect(
      editListingSchema.safeParse({ ...item, startTime: "10:00", endTime: "08:00", priceCents: 0, phone: "+6591234567" })
        .success,
    ).toBe(false);
  });

  it("rejects editing a slot into the past today", () => {
    expect(
      editListingSchema.safeParse({ ...item, date: todaySgt(), startTime: "00:00", priceCents: 0, phone: "+6591234567" })
        .success,
    ).toBe(false);
  });

  it("rejects neither phone nor Telegram handle", () => {
    expect(editListingSchema.safeParse({ ...item, priceCents: 1600 }).success).toBe(false);
  });

  it("accepts a Telegram handle in place of phone", () => {
    expect(editListingSchema.safeParse({ ...item, priceCents: 1600, telegramHandle: "some_user" }).success).toBe(true);
  });
});

describe("editSessionSchema", () => {
  it("accepts valid edit fields including skill range", () => {
    const r = editSessionSchema.safeParse({
      ...item, playersNeeded: 3, maxPax: 6, skillMin: "LOW_BEGINNER", skillMax: "MID_BEGINNER", pricePerPlayerCents: null,
      phone: "+6591234567",
    });
    expect(r.success).toBe(true);
  });

  it("rejects maxPax below playersNeeded", () => {
    const r = editSessionSchema.safeParse({
      ...item, playersNeeded: 4, maxPax: 3, skillMin: "LOW_BEGINNER", skillMax: "MID_BEGINNER", pricePerPlayerCents: null,
      phone: "+6591234567",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a reversed skill range", () => {
    const r = editSessionSchema.safeParse({
      ...item, playersNeeded: 3, maxPax: 6, skillMin: "ADVANCED", skillMax: "LOW_BEGINNER", pricePerPlayerCents: null,
    });
    expect(r.success).toBe(false);
  });
});

describe("boardFilterSchema", () => {
  it("parses empty filters", () => {
    expect(boardFilterSchema.parse({})).toEqual({ date: [], region: [], skill: [] });
  });

  it("drops invalid values rather than crashing the board, keeping valid siblings", () => {
    const r = boardFilterSchema.safeParse({ region: "MOON", timeFrom: "08:00" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.region).toEqual([]);
      expect(r.data.timeFrom).toBe("08:00");
    }
  });

  it("accepts repeated date/region/skill params as multi-select arrays", () => {
    const r = boardFilterSchema.safeParse({
      date: ["2026-07-20", "2026-07-21"],
      region: ["CENTRAL", "WEST"],
      skill: ["LOW_BEGINNER", "ADVANCED"],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.date).toEqual(["2026-07-20", "2026-07-21"]);
      expect(r.data.region).toEqual(["CENTRAL", "WEST"]);
      expect(r.data.skill).toEqual(["LOW_BEGINNER", "ADVANCED"]);
    }
  });

  it("normalizes a single repeated-param value to a one-element array", () => {
    const r = boardFilterSchema.safeParse({ date: "2026-07-20", region: "CENTRAL" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.date).toEqual(["2026-07-20"]);
      expect(r.data.region).toEqual(["CENTRAL"]);
    }
  });

  it("dedupes and drops invalid entries within a multi-select array", () => {
    const r = boardFilterSchema.safeParse({ region: ["CENTRAL", "MOON", "CENTRAL", "WEST"] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.region.sort()).toEqual(["CENTRAL", "WEST"]);
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
