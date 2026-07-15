import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { todaySgt, strToDate } from "@/lib/time";
import type { BoardFilters, CreateListingInput } from "@/lib/schemas";

export class ActivePostCapError extends Error {
  constructor() {
    super("This phone number already has 5 active posts");
    this.name = "ActivePostCapError";
  }
}

export const PUBLIC_LISTING_SELECT = {
  id: true, date: true, startTime: true, endTime: true,
  priceCents: true, notes: true, status: true, createdAt: true,
  venue: {
    select: { id: true, name: true, region: true, venueType: true, availabilityNote: true },
  },
} satisfies Prisma.ListingSelect;

export type PublicListing = Prisma.ListingGetPayload<{ select: typeof PUBLIC_LISTING_SELECT }>;

const DAY_MS = 24 * 3600 * 1000;

/** On-read sweep: expire past posts, scrub stale phones, prune rate-limit events. */
export async function sweepExpired(): Promise<void> {
  const today = strToDate(todaySgt());
  const scrubBefore = new Date(today.getTime() - 7 * DAY_MS);
  const pruneBefore = new Date(Date.now() - DAY_MS);

  await Promise.all([
    prisma.listing.updateMany({
      where: { date: { lt: today }, status: { not: "EXPIRED" } },
      data: { status: "EXPIRED" },
    }),
    prisma.gameSession.updateMany({
      where: { date: { lt: today }, status: { not: "EXPIRED" } },
      data: { status: "EXPIRED" },
    }),
    prisma.listing.updateMany({
      where: { date: { lt: scrubBefore }, phone: { not: null } },
      data: { phone: null },
    }),
    prisma.gameSession.updateMany({
      where: { date: { lt: scrubBefore }, phone: { not: null } },
      data: { phone: null },
    }),
    prisma.rateLimitEvent.deleteMany({ where: { createdAt: { lt: pruneBefore } } }),
  ]);
}

export async function listListings(filters: BoardFilters): Promise<PublicListing[]> {
  await sweepExpired();
  return prisma.listing.findMany({
    where: {
      date: filters.date ? strToDate(filters.date) : { gte: strToDate(todaySgt()) },
      status: filters.available ? "AVAILABLE" : { in: ["AVAILABLE", "SOLD"] },
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
    select: PUBLIC_LISTING_SELECT,
    // Postgres enums sort by declared order (AVAILABLE, SOLD); asc puts AVAILABLE first
    orderBy: [{ date: "asc" }, { status: "asc" }, { startTime: "asc" }],
  });
}

export async function getListing(id: string): Promise<PublicListing | null> {
  return prisma.listing.findUnique({ where: { id }, select: PUBLIC_LISTING_SELECT });
}

export async function createListing(
  input: CreateListingInput,
): Promise<{ id: string; editToken: string }> {
  const active = await prisma.listing.count({
    where: { phone: input.phone, status: "AVAILABLE" },
  });
  if (active >= 5) throw new ActivePostCapError();

  const row = await prisma.listing.create({
    data: {
      venueId: input.venueId,
      date: strToDate(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
      priceCents: input.priceCents,
      notes: input.notes,
      phone: input.phone,
    },
    select: { id: true, editToken: true },
  });
  return row;
}

export async function revealListingPhone(id: string): Promise<string | null> {
  const row = await prisma.listing.findUnique({ where: { id }, select: { phone: true } });
  return row?.phone ?? null;
}
