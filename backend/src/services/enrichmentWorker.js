/**
 * Enrichment Worker
 *
 * Anti-ban stack:
 *  - DDG scan:      impit (Chrome TLS/HTTP2 impersonation) — avoids Node.js TLS fingerprint blocks
 *  - Contact scrape: axios + axios-retry (Retry-After, exponential backoff)
 *  - JS-heavy sites: rebrowser-playwright fallback (CDP patches, hides automation signals)
 *  - Concurrency:   token bucket — max 3 contact scrapes in parallel, DDG sequential
 *  - Delays:        adaptive jitter 1.5-4s DDG, 0.5-2s contact; doubles after errors
 */

import { Impit, Browser } from "impit";
import axios from "axios";
import axiosRetry, { exponentialDelay, isNetworkOrIdempotentRequestError } from "axios-retry";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { getDb } from "../config/db.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 20;
const INTERVAL_MS = 5 * 60 * 1000; // 5 min

const DDG_SKIP_DOMAINS = [
  "tripadvisor.", "paginegialle.", "google.", "thefork.", "yelp.",
  "booking.", "trustpilot.", "virgilio.", "tuttocittà.", "misterimpact.",
  "infobel.", "hotfrog.", "facebook.", "instagram.", "linkedin.",
];

const CONTACT_SKIP_DOMAINS = [
  "facebook.com", "instagram.com", "tripadvisor.", "paginegialle.",
  "yelp.", "booking.", "trustpilot.", "linkedin.",
];

// User-agent pool — rotated randomly
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function jitter(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((r) => setTimeout(r, ms));
}

// Token bucket — shared across contact scrapes to stay ≤ 3 concurrent
const contactLimit = pLimit(3);

// ─── Proxy rotation per axios (enrichment worker) ────────────────────────────

const ENRICHMENT_PROXIES = (process.env.ENRICHMENT_PROXIES || "")
  .split(",").map((p) => p.trim()).filter(Boolean);
let proxyIndex = 0;

function nextProxy() {
  if (ENRICHMENT_PROXIES.length === 0) return {};
  const url = ENRICHMENT_PROXIES[proxyIndex % ENRICHMENT_PROXIES.length];
  proxyIndex++;
  try {
    const u = new URL(url);
    return { proxy: { protocol: u.protocol.replace(":", ""), host: u.hostname, port: parseInt(u.port), auth: { username: u.username, password: u.password } } };
  } catch { return {}; }
}

// ─── axios instance for contact scraping (with retry) ─────────────────────────

const contactAxios = axios.create({ timeout: 12000, maxRedirects: 5 });
axiosRetry(contactAxios, {
  retries: 2,
  retryDelay: (count, err) => {
    // Respect Retry-After header if present, else exponential backoff
    const retryAfter = err?.response?.headers?.["retry-after"];
    if (retryAfter) return parseInt(retryAfter, 10) * 1000;
    return exponentialDelay(count) + Math.random() * 500;
  },
  retryCondition: (err) =>
    isNetworkOrIdempotentRequestError(err) || err?.response?.status === 429,
});

// ─── DDG scan via impit (Chrome TLS impersonation) ────────────────────────────

// Track consecutive DDG errors to apply adaptive back-off
let ddgConsecErrors = 0;

async function ddgFindWebsite(name, area) {
  // Adaptive base delay: doubles up to 15s after consecutive errors
  const baseDelay = Math.min(1500 * Math.pow(1.5, ddgConsecErrors), 15000);
  await jitter(baseDelay, baseDelay + 2000);

  try {
    const client = new Impit({ browser: Browser.Chrome });
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${name} ${area}`)}`;
    const response = await client.fetch(url, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Referer": "https://duckduckgo.com/",
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        ddgConsecErrors++;
        console.log(`[enrichment/ddg] 429 — back-off level ${ddgConsecErrors}`);
      }
      return null;
    }

    ddgConsecErrors = Math.max(0, ddgConsecErrors - 1); // reduce on success

    const html = await response.text();
    const $ = cheerio.load(html);
    let foundUrl = null;

    $("a.result__url, .result__url, .result__a").each((_, el) => {
      if (foundUrl) return;
      const href = $(el).attr("href") || $(el).text();
      if (!href) return;
      if (DDG_SKIP_DOMAINS.some((d) => href.toLowerCase().includes(d))) return;

      try {
        const u = new URL(href);
        if (u.hostname.includes("duckduckgo.com")) {
          const uddg = u.searchParams.get("uddg");
          if (uddg) { foundUrl = decodeURIComponent(uddg); return; }
        }
      } catch { /* skip */ }
      if (href.startsWith("http")) foundUrl = href;
    });

    return foundUrl;
  } catch (err) {
    ddgConsecErrors++;
    console.warn(`[enrichment/ddg] Error for "${name}": ${err.message}`);
    return null;
  }
}

