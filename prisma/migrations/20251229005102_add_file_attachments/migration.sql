-- CreateEnum
CREATE TYPE "AttachmentPurpose" AS ENUM ('DEPOSIT_PROOF', 'SUPPORT_MESSAGE');

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "purpose" "AttachmentPurpose" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "depositId" TEXT,
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileAttachment_ownerUserId_idx" ON "FileAttachment"("ownerUserId");

-- CreateIndex
CREATE INDEX "FileAttachment_depositId_idx" ON "FileAttachment"("depositId");

-- CreateIndex
CREATE INDEX "FileAttachment_ticketId_idx" ON "FileAttachment"("ticketId");
