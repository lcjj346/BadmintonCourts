import { prisma } from "@/lib/db";
import { dateToStr } from "@/lib/time";

export type ManagedPost = {
  type: "listing" | "session";
  post: {
    id: string; date: string; startTime: string; endTime: string;
    status: string; venueName: string; playersNeeded?: number;
  };
};

const MANAGE_SELECT = {
  id: true, date: true, startTime: true, endTime: true, status: true,
  venue: { select: { name: true } },
} as const;

const SESSION_MANAGE_SELECT = {
  ...MANAGE_SELECT, playersNeeded: true,
} as const;

export async function findPostByToken(token: string): Promise<ManagedPost | null> {
  const listing = await prisma.listing.findUnique({
    where: { editToken: token }, select: MANAGE_SELECT,
  });
  if (listing) {
    return {
      type: "listing",
      post: {
        id: listing.id, date: dateToStr(listing.date),
        startTime: listing.startTime, endTime: listing.endTime,
        status: listing.status, venueName: listing.venue.name,
      },
    };
  }
  const session = await prisma.gameSession.findUnique({
    where: { editToken: token }, select: SESSION_MANAGE_SELECT,
  });
  if (session) {
    return {
      type: "session",
      post: {
        id: session.id, date: dateToStr(session.date),
        startTime: session.startTime, endTime: session.endTime,
        status: session.status, venueName: session.venue.name,
        playersNeeded: session.playersNeeded,
      },
    };
  }
  return null;
}

// Session posts only. Returns false for an unknown token or a listing-type post.
export async function updatePlayersNeeded(token: string, playersNeeded: number): Promise<boolean> {
  const found = await findPostByToken(token);
  if (!found || found.type !== "session") return false;
  await prisma.gameSession.update({ where: { editToken: token }, data: { playersNeeded } });
  return true;
}

export async function closePostByToken(token: string): Promise<boolean> {
  const found = await findPostByToken(token);
  if (!found) return false;
  if (found.type === "listing") {
    await prisma.listing.update({ where: { editToken: token }, data: { status: "SOLD" } });
  } else {
    await prisma.gameSession.update({ where: { editToken: token }, data: { status: "FILLED" } });
  }
  return true;
}

export async function deletePostByToken(token: string): Promise<boolean> {
  const found = await findPostByToken(token);
  if (!found) return false;
  if (found.type === "listing") {
    await prisma.listing.delete({ where: { editToken: token } });
  } else {
    await prisma.gameSession.delete({ where: { editToken: token } });
  }
  return true;
}
