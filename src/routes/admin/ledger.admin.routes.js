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
    const ledger = await prisma.ledger.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return res.json({
      success: true,
      ledger
    });
  } catch (err) {
    console.error("ADMIN LEDGER READ ERROR:", err);
    return res.status(500).json({ error: "Failed to read ledger" });
  }
});

export default router;
