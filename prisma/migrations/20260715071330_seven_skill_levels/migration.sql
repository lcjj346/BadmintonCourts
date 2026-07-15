-- AlterEnum
BEGIN;
CREATE TYPE "SkillLevel_new" AS ENUM ('LOW_BEGINNER', 'MID_BEGINNER', 'HIGH_BEGINNER', 'LOW_INTERMEDIATE', 'MID_INTERMEDIATE', 'HIGH_INTERMEDIATE', 'ADVANCED');
ALTER TABLE "GameSession" ALTER COLUMN "skillLevel" TYPE "SkillLevel_new" USING ("skillLevel"::text::"SkillLevel_new");
ALTER TYPE "SkillLevel" RENAME TO "SkillLevel_old";
ALTER TYPE "SkillLevel_new" RENAME TO "SkillLevel";
DROP TYPE "public"."SkillLevel_old";
COMMIT;
