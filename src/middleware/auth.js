import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const client = jwksClient({
  jwksUri: "https://comic-kangaroo-23.clerk.accounts.dev/.well-known/jwks.json",
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
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

  jwt.verify(
    token,
    getKey,
    {
      issuer: "https://comic-kangaroo-23.clerk.accounts.dev",
      algorithms: ["RS256"],
    },
    (err, decoded) => {
      if (err) {
        console.error("JWT verification failed:", err.message);
        return res.status(401).json({ error: "Invalid token" });
      }
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
          
            // ✅ ENSURE USER EXISTS IN DATABASE
            (async () => {
              try {
                let user = await prisma.user.findUnique({
                  where: { clerkId: clerkUserId }
                });
              
                if (!user) {
                  user = await prisma.user.create({
                    data: {
                      clerkId: clerkUserId,
                      email
                    }
                  });
                }
              
                req.userContext = {
                  clerkUserId,
                  userId: user.id,
                  email
                };
              
                next();
              
              } catch (dbErr) {
                console.error("Auth DB sync error:", dbErr);
                return res.status(500).json({ error: "Authentication failed" });
              }
            })();

    }
  );
}



export { requireAuth };
export default requireAuth;


