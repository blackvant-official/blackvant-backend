// services/dashboard.service.js
import prisma from "../utils/prisma.js";
import { resolveCapitalLockState } from "./capitalLock.service.js";
import { getSystemSettings } from "./systemSettings.service.js";

/**
 * Resolve internal userId from clerkId
 */
async function resolveUserId(clerkUserId) {
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { id: true }
  });

  if (!user) throw new Error("User not found");
  return user.id;
}

/**
 * Dashboard Summary (Ledger-only)
 */
export async function getDashboardSummary(clerkUserId) {
  const userId = await resolveUserId(clerkUserId);

  // --- TOTAL CREDITS ---
  const creditAgg = await prisma.ledger.aggregate({
    where: { userId, direction: "CREDIT" },
    _sum: { amount: true }
  });

  // --- TOTAL DEBITS ---
  const debitAgg = await prisma.ledger.aggregate({
    where: { userId, direction: "DEBIT" },
    _sum: { amount: true }
  });

  const totalCredits = Number(creditAgg?._sum?.amount || 0);
  const totalDebits = Number(debitAgg?._sum?.amount || 0);

  const totalBalance = totalCredits - totalDebits;

  // --- LOCKED / INVESTED (FUTURE TYPES SAFE) ---
  const lockedAgg = await prisma.ledger.aggregate({
    where: {
      userId,
      referenceType: { in: ["INVESTMENT_LOCK", "CAPITAL_LOCK"] }
    },
    _sum: { amount: true }
  });


  const lockedBalance = Number(lockedAgg?._sum?.amount || 0);
  const availableBalance = totalBalance - lockedBalance;

  // --- PROFIT ---
    const profitCreditAgg = await prisma.ledger.aggregate({
    where: {
      userId,
      direction: "CREDIT",
      bucket: "PROFIT"
    },
    _sum: { amount: true }
  });
  
  const profitDebitAgg = await prisma.ledger.aggregate({
    where: {
      userId,
      direction: "DEBIT",
      bucket: "PROFIT"
    },
    _sum: { amount: true }
  });
  
  const totalProfit =
    Number(profitCreditAgg?._sum?.amount || 0) -
    Number(profitDebitAgg?._sum?.amount || 0);


  // --- TODAY PROFIT (UTC) ---
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const todayProfitAgg = await prisma.ledger.aggregate({
    where: {
      userId,
      direction: "CREDIT",
      bucket: "PROFIT",
      createdAt: { gte: today }
    },
    _sum: { amount: true }
  });


  const systemSettings = await getSystemSettings();
  const todayProfit = Number(todayProfitAgg?._sum?.amount || 0);
  const lockState = await resolveCapitalLockState().catch(() => null);

  const capitalLocked = Boolean(lockState?.capitalLocked);
  const capitalUnlockAt = lockState?.capitalUnlockAt || null;
// ==============================
// CAPITAL = DEPOSITS - CAPITAL WITHDRAWALS ONLY
// ==============================

const capitalCreditAgg = await prisma.ledger.aggregate({
  where: {
    userId,
    direction: "CREDIT",
    bucket: "CAPITAL",
    referenceType: "DEPOSIT" // 🔒 IMPORTANT
  },
  _sum: { amount: true }
});

const capitalDebitAgg = await prisma.ledger.aggregate({
  where: {
    userId,
    direction: "DEBIT",
    bucket: "CAPITAL",
    referenceType: "WITHDRAWAL"
  },
  _sum: { amount: true }
});

const activeInvestment =
  Number(capitalCreditAgg._sum.amount || 0) -
  Number(capitalDebitAgg._sum.amount || 0);
// ==============================

  return {
    totalBalance,
    availableBalance,
    lockedBalance,
    activeInvestment,    
    totalProfit,
    todayProfit,
    capitalLocked,
    capitalUnlockAt,
    platformMaintenanceMode: !!systemSettings?.platformMaintenanceMode,
    withdrawFrequencyEnabled: systemSettings?.withdrawFrequencyEnabled !== false,
  };


}

/**
 * Equity Curve (Daily)
 */
export async function getDashboardChart(clerkUserId, days = 30) {
  const userId = await resolveUserId(clerkUserId);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - days);

  // 1️⃣ Opening balance before range
  const opening = await prisma.ledger.aggregate({
    where: {
      userId,
      createdAt: { lt: start }
    },
    _sum: { amount: true }
  });

  let runningBalance = Number(opening._sum.amount || 0);
  let cumulativeProfit = 0;

  // 2️⃣ Ledger entries inside range
  const entries = await prisma.ledger.findMany({
    where: {
      userId,
      createdAt: {
        gte: start,
        lt: today
      }
    },
    orderBy: { createdAt: "asc" },
    select: {
      amount: true,
      direction: true,
      referenceType: true,
      createdAt: true
    }
  });

  // 3️⃣ Group entries by day
  const byDay = {};
  for (const e of entries) {
    const day = e.createdAt.toISOString().slice(0, 10);
    byDay[day] ??= [];
    byDay[day].push(e);
  }

  // 4️⃣ Build daily metrics
  const result = [];

  for (let i = 0; i <= days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);

    let dailyProfit = 0;
    const daily = byDay[key] || [];

    for (const e of daily) {
      const delta =
        e.direction === "CREDIT"
          ? Number(e.amount)
          : -Number(e.amount);

      runningBalance += delta;

      if (e.referenceType === "PROFIT") {
        cumulativeProfit += Number(e.amount);
        dailyProfit += Number(e.amount);
      }
    }

    result.push({
      date: key,
      totalBalance: Number(runningBalance.toFixed(2)),
      activeInvestment: Number((runningBalance - cumulativeProfit).toFixed(2)),
      totalProfit: Number(cumulativeProfit.toFixed(2)),
      dailyProfit: Number(dailyProfit.toFixed(2))
    });
  }

  return result;
}
