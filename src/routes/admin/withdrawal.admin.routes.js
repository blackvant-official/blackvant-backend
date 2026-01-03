import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth, } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { requireWritable } from "../../middleware/readOnly.js";
import { Prisma } from "@prisma/client";

const router = express.Router();

// GET /api/v1/admin/withdrawals/pending
router.get("/withdrawals/pending", requireAuth, async (req, res) => {
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { status: { in: ["PENDING", "pending"] } },
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
  requireAuth,
  requireAdmin,
  requireWritable,
  async (req, res) => {
    const withdrawalId = req.params.id;
    const adminId = req.auth.userId;

    try {
      const result = await prisma.$transaction(async (tx) => {
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
          },
        });

        if (existingLedger) {
          throw new Error("LEDGER_ALREADY_EXISTS");
        }

        // 4) Compute ledger balance correctly (CREDIT - DEBIT)
        const creditAgg = await tx.ledger.aggregate({
          where: {
            userId: withdrawal.userId,
            direction: "CREDIT",
          },
          _sum: { amount: true },
        });

        const debitAgg = await tx.ledger.aggregate({
          where: {
            userId: withdrawal.userId,
            direction: "DEBIT",
          },
          _sum: { amount: true },
        });

        const totalCredits = creditAgg._sum.amount || new Prisma.Decimal(0);
        const totalDebits = debitAgg._sum.amount || new Prisma.Decimal(0);
        const availableBalance = totalCredits.minus(totalDebits);

        if (availableBalance.lt(withdrawal.amount)) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // 5) Write ONE ledger DEBIT (amount is POSITIVE)
        await tx.ledger.create({
          data: {
            userId: withdrawal.userId,
            amount: withdrawal.amount,
            direction: "DEBIT",
            referenceType: "WITHDRAWAL",
            referenceId: withdrawal.id,
          },
        });

        // 6) Update withdrawal status
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
            actorId: adminId,
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
      console.error("WITHDRAWAL APPROVAL ERROR:", err);
      return res.status(500).json({ error: "Withdrawal approval failed" });
    }
  }
);


// POST /api/v1/admin/withdrawals/:id/reject
router.post(
  "/withdrawals/:id/reject",
  requireAuth,
  requireAdmin,
  requireWritable,
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.auth.userId;

    try {
      await prisma.$transaction(async (tx) => {
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
            actorId: adminId,
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


      console.error("ADMIN REJECT WITHDRAWAL ERROR:", err);
      return res.status(500).json({ error: "Withdrawal rejection failed" });
    }
  }
);


export default router;
