import express from "express";
import prisma from "../../utils/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { generateOtp, hashOtp, getOtpExpiry } from "../../services/otp.service.js";
import { sendEmail } from "../../services/email.service.js";
import bcrypt from "bcrypt";

const router = express.Router();
router.use(requireAuth, requireAdmin);

// Verify Route
router.post("/profit/otp/verify", async (req, res) => {
  try {
    const adminUserId = req.admin?.id;
    const { profitDistributionId, otp } = req.body;

    if (!adminUserId) {
      return res.status(401).json({ error: "Unauthorized admin" });
    }

    if (!profitDistributionId || !otp) {
      return res.status(400).json({
        error: "profitDistributionId and otp are required",
      });
    }

    // Fetch latest valid OTP
    const otpRecord = await prisma.adminProfitOtp.findFirst({
      where: {
        profitDistributionId,
        adminUserId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otpRecord) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.otpHash);

    if (!isValid) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Mark OTP as used
    await prisma.adminProfitOtp.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    // Mark distribution as VERIFIED
    await prisma.profitDistribution.update({
      where: { id: profitDistributionId },
      data: { status: "VERIFIED" },
    });

    res.json({
      success: true,
      message: "OTP verified. Profit distribution unlocked.",
    });
  } catch (err) {
    console.error("OTP VERIFY ERROR:", err);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});
// Request Route
router.post("/profit/otp/request", async (req, res) => {
  try {
    const adminUserId = req.admin?.id;
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
