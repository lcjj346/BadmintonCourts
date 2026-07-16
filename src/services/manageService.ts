import { prisma } from "@/lib/db";
import { dateToStr, strToDate } from "@/lib/time";
import type { EditListingInput, EditSessionInput } from "@/lib/schemas";

export type ManagedPost = {
  type: "listing" | "session";
  post: {
    id: string; date: string; startTime: string; endTime: string;
    status: string; venueName: string;
    notes: string | null;
    priceCents?: number | null;
    pricePerPlayerCents?: number | null;
    playersNeeded?: number;
    skillMin?: string;
    skillMax?: string;
  };
};

const LISTING_MANAGE_SELECT = {
  id: true, date: true, startTime: true, endTime: true, status: true, notes: true, priceCents: true,
  customVenueName: true,
  venue: { select: { name: true } },
} as const;

const SESSION_MANAGE_SELECT = {
  id: true, date: true, startTime: true, endTime: true, status: true, notes: true, pricePerPlayerCents: true,
  playersNeeded: true, skillMin: true, skillMax: true,
  customVenueName: true,
  venue: { select: { name: true } },
} as const;

/** Everything created under one manage link — the whole batch, both kinds. */
export async function findPostsByBatchToken(token: string): Promise<ManagedPost[]> {
  const [listings, sessions] = await Promise.all([
    prisma.listing.findMany({
      where: { batchToken: token }, select: LISTING_MANAGE_SELECT, orderBy: { createdAt: "asc" },
    }),
    prisma.gameSession.findMany({
      where: { batchToken: token }, select: SESSION_MANAGE_SELECT, orderBy: { createdAt: "asc" },
    }),
  ]);

  const listingPosts: ManagedPost[] = listings.map((l) => ({
    type: "listing",
    post: {
      id: l.id, date: dateToStr(l.date), startTime: l.startTime, endTime: l.endTime,
      status: l.status, venueName: l.venue?.name ?? l.customVenueName ?? "Unlisted venue",
      notes: l.notes, priceCents: l.priceCents,
    },
  }));
  const sessionPosts: ManagedPost[] = sessions.map((s) => ({
    type: "session",
    post: {
      id: s.id, date: dateToStr(s.date), startTime: s.startTime, endTime: s.endTime,
      status: s.status, venueName: s.venue?.name ?? s.customVenueName ?? "Unlisted venue", notes: s.notes,
      pricePerPlayerCents: s.pricePerPlayerCents,
      playersNeeded: s.playersNeeded, skillMin: s.skillMin, skillMax: s.skillMax,
    },
  }));

  return [...listingPosts, ...sessionPosts].sort((a, b) =>
    a.post.date === b.post.date
      ? a.post.startTime.localeCompare(b.post.startTime)
      : a.post.date.localeCompare(b.post.date),
  );
}

/** Confirms `id` both exists and belongs to this manage link before any write. */
async function ownedListing(token: string, id: string) {
  return prisma.listing.findFirst({ where: { id, batchToken: token }, select: { id: true } });
}
async function ownedSession(token: string, id: string) {
  return prisma.gameSession.findFirst({ where: { id, batchToken: token }, select: { id: true } });
}

export async function updatePlayersNeeded(token: string, id: string, playersNeeded: number): Promise<boolean> {
  if (!(await ownedSession(token, id))) return false;
  await prisma.gameSession.update({ where: { id }, data: { playersNeeded } });
  return true;
}

export async function closePost(token: string, type: "listing" | "session", id: string): Promise<boolean> {
  if (type === "listing") {
    if (!(await ownedListing(token, id))) return false;
    await prisma.listing.update({ where: { id }, data: { status: "SOLD" } });
  } else {
    if (!(await ownedSession(token, id))) return false;
    await prisma.gameSession.update({ where: { id }, data: { status: "FILLED" } });
  }
  return true;
}

/** Undoes an accidental "mark as sold/filled" click. */
export async function reopenPost(token: string, type: "listing" | "session", id: string): Promise<boolean> {
  if (type === "listing") {
    if (!(await ownedListing(token, id))) return false;
    await prisma.listing.update({ where: { id }, data: { status: "AVAILABLE" } });
  } else {
    if (!(await ownedSession(token, id))) return false;
    await prisma.gameSession.update({ where: { id }, data: { status: "OPEN" } });
  }
  return true;
}

export async function deletePost(token: string, type: "listing" | "session", id: string): Promise<boolean> {
  if (type === "listing") {
    if (!(await ownedListing(token, id))) return false;
    await prisma.listing.delete({ where: { id } });
  } else {
    if (!(await ownedSession(token, id))) return false;
    await prisma.gameSession.delete({ where: { id } });
  }
  return true;
}

/** Venue is fixed — changing it means deleting and reposting. */
export async function editListing(token: string, id: string, fields: EditListingInput): Promise<boolean> {
  if (!(await ownedListing(token, id))) return false;
  await prisma.listing.update({
    where: { id },
    data: {
      date: strToDate(fields.date), startTime: fields.startTime, endTime: fields.endTime,
      priceCents: fields.priceCents, notes: fields.notes,
    },
  });
  return true;
}

export async function editSession(token: string, id: string, fields: EditSessionInput): Promise<boolean> {
  if (!(await ownedSession(token, id))) return false;
  await prisma.gameSession.update({
    where: { id },
    data: {
      date: strToDate(fields.date), startTime: fields.startTime, endTime: fields.endTime,
      pricePerPlayerCents: fields.pricePerPlayerCents, notes: fields.notes,
      playersNeeded: fields.playersNeeded, skillMin: fields.skillMin, skillMax: fields.skillMax,
    },
  });
  return true;
}
