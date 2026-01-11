-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "capitalLockEnabled" BOOLEAN NOT NULL DEFAULT false,
    "capitalLockDays" INTEGER NOT NULL DEFAULT 0,
    "capitalLockStartAt" TIMESTAMP(3),
    "updatedByAdminId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);
