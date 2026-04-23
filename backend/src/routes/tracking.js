import express from "express";
import { getDb } from "../config/db.js";

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

// GET/POST /api/track/unsubscribe/:token — user clicks unsubscribe link
router.all("/unsubscribe/:token", (req, res) => {
  const { token } = req.params;
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT business_id FROM email_tracking WHERE token = ?")
      .get(token);

    if (row) {
      db.prepare("UPDATE businesses SET is_blacklisted = 1, follow_ups_enabled = 0 WHERE id = ?")
        .run(row.business_id);
      const biz = db.prepare("SELECT name FROM businesses WHERE id = ?").get(row.business_id);
      if (biz) {
        db.prepare("INSERT INTO activity_logs (business_id, type, message) VALUES (?, ?, ?)")
          .run(row.business_id, "unsubscribed", `${biz.name} ha richiesto l'annullamento dell'iscrizione`);
      }
    }
  } catch (e) {
    console.error("[tracking] Unsubscribe error:", e.message);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Iscrizione annullata</title><style>body{font-family:-apple-system,sans-serif;max-width:520px;margin:80px auto;padding:0 20px;color:#111;text-align:center}h1{font-size:28px;margin:0 0 16px}p{color:#555;line-height:1.6}</style></head><body><h1>Iscrizione annullata</h1><p>Non riceverai più email da noi.<br>Grazie per averci contattato.</p></body></html>`);
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
