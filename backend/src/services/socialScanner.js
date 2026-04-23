import axios from "axios";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const IG_SESSION_FILE = join(ROOT, "../../ig-session.json");
const FB_SESSION_FILE = join(ROOT, "../../fb-session.json");

/** Random delay to appear human */
function randomDelay(min = 2000, max = 5000) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// STEP 1: Cerca link social direttamente nel sito web
// (veloce, niente CAPTCHA, niente browser)
// ============================================================

/**
 * Fetches a website and looks for Facebook/Instagram links in the HTML.
 * Most businesses have social links in the footer/header.
 */
async function extractSocialsFromWebsite(websiteUrl) {
  if (!websiteUrl) return null;

  // Skip if the website itself IS facebook/instagram
  const lower = websiteUrl.toLowerCase();
  if (lower.includes("facebook.com") || lower.includes("instagram.com")) {
    return null;
  }

  try {
    let url = websiteUrl;
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);
    let facebook_url = null;
    let instagram_url = null;

    // Search all <a> tags for Facebook and Instagram links
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const h = href.toLowerCase();

      // Facebook
      if (
        !facebook_url &&
        h.includes("facebook.com") &&
        !h.includes("/sharer") &&
        !h.includes("/share?") &&
        !h.includes("/dialog") &&
        !h.includes("facebook.com/tr?") && // exclude tracking pixel
        h !== "https://www.facebook.com/" &&
        h !== "https://facebook.com/"
      ) {
        facebook_url = href.split("?")[0]; // Remove query params
      }

      // Instagram
      if (
        !instagram_url &&
        h.includes("instagram.com") &&
        !h.includes("/share") &&
        h !== "https://www.instagram.com/" &&
        h !== "https://instagram.com/"
      ) {
        instagram_url = href.split("?")[0];
      }
    });

    if (facebook_url || instagram_url) {
      return { facebook_url, instagram_url };
    }
    return null;
  } catch (e) {
    console.log(
      `[social-scan] Errore accesso sito web ${websiteUrl}: ${e.message}`,
    );
    return null;
  }
}

// ============================================================
// STEP 2 (fallback): Cerca su DuckDuckGo con browser visibile
// ============================================================

/**
 * Waits for CAPTCHA to be solved if present.
 */
async function waitForCaptcha(page, timeout = 120000) {
  const isCaptcha = await page
    .locator(".anomaly-modal__modal, #challenge-form")
    .first()
    .isVisible({ timeout: 1500 })
    .catch(() => false);

  if (isCaptcha) {
    console.log(
      "[social-scan] ⚠️  CAPTCHA rilevato! Risolvilo nel browser, poi continuo automaticamente...",
    );
    try {
      await page.waitForSelector(".result", { timeout });
      console.log("[social-scan] ✅ CAPTCHA risolto! Continuo...");
      await page.waitForTimeout(1000);
    } catch {
      console.log("[social-scan] ⏰ Timeout CAPTCHA — salto questa ricerca.");
      return false;
    }
  }
  return true;
}

/**
 * Scans ALL DuckDuckGo results from a single search and picks out
 * any facebook.com and instagram.com links.
 */
