import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import {
  getSystemSettings,
  updateCapitalLockPolicy,
} from "../../services/systemSettings.service.js";
import prisma from "../../utils/prisma.js";

const router = express.Router();

/**
 * GET /admin/settings/system
 * Fetch global system settings.
 */
router.get("/system", requireAuth, requireAdmin, async (req, res) => {
  try {
    const settings = await getSystemSettings();
    res.json(settings);
  } catch (err) {
    console.error("GET system settings failed:", err);
    res.status(500).json({ error: "FAILED_TO_FETCH_SETTINGS" });
  }
});

/**
 * PATCH /admin/settings/system
 * Update capital lock policy.
 */
router.patch("/system", requireAuth, requireAdmin, async (req, res) => {
  const {
    capitalLockEnabled,
    capitalLockDays,
    minDepositAmount,
    minWithdrawAmount,
    withdrawFrequencyDays,
  } = req.body;

  if (
    typeof capitalLockEnabled !== "boolean" &&
    typeof minDepositAmount !== "number"
  ) {
    return res.status(400).json({ error: "INVALID_SETTINGS_PAYLOAD" });
  }
  
  if (
    typeof minDepositAmount === "number" &&
    minDepositAmount <= 0
  ) {
    return res.status(400).json({ error: "INVALID_MIN_DEPOSIT" });
  }


  if (capitalLockEnabled && (!capitalLockDays || capitalLockDays <= 0)) {
    return res.status(400).json({
      error: "INVALID_CAPITAL_LOCK_DAYS",
    });
  }

  if (
    typeof minWithdrawAmount === "number" &&
    minWithdrawAmount <= 0
  ) {
    return res.status(400).json({ error: "INVALID_MIN_WITHDRAW" });
  }
  if (
    typeof withdrawFrequencyDays === "number" &&
    withdrawFrequencyDays <= 0
  ) {
    return res.status(400).json({ error: "INVALID_WITHDRAW_FREQUENCY" });
  }

  try {
    if (typeof capitalLockEnabled === "boolean") {
      await updateCapitalLockPolicy({
        capitalLockEnabled,
        capitalLockDays,
        adminUserId: req.admin.id,
      });

      // ================================
      // WITHDRAW LIMITS (INDEPENDENT)
      // ================================
      if (typeof minWithdrawAmount === "number") {
        await prisma.systemSetting.updateMany({
          data: { minWithdrawAmount },
        });
      }
      
      if (typeof withdrawFrequencyDays === "number") {
        await prisma.systemSetting.updateMany({
          data: { withdrawFrequencyDays },
        });
      }

    }

    if (typeof minDepositAmount === "number") {
      await prisma.systemSetting.updateMany({
        data: { minDepositAmount },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("PATCH system settings failed:", err);
    res.status(500).json({ error: "FAILED_TO_UPDATE_SETTINGS" });
  }
});

export default router;
