// Enrichment batch: processa tutti i business senza email ma con sito.
// Riusa worker esistente (contact scrape → axios + Playwright fallback).
//
// Resume-safe: contact_status='done'|'failed' marca già fatti.
// Rilanciabile: skippa chi ha già status.
//
// Uso:
//   node scripts/enrichAllSites.js --limit 50    # solo i primi 50
//   node scripts/enrichAllSites.js                # tutti (~789)

import "dotenv/config";
import { getDb } from "../src/config/db.js";
import { runEnrichmentBatch } from "../src/services/enrichmentWorker.js";

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : null;

const db = getDb();

// Candidati: senza email, con sito, status vergine o failed (retry)
let sql = `
  SELECT id FROM businesses
  WHERE (email IS NULL OR email = '')
    AND website IS NOT NULL AND website != ''
    AND is_blacklisted = 0
    AND (contact_status IS NULL OR contact_status = 'failed' OR contact_status = 'pending')
  ORDER BY id DESC
`;
if (LIMIT) sql += ` LIMIT ${LIMIT}`;
const candidates = db.prepare(sql).all().map(r => r.id);

console.log(`Candidati: ${candidates.length}\n`);
if (!candidates.length) { console.log("Nessun candidato. Esco."); process.exit(0); }

// Mark all pending
db.prepare(
  `UPDATE businesses SET contact_status='pending' WHERE id IN (${candidates.map(()=>"?").join(",")})`
).run(...candidates);

// Snapshot before (solo email per metrica)
const before = new Map();
for (const id of candidates) {
  const r = db.prepare("SELECT email, phone, facebook_url, instagram_url FROM businesses WHERE id=?").get(id);
  before.set(id, r);
}

// Loop batch 20 con while(pending)
const startTs = Date.now();
let batchN = 0;
while (true) {
  batchN++;
  const pending = db.prepare(
    `SELECT COUNT(*) AS n FROM businesses WHERE contact_status='pending' AND id IN (${candidates.map(()=>"?").join(",")})`
  ).get(...candidates).n;
  if (!pending) break;
  const r = await runEnrichmentBatch(db, { ids: candidates });
  const elapsed = Math.round((Date.now() - startTs) / 1000);
  console.log(`── Batch ${batchN} · processed ${r.contactProcessed} · ${pending - r.contactProcessed} pending · ${elapsed}s totali`);
  if (batchN >= 100) break;
}

// Stats
const stats = { done: 0, failed: 0, email_new: 0, phone_new: 0, fb_new: 0, ig_new: 0 };
for (const id of candidates) {
  const r = db.prepare("SELECT email, phone, facebook_url, instagram_url, contact_status FROM businesses WHERE id=?").get(id);
  const b = before.get(id);
  if (r.contact_status === "done") stats.done++;
  if (r.contact_status === "failed") stats.failed++;
  if (r.email && !b.email) stats.email_new++;
  if (r.phone && !b.phone) stats.phone_new++;
  if (r.facebook_url && !b.facebook_url) stats.fb_new++;
  if (r.instagram_url && !b.instagram_url) stats.ig_new++;
}

const total = Math.round((Date.now() - startTs) / 1000);
console.log("\n=== REPORT ===");
console.log(`  Processati:       ${stats.done + stats.failed} / ${candidates.length}`);
console.log(`  Status done:      ${stats.done}`);
console.log(`  Status failed:    ${stats.failed}`);
console.log(`  Email NUOVE:      ${stats.email_new}`);
console.log(`  Telefoni NUOVI:   ${stats.phone_new}`);
console.log(`  FB NUOVI:         ${stats.fb_new}`);
console.log(`  IG NUOVI:         ${stats.ig_new}`);
console.log(`  Tempo totale:     ${total}s (${(total/candidates.length).toFixed(1)}s/biz)`);
process.exit(0);
