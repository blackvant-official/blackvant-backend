import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { Prisma } from "@prisma/client";
import { requireWritable } from "../middleware/readOnly.js";

const router = express.Router();

// GET /api/v1/me/deposits
router.get("/me/deposits", requireAuth, async (req, res) => {
  try {
    const { clerkUserId } = req.userContext;

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return res.status(404).json({ items: [] });
    }

    const deposits = await prisma.deposit.findMany({
      where: { userId: user.id }, // ✅ FIX
      orderBy: { createdAt: "desc" },
    });

    return res.json(deposits);
  } catch (err) {
    console.error("Deposits error:", err);
    return res.status(500).json({ items: [] });
  }
});



// POST /api/v1/me/deposits
// POST /api/v1/me/deposits
router.post(
  "/me/deposits",
  requireAuth,
  requireWritable,
  async (req, res) => {
  try {
    const { amount, currency, method, txId, proofKey } = req.body;
    const { clerkUserId } = req.userContext;

    if (!amount || Number(amount) <= 0 || !method || !proofKey) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    console.log("DEPOSIT BODY:", req.body);
    const deposit = await prisma.deposit.create({
      data: {
        userId: user.id,
        amount: new Prisma.Decimal(amount.toString()),
        currency: currency || "USD",
        method,
        txId: txId || null,
        proofKey,              // ✅ S3 key stored
        status: "pending",
      },
    });

    res.json({ success: true, deposit });
  } catch (err) {
    console.error("ERROR CREATE DEPOSIT:", err);
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
