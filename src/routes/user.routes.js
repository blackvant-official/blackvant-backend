import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { clerkUserId, email } = req.userContext;

    if (!clerkUserId) {
      return res.status(400).json({ error: "Invalid user context" });
    }

    // 1️⃣ Always trust clerkId as primary key
    let user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    // 2️⃣ Create user ONLY if not exists
    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: clerkUserId,
          email: email ?? `user_${clerkUserId}@blackvant.local`,
          role: "client",
        },
      });
    }

    // 3️⃣ Return stable payload
    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      balances: {
        investment: Number(user.investmentBalance),
        profit: Number(user.profitBalance),
      },
    });



  } catch (err) {
    console.error("GET /me Prisma error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
