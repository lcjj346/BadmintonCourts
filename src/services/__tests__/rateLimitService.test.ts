/** @jest-environment node */
import { prisma } from "@/lib/db";
import { resetDb } from "@/lib/__tests__/helpers/db";
import {
  assertCreateAllowed, assertRevealAllowed, recordCreate, RateLimitError,
} from "@/services/rateLimitService";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("rateLimitService", () => {
  it("allows 5 creates then blocks the 6th", async () => {
    for (let i = 0; i < 5; i++) {
      await assertCreateAllowed("hashA");
      await recordCreate("hashA");
    }
    await expect(assertCreateAllowed("hashA")).rejects.toThrow(RateLimitError);
    await expect(assertCreateAllowed("hashB")).resolves.toBeUndefined();
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

  it("ignores events outside the window", async () => {
    const old = new Date(Date.now() - 2 * 3600 * 1000);
    await prisma.rateLimitEvent.createMany({
      data: Array.from({ length: 5 }, () => ({ ipHash: "hashA", action: "CREATE" as const, createdAt: old })),
    });
    await expect(assertCreateAllowed("hashA")).resolves.toBeUndefined();
  });
});
