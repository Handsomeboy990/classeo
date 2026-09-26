-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('APE', 'ACE', 'AME', 'VACATAIRE', 'PRIVATE');

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "status" "TeacherStatus";

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN     "stateMatricule" TEXT,
ADD COLUMN     "stateStatus" "TeacherStatus";

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_stateMatricule_key" ON "TeacherProfile"("stateMatricule");


-- Backfill: the teachers of private and confessional schools are private
-- teachers. Elsewhere the status stays empty until the ministry records its
-- agents in the registry: nothing is guessed about public school staff.
UPDATE "Teacher" t SET "status" = 'PRIVATE'
FROM "School" s
WHERE s.id = t."schoolId" AND s."sector" IN ('PRIVATE', 'CONFESSIONAL');
