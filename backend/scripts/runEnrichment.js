// Enrichment standalone — scrapa email/tel/social per tutti i business senza email.
// Non genera siti, non manda email.
// Uso:
//   node scripts/runEnrichment.js             # tutti i business senza email
//   node scripts/runEnrichment.js --limit 500 # limite manuale

import "dotenv/config";
import { getDb } from "../src/config/db.js";
import {
  searchEmailViaDDG,
  searchSocialsViaDDGHttp,
  extractContactsFromWebsite,
  extractContactsFromFacebook,
  extractContactsFromInstagram,
} from "../src/services/socialScanner.js";

const args = process.argv.slice(2);
const arg = (k, def) => { const i = args.indexOf(k); return i === -1 ? def : args[i + 1]; };
const LIMIT = parseInt(arg("--limit", "99999"), 10);
const CONCURRENCY = parseInt(arg("--concurrency", "4"), 10);

function pickBusinesses(n) {
  return getDb().prepare(`
    SELECT * FROM businesses
    WHERE is_blacklisted = 0
      AND (email IS NULL OR email = '')
      AND (website IS NOT NULL OR instagram_url IS NOT NULL OR facebook_url IS NOT NULL OR name IS NOT NULL)
    ORDER BY website IS NOT NULL DESC, id
    LIMIT ?
  `).all(n);
}

async function enrichOne(biz) {
  const db = getDb();
  let updated = { ...biz };

  function patch(updates) {
    if (!Object.keys(updates).length) return;
    const sets = Object.keys(updates).map(k => `${k}=?`).join(", ");
    db.prepare(`UPDATE businesses SET ${sets} WHERE id=?`).run(...Object.values(updates), biz.id);
    updated = { ...updated, ...updates };
  }

  // 1. Sito web
  if (biz.website && !updated.email) {
    try {
      const c = await extractContactsFromWebsite(biz.website);
      const u = {};
      if (c.email) { u.email = c.email; u.email_source_url = biz.website; }
      if (c.phone && !updated.phone) u.phone = c.phone;
      if (c.instagram_url && !updated.instagram_url) u.instagram_url = c.instagram_url;
      if (c.facebook_url && !updated.facebook_url) u.facebook_url = c.facebook_url;
      patch(u);
    } catch {}
  }

  // 2. Facebook
  if (updated.facebook_url && !updated.email) {
    try {
      const c = await extractContactsFromFacebook(updated.facebook_url);
      const u = {};
      if (c.email) { u.email = c.email; u.email_source_url = updated.facebook_url; }
      if (c.phone && !updated.phone) u.phone = c.phone;
      patch(u);
    } catch {}
  }

  // 3. Instagram
  if (updated.instagram_url && !updated.email) {
    try {
      const c = await extractContactsFromInstagram(updated.instagram_url);
      const u = {};
      if (c.email) { u.email = c.email; u.email_source_url = updated.instagram_url; }
      if (c.phone && !updated.phone) u.phone = c.phone;
      patch(u);
    } catch {}
  }

  // 4. DDG social scan
  if (!updated.instagram_url && !updated.facebook_url && biz.name) {
    try {
      const social = await searchSocialsViaDDGHttp(biz.name, biz.area);
      const u = {};
      if (social.instagram_url) u.instagram_url = social.instagram_url;
      if (social.facebook_url) u.facebook_url = social.facebook_url;
      if (Object.keys(u).length) {
        patch(u);
        if (!updated.email && updated.facebook_url) {
          const c = await extractContactsFromFacebook(updated.facebook_url).catch(() => ({}));
          if (c.email) patch({ email: c.email, email_source_url: updated.facebook_url });
        }
        if (!updated.email && updated.instagram_url) {
          const c = await extractContactsFromInstagram(updated.instagram_url).catch(() => ({}));
          if (c.email) patch({ email: c.email, email_source_url: updated.instagram_url });
        }
      }
    } catch {}
  }

  // 5. DDG email search — ultima risorsa
  if (!updated.email && biz.name) {
    try {
      const email = await searchEmailViaDDG(biz.name, biz.area);
      if (email) patch({ email, email_source_url: `https://duckduckgo.com/?q=${encodeURIComponent(biz.name + " " + (biz.area || "") + " email")}` });
    } catch {}
  }

  return !!updated.email;
}

// Pool di concorrenza semplice
async function runPool(items, fn, concurrency) {
  let i = 0, found = 0, done = 0;
  async function worker() {
    while (i < items.length) {
      const item = items[i++];
      const idx = done + 1;
      process.stdout.write(`[${idx}/${items.length}] ${item.name} (${item.area || ""}) ... `);
      try {
        const ok = await fn(item);
        console.log(ok ? "✓ email trovata" : "– nessuna email");
        if (ok) found++;
      } catch (e) {
        console.log(`✗ ${e.message}`);
      }
      done++;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return found;
}

(async () => {
  const list = pickBusinesses(LIMIT);
  console.log(`Enrichment su ${list.length} business senza email (concurrency: ${CONCURRENCY})\n`);
  if (!list.length) { console.log("Nessun business da arricchire."); return; }

  const start = Date.now();
  const found = await runPool(list, enrichOne, CONCURRENCY);
  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);

  console.log(`\nDONE in ${elapsed} min — email trovate: ${found}/${list.length}`);
})();
