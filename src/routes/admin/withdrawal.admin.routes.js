import { logAudit } from "../../services/audit.service.js";
import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth, } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { requireWritable } from "../../middleware/readOnly.js";

const router = express.Router();

// GET /api/v1/admin/withdrawals/pending
router.get("/withdrawals/pending", requireAuth, async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { status: "pending" },
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
router.post(
  "/withdrawals/:id/approve",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const withdrawalId = req.params.id;
    const adminId = req.auth.userId;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Atomically claim withdrawal (must be PENDING)
        const updated = await tx.withdrawal.updateMany({
          where: {
            id: withdrawalId,
            status: "PENDING"
          },
          data: {
            status: "APPROVED"
          }
        });

        if (updated.count === 0) {
          throw new Error("WITHDRAWAL_ALREADY_PROCESSED");
        }

        // 2. Fetch withdrawal
        const withdrawal = await tx.withdrawal.findUnique({
          where: { id: withdrawalId }
        });

        if (!withdrawal) {
          throw new Error("WITHDRAWAL_NOT_FOUND");
        }

        // 3. Calculate balance from ledger
        const aggregates = await tx.ledger.aggregate({
          where: { userId: withdrawal.userId },
          _sum: { amount: true }
        });

        const balance = Number(aggregates._sum.amount || 0);

        if (balance < withdrawal.amount) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // 4. Create ledger OUT entry
        await tx.ledger.create({
          data: {
            userId: withdrawal.userId,
            amount: -withdrawal.amount,
            direction: "OUT",
            referenceType: "WITHDRAWAL",
            referenceId: withdrawal.id
          }
        });

        // 5. Audit log
        await tx.auditLog.create({
          data: {
            action: "WITHDRAWAL_APPROVED",
            actorId: adminId,
            entityType: "WITHDRAWAL",
            entityId: withdrawal.id,
            meta: {
              amount: withdrawal.amount
            }
          }
        });

        return { success: true };
      });

      return res.json(result);
    } catch (err) {
      if (err.message === "WITHDRAWAL_ALREADY_PROCESSED") {
        return res.status(409).json({ error: err.message });
      }

      if (err.message === "INSUFFICIENT_BALANCE") {
        return res.status(409).json({ error: err.message });
      }

      if (err.message === "WITHDRAWAL_NOT_FOUND") {
        return res.status(404).json({ error: "Withdrawal not found" });
      }

      console.error("WITHDRAWAL APPROVAL ERROR:", err);
      return res.status(500).json({ error: "Withdrawal approval failed" });
    }
  }
);


// POST /api/v1/admin/withdrawals/:id/reject
router.post(
  "/withdrawals/:id/reject",
  requireAuth,
  requireWritable,
  async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });
    if (withdrawal.status !== "pending")
      return res.status(400).json({ error: "Withdrawal already processed" });

    // refund the profitBalance immediately
    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id },
        data: {
          status: "rejected",
          statusReason: reason,
          reviewedById: req.user.id,
        },
      });

      await logAudit({
  actorId: req.user.id,
  action: "WITHDRAWAL_REJECTED",
  entityType: "withdrawal",
  entityId: withdrawal.id,
  meta: { reason }
});


      await tx.user.update({
        where: { id: withdrawal.userId },
        data: {
          profitBalance: {
            increment: withdrawal.amount,
          },
        },
      });
    });

    res.json({ success: true, message: "Withdrawal rejected and profit refunded" });
  } catch (err) {
    console.error("ADMIN REJECT WITHDRAWAL ERROR:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
