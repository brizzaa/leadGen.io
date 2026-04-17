import { findOwnedById } from "../services/businessRepository.js";

/** Attaches req.business (owned by req.userId) or returns 404. */
export function requireBusinessOwnership(req, res, next) {
  const biz = findOwnedById(req.params.id, req.userId);
  if (!biz) return res.status(404).json({ error: "Business not found" });
  req.business = biz;
  next();
}
