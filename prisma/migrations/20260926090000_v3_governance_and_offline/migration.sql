-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('MOBILE_MONEY', 'BANK');

-- CreateEnum
CREATE TYPE "SubjectStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransferKind" AS ENUM ('CLASS_CHANGE', 'SCHOOL_CHANGE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING_GUARDIAN', 'PENDING_DESTINATION', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrganizerLevel" AS ENUM ('SCHOOL', 'COMMUNE', 'DEPARTMENT', 'NATIONAL');

-- CreateEnum
CREATE TYPE "MockExamStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'IMPOSED');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeclarationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HelpStatus" AS ENUM ('PENDING', 'RESOLVED', 'REJECTED');

-- DropIndex
DROP INDEX "Teacher_userId_key";

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "logoFileId" TEXT,
ADD COLUMN     "motto" TEXT,
ADD COLUMN     "postalBox" TEXT,
ADD COLUMN     "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "statusChangedAt" TIMESTAMP(3),
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "ownerCommuneId" TEXT,
ADD COLUMN     "ownerDepartmentId" TEXT,
ADD COLUMN     "ownerSchoolId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "username" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- Existing accounts get "firstname.lastname" without accents, numbered from
-- 2 when the same name exists more than once (oldest account first).
WITH base AS (
  SELECT "id", "createdAt",
         regexp_replace(lower(translate("firstName" || '.' || "lastName",
           'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
           'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY')), '[^a-z0-9.]+', '', 'g') AS "u"
  FROM "User"
), ranked AS (
  SELECT "id", "u", row_number() OVER (PARTITION BY "u" ORDER BY "createdAt", "id") AS "rn" FROM base
)
UPDATE "User" SET "username" = CASE WHEN ranked."rn" = 1 THEN ranked."u" ELSE ranked."u" || ranked."rn" END
FROM ranked WHERE ranked."id" = "User"."id";

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activeSchoolId" TEXT;

-- AlterTable
ALTER TABLE "AcademicYear" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "requestedBySchoolId" TEXT,
ADD COLUMN     "status" "SubjectStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "npi" TEXT,
ADD COLUMN     "photoFileId" TEXT;

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "ticker" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tickerUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SchoolPaymentAccount" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolPaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "npi" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" "Gender",
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileBlob" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "purpose" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileBlob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSignature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signatureFileId" TEXT,
    "stampFileId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSignature" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signedById" TEXT NOT NULL,
    "schoolId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentTransfer" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" "TransferKind" NOT NULL,
    "fromSchoolId" TEXT NOT NULL,
    "fromClassroomId" TEXT NOT NULL,
    "toSchoolId" TEXT NOT NULL,
    "toClassroomId" TEXT,
    "reason" TEXT NOT NULL,
    "shareHistory" BOOLEAN NOT NULL DEFAULT true,
    "status" "TransferStatus" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "guardianDecisionById" TEXT,
    "guardianDecidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRecordAccess" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "grantedById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentRecordAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExam" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "organizerLevel" "OrganizerLevel" NOT NULL,
    "organizerSchoolId" TEXT,
    "organizerCommuneId" TEXT,
    "organizerDepartmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "subjects" TEXT[],
    "status" "MockExamStatus" NOT NULL DEFAULT 'DRAFT',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamParticipant" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "ParticipationStatus" NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,

    CONSTRAINT "MockExamParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockExamResult" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "enteredById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YearExtension" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "schoolId" TEXT,
    "until" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedById" TEXT NOT NULL,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YearExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "requestedById" TEXT NOT NULL,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "responseNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentRequestFile" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRequestFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentDeclaration" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "accountId" TEXT,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "payerPhone" TEXT,
    "transactionRef" TEXT NOT NULL,
    "proofFileId" TEXT,
    "status" "DeclarationStatus" NOT NULL DEFAULT 'PENDING',
    "declaredById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordHelpRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "HelpStatus" NOT NULL DEFAULT 'PENDING',
    "contact" TEXT,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHelpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSubmission" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolPaymentAccount_schoolId_idx" ON "SchoolPaymentAccount"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_npi_key" ON "TeacherProfile"("npi");

-- CreateIndex
CREATE INDEX "TeacherProfile_phone_idx" ON "TeacherProfile"("phone");

-- CreateIndex
CREATE INDEX "TeacherProfile_lastName_firstName_idx" ON "TeacherProfile"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "FileBlob_ownerUserId_idx" ON "FileBlob"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSignature_userId_key" ON "UserSignature"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSignature_reference_key" ON "DocumentSignature"("reference");

-- CreateIndex
CREATE INDEX "DocumentSignature_subjectId_idx" ON "DocumentSignature"("subjectId");

-- CreateIndex
CREATE INDEX "StudentTransfer_studentId_idx" ON "StudentTransfer"("studentId");

-- CreateIndex
CREATE INDEX "StudentTransfer_toSchoolId_status_idx" ON "StudentTransfer"("toSchoolId", "status");

-- CreateIndex
CREATE INDEX "StudentTransfer_fromSchoolId_status_idx" ON "StudentTransfer"("fromSchoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentRecordAccess_studentId_schoolId_key" ON "StudentRecordAccess"("studentId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "MockExamParticipant_examId_schoolId_key" ON "MockExamParticipant"("examId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "MockExamResult_examId_enrollmentId_subjectCode_key" ON "MockExamResult"("examId", "enrollmentId", "subjectCode");

-- CreateIndex
CREATE INDEX "YearExtension_academicYearId_schoolId_idx" ON "YearExtension"("academicYearId", "schoolId");

-- CreateIndex
CREATE INDEX "DocumentRequest_schoolId_status_idx" ON "DocumentRequest"("schoolId", "status");

-- CreateIndex
CREATE INDEX "PaymentDeclaration_status_idx" ON "PaymentDeclaration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentDeclaration_invoiceId_transactionRef_key" ON "PaymentDeclaration"("invoiceId", "transactionRef");

-- CreateIndex
CREATE INDEX "PasswordHelpRequest_status_idx" ON "PasswordHelpRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineSubmission_clientId_key" ON "OfflineSubmission"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_key_lang_key" ON "Translation"("key", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Teacher_profileId_idx" ON "Teacher"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_schoolId_key" ON "Teacher"("userId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_npi_key" ON "Student"("npi");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "FileBlob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPaymentAccount" ADD CONSTRAINT "SchoolPaymentAccount_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_ownerSchoolId_fkey" FOREIGN KEY ("ownerSchoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeSchoolId_fkey" FOREIGN KEY ("activeSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_requestedBySchoolId_fkey" FOREIGN KEY ("requestedBySchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TeacherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "FileBlob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileBlob" ADD CONSTRAINT "FileBlob_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSignature" ADD CONSTRAINT "UserSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSignature" ADD CONSTRAINT "UserSignature_signatureFileId_fkey" FOREIGN KEY ("signatureFileId") REFERENCES "FileBlob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSignature" ADD CONSTRAINT "UserSignature_stampFileId_fkey" FOREIGN KEY ("stampFileId") REFERENCES "FileBlob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTransfer" ADD CONSTRAINT "StudentTransfer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTransfer" ADD CONSTRAINT "StudentTransfer_fromSchoolId_fkey" FOREIGN KEY ("fromSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTransfer" ADD CONSTRAINT "StudentTransfer_toSchoolId_fkey" FOREIGN KEY ("toSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRecordAccess" ADD CONSTRAINT "StudentRecordAccess_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRecordAccess" ADD CONSTRAINT "StudentRecordAccess_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExam" ADD CONSTRAINT "MockExam_organizerSchoolId_fkey" FOREIGN KEY ("organizerSchoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamParticipant" ADD CONSTRAINT "MockExamParticipant_examId_fkey" FOREIGN KEY ("examId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamParticipant" ADD CONSTRAINT "MockExamParticipant_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockExamResult" ADD CONSTRAINT "MockExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YearExtension" ADD CONSTRAINT "YearExtension_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YearExtension" ADD CONSTRAINT "YearExtension_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestFile" ADD CONSTRAINT "DocumentRequestFile_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequestFile" ADD CONSTRAINT "DocumentRequestFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileBlob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDeclaration" ADD CONSTRAINT "PaymentDeclaration_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDeclaration" ADD CONSTRAINT "PaymentDeclaration_proofFileId_fkey" FOREIGN KEY ("proofFileId") REFERENCES "FileBlob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordHelpRequest" ADD CONSTRAINT "PasswordHelpRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordHelpRequest" ADD CONSTRAINT "PasswordHelpRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSubmission" ADD CONSTRAINT "OfflineSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

