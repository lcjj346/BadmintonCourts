/** @jest-environment node */
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt } from "@/lib/time";
import { createListing } from "@/services/listingService";
import { createSession } from "@/services/sessionService";
import { findPostByToken, closePostByToken, deletePostByToken } from "@/services/manageService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("manageService", () => {
  it("finds either post type by token; null for unknown", async () => {
    const venue = await makeVenue();
    const l = await createListing({
      venueId: venue.id, date: todaySgt(), startTime: "08:00", endTime: "10:00",
      priceCents: 0, phone: "+6591234567",
    });
    const s = await createSession({
      venueId: venue.id, date: todaySgt(), startTime: "18:00", endTime: "20:00",
      playersNeeded: 2, skillLevel: "LOW_BEGINNER", pricePerPlayerCents: null, phone: "+6581234567",
    });

    expect((await findPostByToken(l.editToken))?.type).toBe("listing");
    expect((await findPostByToken(s.editToken))?.type).toBe("session");
    expect(await findPostByToken("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("closes: listing → SOLD, session → FILLED", async () => {
    const venue = await makeVenue();
    const l = await createListing({
      venueId: venue.id, date: todaySgt(), startTime: "08:00", endTime: "10:00",
      priceCents: 0, phone: "+6591234567",
    });
    expect(await closePostByToken(l.editToken)).toBe(true);
    const row = await prisma.listing.findFirstOrThrow();
    expect(row.status).toBe("SOLD");
    expect(await closePostByToken("00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("closes a session by token → FILLED", async () => {
    const venue = await makeVenue();
    const s = await createSession({
      venueId: venue.id, date: todaySgt(), startTime: "18:00", endTime: "20:00",
      playersNeeded: 2, skillLevel: "LOW_BEGINNER", pricePerPlayerCents: null, phone: "+6581234567",
    });
    expect(await closePostByToken(s.editToken)).toBe(true);
    const row = await prisma.gameSession.findFirstOrThrow();
    expect(row.status).toBe("FILLED");
  });

  it("deletes by token", async () => {
    const venue = await makeVenue();
    const l = await createListing({
      venueId: venue.id, date: todaySgt(), startTime: "08:00", endTime: "10:00",
      priceCents: 0, phone: "+6591234567",
    });
    expect(await deletePostByToken(l.editToken)).toBe(true);
    expect(await prisma.listing.count()).toBe(0);
  });

  it("deletes a session by token", async () => {
    const venue = await makeVenue();
    const s = await createSession({
      venueId: venue.id, date: todaySgt(), startTime: "18:00", endTime: "20:00",
      playersNeeded: 2, skillLevel: "LOW_BEGINNER", pricePerPlayerCents: null, phone: "+6581234567",
    });
    expect(await deletePostByToken(s.editToken)).toBe(true);
    expect(await prisma.gameSession.count()).toBe(0);
  });
});
