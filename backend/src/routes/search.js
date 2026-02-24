import express from "express";
import { scrapeBusinesses } from "../scraper.js";
import { extractEmail } from "../emailExtractor.js";
import { getDb } from "../db.js";

const router = express.Router();

let currentAbortSignal = { aborted: false };

router.post("/stop", (req, res) => {
  currentAbortSignal.aborted = true;
  res.json({ success: true, message: "Scraping interrotto." });
});

router.post("/", async (req, res) => {
  const { area, category } = req.body;

  if (!area || !category) {
    return res.status(400).json({ error: "area e category sono obbligatori" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    currentAbortSignal = { aborted: false };

    const db = getDb();
    const existingNames = db
      .prepare("SELECT name FROM businesses WHERE area = ?")
      .all(area)
      .map((r) => r.name);

    const businesses = await scrapeBusinesses(
      area,
      category,
      (msg) => {
        send("progress", { message: msg });
      },
      currentAbortSignal,
      existingNames,
    );

    console.log(`\n[search] Scraper returned ${businesses.length} businesses`);
    if (businesses.length > 0) {
      console.log(
        "[search] Sample record:",
        JSON.stringify(businesses[0], null, 2),
      );
    }

    send("progress", {
      message: `Trovati ${businesses.length} business, salvataggio...`,
    });

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO businesses
        (name, address, phone, website, rating, review_count, email, category, area, maps_url, is_claimed, facebook_url, instagram_url, social_last_active)
      VALUES
        (@name, @address, @phone, @website, @rating, @review_count, @email, @category, @area, @maps_url, @is_claimed, @facebook_url, @instagram_url, @social_last_active)
    `);

    let savedCount = 0;
    let ignoredCount = 0;

    for (const biz of businesses) {
      const record = {
        name: biz.name ?? null,
        address: biz.address ?? null,
        phone: biz.phone ?? null,
        website: biz.website ?? null,
        rating: biz.rating ?? null,
        review_count: biz.review_count ?? null,
        email: null,
        category: biz.category ?? category,
        area: biz.area ?? area,
        maps_url: biz.maps_url ?? null,
        is_claimed: biz.is_claimed ? 1 : 0,
        facebook_url: biz.facebook_url ?? null,
        instagram_url: biz.instagram_url ?? null,
        social_last_active: biz.social_last_active ?? null,
      };

      try {
        const result = insertStmt.run(record);
        if (result.changes > 0) {
          savedCount++;
        } else {
          ignoredCount++;
          console.log(`[search] IGNORED (duplicate): ${record.name}`);
        }
      } catch (insertErr) {
        console.error(
          `[search] INSERT ERROR for "${biz.name}":`,
          insertErr.message,
        );
        console.error("[search] Record was:", record);
      }
    }

    console.log(
      `[search] Done — saved: ${savedCount}, duplicates: ${ignoredCount}`,
    );

    send("done", {
      message: `Completato! ${savedCount} nuovi salvati, ${ignoredCount} già presenti (${businesses.length} trovati).`,
      count: savedCount,
    });
    res.end();

    if (businesses.length > 0) {
      extractEmailsInBackground(businesses, db);
    }
  } catch (err) {
    console.error("[search] Fatal error:", err);
    send("error", { message: err.message });
    res.end();
  }
});

async function extractEmailsInBackground(businesses, db) {
  const updateStmt = db.prepare(
    "UPDATE businesses SET email = ? WHERE name = ? AND area = ? AND email IS NULL",
  );
  for (const biz of businesses) {
    if (!biz.website) continue;
    try {
      const email = await extractEmail(biz.website);
      if (email) {
        updateStmt.run(email, biz.name, biz.area);
        console.log(`[email] ${biz.name} → ${email}`);
      }
    } catch {
      /* skip */
    }
  }
  console.log("[email] Background email extraction complete.");
}

export default router;
