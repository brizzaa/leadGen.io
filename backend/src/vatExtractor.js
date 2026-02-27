import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Espressione regolare per la Partita IVA italiana.
 * Formato: 11 cifre consecutive, opzionalmente precedute da "IT" o "P.IVA", "P. IVA", "VAT".
 */
const VAT_REGEX =
  /(?:P\.?\s*IVA|Partita\s+IVA|VAT(?:\s+N[o.]?)?|IT)[\s:]*([0-9]{11})\b/gi;

// Regex fallback: 11 cifre standalone (evita false positive con numeri telefono lunghi < 11 cifre)
const VAT_BARE_REGEX = /\b([0-9]{11})\b/g;

const CONTACT_PATHS = [
  "/contatti",
  "/contact",
  "/chi-siamo",
  "/about",
  "/info",
  "/privacy",
];

/**
 * Estrae la Partita IVA (11 cifre) dal sito web di un'azienda italiana.
 * Prima prova la homepage, poi le pagine "contatti" / "chi siamo" / "privacy".
 *
 * @param {string} websiteUrl
 * @returns {Promise<string|null>} P.IVA senza prefisso "IT", oppure null
 */
export async function extractVat(websiteUrl) {
  if (!websiteUrl) return null;

  // Non cercare su social o directory generiche
  const SKIP_DOMAINS = [
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "linkedin.com",
    "tripadvisor.",
    "yelp.",
    "paginegialle.",
    "google.",
  ];
  if (SKIP_DOMAINS.some((d) => websiteUrl.includes(d))) return null;

  let baseUrl = websiteUrl.trim();
  if (!baseUrl.startsWith("http")) baseUrl = "https://" + baseUrl;

  // Normalizza — rimuovi path interni per avere la root del dominio
  try {
    const u = new URL(baseUrl);
    baseUrl = `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }

  const pagesToCheck = [baseUrl, ...CONTACT_PATHS.map((p) => baseUrl + p)];

  for (const pageUrl of pagesToCheck) {
    try {
      const vat = await fetchAndParseVat(pageUrl);
      if (vat) return vat;
    } catch {
      // Pagina non disponibile — prossima
    }
  }

  return null;
}

/**
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function fetchAndParseVat(url) {
  const response = await axios.get(url, {
    timeout: 7000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    maxRedirects: 3,
  });

  const $ = cheerio.load(response.data);

  // Rimuovi script/style dal testo — riducono il rumore
  $("script, style, noscript").remove();
  const text = $("body").text();

  // 1. Prima priorità: cerca il pattern "P.IVA XXXXXXXXXXX" (molto preciso)
  const vatLabeled = extractWithLabel(text);
  if (vatLabeled) return vatLabeled;

  // 2. Fallback: sequenza di 11 cifre nel footer o nel documento
  // In genere la P.IVA è nell'HTML del footer
  const footerHtml = $("footer").html() || $('[class*="footer"]').html() || "";
  const footerText = cheerio.load(footerHtml)("*").text();
  const vatBare = extractBare(footerText || text);
  if (vatBare) return vatBare;

  return null;
}

/**
 * Cerca pattern con label (es. "P.IVA 01234567890").
 */
function extractWithLabel(text) {
  // Reset lastIndex — è un regex globale stateful
  VAT_REGEX.lastIndex = 0;
  let match;
  while ((match = VAT_REGEX.exec(text)) !== null) {
    const candidate = match[1];
    if (isValidItalianVat(candidate)) return candidate;
  }
  return null;
}

/**
 * Cerca 11 cifre consecutive nel testo (fallback senza label).
 * Valida con la checksum della P.IVA italiana.
 */
function extractBare(text) {
  VAT_BARE_REGEX.lastIndex = 0;
  let match;
  while ((match = VAT_BARE_REGEX.exec(text)) !== null) {
    const candidate = match[1];
    if (isValidItalianVat(candidate)) return candidate;
  }
  return null;
}

/**
 * Algoritmo di validazione della Partita IVA italiana (checksum ufficiale).
 * @see https://it.wikipedia.org/wiki/Partita_IVA_(Italia)#Calcolo_della_cifra_di_controllo
 */
function isValidItalianVat(vat) {
  if (!/^\d{11}$/.test(vat)) return false;

  // Scarta sequenze banali (es. 00000000000, 11111111111)
  if (/^(\d)\1{10}$/.test(vat)) return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const d = parseInt(vat[i], 10);
    if (i % 2 === 0) {
      sum += d;
    } else {
      const doubled = d * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    }
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(vat[10], 10);
}
