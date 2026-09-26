-- CreateEnum
CREATE TYPE "SchoolDenomination" AS ENUM ('CATHOLIC', 'PROTESTANT', 'ISLAMIC', 'FRANCO_ARABIC', 'OTHER');

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "authorizationDate" TIMESTAMP(3),
ADD COLUMN     "authorizationRef" TEXT,
ADD COLUMN     "denomination" "SchoolDenomination",
ADD COLUMN     "isBilingual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promoter" TEXT;

-- Backfill: faith and bilingual programme read from the names already
-- given, only where they say it; the rest is left for the ministry.
UPDATE "School" SET "denomination" = 'FRANCO_ARABIC' WHERE "sector" = 'CONFESSIONAL' AND "name" ILIKE '%franco-arabe%';
UPDATE "School" SET "denomination" = 'CATHOLIC' WHERE "sector" = 'CONFESSIONAL' AND "denomination" IS NULL AND "name" ILIKE '%catholique%';
UPDATE "School" SET "denomination" = 'PROTESTANT' WHERE "sector" = 'CONFESSIONAL' AND "denomination" IS NULL AND ("name" ILIKE '%protestant%' OR "name" ILIKE '%méthodiste%' OR "name" ILIKE '%évangélique%');
UPDATE "School" SET "denomination" = 'ISLAMIC' WHERE "sector" = 'CONFESSIONAL' AND "denomination" IS NULL AND "name" ILIKE '%islam%';
UPDATE "School" SET "isBilingual" = true WHERE "name" ILIKE '%bilingue%';
