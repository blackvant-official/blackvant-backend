import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import { sendEmail } from "../../services/email.service.js";

const router = express.Router();

router.get("/admin/email/test", requireAuth, async (req, res) => {
  try {
    const email = req.userContext?.email;

    if (!email) {
      return res.status(400).json({ error: "No admin email found" });
    }

    await sendEmail({
      to: email,
      subject: "BlackVant Email Test",
      text: "If you received this email, SMTP is working correctly.",
    });

    res.json({ success: true, message: "Test email sent" });
  } catch (err) {
    console.error("EMAIL TEST ERROR:", err);
    res.status(500).json({ error: "Email failed" });
  }
});

export default router;
