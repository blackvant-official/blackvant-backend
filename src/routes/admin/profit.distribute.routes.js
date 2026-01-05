import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const router = express.Router();

async function getActiveInvestmentSnapshot(prisma) {
  const ledgerEntries = await prisma.ledger.findMany({
    where: {
      referenceType: {
        in: ["DEPOSIT", "WITHDRAWAL"],
      },
    },
    select: {
      userId: true,
      amount: true,
      direction: true,
    },
  });

  const perUser = new Map();

  for (const entry of ledgerEntries) {
    const prev = perUser.get(entry.userId) || 0;
    const delta =
      entry.direction === "CREDIT"
        ? Number(entry.amount)
        : -Number(entry.amount);

    perUser.set(entry.userId, prev + delta);
  }

  const activeUsers = [];
  let totalInvestment = 0;

  for (const [userId, amount] of perUser.entries()) {
    if (amount > 0) {
      activeUsers.push({
        userId,
        investment: amount,
      });
      totalInvestment += amount;
    }
  }

  return {
    users: activeUsers,
    totalInvestment,
    recipientsCount: activeUsers.length,
  };
}

/**
 * POST /api/v1/admin/profit/distribute
 * Phase B-4 — Profit Distribution (Ledger CREDIT)
 * NOTE: Logic will be implemented step-by-step.
 */
router.post("/profit/distribute", requireAuth, async (req, res) => {
  try {
    const adminUserId = req.userContext?.userId;
    const { profitDistributionId } = req.body;

    if (!adminUserId) {
      return res.status(401).json({ error: "Unauthorized admin" });
    }

    if (!profitDistributionId) {
      return res.status(400).json({
        error: "profitDistributionId is required",
      });
    }

    const distribution = await prisma.profitDistribution.findUnique({
      where: { id: profitDistributionId },
    });

    if (!distribution) {
      return res.status(404).json({
        error: "Profit distribution not found",
      });
    }

    if (distribution.status !== "VERIFIED") {
      return res.status(400).json({
        error: "Profit distribution is not VERIFIED",
      });
    }

    if (distribution.status === "DISTRIBUTED") {
      return res.status(400).json({
        error: "Profit distribution already executed",
      });
    }

    const existingPayouts = await prisma.profitPayout.count({
      where: { distributionId: profitDistributionId },
    });

    if (existingPayouts > 0) {
      return res.status(400).json({
        error: "Profit payouts already exist for this distribution",
      });
    }
    
    // STEP 4 — Active Investment Snapshot (Ledger-based, read-only)
    const snapshot = await getActiveInvestmentSnapshot(prisma);

    if (snapshot.recipientsCount === 0) {
      return res.status(400).json({
        success: false,
        message: "No active investments found for distribution",
      });
    }

    return res.json({
      success: true,
      message: "Distribution guards passed. Snapshot computed.",
      snapshot: {
        totalInvestment: snapshot.totalInvestment,
        recipientsCount: snapshot.recipientsCount,
      },
    });


  } catch (err) {
    console.error("PROFIT DISTRIBUTE GUARD ERROR:", err);
    return res.status(500).json({
      error: "Failed to validate profit distribution",
    });
  }
});

export default router;
