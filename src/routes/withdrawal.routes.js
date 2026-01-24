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
import {
  generateOtp,
  hashOtp,
  getOtpExpiry,
} from "../services/otp.service.js";

import { sendEmail } from "../services/email.service.js";
import bcrypt from "bcrypt";


// ================================
// STATUS NORMALIZATION (WITHDRAWALS)
// ================================
const normalizeWithdrawalStatus = (status) => {
  if (!status) return undefined;
  return String(status).toUpperCase();
};

const router = express.Router();

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

// ======================================
// POST /api/v1/me/withdrawals/otp/request
// ======================================
router.post(
  "/me/withdrawals/otp/request",
  requireAuth,
  requireWritable,
  async (req, res) => {
    try {
      const { clerkUserId } = req.userContext;

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Invalidate previous unused OTPs (soft)
      await prisma.withdrawalOtp.updateMany({
        where: {
          userId: user.id,
          used: false,
          verifiedAt: null,
        },
        data: {
          used: true,
        },
      });

      // Generate + hash OTP
      const otp = generateOtp();
      const otpHash = await hashOtp(otp);

      await prisma.withdrawalOtp.create({
        data: {
          userId: user.id,
          otpHash,
          expiresAt: getOtpExpiry(),
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] || null,
        },
      });

      // Send OTP email
      await sendEmail({
        to: user.email,
        subject: "BlackVant Withdrawal Verification Code",
        text:
          `Your withdrawal verification code is:\n\n` +
          `${otp}\n\n` +
          `This code expires in 10 minutes.\n\n` +
          `If you did not request this, ignore this email.`,
      });

      return res.json({ success: true });
    } catch (err) {
      console.error("REQUEST OTP ERROR:", err);
      return res.status(500).json({ error: "Failed to send OTP" });
    }
  }
);

// ======================================
// POST /api/v1/me/withdrawals/otp/verify
// ======================================
router.post(
  "/me/withdrawals/otp/verify",
  requireAuth,
  requireWritable,
  async (req, res) => {
    try {
      const { clerkUserId } = req.userContext;
      const { otp } = req.body;

      if (!otp) {
        return res.status(400).json({ error: "OTP_REQUIRED" });
      }

      const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const record = await prisma.withdrawalOtp.findFirst({
        where: {
          userId: user.id,
          used: false,
          verifiedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!record) {
        return res.status(400).json({ error: "OTP_EXPIRED_OR_INVALID" });
      }

      const isValid = await bcrypt.compare(otp, record.otpHash);

      if (!isValid) {
        return res.status(400).json({ error: "INVALID_OTP" });
      }

      await prisma.withdrawalOtp.update({
        where: { id: record.id },
        data: {
          used: true,
          verifiedAt: new Date(),
        },
      });

      return res.json({ success: true });
    } catch (err) {
      console.error("VERIFY OTP ERROR:", err);
      return res.status(500).json({ error: "OTP verification failed" });
    }
  }
);



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

    // ==============================
    // OTP VERIFICATION (MANDATORY)
    // ==============================
    const otpRecord = await prisma.withdrawalOtp.findFirst({
      where: {
        userId: user.id,
        used: true,
        verifiedAt: { not: null },
        expiresAt: { gt: new Date() },
      },
      orderBy: { verifiedAt: "desc" },
    });
    
    if (!otpRecord) {
      return res.status(403).json({
        error: "OTP_REQUIRED",
        message: "Withdrawal requires OTP verification",
      });
    }
    
    // Consume OTP immediately (single-use guarantee)
    await prisma.withdrawalOtp.update({
      where: { id: otpRecord.id },
      data: {
        expiresAt: new Date(), // hard invalidate after use
      },
    });

    // ================================
    // WITHDRAW SYSTEM LIMITS (AUTHORITATIVE)
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

    // ================================
    // WITHDRAW FREQUENCY (CALENDAR-BASED)
    // ================================
    const now = new Date();
    let periodStart;
    let periodLabel;
      
    // Daily limit
    if (frequencyDays === 1) {
      periodStart = new Date(now);
      periodStart.setHours(0, 0, 0, 0);
      periodLabel = "day";
    }
    // Weekly limit (7 days)
    else if (frequencyDays === 7) {
      periodStart = new Date(now);
      const day = periodStart.getDay(); // 0 = Sunday
      periodStart.setDate(periodStart.getDate() - day);
      periodStart.setHours(0, 0, 0, 0);
      periodLabel = "week";
    }
    // Fallback (rare)
    else {
      periodStart = new Date(now);
      periodStart.setDate(periodStart.getDate() - frequencyDays);
      periodLabel = `${frequencyDays} days`;
    }
    
    const withdrawalInPeriod = await prisma.withdrawal.findFirst({
      where: {
        userId: user.id,
        status: { in: ["PENDING", "APPROVED"] },
        createdAt: { gte: periodStart }
      }
    });
    
    if (withdrawalInPeriod) {
      return res.status(429).json({
        error: "WITHDRAW_FREQUENCY_LIMIT",
        details: {
          frequencyDays,
          periodLabel,
          nextAllowedAt:
            frequencyDays === 1
              ? new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)
              : frequencyDays === 7
                ? new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)
                : null
        }
      });
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
