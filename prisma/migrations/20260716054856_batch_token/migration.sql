-- AlterTable: add batchToken as nullable first so this is safe on a non-empty table.
ALTER TABLE "GameSession" ADD COLUMN "batchToken" TEXT;
ALTER TABLE "Listing" ADD COLUMN "batchToken" TEXT;

-- Backfill: every existing row becomes its own batch of one, same as its old editToken.
UPDATE "GameSession" SET "batchToken" = gen_random_uuid()::text WHERE "batchToken" IS NULL;
UPDATE "Listing" SET "batchToken" = gen_random_uuid()::text WHERE "batchToken" IS NULL;

-- Now every row has a value, so this can be enforced.
ALTER TABLE "GameSession" ALTER COLUMN "batchToken" SET NOT NULL;
ALTER TABLE "Listing" ALTER COLUMN "batchToken" SET NOT NULL;

-- DropIndex
DROP INDEX "GameSession_editToken_key";
DROP INDEX "Listing_editToken_key";

-- AlterTable
ALTER TABLE "GameSession" DROP COLUMN "editToken";
ALTER TABLE "Listing" DROP COLUMN "editToken";

-- CreateIndex
CREATE INDEX "GameSession_batchToken_idx" ON "GameSession"("batchToken");
CREATE INDEX "Listing_batchToken_idx" ON "Listing"("batchToken");
