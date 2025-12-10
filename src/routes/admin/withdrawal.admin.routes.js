import { logAudit } from "../../services/audit.service.js";
import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth, requireAdmin } from "../../middleware/auth.js";

const router = express.Router();

// GET /api/v1/admin/withdrawals/pending
router.get("/withdrawals/pending", requireAuth, requireAdmin, async (req, res) => {
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
router.post("/withdrawals/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { txId, note } = req.body;

    const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });
    if (withdrawal.status !== "pending")
      return res.status(400).json({ error: "Withdrawal already processed" });

    await prisma.withdrawal.update({
      where: { id },
      data: {
        status: "approved",
        txId,
        statusReason: note,
        reviewedById: req.user.id,
        approvedAt: new Date(),
      },
    });

await logAudit({
  actorId: req.user.id,
  action: "WITHDRAWAL_APPROVED",
  entityType: "withdrawal",
  entityId: withdrawal.id,
  meta: { txId }
});

    res.json({ success: true, message: "Withdrawal approved" });
  } catch (err) {
    console.error("ADMIN APPROVE WITHDRAWAL ERROR:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/v1/admin/withdrawals/:id/reject
router.post("/withdrawals/:id/reject", requireAuth, requireAdmin, async (req, res) => {
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
