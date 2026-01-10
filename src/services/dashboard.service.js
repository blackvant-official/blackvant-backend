// services/dashboard.service.js
import prisma from "../utils/prisma.js";

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

  const totalCredits = creditAgg._sum.amount || 0;
  const totalDebits = debitAgg._sum.amount || 0;

  const totalBalance = totalCredits - totalDebits;

  // --- LOCKED / INVESTED (FUTURE TYPES SAFE) ---
  const lockedAgg = await prisma.ledger.aggregate({
    where: {
      userId,
      referenceType: { in: ["INVESTMENT_LOCK", "CAPITAL_LOCK"] }
    },
    _sum: { amount: true }
  });


  const lockedBalance = lockedAgg._sum.amount || 0;
  const availableBalance = totalBalance - lockedBalance;

  // --- PROFIT ---
  const profitAgg = await prisma.ledger.aggregate({
    where: {
      userId,
      direction: "CREDIT",
      referenceType: "PROFIT"
    },
    _sum: { amount: true }
  });


  const totalProfit = profitAgg._sum.amount || 0;

  // --- TODAY PROFIT (UTC) ---
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const todayProfitAgg = await prisma.ledger.aggregate({
    where: {
      userId,
      direction: "CREDIT",
      referenceType: "PROFIT",
      createdAt: { gte: today }
    },
    _sum: { amount: true }
  });


  const todayProfit = todayProfitAgg._sum.amount || 0;

  return {
    totalBalance,
    availableBalance,
    lockedBalance,
    activeInvestment: totalBalance - totalProfit,
    totalProfit,
    todayProfit
  };

}

/**
 * Equity Curve (Daily)
 */
export async function getDashboardChart(clerkUserId, days = 30) {
  const userId = await resolveUserId(clerkUserId);

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.ledger.findMany({
    where: {
      userId,
      createdAt: { gte: start }
    },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      amount: true,
      direction: true
    }
  });

  // Daily equity snapshot
  const dailyMap = new Map();
  let runningBalance = 0;

  for (const row of rows) {
    runningBalance +=
      row.direction === "CREDIT" ? row.amount : -row.amount;

    const day = row.createdAt.toISOString().slice(0, 10);
    dailyMap.set(day, runningBalance);
  }

  return Array.from(dailyMap.entries()).map(([date, balance]) => ({
    date,
    balance
  }));
}
