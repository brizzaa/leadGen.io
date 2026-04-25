// Batch scraping Google Maps per arricchire DB businesses.
//
// Flusso: per ogni business con maps_url e maps_scan_status IS NULL:
//   1. scrape profilo Google Maps (title, category, website, phone, address)
//   2. aggiorna DB SOLO sui campi attualmente NULL (zero-overwrite policy)
//   3. marca maps_scan_status = 'done' | 'failed'
//
// Resume-safe: rilanciare lo script riparte solo dai business NULL.
//
// Uso:
//   node scripts/scanMaps.js --dry-run        # lista + estrazione, no DB update
//   node scripts/scanMaps.js --limit 50       # processa solo i primi 50
//   node scripts/scanMaps.js --concurrency 4  # cambia parallelismo (default 3)
//   node scripts/scanMaps.js                  # tutti i pending
//
// Costo: 0 € (Playwright locale). Tempo stimato ~5-8s/record con concurrency 3.

import "dotenv/config";
import { getDb } from "../src/config/db.js";
import { createMapsSession, scrapeGoogleMapsProfile } from "../src/services/googleMapsScraper.js";

const DRY = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : null;
const concArg = process.argv.indexOf("--concurrency");
const CONCURRENCY = concArg !== -1 ? parseInt(process.argv[concArg + 1], 10) : 3;

function mergeUpdates(biz, mapsData) {
  // Zero-overwrite policy: aggiorna SOLO i campi nel DB attualmente NULL/empty.
  // Eccezione: category, se nel DB è "attività" (generico) la sovrascriviamo
  // con quella specifica di Maps (es. "Pizzeria", "Avvocato").
  const sets = {};
  if (!biz.website && mapsData.website)  sets.website  = mapsData.website;
  if (!biz.phone   && mapsData.phone)    sets.phone    = mapsData.phone;
  if (!biz.address && mapsData.address)  sets.address  = mapsData.address;
  // address: aggiorna anche se attuale è troppo corto (< 15 char = solo città)
  if (mapsData.address && (!biz.address || biz.address.length < 15)) {
    sets.address = mapsData.address;
  }
  if (mapsData.category) {
    const cur = (biz.category || "").toLowerCase().trim();
    if (!cur || cur === "attività" || cur === "attivita") {
      sets.category = mapsData.category;
    }
  }
  return sets;
}

async function main() {
  const db = getDb();

  let sql = `
    SELECT id, name, area, website, email, phone, category, address, maps_url
    FROM businesses
    WHERE maps_url IS NOT NULL AND maps_url != ''
      AND (maps_scan_status IS NULL OR maps_scan_status = 'pending')
      AND is_blacklisted = 0
    ORDER BY id DESC
  `;
  if (LIMIT) sql += ` LIMIT ${LIMIT}`;

  const rows = db.prepare(sql).all();
  console.log(`${rows.length} business da scansionare${DRY ? " (DRY-RUN)" : ""} · parallelismo ${CONCURRENCY}\n`);
  if (!rows.length) { console.log("Nessun lavoro. Esco."); return; }

  const { ctx, release } = await createMapsSession();
  const stats = { done: 0, failed: 0, category_added: 0, website_added: 0, phone_added: 0, address_updated: 0 };
  const startTs = Date.now();

  const updStmt = (sets, id) => db.prepare(
    `UPDATE businesses SET ${Object.keys(sets).map(k => `${k}=?`).join(", ")}, maps_scan_status='done', maps_scanned_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(...Object.values(sets), id);

  const failStmt = db.prepare(
    `UPDATE businesses SET maps_scan_status='failed', maps_scanned_at=CURRENT_TIMESTAMP WHERE id=?`
  );

  // Semplice pool: launch N promises, quando una finisce ne parte un'altra.
  let idx = 0;
  async function worker(wid) {
    while (true) {
      const i = idx++;
      if (i >= rows.length) return;
      const biz = rows[i];
      const pct = Math.round(((i + 1) / rows.length) * 100);
      try {
        const data = await scrapeGoogleMapsProfile(ctx, biz.maps_url);
        const sets = mergeUpdates(biz, data);
        const labels = Object.keys(sets);
        console.log(`[w${wid} ${String(i+1).padStart(4)}/${rows.length} ${String(pct).padStart(3)}%] #${String(biz.id).padStart(4)} ${biz.name.slice(0,32).padEnd(32)} → ${labels.join(",") || "(già popolato)"} ${data.category ? `· cat=${data.category}` : ""}`);
        if (labels.includes("category")) stats.category_added++;
        if (labels.includes("website"))  stats.website_added++;
        if (labels.includes("phone"))    stats.phone_added++;
        if (labels.includes("address"))  stats.address_updated++;
        if (!DRY) {
          if (Object.keys(sets).length) updStmt(sets, biz.id);
          else db.prepare(`UPDATE businesses SET maps_scan_status='done', maps_scanned_at=CURRENT_TIMESTAMP WHERE id=?`).run(biz.id);
        }
        stats.done++;
      } catch (e) {
        console.log(`[w${wid} ${i+1}/${rows.length}] #${biz.id} ${biz.name}: ERR ${e.message.slice(0,80)}`);
        stats.failed++;
        if (!DRY) failStmt.run(biz.id);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, w) => worker(w + 1)));
  await release();

  const elapsed = Math.round((Date.now() - startTs) / 1000);
  console.log("\n=== REPORT ===");
  console.log(`  Business processati: ${stats.done + stats.failed} / ${rows.length}`);
  console.log(`  Ok:               ${stats.done}`);
  console.log(`  Falliti:          ${stats.failed}`);
  console.log(`  Categorie nuove:  ${stats.category_added}`);
  console.log(`  Siti nuovi:       ${stats.website_added}`);
  console.log(`  Telefoni nuovi:   ${stats.phone_added}`);
  console.log(`  Indirizzi estesi: ${stats.address_updated}`);
  console.log(`  Tempo totale:     ${elapsed}s (${(elapsed / Math.max(stats.done,1)).toFixed(1)}s/record)`);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
