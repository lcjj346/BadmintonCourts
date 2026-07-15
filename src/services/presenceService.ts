import { prisma } from "@/lib/db";

const COUNT_WINDOW_MS = 90_000; // "online now" = seen within the last 90s
const PRUNE_MS = 10 * 60_000; // drop rows not seen for 10 minutes

/**
 * Upsert a visitor's heartbeat, prune long-idle rows, and return how many
 * distinct visitors are currently online (seen within COUNT_WINDOW_MS).
 */
export async function recordPresence(id: string): Promise<number> {
  const now = Date.now();

  await prisma.presence.upsert({
    where: { id },
    create: { id, lastSeen: new Date(now) },
    update: { lastSeen: new Date(now) },
  });

  await prisma.presence.deleteMany({
    where: { lastSeen: { lt: new Date(now - PRUNE_MS) } },
  });

  return prisma.presence.count({
    where: { lastSeen: { gte: new Date(now - COUNT_WINDOW_MS) } },
  });
}
