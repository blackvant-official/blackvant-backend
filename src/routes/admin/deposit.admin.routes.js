import { logAudit } from "../../services/audit.service.js";
import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth,  } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
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
  async (req, res) => {
    const depositId = req.params.id;
    const adminId = req.auth.userId;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Atomically claim the deposit
        const updated = await tx.deposit.updateMany({
          where: {
            id: depositId,
            status: "PENDING"
          },
          data: {
            status: "APPROVED"
          }
        });

        if (updated.count === 0) {
          throw new Error("DEPOSIT_ALREADY_PROCESSED");
        }

        // 2. Re-fetch approved deposit
        const deposit = await tx.deposit.findUnique({
          where: { id: depositId }
        });

        if (!deposit) {
          throw new Error("DEPOSIT_NOT_FOUND");
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
  requireAdmin,
  async (req, res) => {
    const depositId = req.params.id;
    const adminId = req.auth.userId;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Atomically reject only if still pending
        const updated = await tx.deposit.updateMany({
          where: {
            id: depositId,
            status: "PENDING"
          },
          data: {
            status: "REJECTED"
          }
        });

        if (updated.count === 0) {
          throw new Error("DEPOSIT_ALREADY_PROCESSED");
        }

        // 2. Fetch deposit for audit context
        const deposit = await tx.deposit.findUnique({
          where: { id: depositId }
        });

        if (!deposit) {
          throw new Error("DEPOSIT_NOT_FOUND");
        }

        // 3. Write audit log (no ledger write)
        await tx.auditLog.create({
          data: {
            action: "DEPOSIT_STATUS_UPDATED",
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
      if (err.message === "DEPOSIT_ALREADY_PROCESSED") {
        return res.status(409).json({ error: err.message });
      }

      if (err.message === "DEPOSIT_NOT_FOUND") {
        return res.status(404).json({ error: "Deposit not found" });
      }

      console.error("DEPOSIT REJECTION ERROR:", err);
      return res.status(500).json({ error: "Deposit rejection failed" });
    }
  }
);


export default router;
