-- CreateEnum
CREATE TYPE "ConnectionOutcome" AS ENUM ('SUCCESS', 'WRONG_PASSWORD', 'LOCKED', 'DISABLED', 'UNKNOWN_ACCOUNT', 'RATE_LIMITED', 'SIGN_OUT');

-- CreateTable
CREATE TABLE "ConnectionEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" "ConnectionOutcome" NOT NULL,
    "userId" TEXT,
    "roleCode" TEXT,
    "scopeLevel" "ScopeLevel",
    "departmentId" TEXT,
    "communeId" TEXT,
    "schoolId" TEXT,
    "chain" "EducationChain",
    "ip" TEXT,
    "ipTruncated" BOOLEAN NOT NULL DEFAULT false,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "firstTime" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConnectionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageViewDaily" (
    "day" DATE NOT NULL,
    "dimension" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PageViewDaily_pkey" PRIMARY KEY ("day","dimension","key")
);

-- CreateTable
CREATE TABLE "MaintenanceMarker" (
    "key" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceMarker_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ConnectionEvent_createdAt_idx" ON "ConnectionEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ConnectionEvent_departmentId_createdAt_idx" ON "ConnectionEvent"("departmentId", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectionEvent_userId_createdAt_idx" ON "ConnectionEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PageViewDaily_dimension_day_idx" ON "PageViewDaily"("dimension", "day");

-- AddForeignKey
ALTER TABLE "ConnectionEvent" ADD CONSTRAINT "ConnectionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

