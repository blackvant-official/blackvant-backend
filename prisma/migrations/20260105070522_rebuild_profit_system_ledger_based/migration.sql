/*
  Warnings:

  - You are about to drop the column `declaredDate` on the `ProfitDistribution` table. All the data in the column will be lost.
  - You are about to drop the column `declaredProfit` on the `ProfitDistribution` table. All the data in the column will be lost.
  - You are about to drop the column `investmentPool` on the `ProfitDistribution` table. All the data in the column will be lost.
  - You are about to drop the column `lockedAt` on the `ProfitDistribution` table. All the data in the column will be lost.
  - You are about to drop the column `refCode` on the `ProfitDistribution` table. All the data in the column will be lost.
  - The `status` column on the `ProfitDistribution` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `investmentSnapshot` on the `ProfitPayout` table. All the data in the column will be lost.
  - You are about to drop the column `shareAmount` on the `ProfitPayout` table. All the data in the column will be lost.
  - You are about to drop the column `investmentBalance` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `profitBalance` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[distributionId,userId]` on the table `ProfitPayout` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `distributionDate` to the `ProfitDistribution` table without a default value. This is not possible if the table is not empty.
  - Added the required column `activeInvestmentSnapshot` to the `ProfitPayout` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profitAmount` to the `ProfitPayout` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProfitDistributionStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISTRIBUTED');

-- DropIndex
DROP INDEX "ProfitDistribution_refCode_key";

-- AlterTable
ALTER TABLE "ProfitDistribution" DROP COLUMN "declaredDate",
DROP COLUMN "declaredProfit",
DROP COLUMN "investmentPool",
DROP COLUMN "lockedAt",
DROP COLUMN "refCode",
ADD COLUMN     "distributionDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "note" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "ProfitDistributionStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "ProfitPayout" DROP COLUMN "investmentSnapshot",
DROP COLUMN "shareAmount",
ADD COLUMN     "activeInvestmentSnapshot" DECIMAL(18,4) NOT NULL,
ADD COLUMN     "ledgerEntryId" TEXT,
ADD COLUMN     "profitAmount" DECIMAL(18,4) NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "investmentBalance",
DROP COLUMN "profitBalance";

-- CreateIndex
CREATE UNIQUE INDEX "ProfitPayout_distributionId_userId_key" ON "ProfitPayout"("distributionId", "userId");
