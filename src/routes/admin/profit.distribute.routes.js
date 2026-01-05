import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const router = express.Router();

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

        // STEP 4 — Snapshot active investments (READ-ONLY)
        const distributionDate = distribution.distributionDate;
      
        const investmentRows = await prisma.ledger.groupBy({
          by: ["userId"],
          where: {
            referenceType: {
              in: ["DEPOSIT", "WITHDRAWAL"],
            },
            createdAt: {
              lte: distributionDate,
            },
          },
          _sum: {
            amount: true,
          },
          _min: {
            direction: true,
          },
        });
      
        // Build per-user active investment map
        const snapshots = [];
      
        for (const row of investmentRows) {
          const credits = await prisma.ledger.aggregate({
            where: {
              userId: row.userId,
              referenceType: "DEPOSIT",
              createdAt: { lte: distributionDate },
            },
            _sum: { amount: true },
          });
        
          const debits = await prisma.ledger.aggregate({
            where: {
              userId: row.userId,
              referenceType: "WITHDRAWAL",
              createdAt: { lte: distributionDate },
            },
            _sum: { amount: true },
          });
        
          const creditAmount = credits._sum.amount || 0;
          const debitAmount = debits._sum.amount || 0;
          const activeInvestment = creditAmount - debitAmount;
        
          if (activeInvestment > 0) {
            snapshots.push({
              userId: row.userId,
              activeInvestment,
            });
          }
        }
      
        return res.json({
          success: true,
          snapshotCount: snapshots.length,
          snapshots,
        });

  } catch (err) {
    console.error("PROFIT DISTRIBUTE GUARD ERROR:", err);
    return res.status(500).json({
      error: "Failed to validate profit distribution",
    });
  }
});

export default router;
