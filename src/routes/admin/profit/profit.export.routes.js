import express from "express";
import prisma from "../../../utils/prisma.js";
import { requireAuth, requireAdmin } from "../../../middleware/auth.js";

const router = express.Router();

// GET /api/v1/admin/profit/export
router.get("/profit/export", requireAuth, requireAdmin, async (req, res) => {
  try {
    const records = await prisma.profitDistribution.findMany({
      orderBy: { declaredDate: "desc" },
      include: {
        createdBy: { select: { email: true } },
        payouts: true,
      },
    });

    // CSV Header
    let csv = "Distribution ID,Declared Date,Declared Profit,Percent,Investment Pool,Total Distributed,Recipients,Created By\n";

    // Add each distribution to CSV
    for (const r of records) {
      csv += `${r.id},${r.declaredDate},${r.declaredProfit},${r.distributionPercent},${r.investmentPool},${r.totalDistributed},${r.recipientsCount},${r.createdBy?.email}\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=profit-history.csv");
    res.send(csv);

  } catch (err) {
    console.error("PROFIT EXPORT ERROR:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