async function extractAllSocialsFromResults(page) {
  return page.evaluate(() => {
    let facebook_url = null;
    let instagram_url = null;
    let social_last_active = null;

    const blockedFb = ["https://www.facebook.com/", "https://facebook.com/"];
    const blockedIg = ["https://www.instagram.com/", "https://instagram.com/"];
    const blockedPaths = [
      "/login",
      "/help",
      "/explore",
      "/sharer",
      "/share?",
      "/dialog",
    ];

    const results = Array.from(document.querySelectorAll(".result"));
    for (const r of results) {
      const linkEl =
        r.querySelector("a.result__a") || r.querySelector("a.result__url");
      const snippetEl = r.querySelector(".result__snippet");
      if (!linkEl) continue;

      const href = linkEl.href || linkEl.textContent || "";
      let cleanHref = href;
      try {
        const urlObj = new URL(href);
        if (urlObj.hostname.includes("duckduckgo.com")) {
          const uddg = urlObj.searchParams.get("uddg");
          if (uddg) cleanHref = decodeURIComponent(uddg);
        }
      } catch {
        /* ignore */
      }

      const l = cleanHref.toLowerCase();
      if (blockedPaths.some((p) => l.includes(p))) continue;

      // Check for Facebook
      if (
        !facebook_url &&
        l.includes("facebook.com") &&
        !blockedFb.includes(l)
      ) {
        facebook_url = cleanHref.split("?")[0];
        // Try to extract date from snippet
        const snippet = snippetEl ? snippetEl.textContent.trim() : "";
        const dateMatch =
          snippet.match(
            /(\d+)\s*(min|ora|ore|giorno|giorni|settimana|settimane|mese|mesi|anno|anni)\s*fa/i,
          ) ||
          snippet.match(
            /(\d{1,2})\s*(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*\.?\s*(\d{4})?/i,
          );
        if (dateMatch && !social_last_active) {
          social_last_active = dateMatch[0];
        }
      }

      // Check for Instagram
      if (
        !instagram_url &&
        l.includes("instagram.com") &&
        !blockedIg.includes(l)
      ) {
        instagram_url = cleanHref.split("?")[0];
        const snippet = snippetEl ? snippetEl.textContent.trim() : "";
        const dateMatch =
          snippet.match(
            /(\d+)\s*(min|ora|ore|giorno|giorni|settimana|settimane|mese|mesi|anno|anni)\s*fa/i,
          ) ||
          snippet.match(
            /(\d{1,2})\s*(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*\.?\s*(\d{4})?/i,
          );
        if (dateMatch && !social_last_active) {
          social_last_active = dateMatch[0];
        }
      }

      // Stop early if we found both
      if (facebook_url && instagram_url) break;
    }

    return { facebook_url, instagram_url, social_last_active };
  });
}

async function searchSocialViaDDG(name, area) {
  const launchOptions = {
    headless: false,
    args: ["--no-sandbox"],
    slowMo: 50,
  };
  if (process.env.PROXY_URL) {
    launchOptions.proxy = { server: process.env.PROXY_URL };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    locale: "it-IT",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    // UNA sola ricerca generica — troviamo sia FB che IG in un colpo solo!
    const query = `"${name}" ${area} facebook instagram`;
    console.log(`[social-scan] DDG ricerca: ${query}`);
    await page.goto(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { waitUntil: "load", timeout: 15000 },
    );

    const ok = await waitForCaptcha(page);
    if (!ok) {
      return {
        facebook_url: null,
        instagram_url: null,
        social_last_active: null,
      };
    }

    const result = await extractAllSocialsFromResults(page);

    if (result.facebook_url) {
      console.log(`[social-scan] 👍 FB trovato: ${result.facebook_url}`);
    }
    if (result.instagram_url) {
      console.log(`[social-scan] 📸 IG trovato: ${result.instagram_url}`);
    }
    if (!result.facebook_url && !result.instagram_url) {
      console.log("[social-scan] Nessun social trovato su DDG.");
    }

    return result;
  } catch (e) {
    console.log(`[social-scan] Errore DDG: ${e.message}`);
    return {
      facebook_url: null,
      instagram_url: null,
      social_last_active: null,
    };
  } finally {
    await browser.close();
  }
}

// ============================================================
// CONTACT EXTRACTION HELPERS
// ============================================================

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+39\s?)?(?:0\d{1,4}[\s\-]?\d{4,8}|3\d{2}[\s\-]?\d{6,7})/g;
const EMAIL_BLACKLIST = ["example.com", "sentry.io", "instagram.com", "facebook.com", "google.com", "apple.com", "w3.org", "schema.org", "duckduckgo.com", "wixpress.com", "squarespace.com", "wordpress.com", "wix.com", "amazonaws.com", "cloudflare.com"];

function filterEmails(matches) {
  return (matches || []).filter(e => !EMAIL_BLACKLIST.some(b => e.toLowerCase().includes(b)));
}

function filterPhones(matches) {
  return (matches || []).filter(p => p.replace(/\D/g, "").length >= 9);
}

/**
 * Estrae email, telefono, IG, FB da un sito web.
 * Integra il vecchio extractSocialsFromWebsite aggiungendo email/tel.
 */
export async function extractContactsFromWebsite(websiteUrl) {
  if (!websiteUrl) return {};
  const lower = websiteUrl.toLowerCase();
  if (lower.includes("facebook.com") || lower.includes("instagram.com")) return {};
  try {
    let url = websiteUrl.startsWith("http") ? websiteUrl : "https://" + websiteUrl;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36" },
      maxRedirects: 5,
    });
    const $ = cheerio.load(response.data);
    const result = {};

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const h = href.toLowerCase();
      if (!result.facebook_url && h.includes("facebook.com") && !h.includes("/sharer") && !h.includes("/dialog") && h !== "https://www.facebook.com/") result.facebook_url = href.split("?")[0];
      if (!result.instagram_url && h.includes("instagram.com") && !h.includes("/share") && h !== "https://www.instagram.com/") result.instagram_url = href.split("?")[0];
      if (!result.email && h.startsWith("mailto:")) result.email = href.replace("mailto:", "").split("?")[0].trim().toLowerCase();
      if (!result.phone && h.startsWith("tel:")) result.phone = href.replace("tel:", "").trim();
    });

    // Fallback: cerca email nel testo del body
    if (!result.email) {
      const bodyText = $("body").text();
      const emails = filterEmails(bodyText.match(EMAIL_RE));
      if (emails[0]) result.email = emails[0].toLowerCase();
    }
    if (!result.phone) {
      const bodyText = $("body").text();
      const phones = filterPhones(bodyText.match(PHONE_RE));
      if (phones[0]) result.phone = phones[0].trim();
    }

    return result;
  } catch { return {}; }
}

