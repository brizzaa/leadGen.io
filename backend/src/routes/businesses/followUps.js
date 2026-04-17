import express from "express";
import { computeLeadScore } from "../../services/leadScore.js";
import * as repo from "../../services/businessRepository.js";

const router = express.Router();

// PATCH /api/businesses/:id/toggle-followups
router.patch("/:id/toggle-followups", (req, res) => {
  const result = repo.toggleFollowUps(parseInt(req.params.id, 10), req.userId);
  if (!result) return res.status(404).json({ error: "Business non trovato" });
  res.json(result);
});

// GET /api/businesses/follow-ups
router.get("/follow-ups", (req, res) => {
  const rows = repo.findFollowUps(req.userId);
  const scored = rows.map((b) => ({ ...b, lead_score: computeLeadScore(b) }));
  res.json(scored);
});

export default router;