// ─── Contact scrape (axios + cheerio, rebrowser-playwright fallback) ──────────

const EXTRA_PATHS = ["/contatti", "/contact", "/chi-siamo", "/about", "/info", "/privacy", "/footer"];
const VAT_REGEX = /(?:P\.?\s*IVA|Partita\s+IVA|VAT(?:\s+N[o.]?)?|C\.?\s*F\.?|IT)\s*[:\s]*([0-9]{11})\b/gi;
const VAT_BARE_REGEX = /\b([0-9]{11})\b/g;

function isValidItalianVat(v) {
  if (!/^\d{11}$/.test(v) || /^(\d)\1{10}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const d = parseInt(v[i], 10);
    if (i % 2 === 0) sum += d;
    else { const x = d * 2; sum += x > 9 ? x - 9 : x; }
  }
  return (10 - (sum % 10)) % 10 === parseInt(v[10], 10);
}

function extractFromHtml($, html) {
  // cheerio $("body").text() incolla il testo di elementi inline senza spazio
  // (es. "info@foo.itTel 0425..." invece di "info@foo.it Tel 0425...").
  // Inseriamo uno spazio ai boundary case/digit→lettera per evitare che il regex
  // email catturi il "Tel" / "Cell" / "Fax" come parte del TLD.
  const rawText = $("body").text();
  const text = rawText
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")   // itTel → it Tel
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")     // Tel0425 → Tel 0425
    // Parole-label italiane spesso concatenate all'email (tutto minuscolo).
    // Matcha solo se seguite da local-part email → evita di spaccare "info@foo.it".
    .replace(/\b(contattaci|cellulare|telefono|scrivici|e-mail|email|mail|cell|tel|fax)([a-z0-9_.+-]+@)/gi, "$1 $2");

  let email = null;
  $('a[href^="mailto:"]').each((_, el) => {
    if (email) return;
    const addr = $(el).attr("href").replace("mailto:", "").split("?")[0].trim().toLowerCase();
    if (addr?.includes("@") && !addr.includes("@example.") && !addr.includes("@sentry.") && !addr.includes("@wixpress."))
      email = addr;
  });
  if (!email) {
    for (const m of (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])) {
      const low = m.toLowerCase();
      if (!low.includes("@example.") && !low.includes("@sentry.") && !low.includes("@wixpress.") && !low.endsWith(".js")) {
        email = low; break;
      }
    }
  }

  let phone = null;
  $('a[href^="tel:"]').each((_, el) => {
    if (phone) return;
    phone = $(el).attr("href").replace("tel:", "").trim();
  });
  if (!phone) {
    for (const m of (text.match(/(?:\+39\s?)?(?:0\d{1,4}[\s.-]?\d{4,8}|3[0-9]{2}[\s.-]?\d{6,7})/g) || [])) {
      const digits = m.replace(/\D/g, "");
      if (digits.length >= 8 && digits.length <= 13) { phone = m.trim(); break; }
    }
  }

  let vat = null;
  VAT_REGEX.lastIndex = 0;
  let m;
  while ((m = VAT_REGEX.exec(text)) !== null) {
    if (isValidItalianVat(m[1])) { vat = m[1]; break; }
  }
  if (!vat) {
    const footerText = ($("footer").text() || "") + ($('[class*="footer"]').text() || "");
    VAT_BARE_REGEX.lastIndex = 0;
    while ((m = VAT_BARE_REGEX.exec(footerText || text)) !== null) {
      if (isValidItalianVat(m[1])) { vat = m[1]; break; }
    }
  }

  let facebook_url = null;
  let instagram_url = null;
  $('a[href*="facebook.com/"]').each((_, el) => {
    if (facebook_url) return;
    const href = $(el).attr("href");
    if (href && !href.includes("sharer") && !href.includes("share?")) facebook_url = href.split("?")[0];
  });
  $('a[href*="instagram.com/"]').each((_, el) => {
    if (instagram_url) return;
    const href = $(el).attr("href");
    if (href && !href.includes("share")) instagram_url = href.split("?")[0];
  });

  return { email, phone, vat, facebook_url, instagram_url };
}

