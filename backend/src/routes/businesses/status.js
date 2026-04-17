import express from "express";
import * as repo from "../../services/businessRepository.js";
import { logActivity } from "../../services/activityLogger.js";

const router = express.Router();

const VALID_STATUSES = [
  "Da Contattare",
  "Inviata Mail",
  "In Trattativa",
  "Vinto (Cliente)",
  "Perso",
];

router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: "status is required" });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Stato non valido. Valori ammessi: ${VALID_STATUSES.join(", ")}`,
    });
  }

  const old = repo.getStatus(req.params.id, req.userId);
  const result = repo.updateStatus(req.params.id, req.userId, status);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }

  if (old && old.status !== status) {
    logActivity(req.params.id, "status", `Stato cambiato: "${old.status}" → "${status}"`);
  }
  res.json({ success: true, status });
});

router.patch("/:id/opt-out", (req, res) => {
  const result = repo.markBlacklisted(req.params.id, req.userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }
  res.json({ success: true, message: "Utente rimosso dalle liste di contatto." });
});

router.patch("/:id/undo-opt-out", (req, res) => {
  const result = repo.unmarkBlacklisted(req.params.id, req.userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }
  res.json({ success: true, message: "Utente riattivato per le liste di contatto." });
});

export default router;
