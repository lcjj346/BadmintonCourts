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
  // The `dev` param genuinely changes which .env file wins — omitting it (or
  // passing false) makes @next/env prefer .env.production.local (if present)
  // over .env, regardless of NODE_ENV. That's the real production database on
  // any machine also used for prod:migrate/prod:seed. `true` forces the same
  // .env.local/.env precedence `next dev` uses, so this can never silently
  // wipe rate-limit events or posts in production.
  loadEnvConfig(process.cwd(), true);
  const prisma = new PrismaClient();
  // Telegram-only posts (no phone) use handles prefixed like this in the specs —
  // match them too, since the phone filter above misses them entirely.
  const testContact = {
    OR: [
      { phone: { in: TEST_PHONES } },
      { telegramHandle: { startsWith: "test_user_" } },
      { telegramHandle: { startsWith: "edited_user_" } },
    ],
  };
  try {
    await prisma.rateLimitEvent.deleteMany({ where: { action: "CREATE" } });
    await prisma.listing.deleteMany({ where: testContact });
    await prisma.gameSession.deleteMany({ where: testContact });
  } finally {
    await prisma.$disconnect();
  }
}
