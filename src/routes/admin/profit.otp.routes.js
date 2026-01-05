import express from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../../middleware/auth.js";
import { generateOtp, hashOtp, getOtpExpiry } from "../../services/otp.service.js";
import { sendEmail } from "../../services/email.service.js";

const router = express.Router();
const prisma = new PrismaClient();

router.post("/admin/profit/otp/request", requireAuth, async (req, res) => {
  try {
    const adminUserId = req.userContext?.userId;
    const adminEmail = req.userContext?.email;
    const { profitDistributionId } = req.body;

    if (!adminUserId || !adminEmail) {
      return res.status(401).json({ error: "Unauthorized admin" });
    }

    if (!profitDistributionId) {
      return res.status(400).json({ error: "profitDistributionId required" });
    }

    // Ensure distribution exists
    const distribution = await prisma.profitDistribution.findUnique({
      where: { id: profitDistributionId },
    });

    if (!distribution) {
      return res.status(404).json({ error: "Profit distribution not found" });
    }

    // Invalidate previous unused OTPs
    await prisma.adminProfitOtp.updateMany({
      where: {
        profitDistributionId,
        adminUserId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    await prisma.adminProfitOtp.create({
      data: {
        profitDistributionId,
        adminUserId,
        otpHash,
        expiresAt: getOtpExpiry(),
      },
    });

    await sendEmail({
      to: adminEmail,
      subject: "BlackVant Admin OTP Verification",
      text: `Your verification code is:\n\n${otp}\n\nThis code expires in 10 minutes.`,
    });

    res.json({ success: true, message: "OTP sent to admin email" });
  } catch (err) {
    console.error("OTP REQUEST ERROR:", err);
    res.status(500).json({ error: "Failed to generate OTP" });
  }
});

export default router;
