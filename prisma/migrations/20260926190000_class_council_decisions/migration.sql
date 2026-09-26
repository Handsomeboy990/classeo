-- CreateEnum
CREATE TYPE "CouncilDecision" AS ENUM ('PROMOTED', 'REPEAT', 'EXCLUDED');

-- CreateTable
CREATE TABLE "ClassCouncilDecision" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "decision" "CouncilDecision" NOT NULL,
    "yearlyAverage" DECIMAL(5,2),
    "note" TEXT,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassCouncilDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassCouncilDecision_enrollmentId_key" ON "ClassCouncilDecision"("enrollmentId");

-- AddForeignKey
ALTER TABLE "ClassCouncilDecision" ADD CONSTRAINT "ClassCouncilDecision_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

