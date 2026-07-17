import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { todaySgt, strToDate } from "@/lib/time";
import type { BoardFilters, CreateSessionItemInput } from "@/lib/schemas";
import { sweepExpired } from "@/services/listingService";
import { assertUnderActiveCap, newBatchToken, withContactLock, contactWhere, type Contact } from "@/services/batchService";
import { SKILL_ORDER } from "@/lib/skill";

const PUBLIC_SESSION_SELECT = {
  id: true, date: true, startTime: true, endTime: true,
  playersNeeded: true, maxPax: true, skillMin: true, skillMax: true, pricePerPlayerCents: true,
  notes: true, status: true, createdAt: true,
  customVenueName: true, customRegion: true,
  venue: {
    select: { id: true, name: true, region: true, venueType: true, availabilityNote: true, address: true },
  },
} satisfies Prisma.GameSessionSelect;

export type PublicSession = Prisma.GameSessionGetPayload<{ select: typeof PUBLIC_SESSION_SELECT }>;

export async function listSessions(filters: BoardFilters): Promise<PublicSession[]> {
  await sweepExpired();
  const rows = await prisma.gameSession.findMany({
    where: {
      date: filters.date.length > 0
        ? { in: filters.date.map(strToDate) }
        : { gte: strToDate(todaySgt()) },
      status: filters.available ? "OPEN" : { in: ["OPEN", "FILLED"] },
      ...(filters.venueId ? { venueId: filters.venueId } : {}),
      ...(filters.region.length > 0
        ? { OR: [{ venue: { region: { in: filters.region } } }, { customRegion: { in: filters.region } }] }
        : {}),
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

  // A poster's skill is a RANGE, so "filter by skill X" means "X falls within [skillMin, skillMax]" —
  // with multiple selected skills, a row matches if ANY of them falls in its range. That overlap
  // check isn't a plain column comparison, so it's applied here rather than in Prisma's `where`.
  if (filters.skill.length === 0) return rows;
  const targets = filters.skill.map((s) => SKILL_ORDER.indexOf(s));
  return rows.filter((r) => {
    const lo = SKILL_ORDER.indexOf(r.skillMin);
    const hi = SKILL_ORDER.indexOf(r.skillMax);
    return targets.some((t) => lo <= t && t <= hi);
  });
}

export async function getSession(id: string): Promise<PublicSession | null> {
  return prisma.gameSession.findUnique({ where: { id }, select: PUBLIC_SESSION_SELECT });
}

function sessionCreator(
  db: Prisma.TransactionClient,
  item: CreateSessionItemInput,
  contact: Contact,
  batchToken: string,
) {
  return db.gameSession.create({
    data: {
      venueId: item.venueId,
      customVenueName: item.customVenueName,
      customRegion: item.customRegion,
      date: strToDate(item.date),
      startTime: item.startTime,
      endTime: item.endTime,
      playersNeeded: item.playersNeeded,
      maxPax: item.maxPax,
      skillMin: item.skillMin,
      skillMax: item.skillMax,
      pricePerPlayerCents: item.pricePerPlayerCents,
      notes: item.notes,
      phone: contact.phone,
      telegramHandle: contact.telegramHandle,
      batchToken,
    },
    select: { id: true },
  });
}

/** Creates every item under one shared batchToken — the manage link for all of them. */
export async function createSessionBatch(
  items: CreateSessionItemInput[],
  contact: Contact,
): Promise<{ batchToken: string; ids: string[] }> {
  return withContactLock(contact, async (tx) => {
    const active = await tx.gameSession.count({ where: { ...contactWhere(contact), status: "OPEN" } });
    assertUnderActiveCap(active, items.length);

    const batchToken = newBatchToken();
    const rows = await Promise.all(items.map((item) => sessionCreator(tx, item, contact, batchToken)));
    return { batchToken, ids: rows.map((r) => r.id) };
  });
}

/** Appends more sessions to an existing manage link, reusing its contact info. Null if the token is unknown or scrubbed. */
export async function addSessionsToBatch(
  batchToken: string,
  items: CreateSessionItemInput[],
): Promise<{ ids: string[] } | null> {
  const existing = await prisma.gameSession.findFirst({
    where: { batchToken }, select: { phone: true, telegramHandle: true },
  });
  if (!existing || (!existing.phone && !existing.telegramHandle)) return null;
  const contact: Contact = { phone: existing.phone ?? undefined, telegramHandle: existing.telegramHandle ?? undefined };

  return withContactLock(contact, async (tx) => {
    const active = await tx.gameSession.count({ where: { ...contactWhere(contact), status: "OPEN" } });
    assertUnderActiveCap(active, items.length);

    const rows = await Promise.all(items.map((item) => sessionCreator(tx, item, contact, batchToken)));
    return { ids: rows.map((r) => r.id) };
  });
}

export async function revealSessionContact(id: string): Promise<Contact | null> {
  const row = await prisma.gameSession.findUnique({ where: { id }, select: { phone: true, telegramHandle: true } });
  if (!row) return null;
  return { phone: row.phone ?? undefined, telegramHandle: row.telegramHandle ?? undefined };
}
