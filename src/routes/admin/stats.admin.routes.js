import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth, } from "../../middleware/auth.js";

const router = express.Router();

// GET /api/v1/admin/stats
router.get("/stats", requireAuth,  async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();

    const approvedDeposits = await prisma.deposit.aggregate({
      _sum: { amount: true },
      where: { status: "approved" },
    });

    const approvedWithdrawals = await prisma.withdrawal.aggregate({
      _sum: { amount: true },
      where: { status: "approved" },
    });

    const pendingDeposits = await prisma.deposit.count({
      where: { status: "pending" },
    });

    const pendingWithdrawals = await prisma.withdrawal.count({
      where: { status: "pending" },
    });

    const investmentPool = await prisma.user.aggregate({
      _sum: { investmentBalance: true },
    });

    // future: pull today's profit (if profit distribution implemented)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const totalDistributedToday = await prisma.profitDistribution.aggregate({
      _sum: {
        totalDistributed: true
      },
      where: {
        declaredDate: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });

    // GET /api/v1/admin/audit-logs
router.get("/audit-logs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        actor: {
          select: { email: true }
        }
      }
    });

    res.json({
      logs: logs.map(l => ({
        id: l.id,
        date: l.createdAt,
        actor: l.actor?.email || "System",
        action: l.action,
        entity: l.entityType,
        entityId: l.entityId,
        ip: l.ip || "-",
        details: l.meta || {}
      }))
    });
  } catch (err) {
    console.error("AUDIT LOGS ERROR:", err);
    res.status(500).json({ error: "Failed to load audit logs" });
  }
});


    res.json({
      success: true,
      totalUsers,
      totalDepositsApproved:
        approvedDeposits._sum.amount || 0,
      totalWithdrawalsApproved:
        approvedWithdrawals._sum.amount || 0,
      pendingDeposits,
      pendingWithdrawals,
      totalInvestmentPool:
        investmentPool._sum.investmentBalance || 0,
      todayDistributed:
        totalDistributedToday._sum.totalDistributed || 0,

    });
  } catch (err) {
    console.error("ADMIN STATS ERROR:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /api/v1/admin/settings
router.get("/settings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [
      usersCount,
      depositsCount,
      withdrawalsCount,
      distributionsCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.deposit.count(),
      prisma.withdrawal.count(),
      prisma.profitDistribution.count()
    ]);

    res.json({
      environment: process.env.NODE_ENV || "production",
      database: "connected",
      clerk: "active",
      stats: {
        users: usersCount,
        deposits: depositsCount,
        withdrawals: withdrawalsCount,
        profitDistributions: distributionsCount
      },
      phase: "Phase A — Read Only",
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    console.error("SETTINGS ERROR:", err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

export default router;
