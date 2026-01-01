import { clerkClient } from "@clerk/clerk-sdk-node";

/**
 * Server-side admin verification
 * Source of truth: Clerk publicMetadata.role
 */
export async function requireAdmin(req, res, next) {
  try {
    // Clerk userId must already be set by requireAuth
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const user = await clerkClient.users.getUser(userId);
    const role = user.publicMetadata?.role;

    if (role !== "super_admin") {
      return res.status(403).json({ error: "Admin access denied" });
    }

    // Authorized
    next();
  } catch (err) {
    console.error("REQUIRE ADMIN ERROR:", err);
    return res.status(500).json({ error: "Admin verification failed" });
  }
}
