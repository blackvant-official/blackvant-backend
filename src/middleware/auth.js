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

export default function requireAuth(req, res, next) {
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
      // 🚫 No audience validation — locked
    },
    (err, decoded) => {
      if (err) {
        console.error("JWT verification failed:", err.message);
        return res.status(401).json({ error: "Invalid token" });
      }

      // ✅ Normalized user context
      const clerkUserId = decoded.sub;
      const email =
        decoded.email ||
        decoded.primary_email ||
        decoded.email_addresses?.[0]?.email_address ||
        null;

      if (!clerkUserId) {
        return res.status(401).json({ error: "Invalid token payload" });
      }

      req.userContext = { clerkUserId, email };
      next();
    }
  );
}
