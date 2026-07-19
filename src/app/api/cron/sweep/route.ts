import { ok, fail, handleError } from "@/lib/api";
import { sweepExpired } from "@/services/listingService";

/**
 * Daily scheduled sweep (vercel.json crons). The on-read sweep only fires when
 * someone actually loads the board, so with zero traffic, expired posts — and
 * more importantly the 14-days-after-expiry phone/handle scrub the FAQ promises —
 * would never run. This makes that promise hold unconditionally.
 *
 * Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically once the
 * CRON_SECRET env var is set. Without the env var the endpoint stays open, but
 * that's the same idempotent housekeeping any board view used to trigger — set
 * the secret anyway so strangers can't poke it.
 */
export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
      return fail("Unauthorized", 401);
    }
    await sweepExpired();
    return ok({ swept: true });
  } catch (e) {
    return handleError(e);
  }
}
