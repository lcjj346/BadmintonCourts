import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

// Test phone numbers used by the core-loop specs.
const TEST_PHONES = ["+6591234567", "+6581234567"];

/**
 * Reset test-environment state before the E2E run so the suite is
 * deterministic and rerunnable against the shared dev DB:
 *
 *  - Clear CREATE rate-limit events. The app allows only 5 posts/hour/IP;
 *    on localhost every request shares one IP, so repeated local runs would
 *    otherwise trip the limiter after ~2 runs. This resets the rate-limit
 *    counter only — it does NOT touch any of the security assertions the
 *    specs make (phone-hiding, reveal, etc.).
 *  - Delete leftover posts for the two test phone numbers so the per-phone
 *    active-post cap and the board stay clean across reruns.
 */
export default async function globalSetup() {
  loadEnvConfig(process.cwd());
  const prisma = new PrismaClient();
  try {
    await prisma.rateLimitEvent.deleteMany({ where: { action: "CREATE" } });
    await prisma.listing.deleteMany({ where: { phone: { in: TEST_PHONES } } });
    await prisma.gameSession.deleteMany({ where: { phone: { in: TEST_PHONES } } });
  } finally {
    await prisma.$disconnect();
  }
}
