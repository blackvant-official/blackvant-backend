import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
const router = express.Router();

/**
 * GET /api/v1/admin/audit-logs
 */
router.use(requireAuth, requireAdmin);

router.get("/audit-logs", async (req, res) => {
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

export default router;
