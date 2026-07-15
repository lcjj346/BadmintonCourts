import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { todaySgt, strToDate } from "@/lib/time";
import type { BoardFilters, CreateSessionInput } from "@/lib/schemas";
import { ActivePostCapError, sweepExpired } from "@/services/listingService";

export const PUBLIC_SESSION_SELECT = {
  id: true, date: true, startTime: true, endTime: true,
  playersNeeded: true, skillLevel: true, pricePerPlayerCents: true,
  notes: true, status: true, createdAt: true,
  venue: {
    select: { id: true, name: true, region: true, venueType: true, availabilityNote: true },
  },
} satisfies Prisma.GameSessionSelect;

export type PublicSession = Prisma.GameSessionGetPayload<{ select: typeof PUBLIC_SESSION_SELECT }>;

export async function listSessions(filters: BoardFilters): Promise<PublicSession[]> {
  await sweepExpired();
  return prisma.gameSession.findMany({
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
      ...(filters.skill ? { skillLevel: filters.skill } : {}),
    },
    select: PUBLIC_SESSION_SELECT,
    // Postgres enums sort by declared order (OPEN, FILLED); asc puts OPEN first
    orderBy: [{ date: "asc" }, { status: "asc" }, { startTime: "asc" }],
  });
}

export async function getSession(id: string): Promise<PublicSession | null> {
  return prisma.gameSession.findUnique({ where: { id }, select: PUBLIC_SESSION_SELECT });
}

export async function createSession(
  input: CreateSessionInput,
): Promise<{ id: string; editToken: string }> {
  const active = await prisma.gameSession.count({
    where: { phone: input.phone, status: "OPEN" },
  });
  if (active >= 5) throw new ActivePostCapError();

  return prisma.gameSession.create({
    data: {
      venueId: input.venueId,
      date: strToDate(input.date),
      startTime: input.startTime,
      endTime: input.endTime,
      playersNeeded: input.playersNeeded,
      skillLevel: input.skillLevel,
      pricePerPlayerCents: input.pricePerPlayerCents,
      notes: input.notes,
      phone: input.phone,
    },
    select: { id: true, editToken: true },
  });
}

export async function revealSessionPhone(id: string): Promise<string | null> {
  const row = await prisma.gameSession.findUnique({ where: { id }, select: { phone: true } });
  return row?.phone ?? null;
}
