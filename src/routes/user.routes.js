import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { sub, email } = req.user;

    if (!sub || !email) {
      return res.status(400).json({ error: "Invalid user payload" });
    }

    // 1️⃣ Find existing user
    let user = await prisma.user.findUnique({
      where: { clerk_user_id: sub },
    });

    // 2️⃣ Create user if not exists
    if (!user) {
      user = await prisma.user.create({
        data: {
          clerk_user_id: sub,
          email: email,
          investment_balance: 0,
          profit_balance: 0,
        },
      });
    }

    // 3️⃣ Return user
    res.json({
      id: user.id,
      email: user.email,
      investmentBalance: user.investment_balance,
      profitBalance: user.profit_balance,
      createdAt: user.created_at,
    });

  } catch (error) {
    console.error("GET /me error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
