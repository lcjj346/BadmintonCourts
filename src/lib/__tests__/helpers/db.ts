import { prisma } from "@/lib/db";

export async function resetDb() {
  // Order matters only for FK targets; venue-dependent tables first.
  await prisma.reportFlag.deleteMany();
  await prisma.rateLimitEvent.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.gameSession.deleteMany();
  await prisma.venueSuggestion.deleteMany();
  await prisma.presence.deleteMany();
  await prisma.venue.deleteMany();
}

export async function makeVenue(name = "Test Hall") {
  return prisma.venue.create({
    data: {
      name, address: "1 Test St", postalCode: "123456",
      region: "WEST", venueType: "SPORTS_HALL",
    },
  });
}
