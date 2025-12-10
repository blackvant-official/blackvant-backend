import express from "express";
import prisma from "../utils/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/v1/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        investmentBalance: true,
        profitBalance: true,
        createdAt: true,
      },
    });

    return res.json({ success: true, user });
  } catch (err) {
    console.error("ME ROUTE ERROR:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
