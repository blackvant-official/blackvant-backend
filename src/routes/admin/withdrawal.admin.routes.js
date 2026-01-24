import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth, } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { requireWritable } from "../../middleware/readOnly.js";
import { Prisma } from "@prisma/client";
import { getSystemSettings } from "../../services/systemSettings.service.js";

// ================================
// STATUS NORMALIZATION (ADMIN WITHDRAWALS)
// ================================
const normalizeAdminWithdrawalStatus = (status) => {
  if (!status) return undefined;
  return String(status).toUpperCase();
};

const router = express.Router();
router.use(requireAuth, requireAdmin);

// GET /api/v1/admin/withdrawals
// ---------------------------------------------
// READ-ONLY — Returns ALL withdrawals (any status)
// Used by Admin Withdrawals page with filters
router.get("/withdrawals", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const rawStatus = req.query.status;
    const normalizedStatus = normalizeAdminWithdrawalStatus(rawStatus);

    const where = {
      ...(normalizedStatus && { status: normalizedStatus }),
    };

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        select: {
          id: true,
          userId: true,
          amount: true,
          currency: true,
          source: true,
          method: true,
          targetAddress: true,
          status: true,
          statusReason: true,
          reviewedById: true,
          approvedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),

      prisma.withdrawal.count({ where }),
    ]);

    return res.json({
      success: true,
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("ADMIN ALL WITHDRAWALS ERROR:", err);
    return res.status(500).json({ error: "Failed to fetch withdrawals" });
  }
});


// GET /api/v1/admin/withdrawals/pending
router.get("/withdrawals/pending", async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { status: "PENDING" },
      include: {
        user: {
          select: { email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, withdrawals });
  } catch (err) {
    console.error("ADMIN PENDING WITHDRAWALS ERROR:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/v1/admin/withdrawals/:id/approve
// POST /api/v1/admin/withdrawals/:id/approve
router.post(
  "/withdrawals/:id/approve",
  requireWritable,
  async (req, res) => {
    const withdrawalId = req.params.id;
    
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 🔒 PLATFORM MAINTENANCE CHECK
        const systemSettings = await getSystemSettings();
              
        if (systemSettings.platformMaintenanceMode === true) {
          throw new Error("PLATFORM_MAINTENANCE");
        }

        // 1) Fetch withdrawal
        const withdrawal = await tx.withdrawal.findUnique({
          where: { id: withdrawalId },
        });

        // Resolve admin internal user ID (Clerk → User)
        const adminUser = await tx.user.findUnique({
          where: { clerkId: req.auth.userId },
          select: { id: true }
        });

        if (!adminUser) {
          throw new Error("ADMIN_USER_NOT_FOUND");
        }


        if (!withdrawal) {
          throw new Error("WITHDRAWAL_NOT_FOUND");
        }

        // 2) Must be pending (normalize to uppercase)
        if (withdrawal.status !== "PENDING" && withdrawal.status !== "pending") {
          throw new Error("WITHDRAWAL_ALREADY_PROCESSED");
        }

        // 3) Idempotency guard: no existing ledger DEBIT for this withdrawal
        const existingLedger = await tx.ledger.findFirst({
          where: {
            referenceType: "WITHDRAWAL",
            referenceId: withdrawal.id,
            direction: "DEBIT",
          },
        });


        if (existingLedger) {
          throw new Error("LEDGER_ALREADY_EXISTS");
        }

        // 4) Compute ledger balance correctly (CREDIT - DEBIT)
        const creditAgg = await tx.ledger.aggregate({
          where: {
            userId: withdrawal.userId,
            direction: "credit",
            bucket: withdrawal.source === "profit" ? "PROFIT" : "CAPITAL",
          },
          _sum: { amount: true },
        });

        const debitAgg = await tx.ledger.aggregate({
          where: {
            userId: withdrawal.userId,
            direction: "debit",
            bucket: withdrawal.source === "profit" ? "PROFIT" : "CAPITAL",
          },
          _sum: { amount: true },
        });

        const totalCredits = creditAgg._sum.amount || new Prisma.Decimal(0);
        const totalDebits = debitAgg._sum.amount || new Prisma.Decimal(0);
        const availableBalance = totalCredits.minus(totalDebits);

        const withdrawalAmount = new Prisma.Decimal(withdrawal.amount);

      if (availableBalance.lt(withdrawalAmount)) {
        throw new Error("INSUFFICIENT_BALANCE");
      }


        // =======================================
        // SOURCE-AWARE WITHDRAWAL LEDGER DEBIT
        // =======================================

        if (withdrawal.source === "profit") {
          // Debit PROFIT balance
          await tx.ledger.create({
            data: {
              userId: withdrawal.userId,
              amount: withdrawal.amount,
              direction: "DEBIT",
              bucket: withdrawal.source === "profit" ? "PROFIT" : "CAPITAL",
              referenceType: "WITHDRAWAL",
              referenceId: withdrawal.id,
            },
          });
        }

        // 6) Update withdrawal status
        console.log("ADMIN INTERNAL ID:", adminUser.id);
        console.log("ADMIN CLERK ID:", req.auth.userId);

        await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            reviewedById: adminUser.id,
          },
        });

        // 7) Audit log
        await tx.auditLog.create({
          data: {
            action: "WITHDRAWAL_APPROVED",
            actorId: adminUser.id,
            entityType: "WITHDRAWAL",
            entityId: withdrawal.id,
            meta: { amount: withdrawal.amount },
          },
        });

        return { success: true };
      });

      return res.json(result);
    } catch (err) {
      if (err.message === "WITHDRAWAL_ALREADY_PROCESSED" || err.message === "LEDGER_ALREADY_EXISTS") {
        return res.status(409).json({ error: err.message });
      }
      if (err.message === "INSUFFICIENT_BALANCE") {
        return res.status(409).json({ error: "INSUFFICIENT_BALANCE" });
      }
      if (err.message === "WITHDRAWAL_NOT_FOUND") {
        return res.status(404).json({ error: "Withdrawal not found" });
      }
      if (err.message === "PLATFORM_MAINTENANCE") {
        return res.status(503).json({
          error: "PLATFORM_MAINTENANCE",
          message: "Withdrawals are disabled during maintenance mode."
        });
      }
      console.error("WITHDRAWAL APPROVAL ERROR:", err);
      return res.status(500).json({ error: "Withdrawal approval failed" });
    }
  }
);


