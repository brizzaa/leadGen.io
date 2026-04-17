import { spawn } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import axios from "axios";
import * as cheerio from "cheerio";
import pLimit from "p-limit";

const GOSOM_BIN = join(process.env.HOME, "go/bin/google-maps-scraper");

// Rate-limit-safe delays
function randomDelay(min = 2000, max = 4000) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Geocode city name → {lat, lon} via Nominatim (1 req/s limit — called once per search)
async function geocodeCity(area) {
  try {
    const res = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: area + ", Italy", format: "json", limit: 1 },
      headers: { "User-Agent": "findbusiness-app/1.0 (local dev)" },
      timeout: 8000,
    });
    if (res.data?.length > 0) {
      return { lat: parseFloat(res.data[0].lat), lon: parseFloat(res.data[0].lon) };
    }
  } catch { /* fallback: no geo */ }
  return null;
}

async function scrapeContactsFromWebsite(websiteUrl) {
  if (!websiteUrl) return { email: null, phone: null };
  const lower = websiteUrl.toLowerCase();
  if (
    lower.includes("facebook.com") || lower.includes("instagram.com") ||
    lower.includes("tripadvisor.") || lower.includes("paginegialle.") || lower.includes("yelp.")
  ) {
    return { email: null, phone: null };
  }

  try {
    let url = websiteUrl;
    if (!url.startsWith("http")) url = "https://" + url;

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);
    $("script, style, noscript").remove();
    const text = $("body").text();

    let email = null;
    $('a[href^="mailto:"]').each((_, el) => {
      if (!email) {
        const addr = $(el).attr("href").replace("mailto:", "").split("?")[0].trim().toLowerCase();
        if (addr && addr.includes("@") && !addr.includes("@example.") && !addr.includes("@sentry.")) {
          email = addr;
        }
      }
    });
    if (!email) {
      const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const m of matches) {
        const low = m.toLowerCase();
        if (!low.includes("@example.") && !low.includes("@sentry.") && !low.includes("@wixpress.") && !low.includes(".png") && !low.includes(".jpg") && !low.endsWith(".js")) {
          email = low;
          break;
        }
      }
    }

    let phone = null;
    $('a[href^="tel:"]').each((_, el) => {
      if (!phone) phone = $(el).attr("href").replace("tel:", "").trim();
    });
    if (!phone) {
      const matches = text.match(/(?:\+39\s?)?(?:0\d{1,4}[\s.-]?\d{4,8}|3[0-9]{2}[\s.-]?\d{6,7})/g) || [];
      for (const m of matches) {
        const digits = m.replace(/\D/g, "");
        if (digits.length >= 8 && digits.length <= 13) { phone = m.trim(); break; }
      }
    }

    return { email, phone };
  } catch {
    return { email: null, phone: null };
  }
}

const DEEP_SCAN_SKIP_DOMAINS = [
  "tripadvisor.", "paginegialle.", "google.", "thefork.", "yelp.",
  "booking.", "trustpilot.", "virgilio.", "tuttocittà.", "misterimpact.",
  "infobel.", "hotfrog.",
];

// Deep scan via DuckDuckGo HTML (no JS needed — axios only, no Playwright)
// Sequential with random delays to respect DDG rate limits
async function deepScanWithDDG(businesses, signal, onProgress) {
  for (let i = 0; i < businesses.length; i++) {
    if (signal.aborted) break;
    const b = businesses[i];
    try {
      // Random delay 2-4s between DDG requests to avoid rate limiting
      if (i > 0) await randomDelay(2000, 4000);

      const res = await axios.get("https://html.duckduckgo.com/html/", {
        params: { q: `${b.name} ${b.area}` },
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "text/html",
        },
        timeout: 8000,
      });

      const $ = cheerio.load(res.data);
      let foundUrl = null;

      $("a.result__url, .result__url").each((_, el) => {
        if (foundUrl) return;
        const href = $(el).attr("href") || $(el).text();
        if (!href) return;
        const lower = href.toLowerCase();
        if (DEEP_SCAN_SKIP_DOMAINS.some((d) => lower.includes(d))) return;

        // Extract real URL from DDG redirect
        try {
          const u = new URL(href);
          if (u.hostname.includes("duckduckgo.com")) {
            const uddg = u.searchParams.get("uddg");
            if (uddg) { foundUrl = decodeURIComponent(uddg); return; }
          }
        } catch { /* skip */ }
        foundUrl = href;
      });

      if (foundUrl) {
        b.website = foundUrl;
        onProgress(`✨ [Deep Scan] ${b.name} → ${b.website}`);
      } else {
        onProgress(`🔍 [Deep Scan] ${b.name} → nessun risultato`);
      }
    } catch (err) {
      // DDG rate limit (429) or timeout — back off longer
      if (err.response?.status === 429) {
        onProgress(`⏳ [Deep Scan] Rate limit DDG — attendo 10s...`);
        await randomDelay(10000, 15000);
      }
    }
  }
}

