import express from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";

const router = express.Router();
const prisma = new PrismaClient();
router.use(requireAuth, requireAdmin);

/**
 * GET /api/v1/admin/transactions
 * Global immutable ledger (admin only)
 */
router.get("/transactions", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.ledger.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { email: true } }
        }
      }),
      prisma.ledger.count()
    ]);

    res.json({
      success: true,
      transactions: entries.map(e => ({
        id: e.id,
        date: e.createdAt,
        user: e.user?.email || "System",
        type: e.type,              // DEPOSIT / WITHDRAWAL / PROFIT
        amount: Number(e.amount),
        direction: e.amount < 0 ? "Out" : "In",
        status: "completed"        // ledger entries are final
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error("ADMIN TRANSACTIONS ERROR:", err);
    res.status(500).json({ error: "Failed to load transactions" });
  }
});


export default router;
