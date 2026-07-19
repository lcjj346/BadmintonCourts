/** @jest-environment node */
import dayjs from "dayjs";
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt, strToDate } from "@/lib/time";
import type { BoardFilters } from "@/lib/schemas";
import {
  createListingBatch, listListings, getListing, revealListingContact,
  sweepExpired, ActivePostCapError, BOARD_ROW_LIMIT,
} from "@/services/listingService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

// Default fixture dated TOMORROW so a same-day expiry sweep can never race the test clock.
const tomorrow = dayjs(todaySgt()).add(1, "day").format("YYYY-MM-DD");

// date/region/skill are multi-select arrays in BoardFilters; this fills the empty
// defaults so test bodies only need to specify what they're actually testing.
const bf = (over: Partial<BoardFilters> = {}): BoardFilters => ({ date: [], region: [], skill: [], ...over });

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

    const rows = await listListings(bf());
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

    const rows = await listListings(bf({ region: ["EAST"] }));
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

    expect(await listListings(bf({ region: ["EAST"] }))).toHaveLength(1);
    expect(await listListings(bf({ venueId: west.id }))).toHaveLength(1);
    expect(await listListings(bf({ timeFrom: "18:00" }))).toHaveLength(1);
    expect(await listListings(bf({ timeFrom: "08:00", timeTo: "10:00" }))).toHaveLength(1);
  });

  it("multi-select region matches ANY of the selected regions", async () => {
    const west = await makeVenue("West Hall");
    const east = await prisma.venue.create({
      data: { name: "East Hall", address: "2 E St", postalCode: "469000", region: "EAST", venueType: "SPORTS_HALL" },
    });
    const north = await prisma.venue.create({
      data: { name: "North Hall", address: "3 N St", postalCode: "769000", region: "NORTH", venueType: "SPORTS_HALL" },
    });
    await createListing(input(west.id));
    await createListing(input(east.id, { phone: "+6581234567" }));
    await createListing(input(north.id, { phone: "+6571234567" }));

    const rows = await listListings(bf({ region: ["EAST", "WEST"] }));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.venue?.region === "EAST" || r.venue?.region === "WEST")).toBe(true);
  });

  it("multi-select date matches any of the selected dates", async () => {
    const venue = await makeVenue();
    const dayAfter = dayjs(todaySgt()).add(2, "day").format("YYYY-MM-DD");
    await createListing(input(venue.id));
    await createListing(input(venue.id, { date: dayAfter, phone: "+6581234567" }));
    await createListing(input(venue.id, { date: dayjs(todaySgt()).add(3, "day").format("YYYY-MM-DD"), phone: "+6571234567" }));

    const rows = await listListings(bf({ date: [tomorrow, dayAfter] }));
    expect(rows).toHaveLength(2);
  });

  it("enforces max 10 active listings per phone", async () => {
    const venue = await makeVenue();
    for (let i = 0; i < 10; i++) await createListing(input(venue.id));
    await expect(createListing(input(venue.id))).rejects.toThrow(ActivePostCapError);
    await expect(createListing(input(venue.id, { phone: "+6581234567" }))).resolves.toBeTruthy();
  });

  it("closes the check-then-act race: 20 concurrent posts for one phone allow only 10", async () => {
    const venue = await makeVenue();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => createListing(input(venue.id, { phone: "+6599990000" }))),
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    expect(succeeded).toBe(10);
    const active = await prisma.listing.count({ where: { phone: "+6599990000", status: "AVAILABLE" } });
    expect(active).toBe(10);
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

  it("board reads sweep at most once a minute: first read sweeps, an immediate second read doesn't", async () => {
    const venue = await makeVenue();
    const backdate = strToDate(dayjs(todaySgt()).subtract(1, "day").format("YYYY-MM-DD"));

    // resetDb (beforeEach) opened the gate, so this first read sweeps.
    const { id: first } = await createListing(input(venue.id));
    await prisma.listing.update({ where: { id: first }, data: { date: backdate } });
    await listListings(bf());
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: first } })).status).toBe("EXPIRED");

    // Gate is now closed — a second read within the interval must NOT sweep.
    const { id: second } = await createListing(input(venue.id, { phone: "+6581234567" }));
    await prisma.listing.update({ where: { id: second }, data: { date: backdate } });
    await listListings(bf());
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: second } })).status).toBe("AVAILABLE");
  });

  it(`board returns at most ${BOARD_ROW_LIMIT} rows however many exist`, async () => {
    const venue = await makeVenue();
    const date = strToDate(tomorrow);
    await prisma.listing.createMany({
      data: Array.from({ length: BOARD_ROW_LIMIT + 20 }, (_, i) => ({
        venueId: venue.id, date, startTime: "08:00", endTime: "10:00",
        priceCents: 1000, phone: `+659${String(1000000 + i)}`,
      })),
    });
    expect(await listListings(bf())).toHaveLength(BOARD_ROW_LIMIT);
  });

  it("sweep auto-expires a SOLD listing 1 hour after it was closed, but not sooner", async () => {
    const venue = await makeVenue();
    const { id: staleId } = await createListing(input(venue.id));
    const { id: freshId } = await createListing(input(venue.id, { phone: "+6581234567" }));
    await prisma.listing.update({
      where: { id: staleId },
      data: { status: "SOLD", closedAt: new Date(Date.now() - 61 * 60 * 1000) },
    });
    await prisma.listing.update({
      where: { id: freshId },
      data: { status: "SOLD", closedAt: new Date(Date.now() - 5 * 60 * 1000) },
    });

    await sweepExpired();

    expect((await prisma.listing.findUniqueOrThrow({ where: { id: staleId } })).status).toBe("EXPIRED");
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: freshId } })).status).toBe("SOLD");
  });

  it("board hides expired, keeps SOLD visible sorted last", async () => {
    const venue = await makeVenue();
    const { id: soldId } = await createListing(input(venue.id, { startTime: "07:00", endTime: "09:00" }));
    await createListing(input(venue.id, { phone: "+6581234567" }));
    await prisma.listing.update({ where: { id: soldId }, data: { status: "SOLD" } });

    const rows = await listListings(bf({ date: [tomorrow] }));
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("AVAILABLE");
    expect(rows[1].status).toBe("SOLD");
  });

  it("reveal returns the phone", async () => {
    const venue = await makeVenue();
    const { id } = await createListing(input(venue.id));
    expect(await revealListingContact(id)).toEqual({ phone: "+6591234567", telegramHandle: undefined });
  });

  it("reveal returns null for a SOLD or EXPIRED listing, even with a valid id", async () => {
    const venue = await makeVenue();
    const { id: soldId } = await createListing(input(venue.id));
    await prisma.listing.update({ where: { id: soldId }, data: { status: "SOLD" } });
    expect(await revealListingContact(soldId)).toBeNull();

    const { id: expiredId } = await createListing(input(venue.id, { phone: "+6581234567" }));
    await prisma.listing.update({ where: { id: expiredId }, data: { status: "EXPIRED" } });
    expect(await revealListingContact(expiredId)).toBeNull();
  });

  it("with no date filter, returns all upcoming dates ordered by date then status then startTime", async () => {
    const venue = await makeVenue();
    const dayAfter = dayjs(todaySgt()).add(2, "day").format("YYYY-MM-DD");
    await createListing(input(venue.id, { date: dayAfter, startTime: "09:00" }));
    await createListing(input(venue.id, { startTime: "20:00" }));
    await createListing(input(venue.id, { startTime: "07:00" }));

    const rows = await listListings(bf());
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

  it("counts every item in a batch toward the 10-active-per-phone cap", async () => {
    const venue = await makeVenue();
    const { phone, ...item } = input(venue.id);
    const items = Array.from({ length: 11 }, () => item) as Parameters<typeof createListingBatch>[0];
    await expect(createListingBatch(items, { phone: phone as string })).rejects.toThrow(ActivePostCapError);
  });

  it("with available=1, only AVAILABLE listings are returned", async () => {
    const venue = await makeVenue();
    const { id: soldId } = await createListing(input(venue.id));
    await createListing(input(venue.id, { phone: "+6581234567" }));
    await prisma.listing.update({ where: { id: soldId }, data: { status: "SOLD" } });

    const rows = await listListings(bf({ available: "1" }));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("AVAILABLE");
  });
});
