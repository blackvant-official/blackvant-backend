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
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const skip = (page - 1) * limit;

    const actor = req.query.actor || null;   // email substring
    const action = req.query.action || null; // exact or prefix
    const q = req.query.q || null;            // free text

    const where = {
      ...(actor && { actor: { email: { contains: actor, mode: "insensitive" } } }),
      ...(action && { action }),
      ...(q && {
        OR: [
          { entityType: { contains: q, mode: "insensitive" } },
          { entityId: { contains: q, mode: "insensitive" } },
        ]
      })
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { actor: { select: { email: true } } }
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      success: true,
      logs: logs.map(l => ({
        id: l.id,
        date: l.createdAt,
        actor: l.actor?.email || "System",
        action: l.action,
        entity: l.entityType,
        entityId: l.entityId,
        ip: l.ip || "-",
        details: l.meta || {}
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("AUDIT LOGS ERROR:", err);
    res.status(500).json({ error: "Failed to load audit logs" });
  }
});


export default router;