async function scrapeContactsAxios(baseUrl) {
  const pages = [baseUrl, ...EXTRA_PATHS.map((p) => baseUrl.replace(/\/$/, "") + p)];
  let result = { email: null, phone: null, vat: null, facebook_url: null, instagram_url: null };

  for (const pageUrl of pages) {
    try {
      const resp = await contactAxios.get(pageUrl, { headers: { "User-Agent": randomUA() }, ...nextProxy() });
      const $ = cheerio.load(resp.data);
      $("script, style, noscript").remove();
      const found = extractFromHtml($, resp.data);
      if (!result.email && found.email) result.email = found.email;
      if (!result.phone && found.phone) result.phone = found.phone;
      if (!result.vat && found.vat) result.vat = found.vat;
      if (!result.facebook_url && found.facebook_url) result.facebook_url = found.facebook_url;
      if (!result.instagram_url && found.instagram_url) result.instagram_url = found.instagram_url;
      if (result.email && result.phone && result.vat && result.facebook_url && result.instagram_url) break;
    } catch { /* pagina non disponibile, prossima */ }
  }

  return result;
}

// Playwright fallback for JS-heavy sites (used only when axios returns no body or blocked)
let playwrightBrowser = null;

async function getPlaywrightBrowser() {
  if (playwrightBrowser) return playwrightBrowser;
  const { chromium } = await import("rebrowser-playwright");
  playwrightBrowser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });
  return playwrightBrowser;
}

