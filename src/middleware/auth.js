import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import prisma from "../utils/prisma.js";

const client = jwksClient({
  jwksUri: process.env.CLERK_JWKS_URL,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

export const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Missing token" });

    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        issuer: process.env.CLERK_ISSUER,
        ignoreExpiration: false,
      },
      async (err, decoded) => {
        if (err) {
          console.error("JWT FAIL:", err);
          return res.status(401).json({ error: "Invalid or expired token" });
        }

        const clerkId = decoded.sub;
        const email = decoded.email;

        let user = await prisma.user.findUnique({ where: { clerkId } });

        if (!user) {
          user = await prisma.user.create({
            data: { clerkId, email, role: "client" },
          });
        }

        req.user = user;
        next();
      }
    );
  } catch (error) {
    console.error("AUTH ERROR:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role === "admin" || req.user?.role === "superadmin") {
    return next();
  }
  return res.status(403).json({ error: "Admin access required" });
};
