/*
  Warnings:

  - You are about to drop the column `skillLevel` on the `GameSession` table. All the data in the column will be lost.
  - Added the required column `skillMax` to the `GameSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `skillMin` to the `GameSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GameSession" DROP COLUMN "skillLevel",
ADD COLUMN     "skillMax" "SkillLevel" NOT NULL,
ADD COLUMN     "skillMin" "SkillLevel" NOT NULL;
