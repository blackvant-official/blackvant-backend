import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";


const prodJwksClient = jwksClient({
  jwksUri: "https://clerk.blackvant.com/.well-known/jwks.json",
});

function getKeyWith(client) {
  return function (header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err);
      callback(null, key.getPublicKey());
    });
  };
}

/**
 * Core auth middleware (single source of truth)
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = authHeader.replace("Bearer ", "");

  const verifyWith = (issuer, jwksClient) =>
    new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKeyWith(jwksClient),
        {
          issuer,
          algorithms: ["RS256"],
        },
        (err, decoded) => {
          if (err) return reject(err);
          resolve(decoded);
        }
      );
    });

  (async () => {
    let decoded;

    try {
      // ✅ TRY PRODUCTION FIRST
      decoded = await verifyWith(
        "https://clerk.blackvant.com",
        prodJwksClient
      );
    } catch (prodErr) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // 🔒 EVERYTHING BELOW IS YOUR ORIGINAL LOGIC (UNCHANGED)
    req.authClaims = decoded;

    const clerkUserId =
      decoded.sub ||
      decoded.user_id ||
      decoded.uid ||
      decoded.id;
    const email =
      decoded.email ||
      decoded.primary_email ||
      decoded.email_addresses?.[0]?.email_address ||
      null;

    if (!clerkUserId) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    try {
      let user = await prisma.user.findUnique({
        where: { clerkId: clerkUserId }
      });

      if (!user) {
        try {
          user = await prisma.user.create({
            data: {
              clerkId: clerkUserId,
              email,
            },
          });
        } catch (err) {
          if (err.code === "P2002") {
            user = await prisma.user.findUnique({
              where: { email },
            });

            if (!user) throw err;

            await prisma.user.update({
              where: { id: user.id },
              data: { clerkId: clerkUserId },
            });
          } else {
            throw err;
          }
        }
      }

      req.userContext = {
        clerkUserId,
        userId: user.id,
        email
      };

      req.auth = {
        userId: clerkUserId
      };

      next();
    } catch (dbErr) {
      console.error("Auth DB sync error:", dbErr);
      return res.status(500).json({ error: "Authentication failed" });
    }
  })();
}

export { requireAuth };
export default requireAuth;
