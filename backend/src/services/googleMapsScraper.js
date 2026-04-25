// Google Maps profile scraper — estrae dati pubblici (title, category, website,
// phone, address) dalla scheda GBP di un business a partire dal maps_url.
//
// Usa Playwright (già installato via `npx playwright install chromium`) perché
// la sidebar di Maps carica in React con dati asincroni non disponibili nell'HTML
// iniziale. Cookie consent Google pre-impostati per evitare la schermata di accetto.
//
// Export pattern:
//   import { createMapsSession, scrapeGoogleMapsProfile } from "./googleMapsScraper.js";
//   const { session, release } = await createMapsSession();
//   try {
//     const data = await scrapeGoogleMapsProfile(session, mapsUrl);
//   } finally {
//     await release();
//   }
//
// Per batch: createMapsSession una sola volta, riutilizzare il ctx su più
// pagine in parallelo per ammortizzare il cold start (~2s) del browser.

import { chromium } from "rebrowser-playwright";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Cookie consent Google: evita la pagina "Prima di continuare..." che blocca la
// navigazione diretta a /maps. Valori standard accettazione tutto.
const CONSENT_COOKIES = [
  { name: "CONSENT", value: "YES+cb.20210328-17-p0.it+FX+789", domain: ".google.com", path: "/" },
  { name: "SOCS",    value: "CAESEwgDEgk0ODE3Nzk3MjQaAml0IAEaBgiA_LyaBg", domain: ".google.com", path: "/" },
];

/**
 * Apre un browser Playwright + context pre-loggato con cookie consent Google.
 * Ritorna un handle riutilizzabile su più scraping.
 *
 * @returns {Promise<{ctx: import("rebrowser-playwright").BrowserContext, release: () => Promise<void>}>}
 */
export async function createMapsSession() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });
  const ctx = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1440, height: 900 },
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
  await ctx.addCookies(CONSENT_COOKIES);
  return {
    ctx,
    release: async () => {
      try { await ctx.close(); } catch { /* ignore */ }
      try { await browser.close(); } catch { /* ignore */ }
    },
  };
}

/**
 * Scrape di un singolo profilo Google Maps.
 * Ritorna i campi trovati (possibilmente null se non presenti nel GBP).
 *
 * @param {import("rebrowser-playwright").BrowserContext} ctx
 * @param {string} mapsUrl - URL completo Google Maps (campo maps_url del DB)
 * @returns {Promise<{title:string|null, category:string|null, website:string|null, phone:string|null, address:string|null}>}
 */
export async function scrapeGoogleMapsProfile(ctx, mapsUrl) {
  if (!mapsUrl) return { title: null, category: null, website: null, phone: null, address: null };

  const page = await ctx.newPage();
  try {
    await page.goto(mapsUrl, { timeout: 30000, waitUntil: "domcontentloaded" });
    // Sidebar carica asincrona; 3.5s è il sweet spot tra velocità e completezza
    // rilevato sperimentalmente (sotto 2s spesso manca website/category).
    await page.waitForTimeout(3500);

    const data = await page.evaluate(() => {
      // La sidebar usa data-item-id per identificare ogni riga di contatto:
      //   - "authority" → link website
      //   - "phone:tel:+39..." → telefono
      //   - "address" → indirizzo completo
      const rows = Array.from(document.querySelectorAll("[data-item-id]"));
      const out = { website: null, phone: null, address: null };
      for (const r of rows) {
        const id = r.getAttribute("data-item-id") || "";
        if (id === "authority" && !out.website) {
          const a = r.querySelector("a[href]");
          out.website = a?.href || (r.innerText || "").trim().replace(/\s+/g, " ") || null;
        } else if (id.startsWith("phone:tel:") && !out.phone) {
          out.phone = id.replace("phone:tel:", "");
        } else if (id === "address" && !out.address) {
          out.address = (r.innerText || "").trim().replace(/\s+/g, " ") || null;
        }
      }

      // Category: primo button con jsaction che include "category"
      let category = document.querySelector('button[jsaction*="category"]')?.innerText?.trim() || null;
      // Fallback: primo button sotto l'h1 (non sempre presente)
      if (!category) {
        const h1 = document.querySelector("h1");
        const btn = h1?.parentElement?.nextElementSibling?.querySelector("button");
        if (btn) category = btn.innerText?.trim() || null;
      }
      // Sanitize: scarta placeholder tecnici e stringhe vuote/troppo lunghe
      if (category) {
        const bad = ["__grid__", "null", "undefined"];
        if (bad.includes(category.toLowerCase()) || category.length === 0 || category.length > 80) {
          category = null;
        }
      }

      const title = document.querySelector("h1")?.innerText?.trim() || null;
      return { title, category, ...out };
    });

    return data;
  } finally {
    await page.close().catch(() => {});
  }
}
