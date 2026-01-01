import { logAudit } from "../../services/audit.service.js";
import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth,  } from "../../middleware/auth.js";
import { requireWritable } from "../../middleware/readOnly.js";

const router = express.Router();

// GET /api/v1/admin/deposits/pending
router.get("/deposits/pending", requireAuth,  async (req, res) => {
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
router.post(
  "/deposits/:id/approve",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const depositId = req.params.id;
    const adminId = req.auth.userId;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Lock deposit row
        const deposit = await tx.deposit.findUnique({
          where: { id: depositId },
          lock: { mode: "for update" }
        });

        if (!deposit) {
          throw new Error("DEPOSIT_NOT_FOUND");
        }

        if (deposit.status !== "PENDING") {
          throw new Error("DEPOSIT_ALREADY_PROCESSED");
        }

        // 2. Idempotency check (ledger)
        const existingLedger = await tx.ledger.findFirst({
          where: {
            referenceType: "DEPOSIT",
            referenceId: deposit.id
          }
        });

        if (existingLedger) {
          throw new Error("DEPOSIT_ALREADY_LEDGERED");
        }

        // 3. Create ledger entry
        await tx.ledger.create({
          data: {
            userId: deposit.userId,
            amount: deposit.amount,
            direction: "IN",
            referenceType: "DEPOSIT",
            referenceId: deposit.id
          }
        });

        // 4. Update deposit status
        await tx.deposit.update({
          where: { id: deposit.id },
          data: { status: "APPROVED" }
        });

        // 5. Write audit log
        await tx.auditLog.create({
          data: {
            action: "DEPOSIT_APPROVED",
            actorId: adminId,
            entityType: "DEPOSIT",
            entityId: deposit.id,
            meta: {
              amount: deposit.amount
            }
          }
        });

        return { success: true };
      });

      return res.json(result);
    } catch (err) {
      if (
        err.message === "DEPOSIT_ALREADY_PROCESSED" ||
        err.message === "DEPOSIT_ALREADY_LEDGERED"
      ) {
        return res.status(409).json({ error: err.message });
      }

      if (err.message === "DEPOSIT_NOT_FOUND") {
        return res.status(404).json({ error: "Deposit not found" });
      }

      console.error("DEPOSIT APPROVAL ERROR:", err);
      return res.status(500).json({ error: "Deposit approval failed" });
    }
  }
);


// POST /api/v1/admin/deposits/:id/reject
router.post(
  "/deposits/:id/reject",
  requireAuth,
  requireWritable,
  async (req, res) => {
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
