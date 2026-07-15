/** @jest-environment node */
import dayjs from "dayjs";
import { prisma } from "@/lib/db";
import { resetDb, makeVenue } from "@/lib/__tests__/helpers/db";
import { todaySgt } from "@/lib/time";
import { createSession, listSessions, revealSessionPhone } from "@/services/sessionService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const input = (venueId: string, over: Record<string, unknown> = {}) => ({
  venueId, date: todaySgt(), startTime: "18:00", endTime: "20:00",
  playersNeeded: 2, skillLevel: "MID_INTERMEDIATE", pricePerPlayerCents: 400,
  phone: "+6591234567", ...over,
}) as Parameters<typeof createSession>[0];

describe("sessionService", () => {
  it("creates; board payload includes session fields, no phone/editToken", async () => {
    const venue = await makeVenue();
    await createSession(input(venue.id));
    const rows = await listSessions({});
    expect(rows).toHaveLength(1);
    expect(rows[0].playersNeeded).toBe(2);
    expect(rows[0].skillLevel).toBe("MID_INTERMEDIATE");
    expect(rows[0]).not.toHaveProperty("phone");
    expect(rows[0]).not.toHaveProperty("editToken");
  });

  it("filters by skill", async () => {
    const venue = await makeVenue();
    await createSession(input(venue.id));
    await createSession(input(venue.id, { skillLevel: "LOW_BEGINNER", phone: "+6581234567" }));
    expect(await listSessions({ skill: "LOW_BEGINNER" })).toHaveLength(1);
  });

  it("filters by time range", async () => {
    const venue = await makeVenue();
    await createSession(input(venue.id, { startTime: "08:00", endTime: "10:00" }));
    await createSession(input(venue.id, { startTime: "18:00", endTime: "20:00", phone: "+6581234567" }));
    expect(await listSessions({ timeFrom: "08:00", timeTo: "10:00" })).toHaveLength(1);
    expect(await listSessions({ timeFrom: "18:00" })).toHaveLength(1);
  });

  it("reveals phone", async () => {
    const venue = await makeVenue();
    const { id } = await createSession(input(venue.id));
    expect(await revealSessionPhone(id)).toBe("+6591234567");
  });

  // Status ordering must dominate startTime ordering: an OPEN game always lists before a
  // FILLED one, even when the OPEN game starts later. Postgres native enums sort by declared
  // order (OPEN, FILLED, EXPIRED), so `orderBy: [{ status: "asc" }, ...]` puts OPEN first.
  it("lists OPEN before FILLED regardless of startTime", async () => {
    const venue = await makeVenue();
    const filled = await createSession(input(venue.id, { startTime: "10:00", endTime: "12:00", phone: "+6591234567" }));
    await createSession(input(venue.id, { startTime: "18:00", endTime: "20:00", phone: "+6581234567" }));
    await prisma.gameSession.update({ where: { id: filled.id }, data: { status: "FILLED" } });

    const rows = await listSessions({ date: todaySgt() });
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("OPEN");
    expect(rows[1].status).toBe("FILLED");
  });

  it("with no date filter, returns all upcoming dates ordered by date then status then startTime", async () => {
    const venue = await makeVenue();
    const tomorrow = dayjs(todaySgt()).add(1, "day").format("YYYY-MM-DD");
    await createSession(input(venue.id, { date: tomorrow, startTime: "09:00" }));
    await createSession(input(venue.id, { startTime: "20:00", phone: "+6581234567" }));

    const rows = await listSessions({});
    expect(rows).toHaveLength(2);
    expect(rows[0].startTime).toBe("20:00"); // today before tomorrow
    expect(rows[1].startTime).toBe("09:00");
  });

  it("with available=1, only OPEN sessions are returned", async () => {
    const venue = await makeVenue();
    const filled = await createSession(input(venue.id));
    await createSession(input(venue.id, { phone: "+6581234567" }));
    await prisma.gameSession.update({ where: { id: filled.id }, data: { status: "FILLED" } });

    const rows = await listSessions({ available: "1" });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("OPEN");
  });
});
