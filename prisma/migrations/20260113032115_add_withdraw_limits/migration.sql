-- AlterTable
ALTER TABLE "SystemSetting" ADD COLUMN     "minWithdrawAmount" DECIMAL(65,30),
ADD COLUMN     "withdrawFrequencyDays" INTEGER;