/**
 * Estrae email e telefono da una pagina Facebook.
 * - Se fb-session.json esiste: usa Playwright con sessione loggata (accesso alla sezione Info)
 * - Altrimenti: HTTP puro su m.facebook.com (solo pagine pubbliche)
 * Per generare fb-session.json: node scripts/facebookLogin.js
 */
export async function extractContactsFromFacebook(fbUrl) {
  if (!fbUrl) return {};
  try {
    if (existsSync(FB_SESSION_FILE)) {
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      const context = await browser.newContext({ storageState: FB_SESSION_FILE, locale: "it-IT" });
      const page = await context.newPage();
      try {
        // Vai alla tab "Info" della pagina FB (sezione contatti)
        const infoUrl = fbUrl.replace(/\/$/, "") + "/about";
        await page.goto(infoUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.waitForTimeout(2000);
        const text = await page.locator("body").innerText().catch(() => "");
        const result = {};
        const emails = filterEmails(text.match(EMAIL_RE));
        if (emails[0]) result.email = emails[0].toLowerCase();
        const phones = filterPhones(text.match(PHONE_RE));
        if (phones[0]) result.phone = phones[0].trim();
        return result;
      } finally { await browser.close(); }
    }

    // Fallback HTTP puro (solo pagine pubbliche non protette da login)
    const mUrl = fbUrl.replace(/^https?:\/\/(www\.)?/, "https://m.facebook.com/").replace("m.facebook.com/m.facebook.com", "m.facebook.com");
    const response = await axios.get(mUrl, {
      timeout: 12000,
      headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" },
      maxRedirects: 5,
    });
    const $ = cheerio.load(response.data);
    const result = {};
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const h = href.toLowerCase();
      if (!result.email && h.startsWith("mailto:")) result.email = href.replace("mailto:", "").split("?")[0].trim().toLowerCase();
      if (!result.phone && h.startsWith("tel:")) result.phone = href.replace("tel:", "").trim();
    });
    if (!result.email) {
      const emails = filterEmails($("body").text().match(EMAIL_RE));
      if (emails[0]) result.email = emails[0].toLowerCase();
    }
    if (!result.phone) {
      const phones = filterPhones($("body").text().match(PHONE_RE));
      if (phones[0]) result.phone = phones[0].trim();
    }
    return result;
  } catch { return {}; }
}

/**
 * Estrae email e telefono dalla bio Instagram.
 * - Se ig-session.json esiste: usa instagram-private-api (no browser, veloce)
 * - Altrimenti: fallback DDG snippet (limitato)
 * Per generare ig-session.json: node scripts/instagramLogin.js
 */
