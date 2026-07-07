import { prisma } from "@/lib/db";

export async function listVenues() {
  return prisma.venue.findMany({
    select: {
      id: true, name: true, address: true, region: true,
      venueType: true, availabilityNote: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function createVenueSuggestion(name: string, details?: string) {
  await prisma.venueSuggestion.create({ data: { name, details } });
}
