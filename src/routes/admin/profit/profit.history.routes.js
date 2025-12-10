import express from "express";
import prisma from "../../../utils/prisma.js";
import { requireAuth, requireAdmin } from "../../../middleware/auth.js";

const router = express.Router();

// GET /api/v1/admin/profit/history
router.get("/profit/history", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const total = await prisma.profitDistribution.count();

    const records = await prisma.profitDistribution.findMany({
      skip,
      take: Number(pageSize),
      orderBy: { declaredDate: "desc" },
      include: {
        createdBy: {
          select: { email: true },
        },
      },
    });

    res.json({
      success: true,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      records,
    });
  } catch (err) {
    console.error("PROFIT HISTORY ERROR:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
