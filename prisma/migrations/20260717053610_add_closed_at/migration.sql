-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "GameSession_status_closedAt_idx" ON "GameSession"("status", "closedAt");

-- CreateIndex
CREATE INDEX "Listing_status_closedAt_idx" ON "Listing"("status", "closedAt");