export async function extractContactsFromInstagram(igUrl) {
  if (!igUrl) return {};
  try {
    const username = igUrl.replace(/\/$/, "").split("/").pop();
    if (!username) return {};

    if (existsSync(IG_SESSION_FILE)) {
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      const context = await browser.newContext({ storageState: IG_SESSION_FILE, locale: "it-IT" });
      const page = await context.newPage();
      try {
        await page.goto(igUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.waitForTimeout(2500);
        // Prendi tutto il testo della pagina — bio è in mezzo al body text
        const bio = await page.evaluate(() => {
          // Skip se profilo non disponibile
          if (document.body.innerText.includes("non è disponibile")) return "";
          return document.body.innerText.slice(0, 3000);
        });
        const result = {};
        const emails = filterEmails(bio.match(EMAIL_RE));
        if (emails[0]) result.email = emails[0].toLowerCase();
        const phones = filterPhones(bio.match(PHONE_RE));
        if (phones[0]) result.phone = phones[0].trim();
        return result;
      } finally { await browser.close(); }
    }

    // Fallback: DDG snippet (limitato, spesso vuoto)
    const query = `site:instagram.com "${username}" email`;
    const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36" },
    });
    const $ = cheerio.load(res.data);
    const emails = filterEmails($("body").text().match(EMAIL_RE));
    return emails[0] ? { email: emails[0].toLowerCase() } : {};
  } catch { return {}; }
}

/**
 * Cerca email di un business via html.duckduckgo.com (puro HTTP, no browser).
 */
export async function searchEmailViaDDG(name, area) {
  try {
    const query = `"${name}" ${area || ""} email contatti`;
    const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36" },
    });
    const $ = cheerio.load(res.data);
    // Cerca email negli snippet dei risultati
    const snippets = $(".result__snippet, .result__body").map((_, el) => $(el).text()).get().join(" ");
    const emails = filterEmails(snippets.match(EMAIL_RE));
    return emails[0]?.toLowerCase() || null;
  } catch { return null; }
}

/**
 * Cerca profili IG/FB via html.duckduckgo.com (puro HTTP, no browser).
 * Rimpiazza searchSocialViaDDG per l'enrichment veloce nella campagna.
 */
export async function searchSocialsViaDDGHttp(name, area) {
  try {
    const query = `"${name}" ${area || ""} facebook instagram`;
    const res = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36" },
    });
    const $ = cheerio.load(res.data);
    const result = { facebook_url: null, instagram_url: null };
    const blocked = ["/login", "/help", "/explore", "/sharer", "/share?", "/dialog", "facebook.com/tr?"];
    const rootFb = ["https://www.facebook.com/", "https://facebook.com/"];
    const rootIg = ["https://www.instagram.com/", "https://instagram.com/"];

    $("a.result__a, a.result__url").each((_, el) => {
      let href = $(el).attr("href") || "";
      // DDG wraps links — estrai uddg param se presente
      try { const u = new URL(href); const uddg = u.searchParams.get("uddg"); if (uddg) href = decodeURIComponent(uddg); } catch {}
      const h = href.toLowerCase();
      if (blocked.some(b => h.includes(b))) return;
      if (!result.facebook_url && h.includes("facebook.com") && !rootFb.includes(h)) result.facebook_url = href.split("?")[0];
      if (!result.instagram_url && h.includes("instagram.com") && !rootIg.includes(h)) result.instagram_url = href.split("?")[0];
    });
    return result;
  } catch { return { facebook_url: null, instagram_url: null }; }
}

// ============================================================
// MAIN: Prima il sito, poi DuckDuckGo come fallback
// ============================================================

/**
 * Scans for social profiles of a single business.
 *
 * Strategy:
 *   1. If the business has a website, scrape it for FB/IG links (fast, no CAPTCHA)
 *   2. If nothing found, fall back to DuckDuckGo search (browser, may have CAPTCHA)
 */
export async function scanSocial(business) {
  const { name, area, website } = business;
  if (!name || !area) {
    throw new Error("name e area sono obbligatori");
  }

  // STEP 1: Cerca nel sito web
  if (website) {
    console.log(
      `[social-scan] 🌐 Step 1: cerco link social nel sito ${website}...`,
    );
    const fromWebsite = await extractSocialsFromWebsite(website);
    if (fromWebsite) {
      console.log("[social-scan] ✅ Social trovati nel sito web!", fromWebsite);
      return {
        facebook_url: fromWebsite.facebook_url,
        instagram_url: fromWebsite.instagram_url,
        social_last_active: null,
      };
    }
    console.log("[social-scan] Nessun social nel sito, provo DuckDuckGo...");
  }

  // STEP 2: Fallback DuckDuckGo
  console.log(`[social-scan] 🔍 Step 2: cerco su DuckDuckGo...`);
  return searchSocialViaDDG(name, area);
}

