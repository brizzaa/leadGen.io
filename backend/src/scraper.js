import { chromium } from "playwright";

/** Random delay between min and max ms to appear human */
function randomDelay(min = 1500, max = 4000) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Domìni da escludere sempre dai risultati deep-scan */
const DEEP_SCAN_SKIP_DOMAINS = [
  "tripadvisor.",
  "paginegialle.",
  "google.",
  "thefork.",
  "yelp.",
  "booking.",
  "trustpilot.",
  "virgilio.",
  "tuttocittà.",
  "misterimpact.",
  "infobel.",
  "hotfrog.",
];

/**
 * Scrapes Google Maps for businesses in a given area and category.
 * @param {string} area - e.g. "Rovigo"
 * @param {string} category - e.g. "ristorante"
 * @param {function} onProgress - callback(message) for progress updates
 * @param {object} signal - abort signal { aborted: boolean }
 * @param {string[]} existingNames - nomi già nel DB, da saltare
 * @returns {Promise<Array>} list of business objects
 */
export async function scrapeBusinesses(
  area,
  category,
  onProgress = () => {},
  signal = { aborted: false },
  existingNames = [],
) {
  const query = `${category} ${area}`;
  onProgress(`🔍 Avvio ricerca: "${query}"`);

  const isProduction =
    process.env.NODE_ENV === "production" || process.env.HEADLESS === "true";

  const launchOptions = {
    headless: isProduction,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--start-maximized",
      "--disable-blink-features=AutomationControlled", // riduce rilevamento bot
    ],
    slowMo: isProduction ? 0 : 60,
  };

  if (process.env.PROXY_URL) {
    launchOptions.proxy = { server: process.env.PROXY_URL };
    onProgress(
      `🔒 Proxy attivo: ${process.env.PROXY_URL.replace(/\/\/.*@/, "//***@")}`,
    );
  }

  const browser = await chromium.launch(launchOptions);

  const context = await browser.newContext({
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "Accept-Language": "it-IT,it;q=0.9",
    },
  });

  const page = await context.newPage();

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    onProgress(`🌐 Navigazione verso Google Maps...`);
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 40000 });

    // Gestione cookie consent — prova più selettori in parallelo
    onProgress("🍪 Gestione consenso cookie...");
    const consentSelectors = [
      'button[aria-label*="Accetta tutto"]',
      'button[aria-label*="Accept all"]',
      'button[aria-label*="Accetta"]',
      'form[action*="consent"] button',
      "#L2AGLb",
      ".tHlp8d",
    ];
    for (const sel of consentSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1500 })) {
          await btn.click();
          await page.waitForTimeout(1000);
          onProgress("✅ Cookie accettati.");
          break;
        }
      } catch (_) {}
    }

    // Attendi il feed risultati
    onProgress("⏳ Attendo caricamento risultati...");
    try {
      await page.waitForSelector('[role="feed"]', { timeout: 20000 });
    } catch {
      onProgress("⚠️ Feed non trovato, potrebbe esserci un solo risultato.");
    }

    await page.waitForTimeout(1500);

    // Scroll per caricare più risultati
    onProgress("📜 Scorrimento risultati...");
    const feedLocator = page.locator('[role="feed"]').first();
    const feedExists = await feedLocator
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (feedExists) {
      let prevCount = 0;
      let staleRounds = 0;

      for (let scroll = 0; scroll < 1000; scroll++) {
        if (signal.aborted) {
          onProgress("🛑 Scorrimento interrotto dall'utente.");
          break;
        }

        // Scroll più aggressivo per caricare più veloce
        await feedLocator.evaluate((el) => el.scrollBy(0, 800));
        await page.waitForTimeout(500);

        const count = await page.locator("a.hfpxzc").count();
        if (count === prevCount) {
          staleRounds++;
          if (staleRounds >= 5) break; // 5 round stagnanti = fine lista
        } else {
          staleRounds = 0;
          prevCount = count;
        }

        if (scroll % 5 === 0 && count > 0) {
          onProgress(`📍 Scorrimento... (${count} elementi trovati)`);
        }
      }
    }

    await page.waitForTimeout(1000);

    // Estrai dati cliccando ogni card
    const cardHandles = await page.locator("a.hfpxzc").all();
    onProgress(
      `📊 Trovati ${cardHandles.length} risultati, estraggo dettagli...`,
    );

    const businesses = [];

    for (let i = 0; i < cardHandles.length; i++) {
      if (signal.aborted) {
        onProgress("🛑 Estrazione interrotta dall'utente.");
        break;
      }

      try {
        const card = cardHandles[i];

        // Salta se già nel DB
        const ariaLabel = await card
          .getAttribute("aria-label")
          .catch(() => null);
        if (ariaLabel && existingNames.includes(ariaLabel.trim())) {
          onProgress(
            `⏭️ [${i + 1}/${cardHandles.length}] Salto "${ariaLabel.trim()}" (già nel DB)`,
          );
          continue;
        }

        // Click sulla card per aprire il pannello dettagli
        await card.scrollIntoViewIfNeeded();
        await card.click({ force: true });

        // Attesa adattiva: prima prova a vedere se l'h1 appare entro 5s
        try {
          await page.waitForSelector("h1", { timeout: 5000 });
        } catch (_) {
          // Ritenta con un click e attesa più lunga
          try {
            await card.click({ force: true });
            await page.waitForSelector("h1", { timeout: 4000 });
          } catch (_) {
            onProgress(`⚠️ [${i + 1}] Dettagli non caricati, salto.`);
            continue;
          }
        }

        // Piccola pausa per stabilizzare il DOM
        await page.waitForTimeout(800);

        const data = await page.evaluate(() => {
          // Selettori h1 in ordine di priorità
          let h1 = null;
          const h1Selectors = ["h1.DUwDvf", 'h1[class*="fontHeadline"]', "h1"];
          for (const sel of h1Selectors) {
            h1 = document.querySelector(sel);
            if (h1 && h1.textContent.trim()) break;
          }
          if (!h1) return null;
          const name = h1.textContent.trim();

          // Usa il pannello dettagli (role="main") per evitare match con annunci
          const container = h1.closest('[role="main"]') || document;

          const getText = (...selectors) => {
            for (const sel of selectors) {
              const el = container.querySelector(sel);
              if (el && el.textContent.trim()) return el.textContent.trim();
            }
            return null;
          };

          const getAttr = (attr, ...selectors) => {
            for (const sel of selectors) {
              const el = container.querySelector(sel);
              if (el && el.getAttribute(attr))
                return el.getAttribute(attr).trim();
            }
            return null;
          };

          // Indirizzo
          const address = getText(
            '[data-item-id="address"] .Io6YTe',
            'button[data-item-id="address"] .fontBodyMedium',
            '[aria-label*="indirizzo"] .Io6YTe',
            '[aria-label*="address"] .Io6YTe',
          );

          // Telefono
          const phone = getText(
            '[data-item-id^="phone:tel:"] .Io6YTe',
            '[data-item-id^="phone"] .Io6YTe',
            'button[aria-label*="telefon"] .Io6YTe',
            'button[aria-label*="phone"] .Io6YTe',
            'a[href^="tel:"]',
          );

          // Categoria
          const categoryFromPage = getText(
            'button[jsaction*="category"]',
            ".DkEaL",
            ".fontBodyMedium.dmRWX", // classe usata per categoria in alcuni layout
          );

          // Sito web — priorità al link "authority"
          let website = null;
          const websiteAnchor = container.querySelector(
            'a[data-item-id="authority"], a[aria-label*="sito web"], a[aria-label*="website"]',
          );
          if (websiteAnchor && websiteAnchor.href) {
            website = websiteAnchor.href;
          } else {
            const websiteEl = container.querySelector(
              '[data-item-id="authority"] .Io6YTe, button[aria-label*="sito web"] .Io6YTe, button[aria-label*="website"] .Io6YTe',
            );
            website = websiteEl ? websiteEl.textContent.trim() : null;
          }

          // Fallback social se nessun sito
          if (!website) {
            const socialAnchor = container.querySelector(
              'a[href*="facebook.com"], a[href*="instagram.com"]',
            );
            if (socialAnchor && socialAnchor.href) {
              website = socialAnchor.href;
            }
          }

          // Rating
          const ratingEl = container.querySelector(
            '.F7nice span[aria-hidden="true"]',
          );
          const rating = ratingEl
            ? parseFloat(ratingEl.textContent.replace(",", "."))
            : null;

          // Conteggio recensioni
          let review_count = null;
          const reviewSelectors = [
            ".F7nice span[aria-label]",
            'button[aria-label*="recensioni"]',
            'button[aria-label*="reviews"]',
            '[jsaction*="pane.rating"] span[aria-label]',
          ];
          for (const sel of reviewSelectors) {
            const el = container.querySelector(sel);
            if (el) {
              const label = el.getAttribute("aria-label") || el.textContent;
              const match = label.match(/[\d.,]+/);
              if (match) {
                review_count = parseInt(
                  match[0].replace(/\./g, "").replace(",", ""),
                  10,
                );
                break;
              }
            }
          }

          // Orari apertura — indicatore di "attività attiva"
          const hoursEl = container.querySelector(
            '[data-item-id="oh"] .Io6YTe, [aria-label*="orari"] .Io6YTe',
          );
          const opening_hours = hoursEl ? hoursEl.textContent.trim() : null;

          const maps_url = window.location.href.split("?")[0];

          // Verifica se non reclamata
          const textContent = container.textContent || "";
          const is_claimed =
            !textContent.includes("Rivendica questa attività") &&
            !textContent.includes("Claim this business");

          return {
            name,
            address,
            phone,
            website,
            rating,
            review_count,
            maps_url,
            is_claimed,
            opening_hours,
            categoryFromPage,
          };
        });

        if (data && data.name) {
          businesses.push({ ...data, category, area });
          const statusEmoji = data.website
            ? data.website.includes("facebook.com") ||
              data.website.includes("instagram.com")
              ? "📱"
              : "🌐"
            : "❌";
          onProgress(
            `✓ [${i + 1}/${cardHandles.length}] ${data.name} — ${data.review_count ?? "?"} rec. ${statusEmoji} ${data.website || "nessun sito"}`,
          );
        }
      } catch (err) {
        onProgress(`⚠️ Errore card ${i + 1}: ${err.message}`);
      }
    }

    // =========================================================
    // DEEP SCAN — cerca sito/social per chi non ce l'ha
    // =========================================================
    const noSiteBusinesses = businesses.filter((b) => !b.website);

    if (noSiteBusinesses.length > 0 && !signal.aborted) {
      onProgress(
        `🔎 Deep Scan — cerco sito/social per ${noSiteBusinesses.length} attività senza sito...`,
      );
      const searchPage = await context.newPage();

      for (let i = 0; i < noSiteBusinesses.length; i++) {
        if (signal.aborted) break;
        const b = noSiteBusinesses[i];
        try {
          if (i > 0) await randomDelay(1500, 3500); // Delay randomico anti-ban

          const q = `${b.name} ${b.area}`;
          await searchPage.goto(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
            { waitUntil: "domcontentloaded", timeout: 8000 },
          );

          const foundUrl = await searchPage.evaluate((skipDomains) => {
            const links = Array.from(
              document.querySelectorAll("a.result__url"),
            );
            for (const el of links) {
              const href = el.href || el.textContent;
              const lower = href.toLowerCase();

              // Salta domini indesiderati
              if (skipDomains.some((d) => lower.includes(d))) continue;

              // Estrai URL reale da DuckDuckGo (redirect)
              let cleanHref = href;
              try {
                const urlObj = new URL(href);
                if (urlObj.hostname.includes("duckduckgo.com")) {
                  const uddg = urlObj.searchParams.get("uddg");
                  if (uddg) cleanHref = decodeURIComponent(uddg);
                }
              } catch {
                // ignora URL malformati
              }
              return cleanHref;
            }
            return null;
          }, DEEP_SCAN_SKIP_DOMAINS);

          if (foundUrl) {
            b.website = foundUrl;
            onProgress(`✨ [Deep Scan] ${b.name} → ${b.website}`);
          } else {
            onProgress(`🔍 [Deep Scan] ${b.name} → nessun risultato`);
          }
        } catch (_) {
          // ignora errori
        }
      }
      await searchPage.close();
    }

    onProgress(
      `✅ Estrazione completata: ${businesses.length} business trovati.`,
    );
    return businesses;
  } finally {
    await browser.close();
  }
}
