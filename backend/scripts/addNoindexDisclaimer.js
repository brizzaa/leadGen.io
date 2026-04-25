// Patch in-place dei 661 siti demo deployati su Cloudflare R2:
//   1. Aggiunge <meta name="robots" content="noindex,nofollow,noarchive"> in <head>
//   2. Aggiunge <meta name="googlebot" content="noindex,nofollow"> per ridondanza
//   3. Inserisce un disclaimer visibile in fondo al <body>
//
// Motivazione: i siti generati riportano nome, indirizzo, telefono ed email del
// business reale senza il suo consenso. Indicizzati su Google sono esposti a
// segnalazioni privacy (Garante) e violazioni dei diritti di marchio del terzo.
// La patch li rende invisibili ai motori di ricerca e dichiara esplicitamente
// la natura dimostrativa della pagina.
//
// Uso:
//   node scripts/addNoindexDisclaimer.js --dry-run
//   node scripts/addNoindexDisclaimer.js --slug bed-and-breakfast-la-corte-a-ferrara-izyj
//   node scripts/addNoindexDisclaimer.js                # tutti i siti

import "dotenv/config";
import axios from "axios";
import { getDb } from "../src/config/db.js";
import { deploySite } from "../src/services/cloudflareDeployer.js";

const DRY = process.argv.includes("--dry-run");
const slugIdx = process.argv.indexOf("--slug");
const SINGLE_SLUG = slugIdx !== -1 ? process.argv[slugIdx + 1] : null;

const CF_DOMAIN = process.env.CF_DOMAIN;
if (!CF_DOMAIN) { console.error("ERRORE: CF_DOMAIN mancante in .env"); process.exit(1); }

const ROBOTS_META = `<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="googlebot" content="noindex,nofollow">`;

const DISCLAIMER_HTML = `
<div style="position:fixed;bottom:0;left:0;right:0;background:#fffbe6;border-top:1px solid #d4a72c;padding:10px 16px;font:12px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#8b5a00;text-align:center;z-index:99999">
<strong>Sito demo dimostrativo</strong> — generato a scopo di valutazione, non affiliato con l'attività menzionata. Per richiederne la rimozione: <a href="mailto:l.brizzante@leader-gen.com" style="color:#8b5a00;text-decoration:underline">l.brizzante@leader-gen.com</a>.
</div>`;

const MARKER_META = "robots\" content=\"noindex"; // se già presente skippa
const MARKER_DISCLAIMER = "Sito demo dimostrativo";

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

function patchHtml(html) {
  let patched = html;
  let metaInserted = false;
  let discInserted = false;

  // 1. Inserisci meta robots in <head> se non presente
  if (!patched.includes(MARKER_META)) {
    if (/<head[^>]*>/i.test(patched)) {
      patched = patched.replace(/<head([^>]*)>/i, `<head$1>\n${ROBOTS_META}`);
      metaInserted = true;
    } else if (/<html[^>]*>/i.test(patched)) {
      // Edge case: HTML senza <head> esplicito
      patched = patched.replace(/<html([^>]*)>/i, `<html$1>\n<head>${ROBOTS_META}</head>`);
      metaInserted = true;
    }
  }

  // 2. Inserisci disclaimer prima di </body>
  if (!patched.includes(MARKER_DISCLAIMER)) {
    if (/<\/body>/i.test(patched)) {
      patched = patched.replace(/<\/body>/i, `${DISCLAIMER_HTML}\n</body>`);
      discInserted = true;
    } else {
      patched = patched + DISCLAIMER_HTML;
      discInserted = true;
    }
  }

  return { patched, metaInserted, discInserted };
}

async function processSite(biz, slug, idx, total) {
  let html;
  try {
    html = await fetchSiteHtml(slug);
  } catch (e) {
    console.warn(`[${idx}/${total}] #${biz.id} ${biz.name}: SKIP — ${e.message}`);
    return { status: "skip" };
  }

  const { patched, metaInserted, discInserted } = patchHtml(html);
  if (!metaInserted && !discInserted) {
    console.log(`[${idx}/${total}] #${String(biz.id).padStart(4)} ${biz.name.slice(0,40).padEnd(40)} → già patchato`);
    return { status: "noop" };
  }

  if (DRY) {
    console.log(`[${idx}/${total}] #${biz.id} ${biz.name.slice(0,40)} → DRY: meta=${metaInserted} disc=${discInserted}`);
    return { status: "dry" };
  }

  await deploySite(slug, patched);
  const labels = [metaInserted ? "noindex" : null, discInserted ? "disclaimer" : null].filter(Boolean).join("+");
  console.log(`[${idx}/${total}] #${String(biz.id).padStart(4)} ${biz.name.slice(0,40).padEnd(40)} → ✓ ${labels}`);
  return { status: "ok" };
}

async function main() {
  const db = getDb();
  let rows;
  if (SINGLE_SLUG) {
    rows = db.prepare(`
      SELECT b.id, b.name, cr.landing_url FROM campaign_results cr
      JOIN businesses b ON b.id = cr.business_id
      WHERE cr.landing_url LIKE ?
    `).all(`%${SINGLE_SLUG}%`);
  } else {
    rows = db.prepare(`
      SELECT b.id, b.name, cr.landing_url FROM campaign_results cr
      JOIN businesses b ON b.id = cr.business_id
      WHERE cr.landing_url LIKE ? AND cr.landing_url IS NOT NULL
      ORDER BY cr.id DESC
    `).all(`%${CF_DOMAIN}%`);
  }

  console.log(`${rows.length} siti da patchare${DRY ? " (DRY-RUN)" : ""}\n`);
  if (!rows.length) { console.log("Niente da fare."); return; }

  const stats = { ok: 0, noop: 0, skip: 0, dry: 0, fail: 0 };
  for (let i = 0; i < rows.length; i++) {
    const biz = rows[i];
    const slug = extractSlug(biz.landing_url);
    if (!slug) { stats.skip++; continue; }
    try {
      const r = await processSite(biz, slug, i + 1, rows.length);
      stats[r.status] = (stats[r.status] || 0) + 1;
    } catch (e) {
      console.error(`  ERRORE: ${e.message}`);
      stats.fail++;
    }
    await new Promise(r => setTimeout(r, 200)); // rate limit gentile
  }

  console.log("\n=== REPORT ===");
  console.log(stats);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