async function scrapeContactsPlaywright(baseUrl) {
  const browser = await getPlaywrightBrowser();
  const context = await browser.newContext({
    userAgent: randomUA(),
    viewport: { width: 1440, height: 900 },
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
  const result = { email: null, phone: null, vat: null, facebook_url: null, instagram_url: null };
  const pages = [baseUrl, ...EXTRA_PATHS.map((p) => baseUrl.replace(/\/$/, "") + p)];

  const page = await context.newPage();
  try {
    for (const pageUrl of pages) {
      try {
        await page.goto(pageUrl, { timeout: 20000, waitUntil: "domcontentloaded" });
        // Attesa idratazione SPA (React/Vue/etc): domcontentloaded non basta,
        // il JS deve montare il DOM visibile prima di estrarre.
        await page.waitForTimeout(2000);
        const html = await page.content();
        const $ = cheerio.load(html);
        $("script, style, noscript").remove();
        const found = extractFromHtml($, html);
        if (!result.email && found.email) result.email = found.email;
        if (!result.phone && found.phone) result.phone = found.phone;
        if (!result.vat && found.vat) result.vat = found.vat;
        if (!result.facebook_url && found.facebook_url) result.facebook_url = found.facebook_url;
        if (!result.instagram_url && found.instagram_url) result.instagram_url = found.instagram_url;
        if (result.email && result.phone && result.vat && result.facebook_url && result.instagram_url) break;
      } catch { /* pagina non disponibile */ }
    }
  } finally {
    await page.close();
    await context.close();
  }
  return result;
}

async function scrapeContacts(websiteUrl) {
  if (!websiteUrl) return { email: null, phone: null };
  const lower = websiteUrl.toLowerCase();
  if (CONTACT_SKIP_DOMAINS.some((d) => lower.includes(d))) return { email: null, phone: null };

  let url = websiteUrl;
  if (!url.startsWith("http")) url = "https://" + url;

  await jitter(500, 2000); // polite delay per site

  // Try axios first (fast, no browser overhead)
  try {
    const result = await scrapeContactsAxios(url);
    if (result.email || result.phone) return result;
    // No contacts found via axios → try Playwright (might be JS-rendered)
  } catch (err) {
    if (err?.response?.status === 403 || err?.response?.status === 401) {
      // Hard block — Playwright probably won't help either
      return { email: null, phone: null };
    }
    // Network error / timeout → try Playwright
  }

  // Playwright fallback
  try {
    return await scrapeContactsPlaywright(url);
  } catch {
    return { email: null, phone: null };
  }
}

// ─── Core batch processor ─────────────────────────────────────────────────────

export async function runEnrichmentBatch(db, { ids = null } = {}) {
  const idClause = ids?.length ? `AND id IN (${ids.map(() => "?").join(",")})` : "";
  const idParams = ids?.length ? ids : [];

  // ── Website scan (DDG, sequential with adaptive delays) ──
  const websitePending = db
    .prepare(`SELECT id, name, area FROM businesses WHERE website_status = 'pending' ${idClause} ORDER BY created_at DESC LIMIT ${BATCH_SIZE}`)
    .all(...idParams);

  let websiteProcessed = 0;
  for (const biz of websitePending) {
    const found = await ddgFindWebsite(biz.name, biz.area);
    if (found) {
      db.prepare(
        "UPDATE businesses SET website = ?, website_status = 'done', enriched_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(found, biz.id);
      // Now eligible for contact scrape
      db.prepare(
        "UPDATE businesses SET contact_status = 'pending' WHERE id = ? AND (contact_status IS NULL OR contact_status = 'failed')"
      ).run(biz.id);
      console.log(`[enrichment/ddg] ✓ ${biz.name} → ${found}`);
    } else {
      db.prepare(
        "UPDATE businesses SET website_status = 'failed', enriched_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(biz.id);
    }
    websiteProcessed++;
  }

  // ── Contact scrape (parallel, concurrency 3) ──
  const contactPending = db
    .prepare(`SELECT id, name, area, website, email, phone, vat_number, facebook_url, instagram_url FROM businesses WHERE contact_status = 'pending' AND website IS NOT NULL ${idClause} ORDER BY created_at DESC LIMIT ${BATCH_SIZE}`)
    .all(...idParams);

  let contactProcessed = 0;

  await Promise.allSettled(
    contactPending.map((biz) =>
      contactLimit(async () => {
        const c = await scrapeContacts(biz.website);

        const setClauses = [];
        const params = [];
        if (c.email        && !biz.email)        { setClauses.push("email = ?");        params.push(c.email); }
        if (c.phone        && !biz.phone)        { setClauses.push("phone = ?");        params.push(c.phone); }
        if (c.vat          && !biz.vat_number)   { setClauses.push("vat_number = ?");   params.push(c.vat); }
        if (c.facebook_url && !biz.facebook_url) { setClauses.push("facebook_url = ?"); params.push(c.facebook_url); }
        if (c.instagram_url && !biz.instagram_url) { setClauses.push("instagram_url = ?"); params.push(c.instagram_url); }

        const found = c.email || c.phone || c.vat || c.facebook_url || c.instagram_url;
        setClauses.push("contact_status = ?", "enriched_at = CURRENT_TIMESTAMP");
        params.push(found ? "done" : "failed", biz.id);

        db.prepare(`UPDATE businesses SET ${setClauses.join(", ")} WHERE id = ?`).run(...params);

        if (found) {
          console.log(`[enrichment/contact] ✓ ${biz.name} → email:${!!c.email} tel:${!!c.phone} piva:${!!c.vat} fb:${!!c.facebook_url} ig:${!!c.instagram_url}`);
        }
        contactProcessed++;
      })
    )
  );

  return { websiteProcessed, contactProcessed };
}

// ─── Manual retrigger ─────────────────────────────────────────────────────────

export async function triggerEnrichment(db, { ids = null, step = "all" } = {}) {
  if (ids?.length) {
    if (step === "website" || step === "all") {
      db.prepare(`UPDATE businesses SET website_status = 'pending' WHERE id IN (${ids.map(() => "?").join(",")}) AND website IS NULL`).run(...ids);
    }
    if (step === "contact" || step === "all") {
      db.prepare(`UPDATE businesses SET contact_status = 'pending' WHERE id IN (${ids.map(() => "?").join(",")}) AND website IS NOT NULL`).run(...ids);
    }
  }

  return runEnrichmentBatch(db, { ids });
}

// ─── Cron worker ──────────────────────────────────────────────────────────────

let workerTimer = null;

export function startEnrichmentWorker() {
  if (workerTimer) return;

  const tick = async () => {
    const db = getDb();
    const pendingW = db.prepare("SELECT COUNT(*) as n FROM businesses WHERE website_status = 'pending'").get().n;
    const pendingC = db.prepare("SELECT COUNT(*) as n FROM businesses WHERE contact_status = 'pending' AND website IS NOT NULL").get().n;

    if (pendingW + pendingC === 0) return;

    console.log(`[enrichment] Tick — ${pendingW} website pending, ${pendingC} contact pending`);
    try {
      const { websiteProcessed, contactProcessed } = await runEnrichmentBatch(db);
      console.log(`[enrichment] Done — website: ${websiteProcessed}, contact: ${contactProcessed}`);
    } catch (err) {
      console.error("[enrichment] Batch error:", err.message);
    }
  };

  // First run 60s after startup, then every 5 min
  setTimeout(tick, 60_000);
  workerTimer = setInterval(tick, INTERVAL_MS);
  console.log("[enrichment] Worker started (every 5 min, first tick in 60s).");
}

// Cleanup Playwright on process exit
process.on("exit", () => { playwrightBrowser?.close().catch(() => {}); });
process.on("SIGTERM", () => { playwrightBrowser?.close().then(() => process.exit(0)).catch(() => process.exit(1)); });
