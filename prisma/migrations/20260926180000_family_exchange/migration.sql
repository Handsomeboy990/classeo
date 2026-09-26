-- CreateEnum
CREATE TYPE "FamilyDocumentKind" AS ENUM ('ENROLLMENT', 'ABSENCE', 'MEDICAL');

-- CreateEnum
CREATE TYPE "FamilyDocumentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "audioDurationMs" INTEGER,
ADD COLUMN     "audioFileId" TEXT;

-- CreateTable
CREATE TABLE "RequiredPiece" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "levelId" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isHealth" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequiredPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyDocument" (
    "id" TEXT NOT NULL,
    "kind" "FamilyDocumentKind" NOT NULL,
    "status" "FamilyDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "requiredPieceId" TEXT,
    "attendanceId" TEXT,
    "startsOn" DATE,
    "endsOn" DATE,
    "note" TEXT,
    "fileId" TEXT,
    "fileRemovedAt" TIMESTAMP(3),
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequiredPiece_schoolId_idx" ON "RequiredPiece"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyDocument_fileId_key" ON "FamilyDocument"("fileId");

-- CreateIndex
CREATE INDEX "FamilyDocument_schoolId_kind_status_idx" ON "FamilyDocument"("schoolId", "kind", "status");

-- CreateIndex
CREATE INDEX "FamilyDocument_enrollmentId_idx" ON "FamilyDocument"("enrollmentId");

-- CreateIndex
CREATE INDEX "FamilyDocument_attendanceId_idx" ON "FamilyDocument"("attendanceId");

-- CreateIndex
CREATE INDEX "FamilyDocument_requiredPieceId_idx" ON "FamilyDocument"("requiredPieceId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_audioFileId_key" ON "Message"("audioFileId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "FileBlob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredPiece" ADD CONSTRAINT "RequiredPiece_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredPiece" ADD CONSTRAINT "RequiredPiece_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "AcademicLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_requiredPieceId_fkey" FOREIGN KEY ("requiredPieceId") REFERENCES "RequiredPiece"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "StudentAttendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileBlob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
