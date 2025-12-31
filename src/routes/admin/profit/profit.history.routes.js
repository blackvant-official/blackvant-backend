import express from "express";
import prisma from "../../../utils/prisma.js";
import { requireAuth, } from "../../../middleware/auth.js";

const router = express.Router();


// GET /api/v1/admin/profits/history
router.get("/profits/history", requireAuth, requireAdmin, async (req, res) => {
  try {
    const distributions = await prisma.profitDistribution.findMany({
      orderBy: { declaredDate: "desc" },
      include: {
        payouts: {
          include: {
            user: { select: { email: true } }
          }
        },
        createdBy: { select: { email: true } }
      }
    });

    res.json({
      distributions: distributions.map(d => ({
        id: d.id,
        date: d.declaredDate,
        declaredProfit: Number(d.declaredProfit),
        distributionPercent: Number(d.distributionPercent),
        investmentPool: Number(d.investmentPool),
        totalDistributed: Number(d.totalDistributed),
        recipientsCount: d.recipientsCount,
        createdBy: d.createdBy?.email || "System",
        payouts: d.payouts.map(p => ({
          user: p.user.email,
          investmentSnapshot: Number(p.investmentSnapshot),
          shareAmount: Number(p.shareAmount)
        }))
      }))
    });
  } catch (err) {
    console.error("PROFIT HISTORY ERROR:", err);
    res.status(500).json({ error: "Failed to load profit history" });
  }
});

export default router;
