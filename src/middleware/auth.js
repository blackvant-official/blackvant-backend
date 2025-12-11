import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import prisma from "../utils/prisma.js";

// JWKS client for verifying Clerk JWT signature
const client = jwksClient({
  jwksUri: process.env.CLERK_JWKS_URL,
});

// Retrieve signing key dynamically
function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// ===============================
// 🔐 AUTH MIDDLEWARE
// ===============================
export const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        issuer: process.env.CLERK_ISSUER, // MUST match Clerk
      },
      async (err, decoded) => {
        if (err) {
          console.error("JWT verification failed:", err);
          return res.status(401).json({ error: "Invalid or expired token" });
        }

        const clerkId = decoded.sub;   // Clerk user ID
        const email = decoded.email;   // Email inside token

        if (!clerkId) {
          return res.status(401).json({ error: "Invalid Clerk token structure" });
        }

        // Check if user exists
        let user = await prisma.user.findUnique({
          where: { clerkId },
        });

        // If user not found → create in DB
        if (!user) {
          user = await prisma.user.create({
            data: {
              clerkId,
              email,
              role: "client",
            },
          });
        }

        req.user = user;
        next();
      }
    );
  } catch (error) {
    console.error("AUTH ERROR:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// ===============================
// 🔐 ADMIN CHECK
// ===============================
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.user.role === "admin" || req.user.role === "superadmin") {
    return next();
  }

  return res.status(403).json({ error: "Admin access required" });
};
