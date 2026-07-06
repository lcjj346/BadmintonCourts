import { RateAction } from "@prisma/client";
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

async function countEvents(opts: {
  ipHash: string; action: RateAction; windowMs: number; targetId?: string;
}): Promise<number> {
  return prisma.rateLimitEvent.count({
    where: {
      ipHash: opts.ipHash,
      action: opts.action,
      createdAt: { gte: since(opts.windowMs) },
      ...(opts.targetId ? { targetId: opts.targetId } : {}),
    },
  });
}

export async function assertCreateAllowed(ipHash: string): Promise<void> {
  if ((await countEvents({ ipHash, action: "CREATE", windowMs: HOUR })) >= 5) {
    throw new RateLimitError();
  }
}

export async function recordCreate(ipHash: string): Promise<void> {
  await prisma.rateLimitEvent.create({ data: { ipHash, action: "CREATE" } });
}

/** Checks + records a low-frequency unauthenticated write (report, venue suggestion). */
export async function assertWriteAllowed(ipHash: string): Promise<void> {
  if ((await countEvents({ ipHash, action: "REPORT", windowMs: HOUR })) >= 15) {
    throw new RateLimitError();
  }
  await prisma.rateLimitEvent.create({ data: { ipHash, action: "REPORT" } });
}

/** Checks per-target + global reveal limits, and records the event when allowed. */
export async function assertRevealAllowed(ipHash: string, targetId: string): Promise<void> {
  const [perTarget, hourly, daily] = await Promise.all([
    countEvents({ ipHash, action: "REVEAL", windowMs: HOUR, targetId }),
    countEvents({ ipHash, action: "REVEAL", windowMs: HOUR }),
    countEvents({ ipHash, action: "REVEAL", windowMs: DAY }),
  ]);
  if (perTarget >= 3 || hourly >= 30 || daily >= 100) throw new RateLimitError();
  await prisma.rateLimitEvent.create({ data: { ipHash, action: "REVEAL", targetId } });
}
