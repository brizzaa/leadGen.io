// Enrichment batch: processa tutti i business senza email ma con FB page.
// Usa extractContactsFromFacebook (Playwright + sessione salvata).
// Zero-overwrite policy: aggiorna solo email/phone NULL.
//
// Uso:
//   node scripts/enrichAllFacebook.js --limit 50
//   node scripts/enrichAllFacebook.js

import "dotenv/config";
import { getDb } from "../src/config/db.js";
import { extractContactsFromFacebook } from "../src/services/socialScanner.js";

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : null;

const db = getDb();

// Migrazione idempotente colonna di stato
try { db.exec("ALTER TABLE businesses ADD COLUMN fb_scan_status TEXT"); } catch {}
try { db.exec("ALTER TABLE businesses ADD COLUMN fb_scanned_at DATETIME"); } catch {}

let sql = `
  SELECT id, name, email, phone, facebook_url FROM businesses
  WHERE (email IS NULL OR email = '')
    AND facebook_url IS NOT NULL AND facebook_url != ''
    AND is_blacklisted = 0
    AND (fb_scan_status IS NULL OR fb_scan_status = 'failed')
  ORDER BY id DESC
`;
if (LIMIT) sql += ` LIMIT ${LIMIT}`;

const rows = db.prepare(sql).all();
console.log(`FB enrichment: ${rows.length} candidati\n`);
if (!rows.length) { console.log("Niente da fare."); process.exit(0); }

const markDone = db.prepare(
  "UPDATE businesses SET fb_scan_status='done', fb_scanned_at=CURRENT_TIMESTAMP WHERE id=?"
);
const markFailed = db.prepare(
  "UPDATE businesses SET fb_scan_status='failed', fb_scanned_at=CURRENT_TIMESTAMP WHERE id=?"
);
const updEmail = db.prepare("UPDATE businesses SET email=? WHERE id=?");
const updPhone = db.prepare("UPDATE businesses SET phone=? WHERE id=?");

const stats = { done: 0, failed: 0, email_new: 0, phone_new: 0 };
const startTs = Date.now();

for (let i = 0; i < rows.length; i++) {
  const biz = rows[i];
  try {
    const c = await extractContactsFromFacebook(biz.facebook_url);
    const bits = [];
    if (c.email && !biz.email) {
      updEmail.run(c.email, biz.id);
      bits.push(`email=${c.email}`);
      stats.email_new++;
    }
    if (c.phone && !biz.phone) {
      updPhone.run(c.phone, biz.id);
      bits.push(`tel=${c.phone}`);
      stats.phone_new++;
    }
    markDone.run(biz.id);
    stats.done++;
    console.log(`[${String(i+1).padStart(4)}/${rows.length}] #${String(biz.id).padStart(4)} ${biz.name.slice(0,32).padEnd(32)} → ${bits.join(" ") || "—"}`);
  } catch (e) {
    stats.failed++;
    markFailed.run(biz.id);
    console.log(`[${i+1}/${rows.length}] #${biz.id} ${biz.name}: ERR ${e.message.slice(0,50)}`);
  }
}

const elapsed = Math.round((Date.now() - startTs) / 1000);
console.log("\n=== REPORT FB ===");
console.log(`  Ok:       ${stats.done}`);
console.log(`  Falliti:  ${stats.failed}`);
console.log(`  Email:    ${stats.email_new}`);
console.log(`  Tel:      ${stats.phone_new}`);
console.log(`  Tempo:    ${elapsed}s (${(elapsed/rows.length).toFixed(1)}s/biz)`);
process.exit(0);
