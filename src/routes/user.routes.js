import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import {
  getDashboardSummary,
  getDashboardChart
} from "../services/dashboard.service.js";
const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { clerkUserId, email } = req.userContext;

    if (!clerkUserId) {
      return res.status(400).json({ error: "Invalid user context" });
    }

    // 1️⃣ Always trust clerkId as primary key
    let user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    // 2️⃣ Create user ONLY if not exists
    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: clerkUserId,
          email: email ?? `user_${clerkUserId}@blackvant.local`,
          role: "client",
        },
      });
    }

    // 3️⃣ Return stable payload
    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      balances: {
        investment: Number(user.investmentBalance),
        profit: Number(user.profitBalance),
      },
    });

  } catch (err) {
    console.error("GET /me Prisma error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/v1/me/balance
// ---------------------------------------------
// Ledger-based balance (READ-ONLY)
// Source of truth: Ledger table only
router.get("/me/balance", requireAuth, async (req, res) => {
  try {
    const { clerkUserId } = req.userContext;

    if (!clerkUserId) {
      return res.status(400).json({ error: "Invalid user context" });
    }

    // Resolve internal user ID
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Sum CREDIT ledger entries
    const creditAgg = await prisma.ledger.aggregate({
      where: {
        userId: user.id,
        direction: "CREDIT",
      },
      _sum: { amount: true },
    });

    // Sum DEBIT ledger entries
    const debitAgg = await prisma.ledger.aggregate({
      where: {
        userId: user.id,
        direction: "DEBIT",
      },
      _sum: { amount: true },
    });

    const totalCredits = creditAgg._sum.amount || 0;
    const totalDebits = debitAgg._sum.amount || 0;

    return res.json({
      success: true,
      balance: {
        totalCredits,
        totalDebits,
        availableBalance: totalCredits - totalDebits,
      },
    });
  } catch (err) {
    console.error("LEDGER BALANCE ERROR:", err);
    return res.status(500).json({ error: "Failed to compute balance" });
  }
});

// DASHBOARD SUMMARY
router.get("/me/dashboard/summary", requireAuth, async (req, res) => {
  try {
    const data = await getDashboardSummary(req.userContext.clerkUserId);
    res.json(data);
  } catch (err) {
    console.error("DASHBOARD SUMMARY ERROR:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// DASHBOARD CHART
router.get("/me/dashboard/chart", requireAuth, async (req, res) => {
  try {
    const range = Number(req.query.range?.replace("d", "")) || 30;
    const data = await getDashboardChart(
      req.userContext.clerkUserId,
      range
    );
    res.json(data);
  } catch (err) {
    console.error("DASHBOARD CHART ERROR:", err);
    res.status(500).json({ error: "Failed to load chart" });
  }
});
export default router;
