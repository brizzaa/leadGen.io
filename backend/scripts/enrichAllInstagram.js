// Enrichment batch: processa business senza email ma con IG profilo.
// Usa extractContactsFromInstagram (richiede ig-session.json se disponibile).
//
// Uso:
//   node scripts/enrichAllInstagram.js --limit 50
//   node scripts/enrichAllInstagram.js

import "dotenv/config";
import { getDb } from "../src/config/db.js";
import { extractContactsFromInstagram } from "../src/services/socialScanner.js";

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : null;

const db = getDb();

try { db.exec("ALTER TABLE businesses ADD COLUMN ig_scan_status TEXT"); } catch {}
try { db.exec("ALTER TABLE businesses ADD COLUMN ig_scanned_at DATETIME"); } catch {}

let sql = `
  SELECT id, name, email, phone, instagram_url FROM businesses
  WHERE (email IS NULL OR email = '')
    AND instagram_url IS NOT NULL AND instagram_url != ''
    AND is_blacklisted = 0
    AND (ig_scan_status IS NULL OR ig_scan_status = 'failed')
  ORDER BY id DESC
`;
if (LIMIT) sql += ` LIMIT ${LIMIT}`;

const rows = db.prepare(sql).all();
console.log(`IG enrichment: ${rows.length} candidati\n`);
if (!rows.length) { console.log("Niente da fare."); process.exit(0); }

const markDone = db.prepare(
  "UPDATE businesses SET ig_scan_status='done', ig_scanned_at=CURRENT_TIMESTAMP WHERE id=?"
);
const markFailed = db.prepare(
  "UPDATE businesses SET ig_scan_status='failed', ig_scanned_at=CURRENT_TIMESTAMP WHERE id=?"
);
const updEmail = db.prepare("UPDATE businesses SET email=? WHERE id=?");
const updPhone = db.prepare("UPDATE businesses SET phone=? WHERE id=?");

const stats = { done: 0, failed: 0, email_new: 0, phone_new: 0 };
const startTs = Date.now();

for (let i = 0; i < rows.length; i++) {
  const biz = rows[i];
  try {
    const c = await extractContactsFromInstagram(biz.instagram_url);
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
console.log("\n=== REPORT IG ===");
console.log(`  Ok:       ${stats.done}`);
console.log(`  Falliti:  ${stats.failed}`);
console.log(`  Email:    ${stats.email_new}`);
console.log(`  Tel:      ${stats.phone_new}`);
console.log(`  Tempo:    ${elapsed}s (${(elapsed/rows.length).toFixed(1)}s/biz)`);
process.exit(0);
