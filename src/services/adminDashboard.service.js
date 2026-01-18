// services/adminDashboard.service.js
import prisma from "../utils/prisma.js";

/**
 * ---------
 * KPI LAYER
 * ---------
 */
async function getKpis() {
  // Aggregate credits & debits per user
  const ledgerAgg = await prisma.ledger.groupBy({
    by: ["userId", "direction"],
    _sum: { amount: true }
  });

  const perUser = new Map();

  for (const row of ledgerAgg) {
    const prev = perUser.get(row.userId) || { credit: 0, debit: 0 };
    if (row.direction === "CREDIT") {
      prev.credit += Number(row._sum.amount || 0);
    } else {
      prev.debit += Number(row._sum.amount || 0);
    }
    perUser.set(row.userId, prev);
  }

  let totalActiveInvestment = 0;
  let activeInvestors = 0;

  for (const { credit, debit } of perUser.values()) {
    const net = credit - debit;
    if (net > 0) {
      activeInvestors += 1;
      totalActiveInvestment += net;
    }
  }

  // Approved withdrawals = ledger DEBIT / WITHDRAWAL
  const withdrawalsAgg = await prisma.ledger.aggregate({
    where: {
      direction: "DEBIT",
      referenceType: "WITHDRAWAL"
    },
    _sum: { amount: true }
  });

  // Total profits = ledger CREDIT / PROFIT
  const profitsAgg = await prisma.ledger.aggregate({
    where: {
      direction: "CREDIT",
      referenceType: "PROFIT"
    },
    _sum: { amount: true }
  });

  return {
    totalActiveInvestment: Number(totalActiveInvestment.toFixed(2)),
    activeInvestors,
    approvedWithdrawals: Number((withdrawalsAgg._sum.amount || 0).toFixed(2)),
    totalProfitsDistributed: Number((profitsAgg._sum.amount || 0).toFixed(2))
  };
}

/**
 * -------------------
 * TIME-SERIES LAYER
 * -------------------
 */
async function getSeries(days) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const start =
    days === "all"
      ? new Date(0)
      : (() => {
          const d = new Date(today);
          d.setUTCDate(d.getUTCDate() - days);
          return d;
        })();

  const ledger = await prisma.ledger.findMany({
    where: { createdAt: { gte: start, lt: today } },
    select: {
      userId: true,
      amount: true,
      direction: true,
      referenceType: true,
      createdAt: true
    },
    orderBy: { createdAt: "asc" }
  });

  // Group by day
  const byDay = {};
  for (const l of ledger) {
    const key = l.createdAt.toISOString().slice(0, 10);
    byDay[key] ??= [];
    byDay[key].push(l);
  }

  // Track balances per user
  const balances = new Map();

  const labels = [];
  const investment = [];
  const investors = [];
  const withdrawals = [];
  const profits = [];

  const cursor = new Date(start);
  while (cursor < today) {
    const key = cursor.toISOString().slice(0, 10);
    const rows = byDay[key] || [];

    let dailyWithdrawals = 0;
    let dailyProfits = 0;

    for (const r of rows) {
      const prev = balances.get(r.userId) || 0;
      const delta =
        r.direction === "CREDIT"
          ? Number(r.amount)
          : -Number(r.amount);

      balances.set(r.userId, prev + delta);

      if (r.direction === "DEBIT" && r.referenceType === "WITHDRAWAL") {
        dailyWithdrawals += Number(r.amount);
      }

      if (r.direction === "CREDIT" && r.referenceType === "PROFIT") {
        dailyProfits += Number(r.amount);
      }
    }

    let activeInvestment = 0;
    let activeCount = 0;

    for (const net of balances.values()) {
      if (net > 0) {
        activeInvestment += net;
        activeCount += 1;
      }
    }

    labels.push(key);
    investment.push(Number(activeInvestment.toFixed(2)));
    investors.push(activeCount);
    withdrawals.push(Number(dailyWithdrawals.toFixed(2)));
    profits.push(Number(dailyProfits.toFixed(2)));

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { labels, investment, investors, withdrawals, profits };
}

/**
 * -------------------
 * PUBLIC ENTRY POINT
 * -------------------
 */
export async function getAdminDashboardStats() {
  const kpis = await getKpis();

  return {
    kpis,
    series: {
      "7d": await getSeries(7),
      "30d": await getSeries(30),
      "90d": await getSeries(90),
      "all": await getSeries("all")
    }
  };
}
