import express from "express";
import prisma from "../../../utils/prisma.js";
import { requireAuth, requireAdmin } from "../../../middleware/auth.js";
import { Decimal } from "@prisma/client/runtime/library";

const router = express.Router();

// POST /api/v1/admin/profit/calculate
router.post("/profit/calculate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { declaredProfit, distributionPercent, distributionDate } = req.body;

    if (!declaredProfit || !distributionPercent || !distributionDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Convert percent to fraction (e.g. 0.70% → 0.007)
    const fraction = new Decimal(distributionPercent).div(100);

    // Load all users with positive investmentBalance
    const users = await prisma.user.findMany({
      where: { investmentBalance: { gt: 0 } },
      select: {
        id: true,
        email: true,
        investmentBalance: true,
      },
    });

    let investmentPool = new Decimal(0);
    let totalToDistribute = new Decimal(0);

    const preview = users.map((u) => {
      investmentPool = investmentPool.plus(u.investmentBalance);

      const share = new Decimal(u.investmentBalance).mul(fraction);

      totalToDistribute = totalToDistribute.plus(share);

      return {
        userId: u.id,
        email: u.email,
        investmentSnapshot: u.investmentBalance,
        shareAmount: share,
      };
    });

    res.json({
      success: true,
      investmentPool,
      totalToDistribute,
      recipientsCount: users.length,
      preview,
    });
  } catch (err) {
    console.error("PROFIT CALCULATE ERROR:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
