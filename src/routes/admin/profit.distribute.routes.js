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

function calculateProfitDistribution(snapshot, distributionPercent) {
  const results = [];
  let totalDistributed = 0;

  for (const user of snapshot.users) {
    let percent = Number(distributionPercent);

    // 🔒 Normalize percent (human-friendly → fractional)
    if (percent >= 0.1) {
      percent = percent / 100;
    }
    
    // 🔒 Final safety check
    if (percent <= 0 || percent >= 0.1) {
      throw new Error(
        `Invalid distributionPercent ${distributionPercent}. Normalized value must be between 0 and 0.1`
      );
    }
    
    const rawProfit = user.investment * percent;

    const profit = Math.floor(rawProfit * 10000) / 10000;

    if (profit > 0) {
      results.push({
        userId: user.userId,
        investmentSnapshot: user.investment,
        profitAmount: profit,
      });
      totalDistributed += profit;
    }
  }

  return {
    payouts: results,
    totalDistributed,
    recipientsCount: results.length,
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

    const existingPayouts = await prisma.profitPayout.findMany({
      where: { distributionId: profitDistributionId },
    });

    // 🔒 PHASE GATE
    if (existingPayouts.length === 0) {
      // ===== Phase B-4 Step 6 (create payouts) =====

      const snapshot = await getActiveInvestmentSnapshot(prisma);
    
      if (snapshot.recipientsCount === 0) {
        return res.status(400).json({
          success: false,
          message: "No active investments found for distribution",
        });
      }
    
      const calculation = calculateProfitDistribution(
        snapshot,
        distribution.distributionPercent
      );
    
      for (const payout of calculation.payouts) {
        await prisma.profitPayout.create({
          data: {
            distributionId: distribution.id,
            userId: payout.userId,
            activeInvestmentSnapshot: payout.investmentSnapshot,
            profitAmount: payout.profitAmount,
          },
        });
      }
    
    } // else → payouts already exist, move to Step 7

    // STEP 7-A — Pre-settlement validation (NO LEDGER WRITES)

    // 1. Reload payouts to ensure consistency
    const payouts = await prisma.profitPayout.findMany({
      where: { distributionId: distribution.id },
    });

    // 2. Ensure payouts exist
    if (payouts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No profit payouts found for settlement",
      });
    }

    // 3. Ensure no payout already linked to a ledger entry
    const alreadySettled = payouts.some(p => p.ledgerEntryId !== null);

    if (alreadySettled) {
      return res.status(400).json({
        success: false,
        message: "One or more payouts already settled in ledger",
      });
    }

    // 4. Ensure distribution is still VERIFIED
    if (distribution.status !== "VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "Distribution must be VERIFIED before ledger settlement",
      });
    }

    // STEP 7-B — Atomic ledger settlement (FINAL)
    await prisma.$transaction(async (tx) => {
      for (const payout of payouts) {
        // 1. Create ledger CREDIT entry
        const ledgerEntry = await tx.ledger.create({
          data: {
            userId: payout.userId,
            amount: payout.profitAmount,
            direction: "CREDIT",
            referenceType: "PROFIT",
            referenceId: payout.id,
          },
        });
      
        // 2. Link ledger entry to payout
        await tx.profitPayout.update({
          where: { id: payout.id },
          data: { ledgerEntryId: ledgerEntry.id },
        });
      }
    
      // 3. Finalize distribution
      // Compute final totals from persisted payouts (ledger-safe)
      const totalDistributed = payouts.reduce(
        (sum, p) => sum + Number(p.profitAmount),
        0
      );
      
      await tx.profitDistribution.update({
        where: { id: distribution.id },
        data: {
          status: "DISTRIBUTED",
          totalDistributed,
          recipientsCount: payouts.length,
        },
      });


    return res.json({
      success: true,
      message: "Profit distribution settled successfully.",
      ledgerCreditsCreated: payouts.length,
    });






  } catch (err) {
    console.error("PROFIT DISTRIBUTE GUARD ERROR:", err);
    return res.status(500).json({
      error: "Failed to validate profit distribution",
    });
  }
});

export default router;
