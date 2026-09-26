-- CreateEnum
CREATE TYPE "FeeKind" AS ENUM ('SCHOOL_CONTRIBUTION', 'APE_DUES', 'OTHER');

-- AlterTable
ALTER TABLE "FeeType" ADD COLUMN     "kind" "FeeKind" NOT NULL DEFAULT 'OTHER';

-- Backfill: existing fee types recognised by their name. Invoices already
-- issued are not changed.
UPDATE "FeeType" SET "kind" = 'SCHOOL_CONTRIBUTION' WHERE "name" ILIKE '%contribution scolaire%';
UPDATE "FeeType" SET "kind" = 'APE_DUES' WHERE "kind" = 'OTHER' AND ("name" ILIKE '%cotisation APE%' OR "name" ILIKE '%association des parents%');
