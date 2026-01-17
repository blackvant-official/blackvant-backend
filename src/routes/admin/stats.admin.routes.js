import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth, } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/stats", async (req, res) => {
  try {
    return res.json({
      "7d": {
        labels: [],
        investment: [],
        investors: [],
        withdrawals: [],
        profits: []
      },
      "30d": {
        labels: [],
        investment: [],
        investors: [],
        withdrawals: [],
        profits: []
      },
      "90d": {
        labels: [],
        investment: [],
        investors: [],
        withdrawals: [],
        profits: []
      },
      "all": {
        labels: [],
        investment: [],
        investors: [],
        withdrawals: [],
        profits: []
      }
    });
  } catch (err) {
    console.error("ADMIN STATS ERROR:", err);
    res.status(500).json({ error: "Admin stats failed" });
  }
});


// GET /api/v1/admin/settings
router.get("/settings", async (req, res) => {
  try {
    const [
      usersCount,
      depositsCount,
      withdrawalsCount,
      distributionsCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.deposit.count(),
      prisma.withdrawal.count(),
      prisma.profitDistribution.count()
    ]);

    res.json({
      environment: process.env.NODE_ENV || "production",
      database: "connected",
      clerk: "active",
      stats: {
        users: usersCount,
        deposits: depositsCount,
        withdrawals: withdrawalsCount,
        profitDistributions: distributionsCount
      },
      phase: "Phase A — Read Only",
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    console.error("SETTINGS ERROR:", err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

export default router;
