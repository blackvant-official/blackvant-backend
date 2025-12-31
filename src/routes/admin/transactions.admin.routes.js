import express from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireAdmin } from "../../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/admin/transactions
 * Global immutable ledger (admin only)
 */
router.get("/transactions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const deposits = await prisma.deposit.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" }
    });

    const withdrawals = await prisma.withdrawal.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" }
    });

    const ledger = [];

    deposits.forEach(d => {
      ledger.push({
        id: d.id,
        type: "deposit",
        amount: Number(d.amount),
        status: d.status,
        method: d.method,
        createdAt: d.createdAt,
        user: { email: d.user.email }
      });
    });

    withdrawals.forEach(w => {
      ledger.push({
        id: w.id,
        type: "withdrawal",
        amount: -Math.abs(Number(w.amount)),
        status: w.status,
        method: w.method,
        createdAt: w.createdAt,
        user: { email: w.user.email }
      });
    });

    ledger.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ transactions: ledger });

  } catch (err) {
    console.error("ADMIN TRANSACTIONS ERROR:", err);
    res.status(500).json({ error: "Failed to load transactions" });
  }
});

export default router;
