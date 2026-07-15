import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import venues from "./prisma/venues.json";

/**
 * Service tests wipe the shared dev database (resetDb truncates every table,
 * including the seeded venues), and some tests create ad-hoc test venues
 * (e.g. "Test Hall") that outlive the suite. Restore the real seed and prune
 * anything that isn't in it, so the dev app isn't left with a missing or
 * polluted venue picker.
 */
export default async function globalTeardown() {
  try {
    execSync("npx prisma db seed", { stdio: "ignore" });
    console.log("\n[teardown] venue seed restored");
  } catch {
    console.warn("\n[teardown] could not reseed venues — run `npx prisma db seed` manually");
    return;
  }

  // Best-effort: prune ad-hoc test venues (e.g. "Test Hall") left behind by
  // tests that create their own venue. Safe to skip if a leftover row still
  // has listings/sessions referencing it (FK constraint) — those get
  // cleaned up by the next test run's resetDb() instead.
  try {
    const prisma = new PrismaClient();
    const seedNames = venues.map((v) => v.name);
    const { count } = await prisma.venue.deleteMany({ where: { name: { notIn: seedNames } } });
    await prisma.$disconnect();
    if (count) console.log(`[teardown] pruned ${count} stray test venue(s)`);
  } catch {
    // non-fatal
  }
}
