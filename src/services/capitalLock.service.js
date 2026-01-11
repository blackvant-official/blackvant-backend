import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Resolve current capital lock state.
 * This function is READ-ONLY and PURE in behavior.
 */
export async function resolveCapitalLockState() {
  const setting = await prisma.systemSetting.findFirst();

  // Safety: system should always have one row,
  // but never crash if something is wrong.
  if (!setting) {
    return {
      capitalLocked: false,
      capitalUnlockAt: null,
    };
  }

  const {
    capitalLockEnabled,
    capitalLockDays,
    capitalLockStartAt,
  } = setting;

  // Lock disabled by admin
  if (!capitalLockEnabled) {
    return {
      capitalLocked: false,
      capitalUnlockAt: null,
    };
  }

  // Lock enabled but not started yet (no approved deposits)
  if (!capitalLockStartAt || capitalLockDays <= 0) {
    return {
      capitalLocked: false,
      capitalUnlockAt: null,
    };
  }

  const unlockAt = new Date(
    capitalLockStartAt.getTime() + capitalLockDays * 24 * 60 * 60 * 1000
  );

  const now = new Date();

  return {
    capitalLocked: now < unlockAt,
    capitalUnlockAt: unlockAt,
  };
}
