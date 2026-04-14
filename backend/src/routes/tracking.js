import express from "express";
import { getDb } from "../db.js";

const router = express.Router();

// Pixel trasparente 1x1 GIF (43 bytes)
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// GET /api/track/:token — tracking pixel per apertura email
router.get("/:token", (req, res) => {
  const { token } = req.params;

  try {
    const db = getDb();
    const row = db
      .prepare("SELECT id, business_id, opened_at FROM email_tracking WHERE token = ?")
      .get(token);

    if (row) {
      db.prepare(
        "UPDATE email_tracking SET opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP), open_count = open_count + 1 WHERE token = ?"
      ).run(token);

      // Log solo la prima apertura
      if (!row.opened_at) {
        const biz = db
          .prepare("SELECT name FROM businesses WHERE id = ?")
          .get(row.business_id);
        if (biz) {
          db.prepare(
            "INSERT INTO activity_logs (business_id, type, message) VALUES (?, ?, ?)"
          ).run(row.business_id, "email_opened", `Email aperta da ${biz.name}`);
        }
      }
    }
  } catch (e) {
    console.error("[tracking] Error:", e.message);
  }

  // Restituisci sempre il pixel (anche se token non trovato)
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.end(PIXEL);
});

// GET /api/track/stats/:businessId — statistiche apertura per un business
router.get("/stats/:businessId", (req, res) => {
  const db = getDb();
  const stats = db
    .prepare(
      "SELECT token, sent_at, opened_at, open_count FROM email_tracking WHERE business_id = ? ORDER BY sent_at DESC"
    )
    .all(req.params.businessId);

  const summary = {
    total_sent: stats.length,
    total_opened: stats.filter((s) => s.opened_at).length,
    open_rate: stats.length > 0
      ? Math.round((stats.filter((s) => s.opened_at).length / stats.length) * 100)
      : 0,
    details: stats,
  };

  res.json(summary);
});

export default router;
