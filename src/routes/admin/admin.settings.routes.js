import express from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  getSystemSettings,
  updateCapitalLockPolicy,
} from "../services/systemSettings.service.js";

const router = express.Router();

/**
 * GET /admin/settings/system
 * Fetch global system settings.
 */
router.get("/system", requireAdmin, async (req, res) => {
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
router.patch("/system", requireAdmin, async (req, res) => {
  const { capitalLockEnabled, capitalLockDays } = req.body;

  if (typeof capitalLockEnabled !== "boolean") {
    return res.status(400).json({ error: "INVALID_CAPITAL_LOCK_FLAG" });
  }

  if (capitalLockEnabled && (!capitalLockDays || capitalLockDays <= 0)) {
    return res.status(400).json({
      error: "INVALID_CAPITAL_LOCK_DAYS",
    });
  }

  try {
    await updateCapitalLockPolicy({
      capitalLockEnabled,
      capitalLockDays,
      adminUserId: req.user.id,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("PATCH system settings failed:", err);
    res.status(500).json({ error: "FAILED_TO_UPDATE_SETTINGS" });
  }
});

export default router;
