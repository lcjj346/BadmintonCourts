/**
 * Seeds random courts + games for load testing (manual or automated).
 *
 * Usage (local db, uses .env):
 *   npx ts-node scripts/loadTestSeed.ts [count]
 *
 * Usage (production db):
 *   npm run loadtest:seed:prod -- [count]
 *
 * Cleanup:
 *   npx ts-node scripts/loadTestSeed.ts --cleanup
 *   npm run loadtest:cleanup:prod
 *
 * Writes go directly through Prisma, bypassing the app's rate limiter — this is for
 * load-testing the board/API/UI under realistic data volume, not for exercising the
 * rate limiter itself. Every row this script creates is tagged with notes starting
 * "[loadtest]" so cleanup can find and remove exactly (and only) what it added.
 *
 * seedLoadTest/cleanupLoadTest are also imported directly by e2e-load/load.spec.ts.
 */
import { PrismaClient, SkillLevel } from "@prisma/client";
import { randomUUID } from "crypto";

export const LOAD_TEST_TAG = "[loadtest]";

const SKILLS: SkillLevel[] = [
  "LOW_BEGINNER", "MID_BEGINNER", "HIGH_BEGINNER", "LOW_INTERMEDIATE",
  "MID_INTERMEDIATE", "HIGH_INTERMEDIATE", "ADVANCED",
];
const NOTE_SNIPPETS = [
  "doubles preferred", "bring own shuttles", "near main entrance", "flexible on time",
  "RSL shuttles provided", "beginners welcome", "coached session", "singles only",
  undefined, undefined, undefined, // optional — no note at all, a real chunk of the time
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

/** Regex-valid Telegram handle (letters/digits/underscores, starts with a letter, 5-32 chars). */
function randomTelegramHandle(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}${suffix}`;
}

/** Occasionally negotiable (null) or free (0), otherwise a random price in 50-cent steps. */
function randomPriceCents(maxDollars: number): number | null {
  const r = Math.random();
  if (r < 0.12) return null;
  if (r < 0.22) return 0;
  return randInt(2, maxDollars * 2) * 50;
}

export async function cleanupLoadTest(prisma: PrismaClient): Promise<{ listings: number; sessions: number }> {
  const l = await prisma.listing.deleteMany({ where: { notes: { startsWith: LOAD_TEST_TAG } } });
  const s = await prisma.gameSession.deleteMany({ where: { notes: { startsWith: LOAD_TEST_TAG } } });
  return { listings: l.count, sessions: s.count };
}

export async function seedLoadTest(
  prisma: PrismaClient,
  count: number,
): Promise<{ listings: number; sessions: number }> {
  const venues = await prisma.venue.findMany({ select: { id: true } });
  if (venues.length === 0) throw new Error("No venues in this database — run the venue seed first");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const listingRows = Array.from({ length: count }, (_, i) => {
    const hour = randInt(7, 22);
    const note = pick(NOTE_SNIPPETS);
    return {
      venueId: pick(venues).id,
      date: addDays(today, randInt(1, 30)),
      startTime: `${String(hour).padStart(2, "0")}:00`,
      endTime: `${String(Math.min(hour + randInt(1, 3), 23)).padStart(2, "0")}:00`,
      priceCents: randomPriceCents(30),
      notes: `${LOAD_TEST_TAG}${note ? " " + note : ""}`,
      // ~5 per phone, under the active-post cap; enough distinct numbers for any count.
      phone: `+6590${String(1000 + Math.floor(i / 5)).padStart(6, "0")}`,
      telegramHandle: randomTelegramHandle("tgcourt"),
      batchToken: randomUUID(),
      status: "AVAILABLE" as const,
    };
  });

  const sessionRows = Array.from({ length: count }, (_, i) => {
    const hour = randInt(7, 22);
    const skillMin = pick(SKILLS);
    const note = pick(NOTE_SNIPPETS);
    const playersNeeded = randInt(1, 12);
    return {
      venueId: pick(venues).id,
      date: addDays(today, randInt(1, 30)),
      startTime: `${String(hour).padStart(2, "0")}:00`,
      endTime: `${String(Math.min(hour + randInt(1, 3), 23)).padStart(2, "0")}:00`,
      playersNeeded,
      maxPax: randInt(playersNeeded, 30), // schema caps maxPax at 30 — see src/lib/schemas.ts
      skillMin,
      skillMax: skillMin,
      pricePerPlayerCents: randomPriceCents(15),
      notes: `${LOAD_TEST_TAG}${note ? " " + note : ""}`,
      phone: `+6591${String(2000 + Math.floor(i / 5)).padStart(6, "0")}`,
      telegramHandle: randomTelegramHandle("tggame"),
      batchToken: randomUUID(),
      status: "OPEN" as const,
    };
  });

  await prisma.listing.createMany({ data: listingRows });
  await prisma.gameSession.createMany({ data: sessionRows });
  return { listings: listingRows.length, sessions: sessionRows.length };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const args = process.argv.slice(2);
    if (args.includes("--cleanup")) {
      const { listings, sessions } = await cleanupLoadTest(prisma);
      console.log(`Removed ${listings} load-test listings and ${sessions} load-test sessions.`);
      return;
    }
    const count = Number(args[0]) || 50;
    const { listings, sessions } = await seedLoadTest(prisma, count);
    console.log(`Seeded ${listings} courts and ${sessions} games (tagged "${LOAD_TEST_TAG}").`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
