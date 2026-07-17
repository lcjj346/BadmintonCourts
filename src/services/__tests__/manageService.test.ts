/** @jest-environment node */
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt } from "@/lib/time";
import { createListingBatch } from "@/services/listingService";
import { createSessionBatch } from "@/services/sessionService";
import {
  findPostsByBatchToken, closePost, reopenPost, deletePost, updatePlayersNeeded, editListing, editSession,
} from "@/services/manageService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function listingItem(venueId: string, over: Record<string, unknown> = {}) {
  return {
    venueId, date: todaySgt(), startTime: "08:00", endTime: "10:00",
    priceCents: 0, notes: undefined, ...over,
  };
}
function sessionItem(venueId: string, over: Record<string, unknown> = {}) {
  return {
    venueId, date: todaySgt(), startTime: "18:00", endTime: "20:00",
    playersNeeded: 2, maxPax: 6, skillMin: "LOW_BEGINNER", skillMax: "LOW_BEGINNER", pricePerPlayerCents: null,
    notes: undefined, ...over,
  };
}

describe("manageService", () => {
  it("finds either post type by batch token; empty for unknown", async () => {
    const venue = await makeVenue();
    const l = await createListingBatch([listingItem(venue.id)] as never, { phone: "+6591234567" });
    const s = await createSessionBatch([sessionItem(venue.id)] as never, { phone: "+6581234567" });

    expect((await findPostsByBatchToken(l.batchToken))[0]?.type).toBe("listing");
    expect((await findPostsByBatchToken(s.batchToken))[0]?.type).toBe("session");
    expect(await findPostsByBatchToken("00000000-0000-0000-0000-000000000000")).toEqual([]);
  });

  it("a batch token surfaces every post created under it", async () => {
    const venue = await makeVenue();
    const { batchToken } = await createListingBatch(
      [listingItem(venue.id), listingItem(venue.id, { startTime: "18:00", endTime: "20:00" })] as never,
      { phone: "+6591234567" },
    );
    expect(await findPostsByBatchToken(batchToken)).toHaveLength(2);
  });

  it("closes: listing → SOLD, session → FILLED", async () => {
    const venue = await makeVenue();
    const l = await createListingBatch([listingItem(venue.id)] as never, { phone: "+6591234567" });
    const [{ post }] = await findPostsByBatchToken(l.batchToken);
    expect(await closePost(l.batchToken, "listing", post.id)).toBe(true);
    expect((await prisma.listing.findFirstOrThrow()).status).toBe("SOLD");
    expect(await closePost(l.batchToken, "listing", "00000000-0000-0000-0000-000000000000")).toBe(false);
  });

  it("closes a session by token → FILLED", async () => {
    const venue = await makeVenue();
    const s = await createSessionBatch([sessionItem(venue.id)] as never, { phone: "+6581234567" });
    const [{ post }] = await findPostsByBatchToken(s.batchToken);
    expect(await closePost(s.batchToken, "session", post.id)).toBe(true);
    expect((await prisma.gameSession.findFirstOrThrow()).status).toBe("FILLED");
  });

  it("closePost stamps closedAt; reopenPost clears it", async () => {
    const venue = await makeVenue();
    const l = await createListingBatch([listingItem(venue.id)] as never, { phone: "+6591234567" });
    const [{ post }] = await findPostsByBatchToken(l.batchToken);

    await closePost(l.batchToken, "listing", post.id);
    expect((await prisma.listing.findFirstOrThrow()).closedAt).not.toBeNull();

    await reopenPost(l.batchToken, "listing", post.id);
    const row = await prisma.listing.findFirstOrThrow();
    expect(row.status).toBe("AVAILABLE");
    expect(row.closedAt).toBeNull();
  });

  it("a token can't act on a row from a different batch", async () => {
    const venue = await makeVenue();
    const a = await createListingBatch([listingItem(venue.id)] as never, { phone: "+6591234567" });
    const b = await createListingBatch([listingItem(venue.id)] as never, { phone: "+6581234567" });
    const [{ post }] = await findPostsByBatchToken(a.batchToken);
    expect(await closePost(b.batchToken, "listing", post.id)).toBe(false);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: post.id } })).status).toBe("AVAILABLE");
  });

  it("deletes by token", async () => {
    const venue = await makeVenue();
    const l = await createListingBatch([listingItem(venue.id)] as never, { phone: "+6591234567" });
    const [{ post }] = await findPostsByBatchToken(l.batchToken);
    expect(await deletePost(l.batchToken, "listing", post.id)).toBe(true);
    expect(await prisma.listing.count()).toBe(0);
  });

  it("deletes a session by token", async () => {
    const venue = await makeVenue();
    const s = await createSessionBatch([sessionItem(venue.id)] as never, { phone: "+6581234567" });
    const [{ post }] = await findPostsByBatchToken(s.batchToken);
    expect(await deletePost(s.batchToken, "session", post.id)).toBe(true);
    expect(await prisma.gameSession.count()).toBe(0);
  });

  it("findPostsByBatchToken returns playersNeeded for sessions", async () => {
    const venue = await makeVenue();
    const s = await createSessionBatch([sessionItem(venue.id, { playersNeeded: 3 })] as never, { phone: "+6581234567" });
    expect((await findPostsByBatchToken(s.batchToken))[0]?.post.playersNeeded).toBe(3);
  });

  it("updatePlayersNeeded updates a session and returns true", async () => {
    const venue = await makeVenue();
    const s = await createSessionBatch([sessionItem(venue.id)] as never, { phone: "+6581234567" });
    const [{ post }] = await findPostsByBatchToken(s.batchToken);
    expect(await updatePlayersNeeded(s.batchToken, post.id, 5)).toBe(true);
    expect((await prisma.gameSession.findFirstOrThrow()).playersNeeded).toBe(5);
  });

  it("updatePlayersNeeded returns false for a listing and for an unknown token", async () => {
    const venue = await makeVenue();
    const l = await createListingBatch([listingItem(venue.id)] as never, { phone: "+6591234567" });
    const [{ post }] = await findPostsByBatchToken(l.batchToken);
    expect(await updatePlayersNeeded(l.batchToken, post.id, 5)).toBe(false);
    expect(await updatePlayersNeeded("00000000-0000-0000-0000-000000000000", post.id, 5)).toBe(false);
  });

  it("editListing updates date/time/price/notes", async () => {
    const venue = await makeVenue();
    const l = await createListingBatch([listingItem(venue.id)] as never, { phone: "+6591234567" });
    const [{ post }] = await findPostsByBatchToken(l.batchToken);
    const ok = await editListing(l.batchToken, post.id, {
      date: todaySgt(), startTime: "09:00", endTime: "11:00", priceCents: 2000, notes: "updated",
      phone: "+6591234567",
    });
    expect(ok).toBe(true);
    const row = await prisma.listing.findFirstOrThrow();
    expect(row.startTime).toBe("09:00");
    expect(row.priceCents).toBe(2000);
    expect(row.notes).toBe("updated");
    expect(row.phone).toBe("+6591234567");
  });

  it("editListing can switch from phone to Telegram-only", async () => {
    const venue = await makeVenue();
    const l = await createListingBatch([listingItem(venue.id)] as never, { phone: "+6591234567" });
    const [{ post }] = await findPostsByBatchToken(l.batchToken);
    const ok = await editListing(l.batchToken, post.id, {
      date: todaySgt(), startTime: "09:00", endTime: "11:00", priceCents: 2000, notes: "updated",
      telegramHandle: "new_handle",
    });
    expect(ok).toBe(true);
    const row = await prisma.listing.findFirstOrThrow();
    expect(row.phone).toBeNull();
    expect(row.telegramHandle).toBe("new_handle");
  });

  it("editSession updates time/skill/players/notes", async () => {
    const venue = await makeVenue();
    const s = await createSessionBatch([sessionItem(venue.id)] as never, { phone: "+6581234567" });
    const [{ post }] = await findPostsByBatchToken(s.batchToken);
    const ok = await editSession(s.batchToken, post.id, {
      date: todaySgt(), startTime: "19:00", endTime: "21:00", playersNeeded: 4, maxPax: 6,
      skillMin: "ADVANCED", skillMax: "ADVANCED", pricePerPlayerCents: 1000, notes: "updated",
      phone: "+6581234567",
    });
    expect(ok).toBe(true);
    const row = await prisma.gameSession.findFirstOrThrow();
    expect(row.startTime).toBe("19:00");
    expect(row.playersNeeded).toBe(4);
    expect(row.skillMin).toBe("ADVANCED");
    expect(row.notes).toBe("updated");
  });
});
