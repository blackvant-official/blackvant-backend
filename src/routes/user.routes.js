import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/v1/me
 * - Creates user on first login
 * - Returns stable user payload
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { clerkUserId, email } = req.userContext;

    if (!clerkUserId) {
      return res.status(400).json({ error: "Invalid user context" });
    }

    // 1️⃣ Find existing user (CORRECT FIELD)
    let user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    // 2️⃣ Create user if not exists
    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId: clerkUserId,
          email: email ?? `user_${Date.now()}@blackvant.local`,
          role: "client",
        },
      });
    }

    // 3️⃣ Respond to frontend
    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    console.error("GET /me error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
