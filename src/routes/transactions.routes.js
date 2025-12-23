import express from "express";
import { PrismaClient } from "@prisma/client";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/me/transactions
 * Returns FULL immutable transaction ledger
 */
router.get("/me/transactions", authMiddleware, async (req, res) => {
    const { clerkUserId } = req.userContext;
        const user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId }
    });

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const userId = user.id;


    try {
        // 1. Fetch deposits
        const deposits = await prisma.deposit.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" }
        });

        // 2. Fetch withdrawals
        const withdrawals = await prisma.withdrawal.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" }
        });

        // 3. Normalize into ledger format
        const ledger = [];

        deposits.forEach(d => {
            ledger.push({
                id: d.id,
                type: "deposit",
                amount: Number(d.amount),            // positive
                status: d.status,
                method: d.method,
                createdAt: d.createdAt
            });
        });

        withdrawals.forEach(w => {
            ledger.push({
                id: w.id,
                type: "withdrawal",
                amount: -Math.abs(Number(w.amount)),   // negative
                status: w.status,
                method: w.method,
                createdAt: w.createdAt
            });
        });

        // 4. Sort immutably by time
        ledger.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        // 5. Return ledger
        res.json(ledger);

    } catch (error) {
        console.error("Transaction ledger error:", error);
        res.status(500).json({
            error: "Failed to load transaction history"
        });
    }
});

export default router;
