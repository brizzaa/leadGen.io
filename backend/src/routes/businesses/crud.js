import express from "express";
import { Parser } from "json2csv";
import { computeLeadScore } from "../../services/leadScore.js";
import * as repo from "../../services/businessRepository.js";

const router = express.Router();

// GET /api/businesses
router.get("/", (req, res) => {
  try {
    const businesses = repo.findFiltered(req.userId, req.query);
    const scored = businesses.map((b) => ({ ...b, lead_score: computeLeadScore(b) }));
    res.json(scored);
  } catch (error) {
    console.error("[businesses] Error fetching:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// POST /api/businesses/bulk
router.post("/bulk", (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids must be a non-empty array" });
  }
  if (ids.length > 50) {
    return res.status(400).json({ error: "Max 50 businesses per request" });
  }
  res.json(repo.findManyByIds(ids, req.userId));
});

// GET /api/businesses/export
router.get("/export", (req, res) => {
  try {
    const businesses = repo.findAllOwned(req.userId);
    console.log(`[export] Esportazione in corso: ${businesses.length} business trovati.`);

    const fields = [
      "id", "name", "address", "phone", "email", "vat_number", "website",
      "rating", "review_count", "category", "area", "maps_url", "status",
      "is_claimed", "facebook_url", "instagram_url", "social_last_active",
      "notes", "next_contact", "created_at",
    ];
    const csv = new Parser({ fields }).parse(businesses);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="businesses.csv"');
    res.send(csv);
    console.log(`[export] Esportazione completata con successo.`);
  } catch (err) {
    console.error("[export] Errore durante l'esportazione:", err.message);
    res.status(500).json({
      error: "Errore durante la generazione del CSV",
      details: err.message,
    });
  }
});

// POST /api/businesses/delete-batch — must register before /:id route
router.post("/delete-batch", (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: "ids must be an array" });
  }
  repo.deleteManyOwned(ids, req.userId);
  res.json({ success: true, deleted: ids.length });
});

// GET /api/businesses/:id
router.get("/:id", (req, res) => {
  const business = repo.findOwnedById(req.params.id, req.userId);
  if (!business) return res.status(404).json({ error: "Business not found" });
  res.json({ ...business, lead_score: computeLeadScore(business) });
});

// DELETE /api/businesses/:id
router.delete("/:id", (req, res) => {
  repo.deleteOwned(req.params.id, req.userId);
  res.json({ success: true });
});

export default router;
