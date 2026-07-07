/** @jest-environment node */
import dayjs from "dayjs";
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt, strToDate } from "@/lib/time";
import {
  createListing, listListings, getListing, revealListingPhone,
  sweepExpired, ActivePostCapError,
} from "@/services/listingService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const input = (venueId: string, over: Record<string, unknown> = {}) => ({
  venueId, date: todaySgt(), startTime: "08:00", endTime: "10:00",
  priceCents: 1600, phone: "91234567", ...over,
}) as Parameters<typeof createListing>[0];

describe("listingService", () => {
  it("creates and returns id + editToken; board payload has no phone/editToken", async () => {
    const venue = await makeVenue();
    const { id, editToken } = await createListing(input(venue.id));
    expect(editToken).toMatch(/^[0-9a-f-]{36}$/);

    const rows = await listListings({});
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0]).not.toHaveProperty("phone");
    expect(rows[0]).not.toHaveProperty("editToken");
    expect(rows[0].venue.name).toBe("Test Hall");

    const detail = await getListing(id);
    expect(detail).not.toHaveProperty("phone");
  });

  it("filters by region, venue, and time bucket", async () => {
    const west = await makeVenue("West Hall");
    const east = await prisma.venue.create({
      data: { name: "East Hall", address: "2 E St", postalCode: "469000", region: "EAST", venueType: "SPORTS_HALL" },
    });
    await createListing(input(west.id, { startTime: "08:00", endTime: "10:00" }));
    await createListing(input(east.id, { startTime: "18:00", endTime: "20:00" }));

    expect(await listListings({ region: "EAST" })).toHaveLength(1);
    expect(await listListings({ venueId: west.id })).toHaveLength(1);
    expect(await listListings({ time: "EVENING" })).toHaveLength(1);
    expect(await listListings({ time: "MORNING" })).toHaveLength(1);
  });

  it("enforces max 5 active listings per phone", async () => {
    const venue = await makeVenue();
    for (let i = 0; i < 5; i++) await createListing(input(venue.id));
    await expect(createListing(input(venue.id))).rejects.toThrow(ActivePostCapError);
    await expect(createListing(input(venue.id, { phone: "81234567" }))).resolves.toBeTruthy();
  });

  it("sweep expires past listings and scrubs old phones", async () => {
    const venue = await makeVenue();
    const { id: oldId } = await createListing(input(venue.id));
    const { id: veryOldId } = await createListing(input(venue.id, { phone: "81111111" }));
    // Backdate relative to todaySgt(): 3 days past (<7d, kept) and 40 days past (>7d, scrubbed).
    const oldDate = dayjs(todaySgt()).subtract(3, "day").format("YYYY-MM-DD");
    const veryOldDate = dayjs(todaySgt()).subtract(40, "day").format("YYYY-MM-DD");
    // Backdate via raw update (service forbids past dates at create time)
    await prisma.listing.update({ where: { id: oldId }, data: { date: strToDate(oldDate) } });
    await prisma.listing.update({ where: { id: veryOldId }, data: { date: strToDate(veryOldDate) } });

    await sweepExpired();

    const old = await prisma.listing.findUniqueOrThrow({ where: { id: oldId } });
    expect(old.status).toBe("EXPIRED");
    expect(old.phone).toBe("91234567"); // <7 days past: kept
    const veryOld = await prisma.listing.findUniqueOrThrow({ where: { id: veryOldId } });
    expect(veryOld.status).toBe("EXPIRED");
    expect(veryOld.phone).toBeNull(); // >7 days past: scrubbed
  });

  it("board hides expired, keeps SOLD visible sorted last", async () => {
    const venue = await makeVenue();
    const { id: soldId } = await createListing(input(venue.id, { startTime: "07:00", endTime: "09:00" }));
    await createListing(input(venue.id, { phone: "81234567" }));
    await prisma.listing.update({ where: { id: soldId }, data: { status: "SOLD" } });

    const rows = await listListings({ date: todaySgt() });
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("AVAILABLE");
    expect(rows[1].status).toBe("SOLD");
  });

  it("reveal returns the phone", async () => {
    const venue = await makeVenue();
    const { id } = await createListing(input(venue.id));
    expect(await revealListingPhone(id)).toBe("91234567");
  });
});
