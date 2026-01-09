import prisma from "../utils/prisma.js";

export async function requireAdmin(req, res, next) {
  try {
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const admin = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, role: true },
    });

    if (!admin || admin.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin access required" });
    }

    // OPTIONAL but recommended
    req.admin = admin;

    next();
  } catch (err) {
    console.error("REQUIRE ADMIN ERROR:", err);
    return res.status(500).json({ error: "Admin validation failed" });
  }
}
