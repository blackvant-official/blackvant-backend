import express from "express";
import prisma from "../utils/prisma.js";
import requireAuth from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/v1/me
 * - Creates user on first login (idempotent)
 * - Returns stable user payload
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { clerkUserId, email } = req.userContext;

    // 1) Find user
    let user = await prisma.user.findUnique({
      where: { clerk_user_id: clerkUserId },
    });

    // 2) Create on first login
    if (!user) {
      user = await prisma.user.create({
        data: {
          clerk_user_id: clerkUserId,
          email: email ?? "unknown",
          investment_balance: 0,
          profit_balance: 0,
        },
      });
    }

    // 3) Respond (frontend contract)
    return res.json({
      id: user.id,
      email: user.email,
      investmentBalance: Number(user.investment_balance),
      profitBalance: Number(user.profit_balance),
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error("GET /me error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
