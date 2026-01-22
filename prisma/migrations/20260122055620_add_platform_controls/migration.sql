-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "depositsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "platformMaintenanceMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "withdrawalsEnabled" BOOLEAN NOT NULL DEFAULT true;
