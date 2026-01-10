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

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const entries = await prisma.ledger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        direction: true,
        referenceType: true,
        createdAt: true
      }
    });

    res.json(entries);
  } catch (err) {
    console.error("LEDGER TRANSACTIONS ERROR:", err);
    res.status(500).json({ error: "Failed to load transactions" });
  }
});

export default router;
