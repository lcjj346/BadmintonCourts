/** @jest-environment node */
import dayjs from "dayjs";
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt } from "@/lib/time";
import type { BoardFilters } from "@/lib/schemas";
import { createSessionBatch, listSessions, revealSessionContact } from "@/services/sessionService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

// Default fixture dated TOMORROW so a same-day expiry sweep can never race the test clock.
const tomorrow = dayjs(todaySgt()).add(1, "day").format("YYYY-MM-DD");

const input = (venueId: string, over: Record<string, unknown> = {}) => ({
  venueId, date: tomorrow, startTime: "18:00", endTime: "20:00",
  playersNeeded: 2, maxPax: 6, skillMin: "MID_INTERMEDIATE", skillMax: "MID_INTERMEDIATE", pricePerPlayerCents: 400,
  phone: "+6591234567", ...over,
});

// date/region/skill are multi-select arrays in BoardFilters; this fills the empty
// defaults so test bodies only need to specify what they're actually testing.
const bf = (over: Partial<BoardFilters> = {}): BoardFilters => ({ date: [], region: [], skill: [], ...over });

// Single-item wrapper around the batch-create service, mirroring the old single-post API
// so most test bodies stay unchanged.
async function createSession(item: ReturnType<typeof input>) {
  const { phone, ...rest } = item;
  const { batchToken, ids } = await createSessionBatch(
    [rest] as Parameters<typeof createSessionBatch>[0],
    { phone: phone as string },
  );
  return { id: ids[0], batchToken };
}

describe("sessionService", () => {
  it("creates; board payload includes session fields, no phone/batchToken", async () => {
    const venue = await makeVenue();
    await createSession(input(venue.id));
    const rows = await listSessions(bf());
    expect(rows).toHaveLength(1);
    expect(rows[0].playersNeeded).toBe(2);
    expect(rows[0].skillMin).toBe("MID_INTERMEDIATE");
    expect(rows[0].skillMax).toBe("MID_INTERMEDIATE");
    expect(rows[0]).not.toHaveProperty("phone");
    expect(rows[0]).not.toHaveProperty("batchToken");
  });

  it("creates a batch of sessions sharing one batchToken", async () => {
    const venue = await makeVenue();
    const { phone, ...item } = input(venue.id);
    const { batchToken, ids } = await createSessionBatch(
      [item, { ...item, startTime: "07:00", endTime: "09:00" }] as Parameters<typeof createSessionBatch>[0],
      { phone: phone as string },
    );
    expect(ids).toHaveLength(2);
    const rows = await prisma.gameSession.findMany({ where: { batchToken } });
    expect(rows).toHaveLength(2);
  });

  it("filters by skill (exact)", async () => {
    const venue = await makeVenue();
    await createSession(input(venue.id));
    await createSession(input(venue.id, { skillMin: "LOW_BEGINNER", skillMax: "LOW_BEGINNER", phone: "+6581234567" }));
    expect(await listSessions(bf({ skill: ["LOW_BEGINNER"] }))).toHaveLength(1);
  });

  it("filters by skill within a range", async () => {
    const venue = await makeVenue();
    await createSession(input(venue.id, { skillMin: "MID_BEGINNER", skillMax: "LOW_INTERMEDIATE" }));
    await createSession(input(venue.id, { skillMin: "ADVANCED", skillMax: "ADVANCED", phone: "+6581234567" }));
    const rows = await listSessions(bf({ skill: ["HIGH_BEGINNER"] }));
    expect(rows).toHaveLength(1);
    expect(rows[0].skillMin).toBe("MID_BEGINNER");
  });

  it("multi-select skill matches a row whose range overlaps ANY selected skill", async () => {
    const venue = await makeVenue();
    await createSession(input(venue.id, { skillMin: "MID_BEGINNER", skillMax: "LOW_INTERMEDIATE" }));
    await createSession(input(venue.id, { skillMin: "ADVANCED", skillMax: "ADVANCED", phone: "+6581234567" }));
    await createSession(input(venue.id, { skillMin: "LOW_BEGINNER", skillMax: "LOW_BEGINNER", phone: "+6571234567" }));

    const rows = await listSessions(bf({ skill: ["HIGH_BEGINNER", "ADVANCED"] }));
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.skillMin === "LOW_BEGINNER")).toBe(false);
  });

  it("stores and returns maxPax alongside playersNeeded", async () => {
    const venue = await makeVenue();
    await createSession(input(venue.id, { playersNeeded: 3, maxPax: 8 }));
    const rows = await listSessions(bf());
    expect(rows[0].playersNeeded).toBe(3);
    expect(rows[0].maxPax).toBe(8);
  });

  // Date/region/venue/time filtering is shared with listings via buildBoardWhere and
  // covered by listingService.test.ts — this suite only tests what's session-specific.

  it("reveals phone", async () => {
    const venue = await makeVenue();
    const { id } = await createSession(input(venue.id));
    expect(await revealSessionContact(id)).toEqual({ phone: "+6591234567", telegramHandle: undefined });
  });

  it("reveal returns null for a FILLED or EXPIRED session, even with a valid id", async () => {
    const venue = await makeVenue();
    const { id: filledId } = await createSession(input(venue.id));
    await prisma.gameSession.update({ where: { id: filledId }, data: { status: "FILLED" } });
    expect(await revealSessionContact(filledId)).toBeNull();

    const { id: expiredId } = await createSession(input(venue.id, { phone: "+6581234567" }));
    await prisma.gameSession.update({ where: { id: expiredId }, data: { status: "EXPIRED" } });
    expect(await revealSessionContact(expiredId)).toBeNull();
  });

  // Status ordering must dominate startTime ordering: an OPEN game always lists before a
  // FILLED one, even when the OPEN game starts later. Postgres native enums sort by declared
  // order (OPEN, FILLED, EXPIRED), so `orderBy: [{ status: "asc" }, ...]` puts OPEN first.
  it("lists OPEN before FILLED regardless of startTime", async () => {
    const venue = await makeVenue();
    const filled = await createSession(input(venue.id, { startTime: "10:00", endTime: "12:00", phone: "+6591234567" }));
    await createSession(input(venue.id, { startTime: "18:00", endTime: "20:00", phone: "+6581234567" }));
    await prisma.gameSession.update({ where: { id: filled.id }, data: { status: "FILLED" } });

    const rows = await listSessions(bf({ date: [tomorrow] }));
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("OPEN");
    expect(rows[1].status).toBe("FILLED");
  });

  it("with available=1, only OPEN sessions are returned", async () => {
    const venue = await makeVenue();
    const filled = await createSession(input(venue.id));
    await createSession(input(venue.id, { phone: "+6581234567" }));
    await prisma.gameSession.update({ where: { id: filled.id }, data: { status: "FILLED" } });

    const rows = await listSessions(bf({ available: "1" }));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("OPEN");
  });
});
