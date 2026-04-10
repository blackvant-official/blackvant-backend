import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { Prisma } from "@prisma/client";
import { requireWritable } from "../middleware/readOnly.js";
import {
  getMinDepositAmount,
  getSystemSettings,
} from "../services/systemSettings.service.js";

// ================================
// STATUS NORMALIZATION (DEPOSITS)
// ================================
const normalizeDepositStatus = (status) => {
  if (!status) return undefined;
  return String(status).toUpperCase();
};

const router = express.Router();

// GET /api/v1/me/deposits
router.get("/me/deposits", requireAuth, async (req, res) => {
  try {
    const { clerkUserId } = req.userContext;
    const rawStatus = req.query.status;
    const normalizedStatus = normalizeDepositStatus(rawStatus);


    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return res.status(404).json({ items: [] });
    }

    const deposits = await prisma.deposit.findMany({
      where: {
        userId: user.id,
        ...(normalizedStatus && { status: normalizedStatus }),
      },
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

    const systemSettings = await getSystemSettings();

    if (systemSettings?.platformMaintenanceMode === true) {
      return res.status(503).json({
        error: "PLATFORM_MAINTENANCE",
        message: "Deposits are disabled during maintenance mode.",
      });
    }

    if (systemSettings?.depositsEnabled === false) {
      return res.status(403).json({
        error: "DEPOSITS_DISABLED",
        message: "Deposits are currently disabled.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const minDepositAmount = await getMinDepositAmount();

    if (Number(amount) < minDepositAmount) {
      return res.status(400).json({
        error: "MIN_DEPOSIT_NOT_MET",
        minAmount: minDepositAmount,
      });
    }

    const deposit = await prisma.deposit.create({
      data: {
        userId: user.id,
        amount: new Prisma.Decimal(amount.toString()),
        currency: currency || "USD",
        method,
        txId: txId || null,
        proofKey,              // ✅ S3 key stored
        status: "PENDING",
      },
    });

    res.json({ success: true, deposit });
  } catch (err) {
    console.error("ERROR CREATE DEPOSIT:", err);
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
