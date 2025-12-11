import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import prisma from "../utils/prisma.js";

// JWKS client for verifying Clerk JWT signature
const client = jwksClient({
  jwksUri: process.env.CLERK_JWKS_URL,
});

// Retrieve signing key
function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// Middleware: require authentication
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
        issuer: process.env.CLERK_ISSUER,   // ONLY ISSUER CHECK
        // NO AUDIENCE CHECK (Clerk dev tokens don't have audience)
      },
      async (err, decoded) => {
        if (err) {
          console.error("JWT verification failed:", err);
          return res.status(401).json({ error: "Invalid or expired token" });
        }

        const clerkId = decoded.sub;
        const email = decoded.email;

        if (!clerkId) {
          return res.status(401).json({ error: "Invalid Clerk token structure" });
        }

        // Find or create local database user
        let user = await prisma.user.findUnique({
          where: { clerkId },
        });

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

// Middleware: require admin privileges
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.user.role === "admin" || req.user.role === "superadmin") {
    return next();
  }

  return res.status(403).json({ error: "Admin access required" });
};
