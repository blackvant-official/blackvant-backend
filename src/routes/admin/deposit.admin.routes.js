import { logAudit } from "../../services/audit.service.js";
import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth,  } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { requireWritable } from "../../middleware/readOnly.js";
import { getSystemSettings } from "../../services/systemSettings.service.js";
import { signGetUrl } from "../../utils/s3.js";

// ================================
// STATUS NORMALIZATION (ADMIN DEPOSITS)
// ================================
const normalizeAdminDepositStatus = (status) => {
  if (!status) return undefined;
  return String(status).toUpperCase();
};

const router = express.Router();

// GET /api/v1/admin/deposits

router.get("/deposits", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const rawStatus = req.query.status;
    const normalizedStatus = normalizeAdminDepositStatus(rawStatus);

    const where = {
      ...(normalizedStatus && { status: normalizedStatus })
    };

    const [deposits, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        include: {
          user: { select: { email: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      prisma.deposit.count({ where })
    ]);

    return res.json({
      success: true,
      deposits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("ADMIN ALL DEPOSITS ERROR:", err);
    return res.status(500).json({ error: "Failed to fetch deposits" });
  }
});

// ============================================
// GET DEPOSIT PROOF URL (ADMIN ONLY)
// ============================================
router.get(
  "/deposits/:id/proof-url",
  requireAdmin,
  async (req, res) => {
    try {
      const depositId = req.params.id;

      // 1️⃣ Fetch deposit (proof only)
      const deposit = await prisma.deposit.findUnique({
        where: { id: depositId },
        select: {
          proofKey: true,
        },
      });

      if (!deposit) {
        return res.status(404).json({
          error: "DEPOSIT_NOT_FOUND",
        });
      }

      if (!deposit.proofKey) {
        return res.status(404).json({
          error: "PROOF_NOT_FOUND",
        });
      }

      // 2️⃣ Generate short-lived signed S3 URL (30 seconds)
      const url = await signGetUrl(deposit.proofKey);

      // 3️⃣ Return URL only (no metadata)
      return res.json({ url });

    } catch (err) {
      console.error("ADMIN PROOF URL ERROR:", err);
      return res.status(500).json({
        error: "FAILED_TO_GENERATE_PROOF_URL",
      });
    }
  }
);

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
  requireWritable,
  async (req, res) => {
  const depositId = req.params.id;

  // 🔒 PLATFORM MAINTENANCE CHECK
  const systemSettings = await getSystemSettings();

  if (systemSettings.platformMaintenanceMode === true) {
    return res.status(503).json({
      error: "PLATFORM_MAINTENANCE",
      message: "Deposit approvals are disabled during maintenance mode."
    });
  }

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
    // ================================
    // CAPITAL LOCK ACTIVATION (SYSTEM-WIDE)
    // ================================
    const systemSettings = await getSystemSettings();
      
    if (
      systemSettings.capitalLockEnabled === true &&
      systemSettings.capitalLockStartAt === null
    ) {
      await prisma.systemSetting.update({
        where: { id: systemSettings.id },
        data: {
          capitalLockStartAt: new Date(),
        },
      });
    }


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
  requireWritable,
  async (req, res) => {
    const depositId = req.params.id;
    const clerkUserId = req.auth.userId;

    try {
      await prisma.$transaction(async (tx) => {

        // 🔹 Resolve internal admin user
        const adminUser = await tx.user.findUnique({
          where: { clerkId: clerkUserId }
        });


        if (!adminUser) {
          throw new Error("ADMIN_USER_NOT_FOUND");
        }

        // 1️⃣ Fetch deposit
        const deposit = await tx.deposit.findUnique({
          where: { id: depositId }
        });

        if (!deposit) {
          throw new Error("DEPOSIT_NOT_FOUND");
        }

        if (deposit.status !== "PENDING") {
          throw new Error("DEPOSIT_ALREADY_PROCESSED");
        }

        // 2️⃣ Update status
        await tx.deposit.update({
          where: { id: depositId },
          data: { status: "REJECTED" }
        });

        // 3️⃣ Audit log (NOW VALID FK)
        await tx.auditLog.create({
          data: {
            action: "DEPOSIT_REJECTED",
            actorId: adminUser.id, // ✅ INTERNAL ID
            entityType: "DEPOSIT",
            entityId: deposit.id,
            meta: {
              amount: deposit.amount
            }
          }
        });
      });

      return res.json({ success: true });

    } catch (err) {
      if (err.message === "ADMIN_USER_NOT_FOUND") {
        return res.status(403).json({ error: "Admin user not registered" });
      }
      if (err.message === "DEPOSIT_ALREADY_PROCESSED") {
        return res.status(409).json({ error: "Deposit already processed" });
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
