import { logAudit } from "../../services/audit.service.js";
import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth,  } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { requireWritable } from "../../middleware/readOnly.js";

// ================================
// STATUS NORMALIZATION (ADMIN DEPOSITS)
// ================================
const normalizeAdminDepositStatus = (status) => {
  if (!status) return undefined;
  return String(status).toUpperCase();
};

const router = express.Router();

// GET /api/v1/admin/deposits
// ---------------------------------------------
// READ-ONLY — Returns ALL deposits (any status)
// Used by Admin Deposits page with filters
router.get("/deposits", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rawStatus = req.query.status;
    const normalizedStatus = normalizeAdminDepositStatus(rawStatus);

    const deposits = await prisma.deposit.findMany({
      where: {
        ...(normalizedStatus && { status: normalizedStatus }),
      },
      include: {
        user: {
          select: { email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      success: true,
      deposits,
    });
  } catch (err) {
    console.error("ADMIN ALL DEPOSITS ERROR:", err);
    return res.status(500).json({
      error: "Failed to fetch deposits",
    });
  }
});

// GET /api/v1/admin/deposits/pending
router.get("/deposits/pending", requireAuth,  async (req, res) => {
  try {
    const deposits = await prisma.deposit.findMany({
      where: { status: "PENDING" },
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


/**
 * APPROVE DEPOSIT (LEDGER-BASED)
 * --------------------------------
 * 1. Deposit must be PENDING
 * 2. Ledger entry must NOT already exist
 * 3. Create ONE ledger credit
 * 4. Mark deposit as APPROVED
 * 5. Idempotent by design
 */
router.post(
  "/deposits/:id/approve",
  requireAuth,
  requireAdmin,
  requireWritable,
  async (req, res) => {
  const depositId = req.params.id;

  try {
    // 1️⃣ Fetch deposit
    const deposit = await prisma.deposit.findUnique({
      where: { id: depositId },
    });

    if (!deposit) {
      return res.status(404).json({ error: "Deposit not found" });
    }

    // 2️⃣ Must be pending
    if (deposit.status !== "PENDING") {
      return res.status(409).json({
        error: "Deposit already processed",
      });
    }

    // 3️⃣ Check for existing ledger entry (idempotency guard)
    const existingLedger = await prisma.ledger.findFirst({
      where: {
        referenceType: "DEPOSIT",
        referenceId: deposit.id,
      },
    });

    if (existingLedger) {
      return res.status(409).json({
        error: "Ledger entry already exists for this deposit",
      });
    }

    // 4️⃣ Atomic transaction (ledger + status)
    await prisma.$transaction([
      prisma.ledger.create({
        data: {
          userId: deposit.userId,
          amount: deposit.amount,
          direction: "CREDIT",
          referenceType: "DEPOSIT",
          referenceId: deposit.id,
        },
      }),

      prisma.deposit.update({
        where: { id: deposit.id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
        },
      }),
    ]);

    return res.json({
      success: true,
      message: "Deposit approved and ledger credited",
    });
  } catch (error) {
    console.error("Deposit approval error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});




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
