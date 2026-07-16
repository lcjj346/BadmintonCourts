/**
 * Seeds random courts + games for manual load testing.
 *
 * Usage (local db, uses .env):
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/loadTestSeed.ts [count]
 *
 * Usage (production db):
 *   npm run loadtest:seed:prod -- [count]
 *
 * Cleanup:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/loadTestSeed.ts --cleanup
 *   npm run loadtest:cleanup:prod
 *
 * Writes go directly through Prisma, bypassing the app's rate limiter — this is for
 * load-testing the board/API/UI under realistic data volume, not for exercising the
 * rate limiter itself. Every row this script creates is tagged with notes starting
 * "[loadtest]" so --cleanup can find and remove exactly (and only) what it added.
 */
import { PrismaClient, SkillLevel } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const TAG = "[loadtest]";
const SKILLS: SkillLevel[] = [
  "LOW_BEGINNER", "MID_BEGINNER", "HIGH_BEGINNER", "LOW_INTERMEDIATE",
  "MID_INTERMEDIATE", "HIGH_INTERMEDIATE", "ADVANCED",
];
const NOTE_SNIPPETS = [
  "court 3, transfer at counter", "bring own shuttles", "doubles preferred",
  "near main entrance", "flexible on time", undefined, undefined,
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

async function cleanup() {
  const l = await prisma.listing.deleteMany({ where: { notes: { startsWith: TAG } } });
  const s = await prisma.gameSession.deleteMany({ where: { notes: { startsWith: TAG } } });
  console.log(`Removed ${l.count} load-test listings and ${s.count} load-test sessions.`);
}

async function seed(count: number) {
  const venues = await prisma.venue.findMany({ select: { id: true } });
  if (venues.length === 0) throw new Error("No venues in this database — run the venue seed first");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const listingRows = Array.from({ length: count }, (_, i) => {
    const hour = 7 + (i % 16);
    const note = pick(NOTE_SNIPPETS, i);
    return {
      venueId: pick(venues, i).id,
      date: addDays(today, 1 + (i % 30)),
      startTime: `${String(hour).padStart(2, "0")}:00`,
      endTime: `${String(hour + 1 + (i % 3)).padStart(2, "0")}:00`,
      priceCents: i % 9 === 0 ? null : i % 11 === 0 ? 0 : 300 + (i % 8) * 250,
      notes: `${TAG}${note ? " " + note : ""}`,
      phone: `+6590${String(1000 + Math.floor(i / 5)).padStart(6, "0")}`, // ~5 per phone, under the active-post cap
      batchToken: randomUUID(),
      status: "AVAILABLE" as const,
    };
  });

  const sessionRows = Array.from({ length: count }, (_, i) => {
    const hour = 7 + ((i + 4) % 16);
    const skillMin = pick(SKILLS, i);
    const note = pick(NOTE_SNIPPETS, i + 2);
    return {
      venueId: pick(venues, i + 3).id,
      date: addDays(today, 1 + ((i + 5) % 30)),
      startTime: `${String(hour).padStart(2, "0")}:00`,
      endTime: `${String(hour + 1 + (i % 3)).padStart(2, "0")}:00`,
      playersNeeded: 1 + (i % 6),
      skillMin,
      skillMax: skillMin,
      pricePerPlayerCents: i % 9 === 0 ? null : i % 11 === 0 ? 0 : 200 + (i % 8) * 150,
      notes: `${TAG}${note ? " " + note : ""}`,
      phone: `+6591${String(2000 + Math.floor(i / 5)).padStart(6, "0")}`,
      batchToken: randomUUID(),
      status: "OPEN" as const,
    };
  });

  await prisma.listing.createMany({ data: listingRows });
  await prisma.gameSession.createMany({ data: sessionRows });
  console.log(`Seeded ${listingRows.length} courts and ${sessionRows.length} games (tagged "${TAG}").`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--cleanup")) return cleanup();
  const count = Number(args[0]) || 50;
  return seed(count);
}

main().finally(() => prisma.$disconnect());
