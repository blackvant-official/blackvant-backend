import prisma from "../utils/prisma.js";

/**
 * requireAdmin
 * -----------------
 * Enforces that:
 * 1. Request is authenticated via Clerk
 * 2. Clerk user exists in internal User table
 * 3. User has an admin-capable role
 *
 * Accepted roles:
 * - "ADMIN"
 * - "super_admin"
 *
 * Attaches:
 *   req.admin = { id, role }
 */
export async function requireAdmin(req, res, next) {
  try {
    // 1️⃣ Ensure Clerk auth context exists
    if (!req.auth || !req.auth.userId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const clerkUserId = req.auth.userId;

    // 2️⃣ Lookup internal user by clerkId
    const admin = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: {
        id: true,
        role: true,
      },
    });

    // 3️⃣ Validate admin existence
    if (!admin) {
      return res.status(403).json({
        error: "Admin user not registered in system",
      });
    }

    // 4️⃣ Validate role (case-sensitive, explicit)
    const ALLOWED_ROLES = ["ADMIN", "super_admin"];

    if (!ALLOWED_ROLES.includes(admin.role)) {
      return res.status(403).json({
        error: "Admin access required",
      });
    }

    // 5️⃣ Attach admin context (used by profit system)
    req.admin = {
      id: admin.id,
      role: admin.role,
    };

    return next();
  } catch (err) {
    console.error("REQUIRE ADMIN ERROR:", err);
    return res.status(500).json({
      error: "Admin validation failed",
    });
  }
}
