import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/v1/me/deposits
router.get("/me/deposits", requireAuth, async (req, res) => {
  try {
    const deposits = await prisma.deposit.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, deposits });
  } catch (err) {
    console.error("ERROR GET DEPOSITS:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/v1/me/deposits
router.post("/me/deposits", requireAuth, async (req, res) => {
  try {
    const { amount, currency, method, proofUrl, txId } = req.body;

    if (!amount || !currency || !method) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const deposit = await prisma.deposit.create({
      data: {
        userId: req.user.id,
        amount,
        currency,
        method,
        proofUrl,
        txId,
        status: "pending",
      },
    });

    res.json({ success: true, deposit });
  } catch (err) {
    console.error("ERROR CREATE DEPOSIT:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
