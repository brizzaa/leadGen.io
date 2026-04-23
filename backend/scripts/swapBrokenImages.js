// Fix immagini rotte sui siti già deployati su Cloudflare R2.
//
// Problema: i siti usano URL Pixabay `largeImageURL` (/get/..._1280.jpg) che
// NON sono hotlinkable e restituiscono HTTP 400 come <img src>.
// Soluzione: fetch HTML dal subdomain pubblico, trova URL rotti, chiama Pixabay
// API con keyword categoria del business, sostituisce con webformatURL (_640)
// che sono hotlinkable, re-upload su R2. Zero chiamate AI.
//
// Uso:
//   node scripts/swapBrokenImages.js --dry-run          # lista, non tocca R2
//   node scripts/swapBrokenImages.js --only 1           # primo della lista
//   node scripts/swapBrokenImages.js --slug bed-and-breakfast-la-corte-a-ferrara-izyj
//   node scripts/swapBrokenImages.js                    # tutti
//
// Costo: ~0€ (solo chiamate Pixabay free tier + upload R2).

import "dotenv/config";
import axios from "axios";
import { getDb } from "../src/config/db.js";
import { deploySite } from "../src/services/cloudflareDeployer.js";
import { getCategoryImageKeywords } from "../src/services/landingPageBuilder.js";

const DRY = process.argv.includes("--dry-run");
const onlyIdx = process.argv.indexOf("--only");
const ONLY = onlyIdx !== -1 ? parseInt(process.argv[onlyIdx + 1], 10) : null;
const slugIdx = process.argv.indexOf("--slug");
const SINGLE_SLUG = slugIdx !== -1 ? process.argv[slugIdx + 1] : null;

const PIXABAY_KEY = process.env.PIXABAY_API_KEY;
if (!PIXABAY_KEY) {
  console.error("ERRORE: PIXABAY_API_KEY mancante in .env");
  process.exit(1);
}

const CF_DOMAIN = process.env.CF_DOMAIN;
if (!CF_DOMAIN) {
  console.error("ERRORE: CF_DOMAIN mancante in .env");
  process.exit(1);
}

// Pattern URL rotti: /get/<hash>_1280.jpg su pixabay.com
const BROKEN_PATTERN = /https:\/\/pixabay\.com\/get\/[a-z0-9]+_1280\.(?:jpg|jpeg|png)/gi;

function extractSlug(url) {
  if (!url) return null;
  const m = url.match(/https?:\/\/([^.]+)\./);
  return m ? m[1] : null;
}

async function fetchSiteHtml(slug) {
  const url = `https://${slug}.${CF_DOMAIN}`;
  const res = await axios.get(url, { timeout: 15000, validateStatus: () => true });
  if (res.status !== 200) throw new Error(`fetch ${url} → HTTP ${res.status}`);
  return res.data;
}

async function fetchFreshImages(keywords, count) {
  for (const kw of keywords) {
    try {
      const res = await axios.get("https://pixabay.com/api/", {
        params: {
          key: PIXABAY_KEY,
          q: kw,
          image_type: "photo",
          orientation: "horizontal",
          per_page: Math.max(20, count * 2),
          order: "popular",
          safesearch: "true",
        },
        timeout: 10000,
      });
      const urls = (res.data.hits || [])
        .map(h => h.webformatURL || h.previewURL)
        .filter(Boolean);
      if (urls.length >= count) {
        // Shuffle per varietà tra siti con stessa categoria
        for (let i = urls.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [urls[i], urls[j]] = [urls[j], urls[i]];
        }
        return urls.slice(0, count);
      }
    } catch (e) {
      console.warn(`    pixabay "${kw}" fail: ${e.message}`);
    }
  }
  return [];
}

async function processSite(biz, slug, idx, total) {
  console.log(`\n[${idx}/${total}] ${biz.name} · slug=${slug}`);
  let html;
  try {
    html = await fetchSiteHtml(slug);
  } catch (e) {
    console.warn(`  SKIP: ${e.message}`);
    return { status: "skip", reason: e.message };
  }

  const broken = [...new Set(html.match(BROKEN_PATTERN) || [])];
  if (!broken.length) {
    console.log(`  ✓ nessun URL rotto — skip`);
    return { status: "noop" };
  }
  console.log(`  trovati ${broken.length} URL rotti`);

  const keywords = getCategoryImageKeywords(biz.category, biz.name);
  const fresh = await fetchFreshImages(keywords, broken.length);
  if (fresh.length < broken.length) {
    console.warn(`  PIXABAY: servivano ${broken.length} img, ottenute ${fresh.length}`);
    if (!fresh.length) return { status: "fail", reason: "no pixabay results" };
  }

  let newHtml = html;
  broken.forEach((oldUrl, i) => {
    const replacement = fresh[i % fresh.length];
    // replace ALL occurrences (stesso URL può apparire più volte)
    newHtml = newHtml.split(oldUrl).join(replacement);
  });

  const count = broken.length;
  if (DRY) {
    console.log(`  DRY-RUN: avrei sostituito ${count} URL`);
    return { status: "dry", count };
  }

  await deploySite(slug, newHtml);
  console.log(`  ✓ deployed ${count} nuove img → https://${slug}.${CF_DOMAIN}`);
  return { status: "ok", count };
}

async function main() {
  const db = getDb();
  let rows;
  if (SINGLE_SLUG) {
    rows = db.prepare(`
      SELECT b.id, b.name, b.category, b.area, cr.landing_url
      FROM campaign_results cr
      JOIN businesses b ON b.id = cr.business_id
      WHERE cr.landing_url LIKE ?
    `).all(`%${SINGLE_SLUG}%`);
  } else {
    rows = db.prepare(`
      SELECT b.id, b.name, b.category, b.area, cr.landing_url
      FROM campaign_results cr
      JOIN businesses b ON b.id = cr.business_id
      WHERE cr.landing_url LIKE ? AND cr.landing_url IS NOT NULL
      ORDER BY cr.id DESC
    `).all(`%${CF_DOMAIN}%`);
  }

  if (!rows.length) {
    console.log("Nessun sito da processare.");
    return;
  }

  if (ONLY) rows = rows.slice(0, ONLY);

  console.log(`${rows.length} siti da controllare${DRY ? " (DRY-RUN)" : ""}\n`);

  const stats = { ok: 0, noop: 0, skip: 0, fail: 0, dry: 0, total_swapped: 0 };
  for (let i = 0; i < rows.length; i++) {
    const biz = rows[i];
    const slug = extractSlug(biz.landing_url);
    if (!slug) {
      console.warn(`[${i+1}] ${biz.name} · slug non estratto da ${biz.landing_url}`);
      stats.skip++;
      continue;
    }
    try {
      const r = await processSite(biz, slug, i + 1, rows.length);
      stats[r.status] = (stats[r.status] || 0) + 1;
      if (r.count) stats.total_swapped += r.count;
    } catch (e) {
      console.error(`  ERRORE: ${e.message}`);
      stats.fail++;
    }
    // rate limit soft verso Pixabay
    await new Promise(r => setTimeout(r, 300));
  }

  console.log("\n=== REPORT ===");
  console.log(stats);
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
