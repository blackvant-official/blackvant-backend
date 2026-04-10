import prisma from "../utils/prisma.js";

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

export async function getMinWithdrawAmount() {
  const settings = await prisma.systemSetting.findFirst();
  const value = Number(settings?.minWithdrawAmount);
  return Number.isFinite(value) && value > 0 ? value : 10;
}

export async function getWithdrawFrequencyDays() {
  const settings = await prisma.systemSetting.findFirst();
  const value = Number(settings?.withdrawFrequencyDays);
  return Number.isFinite(value) && value > 0 ? value : 7;
}
export async function isWithdrawFrequencyEnabled() {
  const settings = await prisma.systemSetting.findFirst();
  return settings?.withdrawFrequencyEnabled !== false;
}