// POST /api/v1/admin/withdrawals/:id/reject
router.post(
  "/withdrawals/:id/reject",
  requireWritable,
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    

    try {
      await prisma.$transaction(async (tx) => {
        // 🔒 PLATFORM MAINTENANCE CHECK
      const systemSettings = await getSystemSettings();

      if (systemSettings.platformMaintenanceMode === true) {
        throw new Error("PLATFORM_MAINTENANCE");
      }

        // 1️⃣ Fetch withdrawal
        const withdrawal = await tx.withdrawal.findUnique({
          where: { id },
        });

        // Resolve admin internal user ID (Clerk → User)
        const adminUser = await tx.user.findUnique({
          where: { clerkId: req.auth.userId },
          select: { id: true }
        });

        if (!adminUser) {
          throw new Error("ADMIN_USER_NOT_FOUND");
        }


        if (!withdrawal) {
          throw new Error("WITHDRAWAL_NOT_FOUND");
        }

        // 2️⃣ Must be pending
        if (withdrawal.status !== "PENDING" && withdrawal.status !== "pending") {
          throw new Error("WITHDRAWAL_ALREADY_PROCESSED");
        }

        // 3️⃣ Update status → REJECTED
        console.log("ADMIN INTERNAL ID:", adminUser.id);
        console.log("ADMIN CLERK ID:", req.auth.userId);

        await tx.withdrawal.update({
          where: { id },
          data: {
            status: "REJECTED",
            statusReason: reason || null,
            reviewedById: adminUser.id,
          },
        });

        // 4️⃣ Audit log (NO ledger write, NO balance mutation)
        await tx.auditLog.create({
          data: {
            action: "WITHDRAWAL_REJECTED",
            actorId: adminUser.id,
            entityType: "WITHDRAWAL",
            entityId: withdrawal.id,
            meta: { reason },
          },
        });
      });

      return res.json({
        success: true,
        message: "Withdrawal rejected",
      });
    } catch (err) {
      if (err.message === "WITHDRAWAL_ALREADY_PROCESSED") {
        return res.status(409).json({ error: err.message });
      }
      if (err.message === "WITHDRAWAL_NOT_FOUND") {
        return res.status(404).json({ error: "Withdrawal not found" });
      }

      if (err.message === "ADMIN_USER_NOT_FOUND") {
        return res.status(403).json({ error: "Admin user not found" });
      }
      if (err.message === "PLATFORM_MAINTENANCE") {
        return res.status(503).json({
          error: "PLATFORM_MAINTENANCE",
          message: "Withdrawals are disabled during maintenance mode."
        });
      }
      console.error("ADMIN REJECT WITHDRAWAL ERROR:", err);
      return res.status(500).json({ error: "Withdrawal rejection failed" });
    }
  }
);


export default router;
