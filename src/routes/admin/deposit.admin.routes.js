import { logAudit } from "../../services/audit.service.js";
import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth, requireAdmin } from "../../middleware/auth.js";

const router = express.Router();

// GET /api/v1/admin/deposits/pending
router.get("/deposits/pending", requireAuth, requireAdmin, async (req, res) => {
  try {
    const deposits = await prisma.deposit.findMany({
      where: { status: "pending" },
      include: {
        user: {
          select: { email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, deposits });
  } catch (err) {
    console.error("ADMIN PENDING DEPOSITS ERROR:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/v1/admin/deposits/:id/approve
router.post("/deposits/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const deposit = await prisma.deposit.findUnique({ where: { id } });
    if (!deposit) return res.status(404).json({ error: "Deposit not found" });
    if (deposit.status !== "pending")
      return res.status(400).json({ error: "Deposit already processed" });

    // Transaction: approve deposit and update user balance
    const result = await prisma.$transaction(async (tx) => {
      await tx.deposit.update({
        where: { id },
        data: {
          status: "approved",
          reviewedById: req.user.id,
          approvedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: deposit.userId },
        data: {
          investmentBalance: {
            increment: deposit.amount,
            
            
        },
    },
});
});

await logAudit({
  actorId: req.user.id,
  action: "DEPOSIT_APPROVED",
  entityType: "deposit",
  entityId: deposit.id,
  meta: { amount: deposit.amount }
});

    res.json({ success: true, message: "Deposit approved" });
  } catch (err) {
    console.error("ADMIN APPROVE DEPOSIT ERROR:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/v1/admin/deposits/:id/reject
router.post("/deposits/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const deposit = await prisma.deposit.findUnique({ where: { id } });
    if (!deposit) return res.status(404).json({ error: "Deposit not found" });
    if (deposit.status !== "pending")
      return res.status(400).json({ error: "Deposit already processed" });

    await prisma.deposit.update({
      where: { id },
      data: {
        status: "rejected",
        statusReason: reason,
        reviewedById: req.user.id,
      },
    });

await logAudit({
  actorId: req.user.id,
  action: "DEPOSIT_REJECTED",
  entityType: "deposit",
  entityId: deposit.id,
  meta: { reason }
});

    res.json({ success: true, message: "Deposit rejected" });
  } catch (err) {
    console.error("ADMIN REJECT DEPOSIT ERROR:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
