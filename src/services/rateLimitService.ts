import { RateAction, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests — try again later");
    this.name = "RateLimitError";
  }
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function since(ms: number): Date {
  return new Date(Date.now() - ms);
}

async function countEvents(
  db: Prisma.TransactionClient,
  opts: { ipHash: string; action: RateAction; windowMs: number; targetId?: string },
): Promise<number> {
  return db.rateLimitEvent.count({
    where: {
      ipHash: opts.ipHash,
      action: opts.action,
      createdAt: { gte: since(opts.windowMs) },
      ...(opts.targetId ? { targetId: opts.targetId } : {}),
    },
  });
}

/**
 * Runs `fn` inside a transaction holding a Postgres advisory lock keyed on
 * ipHash+action. Without this, a burst of concurrent requests from the same IP
 * can all count the same "under the limit" number before any of them commits
 * its own event row, letting all of them through together — a plain
 * count-then-create is only safe against sequential requests. The lock
 * serializes requests sharing that exact key only; different IPs or actions
 * are never blocked by each other. `pg_advisory_xact_lock` auto-releases when
 * the transaction ends, so a thrown RateLimitError still releases it correctly.
 */
async function withIpActionLock<T>(
  ipHash: string,
  action: RateAction,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${ipHash}:${action}`}))`;
    return fn(tx);
  });
}

/**
 * Checks and reserves a CREATE slot atomically, so it must be called BEFORE the
 * post is created — not after, like the old assertCreateAllowed/recordCreate
 * split. That split left a gap for the same race this function's lock closes:
 * with the check and the write on either side of the actual create, two
 * concurrent requests could both pass the check before either recorded, no
 * matter how tightly the check itself was locked. The tradeoff is that a
 * request which fails afterward (e.g. ActivePostCapError) still consumes a
 * slot — acceptable since that's a genuine attempt, and the caller has 9 more
 * within the hour.
 */
export async function assertAndRecordCreate(ipHash: string): Promise<void> {
  await withIpActionLock(ipHash, "CREATE", async (tx) => {
    if ((await countEvents(tx, { ipHash, action: "CREATE", windowMs: HOUR })) >= 10) {
      throw new RateLimitError();
    }
    await tx.rateLimitEvent.create({ data: { ipHash, action: "CREATE" } });
  });
}

/** Checks + records a low-frequency unauthenticated write (report, venue suggestion). */
export async function assertWriteAllowed(ipHash: string): Promise<void> {
  await withIpActionLock(ipHash, "REPORT", async (tx) => {
    if ((await countEvents(tx, { ipHash, action: "REPORT", windowMs: HOUR })) >= 15) {
      throw new RateLimitError();
    }
    await tx.rateLimitEvent.create({ data: { ipHash, action: "REPORT" } });
  });
}

/**
 * Checks + records a presence heartbeat. The client pings every 30s while a tab is
 * open (~120/hour), so the ceiling sits well above normal usage and only bounds a
 * script hammering the endpoint with random ids.
 */
export async function assertPresenceAllowed(ipHash: string): Promise<void> {
  await withIpActionLock(ipHash, "PRESENCE", async (tx) => {
    if ((await countEvents(tx, { ipHash, action: "PRESENCE", windowMs: HOUR })) >= 300) {
      throw new RateLimitError();
    }
    await tx.rateLimitEvent.create({ data: { ipHash, action: "PRESENCE" } });
  });
}

/** Checks per-target + global reveal limits, and records the event when allowed. */
export async function assertRevealAllowed(ipHash: string, targetId: string): Promise<void> {
  await withIpActionLock(ipHash, "REVEAL", async (tx) => {
    const [perTarget, hourly, daily] = await Promise.all([
      countEvents(tx, { ipHash, action: "REVEAL", windowMs: HOUR, targetId }),
      countEvents(tx, { ipHash, action: "REVEAL", windowMs: HOUR }),
      countEvents(tx, { ipHash, action: "REVEAL", windowMs: DAY }),
    ]);
    if (perTarget >= 3 || hourly >= 30 || daily >= 100) throw new RateLimitError();
    await tx.rateLimitEvent.create({ data: { ipHash, action: "REVEAL", targetId } });
  });
}
