/** @jest-environment node */
import { prisma } from "@/lib/db";
import { resetDb } from "@/lib/__tests__/helpers/db";
import {
  assertAndRecordCreate, assertRevealAllowed, assertPresenceAllowed, RateLimitError,
} from "@/services/rateLimitService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("rateLimitService", () => {
  it("allows 10 creates then blocks the 11th", async () => {
    for (let i = 0; i < 10; i++) {
      await assertAndRecordCreate("hashA");
    }
    await expect(assertAndRecordCreate("hashA")).rejects.toThrow(RateLimitError);
    await expect(assertAndRecordCreate("hashB")).resolves.toBeUndefined();
  });

  it("closes the check-then-act race: 30 concurrent creates from one IP allow only 10", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, () => assertAndRecordCreate("hashRace")),
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    expect(succeeded).toBe(10);
    const count = await prisma.rateLimitEvent.count({ where: { ipHash: "hashRace", action: "CREATE" } });
    expect(count).toBe(10);
  });

  it("blocks 4th reveal of the same target for one ip", async () => {
    for (let i = 0; i < 3; i++) await assertRevealAllowed("hashA", "target1");
    await expect(assertRevealAllowed("hashA", "target1")).rejects.toThrow(RateLimitError);
    // different target still fine
    await expect(assertRevealAllowed("hashA", "target2")).resolves.toBeUndefined();
  });

  it("blocks after 30 reveals across targets in an hour", async () => {
    for (let i = 0; i < 30; i++) await assertRevealAllowed("hashA", `t${i}`);
    await expect(assertRevealAllowed("hashA", "t99")).rejects.toThrow(RateLimitError);
  });

  it("closes the check-then-act race: 10 concurrent reveals of the same target allow only 3", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => assertRevealAllowed("hashRace2", "targetRace")),
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    expect(succeeded).toBe(3);
  });

  it("allows 300 presence pings then blocks the 301st", async () => {
    for (let i = 0; i < 300; i++) await assertPresenceAllowed("hashA");
    await expect(assertPresenceAllowed("hashA")).rejects.toThrow(RateLimitError);
    await expect(assertPresenceAllowed("hashB")).resolves.toBeUndefined();
  });

  it("ignores events outside the window", async () => {
    const old = new Date(Date.now() - 2 * 3600 * 1000);
    await prisma.rateLimitEvent.createMany({
      data: Array.from({ length: 5 }, () => ({ ipHash: "hashA", action: "CREATE" as const, createdAt: old })),
    });
    await expect(assertAndRecordCreate("hashA")).resolves.toBeUndefined();
  });
});
