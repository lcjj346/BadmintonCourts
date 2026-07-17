import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { todaySgt, strToDate, nowSgtTime } from "@/lib/time";
import type { BoardFilters, CreateListingItemInput } from "@/lib/schemas";
import {
  assertUnderActiveCap, newBatchToken, createBatch, contactWhere, ActivePostCapError, type Contact,
} from "@/services/batchService";

export { ActivePostCapError };

const PUBLIC_LISTING_SELECT = {
  id: true, date: true, startTime: true, endTime: true,
  priceCents: true, notes: true, status: true, createdAt: true,
  customVenueName: true, customRegion: true,
  venue: {
    select: { id: true, name: true, region: true, venueType: true, availabilityNote: true, address: true },
  },
} satisfies Prisma.ListingSelect;

export type PublicListing = Prisma.ListingGetPayload<{ select: typeof PUBLIC_LISTING_SELECT }>;

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** On-read sweep: expire past/long-closed posts, scrub stale phones, prune rate-limit events. */
export async function sweepExpired(): Promise<void> {
  const today = strToDate(todaySgt());
  const now = nowSgtTime();
  const scrubBefore = new Date(today.getTime() - 14 * DAY_MS);
  const pruneBefore = new Date(Date.now() - DAY_MS);
  const closedBefore = new Date(Date.now() - HOUR_MS);

  // A slot expires once its start time passes (past dates, or today with startTime <= now SGT),
  // or once it's been marked SOLD/FILLED for over an hour without the poster removing it —
  // closedAt is only set while status is SOLD/FILLED, so this OR branch is a no-op for
  // AVAILABLE/OPEN rows.
  const expiredWhere = {
    status: { not: "EXPIRED" as const },
    OR: [
      { date: { lt: today } },
      { date: today, startTime: { lte: now } },
      { closedAt: { lt: closedBefore } },
    ],
  };

  await Promise.all([
    prisma.listing.updateMany({
      where: expiredWhere,
      data: { status: "EXPIRED" },
    }),
    prisma.gameSession.updateMany({
      where: expiredWhere,
      data: { status: "EXPIRED" },
    }),
    prisma.listing.updateMany({
      where: { date: { lt: scrubBefore }, OR: [{ phone: { not: null } }, { telegramHandle: { not: null } }] },
      data: { phone: null, telegramHandle: null },
    }),
    prisma.gameSession.updateMany({
      where: { date: { lt: scrubBefore }, OR: [{ phone: { not: null } }, { telegramHandle: { not: null } }] },
      data: { phone: null, telegramHandle: null },
    }),
    prisma.rateLimitEvent.deleteMany({ where: { createdAt: { lt: pruneBefore } } }),
  ]);
}

export async function listListings(filters: BoardFilters): Promise<PublicListing[]> {
  await sweepExpired();
  return prisma.listing.findMany({
    where: {
      date: filters.date.length > 0
        ? { in: filters.date.map(strToDate) }
        : { gte: strToDate(todaySgt()) },
      status: filters.available ? "AVAILABLE" : { in: ["AVAILABLE", "SOLD"] },
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
    select: PUBLIC_LISTING_SELECT,
    // Postgres enums sort by declared order (AVAILABLE, SOLD); asc puts AVAILABLE first
    orderBy: [{ date: "asc" }, { status: "asc" }, { startTime: "asc" }],
  });
}

export async function getListing(id: string): Promise<PublicListing | null> {
  return prisma.listing.findUnique({ where: { id }, select: PUBLIC_LISTING_SELECT });
}

function listingCreator(item: CreateListingItemInput, contact: Contact, batchToken: string) {
  return prisma.listing.create({
    data: {
      venueId: item.venueId,
      customVenueName: item.customVenueName,
      customRegion: item.customRegion,
      date: strToDate(item.date),
      startTime: item.startTime,
      endTime: item.endTime,
      priceCents: item.priceCents,
      notes: item.notes,
      phone: contact.phone,
      telegramHandle: contact.telegramHandle,
      batchToken,
    },
    select: { id: true },
  });
}

/** Creates every item under one shared batchToken — the manage link for all of them. */
export async function createListingBatch(
  items: CreateListingItemInput[],
  contact: Contact,
): Promise<{ batchToken: string; ids: string[] }> {
  const active = await prisma.listing.count({ where: { ...contactWhere(contact), status: "AVAILABLE" } });
  assertUnderActiveCap(active, items.length);

  const batchToken = newBatchToken();
  const ids = await createBatch(items.map((item) => listingCreator(item, contact, batchToken)));
  return { batchToken, ids };
}

/** Appends more listings to an existing manage link, reusing its contact info. Null if the token is unknown or scrubbed. */
export async function addListingsToBatch(
  batchToken: string,
  items: CreateListingItemInput[],
): Promise<{ ids: string[] } | null> {
  const existing = await prisma.listing.findFirst({
    where: { batchToken }, select: { phone: true, telegramHandle: true },
  });
  if (!existing || (!existing.phone && !existing.telegramHandle)) return null;
  const contact: Contact = { phone: existing.phone ?? undefined, telegramHandle: existing.telegramHandle ?? undefined };

  const active = await prisma.listing.count({ where: { ...contactWhere(contact), status: "AVAILABLE" } });
  assertUnderActiveCap(active, items.length);

  const ids = await createBatch(items.map((item) => listingCreator(item, contact, batchToken)));
  return { ids };
}

// Only an AVAILABLE listing reveals its contact — the UI already hides the "Reveal"
// button once a post is SOLD/EXPIRED, but that's a client-side gate only; without this
// check, anyone who already has the id (e.g. captured before it sold) could still hit
// the API directly and get the number.
export async function revealListingContact(id: string): Promise<Contact | null> {
  const row = await prisma.listing.findUnique({ where: { id }, select: { phone: true, telegramHandle: true, status: true } });
  if (!row || row.status !== "AVAILABLE") return null;
  return { phone: row.phone ?? undefined, telegramHandle: row.telegramHandle ?? undefined };
}
