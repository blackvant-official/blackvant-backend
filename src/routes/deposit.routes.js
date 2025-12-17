import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/v1/me/deposits
router.get("/me/deposits", requireAuth, async (req, res) => {
  try {
    const { clerkUserId } = req.userContext;

    const deposits = await prisma.deposit.findMany({
      where: { clerkId: clerkUserId },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ items: deposits || [] });
  } catch (err) {
    console.error("Deposits error:", err);
    return res.status(500).json({ items: [] });
  }
});


// POST /api/v1/me/deposits
import { uploadProof } from "../middleware/upload.js";

router.post(
  "/me/deposits",
  requireAuth,
  uploadProof.single("proof"),
  async (req, res) => {
    try {
      const { amount, currency, method, txId } = req.body;
      const { clerkUserId } = req.userContext;

      if (!amount || !currency || !method || !req.file) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const deposit = await prisma.deposit.create({
        data: {
          userId: user.id,
          amount,
          currency,
          method,
          txId: txId || null,
          proofUrl: `/uploads/proofs/${req.file.filename}`,
          status: "pending",
        },
      });

      res.json({ success: true, deposit });
    } catch (err) {
      console.error("ERROR CREATE DEPOSIT:", err);
      res.status(500).json({ error: "Something went wrong" });
    }
  }
);


router.post("/deposit", requireAuth, async (req, res) => {
  try {
    const { clerkUserId } = req.userContext;
    const { amount, currency, method, txId, proofUrl } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const deposit = await prisma.deposit.create({
      data: {
        userId: user.id,
        amount,
        currency: currency || "USD",
        method: method || "manual",
        txId: txId || null,
        proofUrl: proofUrl || null,
        status: "pending",
      },
    });

    return res.json({ success: true, depositId: deposit.id });
  } catch (err) {
    console.error("Deposit submit error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
