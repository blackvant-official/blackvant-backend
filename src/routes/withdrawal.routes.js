import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/v1/me/withdrawals
router.get("/me/withdrawals", requireAuth, async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, withdrawals });
  } catch (err) {
    console.error("ERROR GET WITHDRAWALS:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/v1/me/withdrawals
router.post("/me/withdrawals", requireAuth, async (req, res) => {
  try {
    const { amount, currency, method, targetAddress } = req.body;

    if (!amount || !currency || !method || !targetAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Ensure user has enough profit balance
    if (Number(req.user.profitBalance) < Number(amount)) {
      return res.status(400).json({ error: "Insufficient profit balance" });
    }

    // Deduct profit immediately
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        profitBalance: {
          decrement: amount,
        },
      },
    });

    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId: req.user.id,
        amount,
        currency,
        method,
        targetAddress,
        status: "pending",
      },
    });

    res.json({ success: true, withdrawal });
  } catch (err) {
    console.error("ERROR CREATE WITHDRAWAL:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
