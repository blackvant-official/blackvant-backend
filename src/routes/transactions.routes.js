import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/v1/me/transactions
 * Ledger = single source of truth
 */
router.get("/me/transactions", requireAuth, async (req, res) => {
  try {
    const { clerkUserId } = req.userContext;

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true }
    });

    if (!user) return res.json([]);

    /* ======================
       1. LEDGER (APPROVED)
       ====================== */
    const ledger = await prisma.ledger.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        amount: true,
        direction: true,
        referenceType: true,
        createdAt: true
      }
    });

    const ledgerItems = ledger.map(l => ({
      id: `ledger_${l.id}`,
      type:
        l.referenceType === "DEPOSIT" ? "deposit" :
        l.referenceType === "WITHDRAWAL" ? "withdrawal" :
        "profit",
      amount:
        l.direction === "CREDIT"
          ? Number(l.amount)
          : -Number(l.amount),
      status: "approved",
      createdAt: l.createdAt
    }));

    /* ======================
       2. DEPOSITS (PENDING)
       ====================== */
    const deposits = await prisma.deposit.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true
      }
    });

    const depositItems = deposits.map(d => ({
      id: `deposit_${d.id}`,
      type: "deposit",
      amount: Number(d.amount),
      status: d.status.toLowerCase(),
      createdAt: d.createdAt
    }));

    /* ======================
       3. WITHDRAWALS (PENDING)
       ====================== */
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true
      }
    });

    const withdrawalItems = withdrawals.map(w => ({
      id: `withdrawal_${w.id}`,
      type: "withdrawal",
      amount: -Number(w.amount),
      status: w.status.toLowerCase(),
      createdAt: w.createdAt
    }));

    /* ======================
       MERGE & SORT
       ====================== */
    const all = [
      ...ledgerItems,
      ...depositItems,
      ...withdrawalItems
    ].sort((a, b) => b.createdAt - a.createdAt);

    res.json(all);
  } catch (err) {
    console.error("UNIFIED TRANSACTIONS ERROR:", err);
    res.status(500).json([]);
  }
});


export default router;
