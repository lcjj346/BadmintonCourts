/*
  Warnings:

  - You are about to drop the column `editToken` on the `GameSession` table. All the data in the column will be lost.
  - You are about to drop the column `editToken` on the `Listing` table. All the data in the column will be lost.
  - The required column `batchToken` was added to the `GameSession` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `batchToken` was added to the `Listing` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropIndex
DROP INDEX "GameSession_editToken_key";

-- DropIndex
DROP INDEX "Listing_editToken_key";

-- AlterTable
ALTER TABLE "GameSession" DROP COLUMN "editToken",
ADD COLUMN     "batchToken" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Listing" DROP COLUMN "editToken",
ADD COLUMN     "batchToken" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "GameSession_batchToken_idx" ON "GameSession"("batchToken");

-- CreateIndex
CREATE INDEX "Listing_batchToken_idx" ON "Listing"("batchToken");