// ============================================================
// BATCH: Scansiona social per più business alla volta
// ============================================================

/**
 * Batch social scan: scansiona social per un array di business.
 * Usa UN solo browser per tutte le ricerche DDG.
 *
 * @param {Array} businesses - lista di business objects
 * @param {function} onProgress - callback(message) for progress
 * @param {object} signal - { aborted: boolean }
 * @returns {Promise<Map<number, object>>} mappa id -> { facebook_url, instagram_url, social_last_active }
 */
export async function scanSocialBatch(
  businesses,
  onProgress = () => {},
  signal = { aborted: false },
) {
  const results = new Map();
  const needsDDG = [];

  // ---- STEP 1: Scraping siti web (veloce, parallelo) ----
  const step1Msg = `🌐 Step 1/2: cerco link social nei siti web di ${businesses.length} attività...`;
  console.log(`[batch-social] ${step1Msg}`);
  onProgress(step1Msg);

  let websiteFound = 0;
  for (let i = 0; i < businesses.length; i++) {
    if (signal.aborted) break;
    const biz = businesses[i];

    if (biz.website) {
      try {
        const fromSite = await extractSocialsFromWebsite(biz.website);
        if (fromSite && (fromSite.facebook_url || fromSite.instagram_url)) {
          results.set(biz.id, {
            facebook_url: fromSite.facebook_url,
            instagram_url: fromSite.instagram_url,
            social_last_active: null,
          });
          websiteFound++;
          const msg = `🌐 [${i + 1}/${businesses.length}] ${biz.name} → trovati nel sito!`;
          console.log(`[batch-social] ${msg}`);
          onProgress(msg);
          continue;
        }
      } catch {
        // ignore
      }
    }
    // Push to DDG queue
    needsDDG.push(biz);
    const msg = `🌐 [${i + 1}/${businesses.length}] ${biz.name} → niente nel sito`;
    onProgress(msg);
  }

  const step1DoneMsg = `✅ Step 1 completato: ${websiteFound} trovati via sito, ${needsDDG.length} da cercare su DDG.`;
  console.log(`[batch-social] ${step1DoneMsg}`);
  onProgress(step1DoneMsg);

  if (signal.aborted || needsDDG.length === 0) {
    return results;
  }

  // ---- STEP 2: DDG con UN solo browser riutilizzato ----
  const step2Msg = `🔍 Step 2/2: cerco su DuckDuckGo per ${needsDDG.length} attività (1 browser)...`;
  console.log(`[batch-social] ${step2Msg}`);
  onProgress(step2Msg);

  const launchOptions = {
    headless: false,
    args: ["--no-sandbox"],
    slowMo: 50,
  };
  if (process.env.PROXY_URL) {
    launchOptions.proxy = { server: process.env.PROXY_URL };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    locale: "it-IT",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    for (let i = 0; i < needsDDG.length; i++) {
      if (signal.aborted) {
        onProgress("🛑 Batch scan interrotto.");
        break;
      }

      const biz = needsDDG[i];

      // Delay randomico tra ricerche (3-6 sec) per sembrare umani
      if (i > 0) await randomDelay(3000, 6000);

      try {
        const query = `"${biz.name}" ${biz.area} facebook instagram`;
        onProgress(`🔍 [${i + 1}/${needsDDG.length}] Cerco: ${biz.name}...`);

        await page.goto(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
          { waitUntil: "load", timeout: 15000 },
        );

        const ok = await waitForCaptcha(page);
        if (!ok) {
          onProgress(`⏰ [${i + 1}] Timeout CAPTCHA, salto ${biz.name}`);
          continue;
        }

        const result = await extractAllSocialsFromResults(page);

        if (result.facebook_url || result.instagram_url) {
          results.set(biz.id, result);
          const parts = [];
          if (result.facebook_url) parts.push("FB");
          if (result.instagram_url) parts.push("IG");
          onProgress(
            `✨ [${i + 1}/${needsDDG.length}] ${biz.name} → ${parts.join(" + ")} trovati!`,
          );
        } else {
          onProgress(
            `  [${i + 1}/${needsDDG.length}] ${biz.name} → nessun social`,
          );
        }
      } catch (e) {
        onProgress(`⚠ [${i + 1}] Errore per ${biz.name}: ${e.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  onProgress(
    `✅ Batch completato! ${results.size} business con social trovati su ${businesses.length} totali.`,
  );
  return results;
}
