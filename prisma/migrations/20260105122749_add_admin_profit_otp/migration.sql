-- CreateTable
CREATE TABLE "AdminProfitOtp" (
    "id" TEXT NOT NULL,
    "profitDistributionId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminProfitOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminProfitOtp_profitDistributionId_idx" ON "AdminProfitOtp"("profitDistributionId");

-- CreateIndex
CREATE INDEX "AdminProfitOtp_adminUserId_idx" ON "AdminProfitOtp"("adminUserId");
