import express from "express";
import { scrapeBusinesses } from "../services/scraper.js";
import { extractEmail } from "../services/emailExtractor.js";
import { extractVat } from "../services/vatExtractor.js";
import { getDb } from "../config/db.js";

const router = express.Router();

// ─── Global scraping session ──────────────────────────────────────────────────
// Persiste tra connessioni SSE — permette di riconnettersi dopo cambio pagina

const session = {
  active: false,
  userId: null,
  buffer: [],          // ultimi 200 eventi SSE (replay al reconnect)
  clients: new Set(),  // client SSE connessi al momento
  abortSignal: { aborted: false },
};

const MAX_BUFFER = 200;

function broadcast(type, data) {
  const event = { type, ...data };
  session.buffer.push(event);
  if (session.buffer.length > MAX_BUFFER) session.buffer.shift();
  const msg = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of session.clients) {
    try { res.write(msg); } catch { session.clients.delete(res); }
  }
}

function resetSession() {
  session.active = false;
  session.userId = null;
  session.buffer = [];
  session.clients.clear();
  session.abortSignal = { aborted: false };
}

// ─── GET /events — SSE stream, riconnettibile ─────────────────────────────────

router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Replay buffer — il client vede tutto quello che si è perso
  for (const event of session.buffer) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // Se non c'è sessione attiva, invia subito idle e chiudi
  if (!session.active) {
    res.write(`data: ${JSON.stringify({ type: "idle" })}\n\n`);
    res.end();
    return;
  }

  session.clients.add(res);

  req.on("close", () => {
    session.clients.delete(res);
  });
});

// ─── GET /status — stato corrente ────────────────────────────────────────────

router.get("/status", (req, res) => {
  res.json({ active: session.active });
});

// ─── POST /stop ───────────────────────────────────────────────────────────────

router.post("/stop", (req, res) => {
  session.abortSignal.aborted = true;
  res.json({ success: true });
});

// ─── POST / — avvia scraping ─────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const { area, category } = req.body;

  if (!area || !category) {
    return res.status(400).json({ error: "area e category sono obbligatori" });
  }

  if (session.active) {
    return res.status(409).json({ error: "Scraping già in corso. Usa /api/search/events per seguirlo." });
  }

  // Inizializza sessione
  session.active = true;
  session.userId = req.userId;
  session.buffer = [];
  session.abortSignal = { aborted: false };

  // Risponde subito con 202 — il client si connette a /events per seguire
  res.status(202).json({ ok: true, message: "Scraping avviato. Connettiti a /api/search/events per seguire il progresso." });

  // Esegue in background (non blocca la risposta HTTP)
  runScraping(area, category, req.userId).catch((err) => {
    console.error("[search] Fatal:", err);
    broadcast("error", { message: err.message });
    resetSession();
  });
});

async function runScraping(area, category, userId) {
  const db = getDb();

  const existingNames = new Set(
    db.prepare("SELECT name FROM businesses WHERE area = ? AND user_id = ?")
      .all(area, userId)
      .map((r) => r.name)
  );

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO businesses
      (name, address, phone, website, rating, review_count, email, vat_number, category, area,
       maps_url, is_claimed, facebook_url, instagram_url, social_last_active, user_id,
       website_status, contact_status)
    VALUES
      (@name, @address, @phone, @website, @rating, @review_count, @email, @vat_number, @category, @area,
       @maps_url, @is_claimed, @facebook_url, @instagram_url, @social_last_active, @user_id,
       @website_status, @contact_status)
  `);

  let totalSaved = 0;
  let totalIgnored = 0;
  const allInserted = [];

  const onBatch = (businesses) => {
    const fresh = businesses.filter((b) => b.name && !existingNames.has(b.name));
    if (fresh.length === 0) return;

    for (const biz of fresh) {
      biz.category = category;
      biz.area = area;
      const hasWebsite = !!biz.website;
      const hasContacts = !!(biz.email && biz.phone);

      const record = {
        name: biz.name, address: biz.address ?? null, phone: biz.phone ?? null,
        website: biz.website ?? null, rating: biz.rating ?? null,
        review_count: biz.review_count ?? null, email: biz.email ?? null,
        vat_number: null, category, area,
        maps_url: biz.maps_url ?? null, is_claimed: 1,
        facebook_url: null, instagram_url: null, social_last_active: null,
        user_id: userId,
        website_status: hasWebsite ? "skipped" : "pending",
        contact_status: hasContacts ? "skipped" : hasWebsite ? "pending" : null,
      };

      try {
        const result = insertStmt.run(record);
        if (result.changes > 0) {
          totalSaved++;
          existingNames.add(biz.name);
          allInserted.push(biz);
          broadcast("inserted", { name: record.name, category: record.category, total: totalSaved });
        } else {
          totalIgnored++;
        }
      } catch (err) {
        console.error(`[search] INSERT ERROR "${biz.name}":`, err.message);
      }
    }

    broadcast("progress", { message: `💾 ${totalSaved} salvati, ${totalIgnored} duplicati saltati` });
  };

  await scrapeBusinesses(area, category,
    (msg) => broadcast("progress", { message: msg }),
    session.abortSignal,
    onBatch,
  );

  broadcast("done", {
    message: `Completato! ${totalSaved} nuovi salvati, ${totalIgnored} già presenti.`,
    count: totalSaved,
  });

  // Cleanup sessione dopo 10s (dà tempo ai client di ricevere "done")
  setTimeout(resetSession, 10_000);

  if (allInserted.length > 0) {
    extractDataInBackground(allInserted, db);
  }
}

async function extractDataInBackground(businesses, db) {
  const updateEmail = db.prepare("UPDATE businesses SET email = ? WHERE name = ? AND area = ? AND email IS NULL");
  const updateVat = db.prepare("UPDATE businesses SET vat_number = ? WHERE name = ? AND area = ? AND vat_number IS NULL");
  for (const biz of businesses) {
    if (!biz.website) continue;
    try { const e = await extractEmail(biz.website); if (e) updateEmail.run(e, biz.name, biz.area); } catch { /* skip */ }
    try { const v = await extractVat(biz.website); if (v) updateVat.run(v, biz.name, biz.area); } catch { /* skip */ }
  }
}

export default router;
