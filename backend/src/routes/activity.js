import express from "express";
import { getDb } from "../db.js";

const router = express.Router();

// ⚠️ IMPORTANTE: Le route specifiche vanno PRIMA di quelle con parametri (:id)

// GET /api/activity/reminders/due — Lead con follow-up in scadenza oggi o passati
router.get("/reminders/due", (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split("T")[0];
    const leads = db
      .prepare(
        `SELECT id, name, area, category, status, phone, email, next_contact
         FROM businesses
         WHERE next_contact IS NOT NULL
           AND next_contact != ''
           AND date(next_contact) <= ?
           AND status NOT IN ('Vinto (Cliente)', 'Perso')
         ORDER BY next_contact ASC`,
      )
      .all(today);
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/activity/log/:logId — Cancella un singolo log
router.delete("/log/:logId", (req, res) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM activity_logs WHERE id = ?").run(req.params.logId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/activity/:businessId — Storico attività di un business
router.get("/:businessId", (req, res) => {
  try {
    const db = getDb();
    const logs = db
      .prepare(
        "SELECT * FROM activity_logs WHERE business_id = ? ORDER BY created_at DESC LIMIT 50",
      )
      .all(req.params.businessId);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/activity/:businessId — Aggiunge un log manuale (nota rapida)
router.post("/:businessId", (req, res) => {
  const { type = "note", message } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const db = getDb();
    const stmt = db.prepare(
      "INSERT INTO activity_logs (business_id, type, message) VALUES (?, ?, ?)",
    );
    const result = stmt.run(req.params.businessId, type, message);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
