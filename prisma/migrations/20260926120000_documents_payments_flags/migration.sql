-- CreateEnum
CREATE TYPE "OnlinePaymentStatus" AS ENUM ('CREATED', 'PENDING', 'APPROVED', 'DECLINED', 'CANCELED', 'REFUNDED');

-- CreateTable
CREATE TABLE "IssuedDocument" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT,
    "schoolId" TEXT,
    "contentHash" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "signatureId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssuedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlinePayment" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "invoiceId" TEXT NOT NULL,
    "installmentIds" TEXT[],
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" "OnlinePaymentStatus" NOT NULL DEFAULT 'CREATED',
    "checkoutUrl" TEXT,
    "payerId" TEXT NOT NULL,
    "payerPhone" TEXT,
    "paymentId" TEXT,
    "lastEvent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlinePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "config" JSONB,
    "description" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssuedDocument_reference_key" ON "IssuedDocument"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "IssuedDocument_signatureId_key" ON "IssuedDocument"("signatureId");

-- CreateIndex
CREATE INDEX "IssuedDocument_subjectId_idx" ON "IssuedDocument"("subjectId");

-- CreateIndex
CREATE INDEX "IssuedDocument_schoolId_createdAt_idx" ON "IssuedDocument"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnlinePayment_providerRef_key" ON "OnlinePayment"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "OnlinePayment_paymentId_key" ON "OnlinePayment"("paymentId");

-- CreateIndex
CREATE INDEX "OnlinePayment_invoiceId_idx" ON "OnlinePayment"("invoiceId");

-- CreateIndex
CREATE INDEX "OnlinePayment_status_idx" ON "OnlinePayment"("status");

