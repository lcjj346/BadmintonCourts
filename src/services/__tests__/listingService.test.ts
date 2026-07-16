/** @jest-environment node */
import dayjs from "dayjs";
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt, strToDate } from "@/lib/time";
import {
  createListingBatch, listListings, getListing, revealListingContact,
  sweepExpired, ActivePostCapError,
} from "@/services/listingService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

// Default fixture dated TOMORROW so a same-day expiry sweep can never race the test clock.
const tomorrow = dayjs(todaySgt()).add(1, "day").format("YYYY-MM-DD");

const input = (venueId: string, over: Record<string, unknown> = {}) => ({
  venueId, date: tomorrow, startTime: "08:00", endTime: "10:00",
  priceCents: 1600, phone: "+6591234567", ...over,
});

// Single-item wrapper around the batch-create service, mirroring the old single-post API
// so most test bodies stay unchanged.
async function createListing(item: ReturnType<typeof input>) {
  const { phone, ...rest } = item;
  const { batchToken, ids } = await createListingBatch(
    [rest] as Parameters<typeof createListingBatch>[0],
    { phone: phone as string },
  );
  return { id: ids[0], batchToken };
}

describe("listingService", () => {
  it("creates and returns id + batchToken; board payload has no phone/batchToken", async () => {
    const venue = await makeVenue();
    const { id, batchToken } = await createListing(input(venue.id));
    expect(batchToken).toMatch(/^[0-9a-f-]{36}$/);

    const rows = await listListings({});
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0]).not.toHaveProperty("phone");
    expect(rows[0]).not.toHaveProperty("batchToken");
    expect(rows[0].venue?.name).toBe("Test Hall");

    const detail = await getListing(id);
    expect(detail).not.toHaveProperty("phone");
  });

  it("creates a listing at a custom (unlisted) venue, no venueId", async () => {
    const { batchToken, ids } = await createListingBatch(
      [{
        date: tomorrow, startTime: "08:00", endTime: "10:00", priceCents: 1600,
        customVenueName: "Some Private Hall", customRegion: "EAST",
      }] as Parameters<typeof createListingBatch>[0],
      { phone: "+6591234567" },
    );
    expect(batchToken).toMatch(/^[0-9a-f-]{36}$/);

    const row = await prisma.listing.findUniqueOrThrow({ where: { id: ids[0] } });
    expect(row.venueId).toBeNull();
    expect(row.customVenueName).toBe("Some Private Hall");
    expect(row.customRegion).toBe("EAST");

    const rows = await listListings({ region: "EAST" });
    expect(rows).toHaveLength(1);
    expect(rows[0].venue).toBeNull();
  });

  it("filters by region, venue, and time range", async () => {
    const west = await makeVenue("West Hall");
    const east = await prisma.venue.create({
      data: { name: "East Hall", address: "2 E St", postalCode: "469000", region: "EAST", venueType: "SPORTS_HALL" },
    });
    await createListing(input(west.id, { startTime: "08:00", endTime: "10:00" }));
    await createListing(input(east.id, { startTime: "18:00", endTime: "20:00" }));

    expect(await listListings({ region: "EAST" })).toHaveLength(1);
    expect(await listListings({ venueId: west.id })).toHaveLength(1);
    expect(await listListings({ timeFrom: "18:00" })).toHaveLength(1);
    expect(await listListings({ timeFrom: "08:00", timeTo: "10:00" })).toHaveLength(1);
  });

  it("enforces max 5 active listings per phone", async () => {
    const venue = await makeVenue();
    for (let i = 0; i < 5; i++) await createListing(input(venue.id));
    await expect(createListing(input(venue.id))).rejects.toThrow(ActivePostCapError);
    await expect(createListing(input(venue.id, { phone: "+6581234567" }))).resolves.toBeTruthy();
  });

  it("sweep expires past listings and scrubs old phones", async () => {
    const venue = await makeVenue();
    const { id: oldId } = await createListing(input(venue.id));
    const { id: veryOldId } = await createListing(input(venue.id, { phone: "+6581111111" }));
    // Backdate relative to todaySgt(): 3 days past (<14d, kept) and 40 days past (>14d, scrubbed).
    const oldDate = dayjs(todaySgt()).subtract(3, "day").format("YYYY-MM-DD");
    const veryOldDate = dayjs(todaySgt()).subtract(40, "day").format("YYYY-MM-DD");
    // Backdate via raw update (service forbids past dates at create time)
    await prisma.listing.update({ where: { id: oldId }, data: { date: strToDate(oldDate) } });
    await prisma.listing.update({ where: { id: veryOldId }, data: { date: strToDate(veryOldDate) } });

    await sweepExpired();

    const old = await prisma.listing.findUniqueOrThrow({ where: { id: oldId } });
    expect(old.status).toBe("EXPIRED");
    expect(old.phone).toBe("+6591234567"); // <14 days past: kept
    const veryOld = await prisma.listing.findUniqueOrThrow({ where: { id: veryOldId } });
    expect(veryOld.status).toBe("EXPIRED");
    expect(veryOld.phone).toBeNull(); // >14 days past: scrubbed
  });

  it("sweep expires a same-day slot once its start time has passed", async () => {
    const venue = await makeVenue();
    // Service create bypasses zod, so a today/00:00 row (already started) is possible.
    const { id } = await createListing(input(venue.id, { date: todaySgt(), startTime: "00:00", endTime: "01:00" }));
    await sweepExpired();
    expect((await prisma.listing.findUniqueOrThrow({ where: { id } })).status).toBe("EXPIRED");
  });

  it("board hides expired, keeps SOLD visible sorted last", async () => {
    const venue = await makeVenue();
    const { id: soldId } = await createListing(input(venue.id, { startTime: "07:00", endTime: "09:00" }));
    await createListing(input(venue.id, { phone: "+6581234567" }));
    await prisma.listing.update({ where: { id: soldId }, data: { status: "SOLD" } });

    const rows = await listListings({ date: tomorrow });
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("AVAILABLE");
    expect(rows[1].status).toBe("SOLD");
  });

  it("reveal returns the phone", async () => {
    const venue = await makeVenue();
    const { id } = await createListing(input(venue.id));
    expect(await revealListingContact(id)).toEqual({ phone: "+6591234567", telegramHandle: undefined });
  });

  it("with no date filter, returns all upcoming dates ordered by date then status then startTime", async () => {
    const venue = await makeVenue();
    const dayAfter = dayjs(todaySgt()).add(2, "day").format("YYYY-MM-DD");
    await createListing(input(venue.id, { date: dayAfter, startTime: "09:00" }));
    await createListing(input(venue.id, { startTime: "20:00" }));
    await createListing(input(venue.id, { startTime: "07:00" }));

    const rows = await listListings({});
    expect(rows).toHaveLength(3);
    expect(rows[0].startTime).toBe("07:00");
    expect(rows[1].startTime).toBe("20:00");
    expect(rows[2].startTime).toBe("09:00");
  });

  it("creates a batch of listings sharing one batchToken", async () => {
    const venue = await makeVenue();
    const { phone, ...item } = input(venue.id);
    const { batchToken, ids } = await createListingBatch(
      [item, { ...item, startTime: "18:00", endTime: "20:00" }] as Parameters<typeof createListingBatch>[0],
      { phone: phone as string },
    );
    expect(ids).toHaveLength(2);
    const rows = await prisma.listing.findMany({ where: { batchToken } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.batchToken === batchToken)).toBe(true);
  });

  it("counts every item in a batch toward the 5-active-per-phone cap", async () => {
    const venue = await makeVenue();
    const { phone, ...item } = input(venue.id);
    const items = Array.from({ length: 6 }, () => item) as Parameters<typeof createListingBatch>[0];
    await expect(createListingBatch(items, { phone: phone as string })).rejects.toThrow(ActivePostCapError);
  });

  it("with available=1, only AVAILABLE listings are returned", async () => {
    const venue = await makeVenue();
    const { id: soldId } = await createListing(input(venue.id));
    await createListing(input(venue.id, { phone: "+6581234567" }));
    await prisma.listing.update({ where: { id: soldId }, data: { status: "SOLD" } });

    const rows = await listListings({ available: "1" });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("AVAILABLE");
  });
});
