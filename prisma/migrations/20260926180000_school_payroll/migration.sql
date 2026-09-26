-- AlterTable
ALTER TABLE "Payroll" ADD COLUMN     "allowances" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "allowancesNote" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "baseAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deductions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deductionsNote" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "teacherId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Payroll_schoolId_month_idx" ON "Payroll"("schoolId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_teacherId_month_key" ON "Payroll"("teacherId", "month");

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: payroll rows written before this change (reserved schema, no
-- screen) keep their amounts: the gross becomes the base.
UPDATE "Payroll" SET "baseAmount" = "grossAmount", "deductions" = GREATEST("grossAmount" - "netAmount", 0) WHERE "baseAmount" = 0;
