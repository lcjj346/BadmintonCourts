import { PrismaClient, Region, VenueType } from "@prisma/client";
import venues from "./venues.json";

const prisma = new PrismaClient();

async function main() {
  for (const v of venues) {
    await prisma.venue.upsert({
      where: { name: v.name },
      update: { ...v, region: v.region as Region, venueType: v.venueType as VenueType },
      create: { ...v, region: v.region as Region, venueType: v.venueType as VenueType },
    });
  }
  console.log(`Seeded ${venues.length} venues`);
}

main().finally(() => prisma.$disconnect());
