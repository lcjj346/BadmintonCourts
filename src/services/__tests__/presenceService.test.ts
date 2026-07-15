/** @jest-environment node */
import { prisma } from "@/lib/db";
import { recordPresence } from "@/services/presenceService";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => prisma.presence.deleteMany());
afterAll(() => prisma.$disconnect());

describe("presenceService", () => {
  it("counts two fresh ids as online", async () => {
    await recordPresence(A);
    expect(await recordPresence(B)).toBe(2);
  });

  it("keeps a 5-minute-old id stored but excludes it from the 90s online count", async () => {
    await recordPresence(A);
    await prisma.presence.update({
      where: { id: A },
      data: { lastSeen: new Date(Date.now() - 5 * 60_000) },
    });

    const count = await recordPresence(B); // B is fresh
    expect(count).toBe(1); // only B is within the 90s window
    expect(await prisma.presence.count()).toBe(2); // A still stored (< 10 min)
  });

  it("prunes an id last seen more than 10 minutes ago on the next record", async () => {
    await recordPresence(A);
    await prisma.presence.update({
      where: { id: A },
      data: { lastSeen: new Date(Date.now() - 15 * 60_000) },
    });

    await recordPresence(B);
    expect(await prisma.presence.findUnique({ where: { id: A } })).toBeNull();
  });
});
