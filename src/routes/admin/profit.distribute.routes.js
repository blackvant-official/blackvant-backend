import express from "express";
import prisma from "../../../utils/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/v1/admin/profit/distribute
 * Phase B-4 — Profit Distribution (Ledger CREDIT)
 * NOTE: Logic will be implemented step-by-step.
 */
router.post("/profit/distribute", requireAuth, async (req, res) => {
  return res.status(501).json({
    error: "Profit distribution logic not implemented yet",
  });
});

export default router;
