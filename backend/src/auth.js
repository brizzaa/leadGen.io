import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "leadgen-dev-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/** Express middleware — sets req.userId or returns 401 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token mancante" });
  }
  try {
    const decoded = verifyToken(header.slice(7));
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Token non valido o scaduto" });
  }
}
