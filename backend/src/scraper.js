import { chromium } from "playwright";

/** Random delay between min and max ms to appear human */
function randomDelay(min = 1500, max = 4000) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrapes Google Maps for businesses in a given area and category.
 * @param {string} area - e.g. "Rovigo"
 * @param {string} category - e.g. "ristorante"
 * @param {function} onProgress - callback(message) for progress updates
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
  onProgress(`Avvio ricerca: "${query}"`);

  const isProduction =
    process.env.NODE_ENV === "production" || process.env.HEADLESS === "true";

  // Proxy support: set PROXY_URL in .env (e.g. http://user:pass@proxy.example.com:8080)
  const launchOptions = {
    headless: isProduction,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
    slowMo: isProduction ? 0 : 80,
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
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    onProgress(`Navigazione verso Google Maps...`);
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 40000 });

    // Handle cookie/consent dialogs — try multiple selectors
    onProgress("Gestione consenso cookie...");
    const consentSelectors = [
      'button[aria-label*="Accetta tutto"]',
      'button[aria-label*="Accept all"]',
      'button[aria-label*="Accetta"]',
      'form[action*="consent"] button',
      "#L2AGLb", // Google consent button ID
      ".tHlp8d",
    ];
    for (const sel of consentSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click();
          await page.waitForTimeout(1500);
          onProgress("Cookie accettati.");
          break;
        }
      } catch (_) {}
    }

    // Wait for results feed
    onProgress("Attendo caricamento risultati...");
    try {
      await page.waitForSelector('[role="feed"]', { timeout: 20000 });
    } catch {
      // Maybe only one result page (no feed)
      onProgress("Feed non trovato, potrebbe esserci un solo risultato.");
    }

    await page.waitForTimeout(2000);

    // Scroll to load more results
    onProgress("Scorrimento risultati...");
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
        await feedLocator.evaluate((el) => el.scrollBy(0, 500));
        await page.waitForTimeout(600);

        const count = await page.locator("a.hfpxzc").count();
        if (count === prevCount) {
          staleRounds++;
          if (staleRounds >= 4) break;
        } else {
          staleRounds = 0;
          prevCount = count;
        }
        onProgress(`Scorrimento... (${count} elementi trovati)`);
      }
    }

    await page.waitForTimeout(1500);

    // --- Extract data by clicking each result card ---
    const cardHandles = await page.locator("a.hfpxzc").all();
    onProgress(`Trovati ${cardHandles.length} risultati, estraggo dettagli...`);

    const businesses = [];

    for (let i = 0; i < cardHandles.length; i++) {
      if (signal.aborted) {
        onProgress("🛑 Estrazione interrotta dall'utente.");
        break;
      }

      try {
        const card = cardHandles[i];

        // Skip if already in DB
        const ariaLabel = await card
          .getAttribute("aria-label")
          .catch(() => null);
        if (ariaLabel && existingNames.includes(ariaLabel.trim())) {
          onProgress(
            `⏭️ [${i + 1}/${cardHandles.length}] Salto "${ariaLabel.trim()}" (già nel DB)`,
          );
          continue;
        }

        // Click the card to open the details panel
        await card.scrollIntoViewIfNeeded();
        await card.click({ force: true });
        await page.waitForTimeout(2000);

        // Wait for detail panel to load (look for h1 heading)
        try {
          await page.waitForSelector("h1", { timeout: 6000 });
        } catch (_) {
          continue; // skip if detail doesn't load
        }

        const data = await page.evaluate(() => {
          let h1 = null;
          const h1Selectors = ["h1.DUwDvf", 'h1[class*="fontHeadline"]', "h1"];
          for (const sel of h1Selectors) {
            h1 = document.querySelector(sel);
            if (h1 && h1.textContent.trim()) break;
          }
          if (!h1) return null;
          const name = h1.textContent.trim();

          // Restrict query to the detail pane (role="main") to avoid matching sponsored ads outside
          const container = h1.closest('[role="main"]') || document;

          // Helper: try multiple selectors and return first match text
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

          // Address — look for the address button/section
          const address = getText(
            '[data-item-id="address"] .Io6YTe',
            'button[data-item-id="address"] .fontBodyMedium',
            '[aria-label*="indirizzo"] .Io6YTe',
            '[aria-label*="address"] .Io6YTe',
          );

          // Phone
          const phone = getText(
            '[data-item-id^="phone:tel:"] .Io6YTe',
            '[data-item-id^="phone"] .Io6YTe',
            'button[aria-label*="telefon"] .Io6YTe',
            'button[aria-label*="phone"] .Io6YTe',
            'a[href^="tel:"]',
          );

          // Website — look for authority link specifically avoiding just visible text and prioritizing actual href
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

          // Fallback assoluto: Se non ha un sito "ufficiale", cerchiamo un link a un profilo Social!
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

          // Review count
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

          const maps_url = window.location.href.split("?")[0];

          // Is Claimed? Check for common claiming links or texts
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
          };
        });

        if (data && data.name) {
          businesses.push({ ...data, category, area });
          onProgress(
            `✓ [${i + 1}/${cardHandles.length}] ${data.name} — ${data.review_count ?? "?"} rec. — ${data.website || "nessun sito"}`,
          );
        }
      } catch (err) {
        onProgress(`⚠ Errore card ${i + 1}: ${err.message}`);
      }
    }

    // =========================================================
    // DEEP SCAN: Caccia ai siti per chi non ne ha
    // (con delay randomici per evitare CAPTCHA)
    // =========================================================
    const noSiteBusinesses = businesses.filter((b) => !b.website);

    if (noSiteBusinesses.length > 0 && !signal.aborted) {
      onProgress(
        `Deep Scan — cerco il sito/social per ${noSiteBusinesses.length} attività senza sito...`,
      );
      const searchPage = await context.newPage();

      for (let i = 0; i < noSiteBusinesses.length; i++) {
        if (signal.aborted) break;
        const b = noSiteBusinesses[i];
        try {
          // Delay randomico tra richieste (2-5 sec)
          if (i > 0) await randomDelay(2000, 5000);

          const query = `${b.name} ${b.area} facebook instagram sito ufficiale`;
          await searchPage.goto(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
            { waitUntil: "load", timeout: 8000 },
          );

          const foundUrl = await searchPage.evaluate(() => {
            const links = Array.from(
              document.querySelectorAll("a.result__url"),
            );
            for (let el of links) {
              const href = el.href || el.textContent;
              const l = href.toLowerCase();
              if (
                l.includes("tripadvisor.") ||
                l.includes("paginegialle.") ||
                l.includes("google.") ||
                l.includes("thefork.") ||
                l.includes("yelp.")
              )
                continue;
              let cleanHref = href;
              try {
                const urlObj = new URL(href);
                if (urlObj.hostname.includes("duckduckgo.com")) {
                  const uddg = urlObj.searchParams.get("uddg");
                  if (uddg) cleanHref = decodeURIComponent(uddg);
                }
              } catch {
                // ignora
              }
              return cleanHref;
            }
            return null;
          });

          if (foundUrl) {
            b.website = foundUrl;
            onProgress(`✨ [Deep Scan] Trovato! ${b.name} → ${b.website}`);
          }
        } catch (e) {
          // ignora
        }
      }
      await searchPage.close();
    }

    onProgress(`Estrazione completata: ${businesses.length} business trovati.`);
    return businesses;
  } finally {
    await browser.close();
  }
}
