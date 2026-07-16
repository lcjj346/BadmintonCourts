import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { todaySgt, strToDate } from "@/lib/time";
import type { BoardFilters, CreateSessionItemInput } from "@/lib/schemas";
import { ActivePostCapError, sweepExpired } from "@/services/listingService";
import { SKILL_ORDER } from "@/lib/skill";

export const PUBLIC_SESSION_SELECT = {
  id: true, date: true, startTime: true, endTime: true,
  playersNeeded: true, skillMin: true, skillMax: true, pricePerPlayerCents: true,
  notes: true, status: true, createdAt: true,
  venue: {
    select: { id: true, name: true, region: true, venueType: true, availabilityNote: true },
  },
} satisfies Prisma.GameSessionSelect;

export type PublicSession = Prisma.GameSessionGetPayload<{ select: typeof PUBLIC_SESSION_SELECT }>;

export async function listSessions(filters: BoardFilters): Promise<PublicSession[]> {
  await sweepExpired();
  const rows = await prisma.gameSession.findMany({
    where: {
      date: filters.date ? strToDate(filters.date) : { gte: strToDate(todaySgt()) },
      status: filters.available ? "OPEN" : { in: ["OPEN", "FILLED"] },
      ...(filters.venueId ? { venueId: filters.venueId } : {}),
      ...(filters.region ? { venue: { region: filters.region } } : {}),
      ...(filters.timeFrom || filters.timeTo
        ? {
            startTime: {
              ...(filters.timeFrom ? { gte: filters.timeFrom } : {}),
              ...(filters.timeTo ? { lt: filters.timeTo } : {}),
            },
          }
        : {}),
    },
    select: PUBLIC_SESSION_SELECT,
    // Postgres enums sort by declared order (OPEN, FILLED); asc puts OPEN first
    orderBy: [{ date: "asc" }, { status: "asc" }, { startTime: "asc" }],
  });

  // A poster's skill is a RANGE, so "filter by skill X" means "X falls within [skillMin, skillMax]".
  // That overlap check isn't a plain column comparison, so it's applied here rather than in Prisma's `where`.
  if (!filters.skill) return rows;
  const target = SKILL_ORDER.indexOf(filters.skill);
  return rows.filter(
    (r) => SKILL_ORDER.indexOf(r.skillMin) <= target && target <= SKILL_ORDER.indexOf(r.skillMax),
  );
}

export async function getSession(id: string): Promise<PublicSession | null> {
  return prisma.gameSession.findUnique({ where: { id }, select: PUBLIC_SESSION_SELECT });
}

/** Creates every item under one shared batchToken — the manage link for all of them. */
export async function createSessionBatch(
  items: CreateSessionItemInput[],
  phone: string,
): Promise<{ batchToken: string; ids: string[] }> {
  const active = await prisma.gameSession.count({
    where: { phone, status: "OPEN" },
  });
  if (active + items.length > 5) throw new ActivePostCapError();

  const batchToken = randomUUID();
  const rows = await prisma.$transaction(
    items.map((item) =>
      prisma.gameSession.create({
        data: {
          venueId: item.venueId,
          date: strToDate(item.date),
          startTime: item.startTime,
          endTime: item.endTime,
          playersNeeded: item.playersNeeded,
          skillMin: item.skillMin,
          skillMax: item.skillMax,
          pricePerPlayerCents: item.pricePerPlayerCents,
          notes: item.notes,
          phone,
          batchToken,
        },
        select: { id: true },
      }),
    ),
  );
  return { batchToken, ids: rows.map((r) => r.id) };
}

/** Appends more sessions to an existing manage link, reusing its phone. Null if the token is unknown or scrubbed. */
export async function addSessionsToBatch(
  batchToken: string,
  items: CreateSessionItemInput[],
): Promise<{ ids: string[] } | null> {
  const existing = await prisma.gameSession.findFirst({ where: { batchToken }, select: { phone: true } });
  if (!existing?.phone) return null;
  const phone = existing.phone;

  const active = await prisma.gameSession.count({ where: { phone, status: "OPEN" } });
  if (active + items.length > 5) throw new ActivePostCapError();

  const rows = await prisma.$transaction(
    items.map((item) =>
      prisma.gameSession.create({
        data: {
          venueId: item.venueId,
          date: strToDate(item.date),
          startTime: item.startTime,
          endTime: item.endTime,
          playersNeeded: item.playersNeeded,
          skillMin: item.skillMin,
          skillMax: item.skillMax,
          pricePerPlayerCents: item.pricePerPlayerCents,
          notes: item.notes,
          phone,
          batchToken,
        },
        select: { id: true },
      }),
    ),
  );
  return { ids: rows.map((r) => r.id) };
}

export async function revealSessionPhone(id: string): Promise<string | null> {
  const row = await prisma.gameSession.findUnique({ where: { id }, select: { phone: true } });
  return row?.phone ?? null;
}
