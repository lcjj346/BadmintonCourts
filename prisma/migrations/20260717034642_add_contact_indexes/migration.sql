-- CreateIndex
CREATE INDEX "GameSession_phone_status_idx" ON "GameSession"("phone", "status");

-- CreateIndex
CREATE INDEX "GameSession_telegramHandle_status_idx" ON "GameSession"("telegramHandle", "status");

-- CreateIndex
CREATE INDEX "Listing_phone_status_idx" ON "Listing"("phone", "status");

-- CreateIndex
CREATE INDEX "Listing_telegramHandle_status_idx" ON "Listing"("telegramHandle", "status");
