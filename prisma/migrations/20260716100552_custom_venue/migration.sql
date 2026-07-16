-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_venueId_fkey";

-- DropForeignKey
ALTER TABLE "Listing" DROP CONSTRAINT "Listing_venueId_fkey";

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "customRegion" "Region",
ADD COLUMN     "customVenueName" TEXT,
ALTER COLUMN "venueId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "customRegion" "Region",
ADD COLUMN     "customVenueName" TEXT,
ALTER COLUMN "venueId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
