import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";

const router = express.Router();

/**
 * CREATE profit distribution (PENDING)
 * POST /api/v1/admin/profit/distributions
 */
router.post(
  "/profit/distributions",
  requireAuth,
  requireAdmin,
  async (req, res) => {
  try {
    const { distributionPercent } = req.body;

    if (!distributionPercent || Number(distributionPercent) <= 0) {
      return res.status(400).json({ error: "Invalid distribution percent" });
    }
    
    const created = await prisma.profitDistribution.create({
      data: {
        distributionPercent: Number(distributionPercent),
        status: "PENDING",
        createdById: req.auth.userId,
      },
    });

    res.json({
      success: true,
      distribution: created,
    });
  } catch (err) {
    console.error("CREATE PROFIT DISTRIBUTION ERROR:", err);
    res.status(500).json({ error: "Failed to create distribution" });
  }
});

/**
 * LIST profit distributions
 * GET /api/v1/admin/profit/distributions
 */
router.get(
  "/profit/distributions",
  requireAuth,
  requireAdmin,
  async (req, res) => {
  try {
    const rows = await prisma.profitDistribution.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        payouts: true,
      },
    });

    const response = rows.map(d => ({
      id: d.id,
      distributionPercent: d.distributionPercent,
      status: d.status,
      recipientsCount: d.recipientsCount,
      totalDistributed: d.totalDistributed,
      createdAt: d.createdAt,
      verifiedAt: d.verifiedAt,
      distributedAt: d.distributedAt,
      otpRequested: d.status !== "PENDING",
      otpVerified: d.status === "VERIFIED" || d.status === "DISTRIBUTED",
    }));

    res.json(response);
  } catch (err) {
    console.error("LIST PROFIT DISTRIBUTIONS ERROR:", err);
    res.status(500).json({ error: "Failed to load distributions" });
  }
});

export default router;
