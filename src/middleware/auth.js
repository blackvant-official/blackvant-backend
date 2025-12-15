import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const client = jwksClient({
  jwksUri: "https://comic-kangaroo-23.clerk.accounts.dev/.well-known/jwks.json",
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

/**
 * Core JWT verification logic
 */
function verifyToken(req, res, next) {
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
      // 🚫 NO audience validation
    },
    (err, decoded) => {
      if (err) {
        console.error("JWT verification failed:", err.message);
        return res.status(401).json({ error: "Invalid token" });
      }

      req.user = decoded;
      next();
    }
  );
}

/**
 * Named export (routes)
 */
export function requireAuth(req, res, next) {
  return verifyToken(req, res, next);
}

/**
 * Default export (app-level)
 */
export default verifyToken;
