import express from "express";
import { getDb } from "../../config/db.js";
import { triggerEnrichment } from "../../services/enrichmentWorker.js";

const router = express.Router();

/**
 * POST /api/businesses/enrich
 * Body: { ids?: number[], step?: "website"|"contact"|"all" }
 * Retrigers enrichment for given IDs (or all pending if no IDs).
 * Returns SSE stream of progress.
 */
router.post("/enrich", async (req, res) => {
  const { ids, step = "all" } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type, data) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);

  try {
    const db = getDb();

    // If specific IDs, validate ownership
    let validIds = ids ?? null;
    if (ids?.length) {
      const owned = db
        .prepare(`SELECT id FROM businesses WHERE id IN (${ids.join(",")}) AND user_id = ?`)
        .all(req.userId)
        .map((r) => r.id);
      validIds = owned;

      if (validIds.length === 0) {
        send("error", { message: "Nessun business valido trovato." });
        return res.end();
      }
    } else {
      // No IDs: reset all pending for this user
      if (step === "website" || step === "all") {
        db.prepare("UPDATE businesses SET website_status = 'pending' WHERE website IS NULL AND user_id = ?").run(req.userId);
      }
      if (step === "contact" || step === "all") {
        db.prepare("UPDATE businesses SET contact_status = 'pending' WHERE website IS NOT NULL AND (email IS NULL OR phone IS NULL) AND user_id = ?").run(req.userId);
      }
    }

    const pendingW = db.prepare(
      validIds ? `SELECT COUNT(*) as n FROM businesses WHERE website_status = 'pending' AND id IN (${validIds.join(",")})` :
      "SELECT COUNT(*) as n FROM businesses WHERE website_status = 'pending' AND user_id = ?"
    ).get(...(validIds ? [] : [req.userId])).n;

    const pendingC = db.prepare(
      validIds ? `SELECT COUNT(*) as n FROM businesses WHERE contact_status = 'pending' AND website IS NOT NULL AND id IN (${validIds.join(",")})` :
      "SELECT COUNT(*) as n FROM businesses WHERE contact_status = 'pending' AND website IS NOT NULL AND user_id = ?"
    ).get(...(validIds ? [] : [req.userId])).n;

    send("progress", { message: `🔄 Avvio arricchimento: ${pendingW} siti + ${pendingC} contatti` });

    const { websiteProcessed, contactProcessed } = await triggerEnrichment(db, { ids: validIds, step });

    send("done", {
      message: `✅ Arricchimento completato: ${websiteProcessed} siti scansionati, ${contactProcessed} contatti estratti.`,
      websiteProcessed,
      contactProcessed,
    });
    res.end();
  } catch (err) {
    console.error("[enrich] Error:", err);
    send("error", { message: err.message });
    res.end();
  }
});

/**
 * GET /api/businesses/enrich/stats
 * Returns pending enrichment counts for current user.
 */
router.get("/enrich/stats", (req, res) => {
  const db = getDb();
  const pendingWebsite = db.prepare(
    "SELECT COUNT(*) as n FROM businesses WHERE website_status = 'pending' AND user_id = ?"
  ).get(req.userId).n;
  const pendingContact = db.prepare(
    "SELECT COUNT(*) as n FROM businesses WHERE contact_status = 'pending' AND website IS NOT NULL AND user_id = ?"
  ).get(req.userId).n;
  const failedWebsite = db.prepare(
    "SELECT COUNT(*) as n FROM businesses WHERE website_status = 'failed' AND user_id = ?"
  ).get(req.userId).n;
  const failedContact = db.prepare(
    "SELECT COUNT(*) as n FROM businesses WHERE contact_status = 'failed' AND user_id = ?"
  ).get(req.userId).n;

  res.json({ pendingWebsite, pendingContact, failedWebsite, failedContact });
});

export default router;