function runGosom(queryFile, outputFile, onProgress, signal, geo) {
  return new Promise((resolve, reject) => {
    const args = [
      "-input", queryFile,
      "-results", outputFile,
      "-json",
      "-depth", "10",
      "-c", "2",
      "-lang", "it",
      "-email",
    ];

    if (geo) {
      args.push("-geo", `${geo.lat},${geo.lon}`);
      args.push("-radius", "15000");
    }

    const proc = spawn(GOSOM_BIN, args, { stdio: ["ignore", "ignore", "pipe"] });

    proc.stderr.on("data", (data) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        if (line.includes("places found")) {
          const match = line.match(/(\d+) places found/);
          if (match) onProgress(`📍 ${match[1]} business trovati, estraggo dettagli...`);
        } else if (line.includes("job finished")) {
          onProgress("✅ Scraping Google Maps completato.");
        } else if (line.includes("ERROR") || line.includes("error")) {
          onProgress(`⚠️ ${line.trim()}`);
        }
      }
    });

    const checkAbort = setInterval(() => {
      if (signal.aborted) { proc.kill("SIGTERM"); clearInterval(checkAbort); }
    }, 500);

    proc.on("close", (code) => {
      clearInterval(checkAbort);
      if (signal.aborted) return resolve();
      if (code !== 0 && code !== null) reject(new Error(`gosom exited with code ${code}`));
      else resolve();
    });

    proc.on("error", reject);
  });
}

function parseGosomOutput(outputFile) {
  if (!existsSync(outputFile)) return [];
  const results = [];
  for (const line of readFileSync(outputFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const d = JSON.parse(trimmed);
      if (!d.title) continue;
      const email = Array.isArray(d.emails) && d.emails.length > 0 ? d.emails[0] : null;
      results.push({
        name: d.title ?? null,
        address: d.address ?? null,
        phone: d.phone ?? null,
        website: d.web_site ?? null,
        rating: d.review_rating ?? null,
        review_count: d.review_count ?? null,
        email,
        maps_url: d.link ?? null,
        is_claimed: true,
        facebook_url: null,
        instagram_url: null,
        social_last_active: null,
        latitude: d.latitude ?? null,
        longitude: d.longtitude ?? null, // gosom typo
      });
    } catch { /* skip malformed */ }
  }
  return results;
}

export async function scrapeBusinesses(
  area,
  category,
  onProgress = () => {},
  signal = { aborted: false },
  existingNames = [],
) {
  const query = `${category} ${area}`;
  onProgress(`🔍 Avvio ricerca: "${query}"`);

  // Geo targeting — Nominatim (1 call, max 1 req/s — fine)
  onProgress("🌍 Risoluzione coordinate...");
  const geo = await geocodeCity(area);
  if (geo) {
    onProgress(`📌 Coordinate: ${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}`);
  }

  const id = randomUUID();
  const queryFile = join(tmpdir(), `gosom-query-${id}.txt`);
  const outputFile = join(tmpdir(), `gosom-out-${id}.json`);

  try {
    writeFileSync(queryFile, query + "\n", "utf8");

    onProgress("🤖 Avvio gosom scraper...");
    await runGosom(queryFile, outputFile, onProgress, signal, geo);

    if (signal.aborted) {
      onProgress("🛑 Scraping interrotto dall'utente.");
      return [];
    }

    const businesses = parseGosomOutput(outputFile);
    onProgress(`📊 Trovati ${businesses.length} business da gosom.`);

    // Filtra duplicati già nel DB
    const filtered = businesses.filter((b) => !existingNames.includes(b.name));
    const skipped = businesses.length - filtered.length;
    if (skipped > 0) onProgress(`⏭️ ${skipped} già presenti nel DB, saltati.`);

    for (const b of filtered) { b.category = category; b.area = area; }

    // =========================================================
    // DEEP SCAN — trova sito per chi non ce l'ha (axios+DDG, no browser)
    // Sequential con delays 2-4s per rispettare rate limit DDG
    // =========================================================
    const noSite = filtered.filter((b) => !b.website);
    if (noSite.length > 0 && !signal.aborted) {
      onProgress(`🔎 Deep Scan — cerco sito per ${noSite.length} attività (axios, no browser)...`);
      await deepScanWithDDG(noSite, signal, onProgress);
    }

    // =========================================================
    // CONTACT SCRAPE — parallelo con concurrency 3
    // Ognuno visita un dominio diverso → nessun rate limit per sito singolo
    // Salta se gosom ha già trovato email E phone è già presente
    // =========================================================
    const needsContacts = filtered.filter((b) => b.website && (!b.email || !b.phone));
    if (needsContacts.length > 0 && !signal.aborted) {
      onProgress(`📧 Contact Scrape — ${needsContacts.length} attività (concurrency: 3)...`);
      const limit = pLimit(3);
      let done = 0;

      await Promise.allSettled(
        needsContacts.map((b) =>
          limit(async () => {
            if (signal.aborted) return;
            try {
              const contacts = await scrapeContactsFromWebsite(b.website);
              const found = [];
              if (contacts.email && !b.email) { b.email = contacts.email; found.push(`email: ${contacts.email}`); }
              if (contacts.phone && !b.phone) { b.phone = contacts.phone; found.push(`tel: ${contacts.phone}`); }
              done++;
              if (found.length > 0) {
                onProgress(`📧 [${done}/${needsContacts.length}] ${b.name} → ${found.join(", ")}`);
              }
            } catch { /* skip */ }
          })
        )
      );
    }

    onProgress(`✅ Estrazione completata: ${filtered.length} business trovati.`);
    return filtered;

  } finally {
    try { unlinkSync(queryFile); } catch { /* skip */ }
    try { unlinkSync(outputFile); } catch { /* skip */ }
  }
}
