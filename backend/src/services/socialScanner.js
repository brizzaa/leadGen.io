import axios from "axios";
import * as cheerio from "cheerio";
import { chromium } from "playwright";

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
