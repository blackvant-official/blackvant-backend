import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Get the single system settings row.
 */
export async function getSystemSettings() {
  const settings = await prisma.systemSetting.findFirst();
  return settings;
}

/**
 * Update capital lock policy.
 * This does NOT start the lock.
 * Lock start is triggered by deposit approval logic later.
 */
export async function updateCapitalLockPolicy({
  capitalLockEnabled,
  capitalLockDays,
  adminUserId,
}) {
  return prisma.systemSetting.updateMany({
    data: {
      capitalLockEnabled,
      capitalLockDays,
      updatedByAdminId: adminUserId,
    },
  });
}

export async function getMinDepositAmount() {
  const settings = await prisma.systemSetting.findFirst();
  const value = Number(settings?.minDepositAmount);
  return Number.isFinite(value) && value > 0 ? value : 100;
}
