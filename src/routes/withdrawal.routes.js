import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { Prisma } from "@prisma/client";
import { requireWritable } from "../middleware/readOnly.js";
import { resolveCapitalLockState } from "../services/capitalLock.service.js";
import {
  getMinWithdrawAmount,
  getWithdrawFrequencyDays,
} from "../services/systemSettings.service.js";

// ================================
// STATUS NORMALIZATION (WITHDRAWALS)
// ================================
const normalizeWithdrawalStatus = (status) => {
  if (!status) return undefined;
  return String(status).toUpperCase();
};

const router = express.Router();

// ================================
// WITHDRAW SYSTEM LIMITS
// ================================
const minWithdraw = await getMinWithdrawAmount();
const frequencyDays = await getWithdrawFrequencyDays();

const requestedAmount = new Prisma.Decimal(amount.toString());

if (requestedAmount.lt(new Prisma.Decimal(minWithdraw))) {
  return res.status(400).json({
    error: "MIN_WITHDRAW_NOT_MET",
    minWithdraw,
  });
}

// Frequency enforcement (creation-based, ledger untouched)
const lastWithdrawal = await prisma.withdrawal.findFirst({
  where: { userId: user.id },
  orderBy: { createdAt: "desc" },
});

if (lastWithdrawal) {
  const nextAllowedAt = new Date(lastWithdrawal.createdAt);
  nextAllowedAt.setDate(nextAllowedAt.getDate() + frequencyDays);

  if (new Date() < nextAllowedAt) {
    return res.status(429).json({
      error: "WITHDRAW_FREQUENCY_LIMIT",
      nextAllowedAt,
      frequencyDays,
    });
  }
}

// GET /api/v1/me/withdrawals
router.get("/me/withdrawals", requireAuth, async (req, res) => {
  try {
    const { clerkUserId } = req.userContext;
    const rawStatus = req.query.status;
    const normalizedStatus = normalizeWithdrawalStatus(rawStatus);


    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId }
    });

    if (!user) {
      return res.json([]);
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where: {
        userId: user.id,
        ...(normalizedStatus && { status: normalizedStatus }),
      },
      orderBy: { createdAt: "desc" }
    });


    return res.json(withdrawals);
  } catch (err) {
    console.error("Withdrawals error:", err);
    return res.status(500).json([]);
  }
});



// POST /api/v1/me/withdrawals
router.post(
  "/me/withdrawals",
  requireAuth,
  requireWritable,
  async (req, res) => {
  try {
    const { clerkUserId } = req.userContext;
    const { amount, currency, method, targetAddress, source } = req.body;

    if (!amount || !currency || !method || !targetAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId }
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // -------------------------------
// LEDGER-BASED WITHDRAWAL CHECK
// -------------------------------

// Sum CREDIT entries
const creditAgg = await prisma.ledger.aggregate({
  where: {
    userId: user.id,
    direction: "CREDIT",
  },
  _sum: { amount: true },
});

// Sum DEBIT entries
const debitAgg = await prisma.ledger.aggregate({
  where: {
    userId: user.id,
    direction: "DEBIT",
  },
  _sum: { amount: true },
});


const totalCredits = creditAgg._sum.amount || new Prisma.Decimal(0);
const totalDebits = debitAgg._sum.amount || new Prisma.Decimal(0);

const availableBalance = totalCredits.minus(totalDebits);
const requestedAmount = new Prisma.Decimal(amount.toString());

if (requestedAmount.gt(availableBalance)) {
  return res.status(403).json({
    error: "Insufficient available balance",
  });
}

// ==============================
// Capital Lock Enforcement
// ==============================
if (source === "capital") {
  const lockState = await resolveCapitalLockState(req.userContext.userId);

  if (lockState.capitalLocked) {
    return res.status(403).json({
      error: "CAPITAL_LOCKED",
      message:
        lockState.status === "PENDING"
          ? "Investment capital is locked and will activate on first approved deposit."
          : "Investment capital is locked.",
      capitalUnlockAt: lockState.capitalUnlockAt,
      status: lockState.status,
    });
  }
}

    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId: user.id,
        amount: new Prisma.Decimal(amount.toString()),
        currency,
        source,
        method,
        targetAddress,
        status: "PENDING",
      },
    });

    res.json({ success: true, withdrawal });
  } catch (err) {
    console.error("ERROR CREATE WITHDRAWAL:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
