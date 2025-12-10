import { logAudit } from "../../../services/audit.service.js";

import express from "express";
import prisma from "../../../utils/prisma.js";
import { requireAuth, requireAdmin } from "../../../middleware/auth.js";
import { Decimal } from "@prisma/client/runtime/library";

const router = express.Router();

// POST /api/v1/admin/profit/distribute
router.post("/profit/distribute", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { declaredProfit, distributionPercent, distributionDate } = req.body;

    if (!declaredProfit || !distributionPercent || !distributionDate) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const fraction = new Decimal(distributionPercent).div(100);

    // load all active investors
    const users = await prisma.user.findMany({
      where: { investmentBalance: { gt: 0 } },
      select: {
        id: true,
        investmentBalance: true,
      },
    });

    let investmentPool = new Decimal(0);
    let totalDistributed = new Decimal(0);

    const payouts = users.map((u) => {
      investmentPool = investmentPool.plus(u.investmentBalance);
      const share = new Decimal(u.investmentBalance).mul(fraction);
      totalDistributed = totalDistributed.plus(share);

      return {
        userId: u.id,
        investmentSnapshot: u.investmentBalance,
        shareAmount: share,
      };
    });

    // Start TRANSACTION
    const distribution = await prisma.$transaction(async (tx) => {
      // Create main distribution record
      const dist = await tx.profitDistribution.create({
        data: {
          declaredProfit,
          distributionPercent,
          declaredDate: new Date(distributionDate),
          investmentPool,
          totalDistributed,
          recipientsCount: payouts.length,
          createdById: req.user.id,
          status: "distributed",
        },
      });

      await logAudit({
  actorId: req.user.id,
  action: "PROFIT_DISTRIBUTED",
  entityType: "profitDistribution",
  entityId: distribution.id,
  meta: {
    recipients: payouts.length,
    totalDistributed
  }
});

      // create payout records + update user balances
      for (const p of payouts) {
        await tx.profitPayout.create({
          data: {
            distributionId: dist.id,
            userId: p.userId,
            investmentSnapshot: p.investmentSnapshot,
            shareAmount: p.shareAmount,
          },
        });

        await tx.user.update({
          where: { id: p.userId },
          data: {
            profitBalance: {
              increment: p.shareAmount,
            },
          },
        });
      }

      return dist;
    });

    res.json({
      success: true,
      message: "Profit distributed successfully",
      distributionId: distribution.id,
      recipients: payouts.length,
      totalDistributed,
    });
  } catch (err) {
    console.error("PROFIT DISTRIBUTE ERROR:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
