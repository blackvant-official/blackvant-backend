-- CreateTable
CREATE TABLE "WithdrawalOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "WithdrawalOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WithdrawalOtp_userId_idx" ON "WithdrawalOtp"("userId");

-- CreateIndex
CREATE INDEX "WithdrawalOtp_expiresAt_idx" ON "WithdrawalOtp"("expiresAt");

-- AddForeignKey
ALTER TABLE "WithdrawalOtp" ADD CONSTRAINT "WithdrawalOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
