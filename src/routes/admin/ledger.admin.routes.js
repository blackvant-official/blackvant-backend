import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import prisma from "../../utils/prisma.js";

const router = express.Router();

/**
 * READ-ONLY — Admin Ledger Inspection */
router.use(requireAuth, requireAdmin);
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const skip = (page - 1) * limit;

    const [ledger, total] = await Promise.all([
      prisma.ledger.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      prisma.ledger.count()
    ]);

    return res.json({
      success: true,
      ledger,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error("ADMIN LEDGER READ ERROR:", err);
    return res.status(500).json({ error: "Failed to read ledger" });
  }
});


export default router;
