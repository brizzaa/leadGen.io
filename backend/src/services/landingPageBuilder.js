import { writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Pubblica HTML su Cloudflare R2 + Workers (dominio leader-gen.com).
 * Nome mantenuto `deployToNetlify` per compatibilità con chiamanti esistenti.
 * @param {string} html
 * @param {string} slug
 * @returns {Promise<string>} URL pubblico del sito
 */
export async function deployToNetlify(html, slug) {
  const { buildSlug, deploySite } = await import("./cloudflareDeployer.js");
  const fullSlug = buildSlug(slug);
  const { url } = await deploySite(fullSlug, html);
  return url;
}

/**
 * Determina il template da usare in base ai dati del business.
 * @param {object} business
 * @returns {"local-pro" | "digital-presence" | "social-first"}
 */
export function determineTemplate(business) {
  const hasSocial = business.facebook_url || business.instagram_url;
  const hasWebsite =
    business.website &&
    business.website !== "" &&
    business.website !== "None";

  if (hasSocial && !hasWebsite) return "social-first";

  if (hasWebsite) {
    const url = business.website.toLowerCase();
    const isWeakUrl =
      url.includes("facebook.com") ||
      url.includes("instagram.com") ||
      url.includes("linktr.ee") ||
      url.includes("linktree");
    if (isWeakUrl) return "digital-presence";
  }

  if (!hasWebsite) return "digital-presence";

  return "local-pro";
}

/** Stili disponibili per la generazione del sito */
export const WEBSITE_STYLES = {
  auto: { label: "Automatico", desc: "Scelto in base alla categoria del business", prompt: "" },
  elegant: { label: "Elegante", desc: "Minimalista, tipografia raffinata, colori neutri", prompt: "Design style: ELEGANT MINIMALIST. Use a refined serif + sans-serif font pairing (e.g. Playfair Display + DM Sans). Muted color palette (cream, charcoal, gold accents). Generous whitespace, large typography, subtle hover animations. Think luxury brand website." },
  bold: { label: "Audace", desc: "Colori vivaci, layout dinamico, forte impatto", prompt: "Design style: BOLD & DYNAMIC. Use a strong geometric sans-serif (e.g. Space Grotesk or Outfit). Vibrant contrasting colors, large headings, asymmetric layouts, strong call-to-action buttons. Think startup landing page." },
  warm: { label: "Caldo", desc: "Toni caldi, sensazione accogliente, perfetto per food/hospitality", prompt: "Design style: WARM & INVITING. Use a warm font pairing (e.g. Libre Baskerville + Source Sans 3). Earth tones palette (terracotta, olive, cream, warm brown). Rounded corners, soft shadows, cozy feel. Think artisan restaurant or bakery." },
  professional: { label: "Professionale", desc: "Corporate, pulito, affidabile", prompt: "Design style: PROFESSIONAL CORPORATE. Use a clean sans-serif (e.g. Outfit or Sora). Blue/navy/white palette with one accent color. Sharp corners, structured grid, trust badges prominent. Think law firm or consulting agency." },
  creative: { label: "Creativo", desc: "Colorato, giocoso, ideale per settore creativo", prompt: "Design style: CREATIVE & PLAYFUL. Use a distinctive display font (e.g. Sora or Space Grotesk) with fun weights. Gradient backgrounds, colorful illustrations style, playful micro-animations. Think design studio or creative agency." },
};

/** Engine disponibili per la generazione */
export const WEBSITE_ENGINES = {
  stitch: { label: "Stitch (Google)", desc: "UI specializzato, design più coerente" },
  gemini_3_pro: { label: "Gemini 3.1 Pro", desc: "Migliore qualità design, modello più recente" },
  gemini_pro: { label: "Gemini 2.5 Pro", desc: "Alta qualità, stabile" },
  gemini_flash: { label: "Gemini 2.5 Flash", desc: "Veloce, economico" },
  gemini_flash_lite: { label: "Gemini 2.5 Flash Lite", desc: "Più veloce e leggero" },
};

/**
 * Costruisce il prompt Gemini per la landing page.
 */
/**
 * Scrape dell'homepage del business per estrarre contesto reale (title, h1-h3, meta desc, testo).
 * Ritorna stringa compatta (~1500 char max) da iniettare nel prompt di Gemini.
 */
async function scrapeSiteContext(websiteUrl) {
  if (!websiteUrl) return null;
  try {
    const { default: axios } = await import("axios");
    const { load } = await import("cheerio");
    const res = await axios.get(websiteUrl, {
      timeout: 10000,
      maxRedirects: 3,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadGenBot/1.0)" },
      responseType: "text",
      validateStatus: (s) => s < 500,
    });
    const $ = load(res.data);
    $("script, style, nav, footer").remove();
    const title = ($("title").text() || "").trim().slice(0, 120);
    const metaDesc = ($('meta[name="description"]').attr("content") || "").trim().slice(0, 200);
    const h1 = $("h1").first().text().trim().slice(0, 150);
    const h2s = $("h2").slice(0, 4).map((_, el) => $(el).text().trim()).get().join(" | ").slice(0, 250);
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 700);
    const parts = [
      title && `TITLE: ${title}`,
      metaDesc && `META: ${metaDesc}`,
      h1 && `H1: ${h1}`,
      h2s && `H2s: ${h2s}`,
      bodyText && `TEXT: ${bodyText}`,
    ].filter(Boolean);
    return parts.length ? parts.join("\n") : null;
  } catch (e) {
    console.warn(`[siteContext] ${websiteUrl} failed: ${e.message}`);
    return null;
  }
}

function buildWebsitePrompt(biz, style, siteContext = null) {
  const socials = [biz.facebook_url, biz.instagram_url].filter(Boolean);
  const hasRating = biz.rating && biz.review_count;
  const spec = WEBSITE_STYLES[style]?.prompt || "";

  const info = [
    `Nome: "${biz.name}"`,
    `Categoria: ${biz.category || "Attività locale"}`,
    `Città: ${biz.area || "Italia"}`,
    biz.address && `Indirizzo: ${biz.address}`,
    biz.phone && `Tel: ${biz.phone}`,
    biz.email && `Email: ${biz.email}`,
    socials.length && `Social: ${socials.join(", ")}`,
    hasRating && `Google: ${biz.rating}★ (${biz.review_count})`,
  ].filter(Boolean).join("\n");

  return `Genera UN SOLO file HTML completo per landing page di attività italiana. Testo tutto in italiano. Moderno, pulito, NON generico.

BUSINESS:
${info}
${siteContext ? `\nCONTENUTO REALE DAL LORO SITO (usa SOLO questi servizi/fatti, NON inventare):\n${siteContext}\n` : `\nATTENZIONE: nessun contenuto reale disponibile. Servizi generici plausibili per la categoria, NO dettagli specifici inventati, NO testimonial con nomi falsi.\n`}
STACK: Tailwind CDN (<script src="https://cdn.tailwindcss.com"></script>), Lucide Icons (<script src="https://unpkg.com/lucide@latest"></script> + lucide.createIcons()), Google Fonts (coppia distintiva adatta alla categoria, evita Inter/Roboto). Config Tailwind con \`primary\`/\`secondary\` in palette coerente con categoria (ristoranti=caldi, wellness=pastello, tech=scuro, edilizia=industriale). NO viola/indaco di default.

SEZIONI OBBLIGATORIE (in ordine, nessun altra): navbar sticky (Servizi/Chi Siamo/Contatti, hamburger mobile) • hero full-bleed con nome + tagline + CTA "Contattaci"${hasRating ? ` + badge rating ${biz.rating}★ (${biz.review_count} recensioni Google)` : ""} • 3-4 servizi con icone Lucide • Chi Siamo (2-3 frasi, immagine + testo)${hasRating ? ` • riquadro con rating Google ${biz.rating}★ e "${biz.review_count} recensioni verificate" come social proof (NO testimonial inventati)` : ""} • contatti (${biz.phone ? "tel reale, " : ""}${biz.email ? "email reale, " : ""}${biz.address ? "indirizzo reale" : ""}) senza form${socials.length ? "; link social reali" : ""} • footer con nome + © 2026.

REGOLE ASSOLUTE:
- VIETATO inventare testimonial, nomi clienti, recensioni fake
- VIETATO placeholder come "Un Cliente Soddisfatto", "Lorem Ipsum", href="#" vuoti, email fake
- VIETATO contact form (non c'è backend che riceve) — usa invece pulsanti "Chiama" (tel:) / "Scrivici" (mailto:)
- SE un dato non c'è (no email, no social, no rating) OMETTI completamente la sezione/elemento, NON mettere placeholder
- Metti <title> completo e <meta name="description"> con tagline italiana specifica al business

IMMAGINI: <img src="https://picsum.photos/1200/800?random=N" alt="..."> (sostituite post-build). Alt tag italiani descrittivi.

OUTPUT: solo HTML da <!DOCTYPE html> a </html>. NO markdown, NO commenti.

ESEMPIO STRUTTURA (adatta palette/font/copy al business specifico):
<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NomeBusiness</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<script>tailwind.config={theme:{extend:{colors:{primary:'#8B4513',secondary:'#F5E6D3'},fontFamily:{display:['Playfair Display','serif'],body:['DM Sans','sans-serif']}}}}</script>
</head><body class="font-body text-stone-800 bg-stone-50">
<nav class="sticky top-0 bg-white/90 backdrop-blur z-50 border-b">...</nav>
<section class="relative h-screen flex items-center"><img src="..." class="absolute inset-0 w-full h-full object-cover"><div class="relative z-10 text-white px-8"><h1 class="font-display text-6xl">...</h1><p class="mt-4 text-xl">...</p><a class="mt-8 inline-block bg-primary px-8 py-3 rounded-full">Contattaci</a></div></section>
<section id="servizi" class="py-24 max-w-6xl mx-auto px-6"><h2 class="font-display text-4xl mb-12">...</h2><div class="grid md:grid-cols-3 gap-8">...</div></section>
...
<script src="https://unpkg.com/lucide@latest"></script><script>lucide.createIcons()</script>
</body></html>
${spec}`;
}

/** Keyword Pexels/Unsplash per categoria business */
const CATEGORY_IMAGE_KEYWORDS = {
  ristorante:    ["italian restaurant interior", "pasta dish", "restaurant table candles"],
  trattoria:     ["italian trattoria rustic", "traditional italian food", "wine restaurant"],
  osteria:       ["italian osteria rustic", "wine bar italian", "traditional italian food"],
  pizzeria:      ["pizza neapolitan", "pizzeria wood oven", "italian pizza"],
  bar:           ["italian espresso coffee bar", "barista coffee", "cafe interior"],
  pasticceria:   ["italian pastry shop", "croissants pastries", "bakery display"],
  gelateria:     ["gelato shop colorful", "italian ice cream", "gelateria"],
  panificio:     ["artisan bakery bread", "italian bakery interior", "fresh bread"],
  parrucchier:   ["hair salon interior", "hairstylist work", "barbershop modern"],
  barbier:       ["barbershop modern", "barber professional", "men haircut"],
  estetic:       ["beauty spa treatment", "wellness massage", "nail salon luxury"],
  wellness:      ["wellness spa", "beauty spa treatment", "relaxation massage"],
  spa:           ["luxury spa treatment", "wellness massage", "spa interior zen"],
  massaggi:      ["massage therapy", "wellness massage room", "spa treatment"],
  dentist:       ["dental clinic modern", "dentist office bright", "dental care"],
  medic:         ["medical clinic modern", "doctor office bright", "healthcare professional"],
  fisioterap:    ["physiotherapy clinic", "rehabilitation physical therapy", "medical treatment"],
  psicolog:      ["therapy office calm", "counseling session", "psychology clinic"],
  ottic:         ["optical store eyewear", "glasses boutique", "optician shop"],
  farmaci:       ["pharmacy interior modern", "pharmacist professional", "medicine health"],
  avvocat:       ["law office elegant", "lawyer desk books", "legal consultation"],
  notai:         ["notary office professional", "legal documents desk", "law office"],
  commercialist: ["accounting office", "financial advisor desk", "business meeting"],
  consulen:      ["business consulting", "professional meeting office", "corporate advisor"],
  agenzia:       ["modern agency office", "creative workspace", "business team meeting"],
  immobil:       ["luxury home exterior", "real estate modern house", "apartment interior design"],
  architett:     ["architecture studio modern", "architect desk drawings", "modern interior design"],
  ingegner:      ["engineering office modern", "technical drawings", "professional workspace"],
  idraulic:      ["plumber professional work", "bathroom renovation", "pipes plumbing"],
  elettricist:   ["electrician work", "electrical panel modern", "wiring professional"],
  edil:          ["construction site modern", "builder professional", "building renovation"],
  serrament:     ["modern windows installation", "doors frames professional", "aluminum windows"],
  carrozzer:     ["car body shop professional", "auto repair painting", "car restoration"],
  autoffic:      ["auto repair garage", "mechanic car service", "automotive workshop"],
  gommist:       ["tire shop professional", "wheel alignment", "automotive tires"],
  concessionari: ["car dealership modern", "new cars showroom", "automotive dealer"],
  autonoleggio:  ["car rental service", "modern fleet cars", "vehicle rental"],
  palestr:       ["gym fitness modern", "workout training", "gym equipment"],
  fitness:       ["fitness center modern", "personal training gym", "workout equipment"],
  "personal train": ["personal trainer", "fitness coach workout", "gym training session"],
  crossfit:      ["crossfit box training", "functional fitness", "gym high intensity"],
  yoga:          ["yoga studio calm", "meditation wellness", "yoga pose natural light"],
  pilates:       ["pilates studio reformer", "pilates class bright", "wellness fitness"],
  danza:         ["dance studio mirrors", "ballet studio bright", "dancers practice"],
  scuola:        ["school classroom modern", "students learning", "education bright"],
  asilo:         ["kindergarten colorful", "children playing", "preschool bright"],
  libreri:       ["bookstore interior cozy", "books shelves library", "reading corner"],
  fior:          ["flower shop colorful", "florist arrangement", "fresh flowers bouquet"],
  fotograf:      ["photography studio", "professional photographer camera", "photo studio lights"],
  gioiell:       ["jewelry store luxury", "jewelry display case", "rings diamonds"],
  abbigl:        ["boutique fashion store", "clothing shop interior", "fashion retail"],
  calzatur:      ["shoe store boutique", "shoes display shelves", "footwear retail"],
  lavander:      ["laundry service professional", "dry cleaning shop", "clean clothes"],
  pulizi:        ["professional cleaning service", "cleaning staff work", "clean modern office"],
  giardin:       ["landscape gardening", "garden design professional", "green hedge"],
  veterinari:    ["veterinary clinic modern", "vet with pet", "animal care clinic"],
  petshop:       ["pet store colorful", "pet supplies shop", "dog accessories"],
  toelett:       ["dog grooming salon", "professional pet grooming", "dog bath care"],
  "dog groom":   ["dog grooming salon", "professional pet grooming", "pet spa"],
  "pet groom":   ["pet grooming salon", "dog grooming", "cat grooming care"],
  "zampa":       ["dog grooming salon", "pet care shop", "happy dog"],
  "cane":        ["dog grooming salon", "professional dog care", "happy dogs"],
  "animali":     ["pet care shop", "veterinary clinic", "dog and cat happy"],
  "compro oro":  ["gold jewelry shop", "gold coins trade", "luxury jewelry store"],
  "oreficeri":   ["gold jewelry boutique", "goldsmith workshop", "jewelry craftsmanship"],
  "gioiell":     ["jewelry store elegant", "diamond ring display", "luxury jewelry"],
  "autoneri":    ["car tire shop", "auto parts store", "car accessories shop"],
  "automec":     ["car mechanic workshop", "auto repair garage", "car service"],
  "slimmer":     ["personal trainer woman", "fitness coach weight loss", "healthy lifestyle"],
  "bodytec":     ["EMS training fitness", "electrostimulation workout", "personal training gym"],
  "firstfit":    ["fitness center modern", "gym workout training", "fitness equipment"],
  "synerg":      ["modern office workspace", "tech business team", "professional consulting"],
  "dott":        ["medical doctor office", "healthcare professional", "medical clinic modern"],
  "dr ":         ["medical doctor office", "healthcare professional", "medical clinic modern"],
  "sanitaria":   ["pharmacy shop interior", "medical supplies store", "healthcare retail"],
  "ortoped":     ["orthopedic clinic", "physiotherapy session", "medical rehabilitation"],
  "psicol":      ["therapy office calm", "counseling session", "psychology clinic"],
  "studio legal":["law office elegant", "lawyer consultation", "legal documents"],
  "macelleri":   ["italian butcher shop", "meat counter display", "artisan butchery"],
  "pescheri":    ["fish market italian", "fresh fish display", "fishmonger shop"],
  "alimentari":  ["italian grocery shop", "local food store", "delicatessen shelves"],
  "forneri":     ["artisan bakery bread", "italian bakery", "fresh bread shop"],
  "caffett":     ["italian cafe espresso", "barista coffee bar", "cozy coffee shop"],
  "piadin":      ["piadina romagnola", "italian street food", "flatbread sandwich"],
  "kebab":       ["kebab restaurant", "middle eastern food", "turkish grill shop"],
  "sushi":       ["sushi restaurant modern", "japanese cuisine", "sushi bar counter"],
  "indian":      ["indian restaurant interior", "curry dish", "indian cuisine"],
  "cinese":      ["chinese restaurant", "asian cuisine dumplings", "chinese food"],
  "birrer":      ["craft beer bar", "pub interior cozy", "beer taps"],
  "enoteca":     ["wine bar italian", "wine tasting room", "wine bottles display"],
  "pub":         ["cozy pub interior", "beer glasses wooden bar", "gastropub"],
  "lavasecco":   ["dry cleaning shop", "laundry service", "clothing care"],
  "serrand":     ["roller shutter installation", "garage door repair", "metal shutters"],
  "pavimen":     ["floor tiles installation", "wood flooring craft", "home renovation"],
  "onoranze":    ["funeral services discreet", "memorial flowers", "floral tribute"],
  "ottic":       ["optical store eyewear", "glasses boutique", "optician shop"],
  "erboristeri": ["herbal shop natural", "herbs tea display", "natural wellness"],
  "vivaio":      ["plant nursery garden", "flowers greenhouse", "gardening shop"],
  "ferramenta":  ["hardware store tools", "italian ferramenta", "tools workshop"],
  "tipografi":   ["printing press shop", "graphic printing", "print studio"],
  "stamperi":    ["printing shop professional", "graphic design studio", "print production"],
  "immobili":    ["luxury home exterior", "real estate modern house", "apartment interior"],
  "ass. ":       ["business association office", "meeting room professional", "community group"],
  tatuaggio:     ["tattoo studio professional", "tattoo artist work", "tattoo parlor modern"],
  assicurazion:  ["insurance office professional", "financial consulting", "business advisor desk"],
  banca:         ["bank interior modern", "financial services", "bank advisor desk"],
  "web agency":  ["web design agency", "developer workspace", "creative digital office"],
  hotel:         ["boutique hotel lobby", "modern hotel room", "hospitality interior"],
  "b&b":         ["bed and breakfast cozy", "italian guest house", "charming accommodation"],
  casa:          ["modern italian home interior", "residential house architecture", "home design"],
  pizzer:        ["pizza neapolitan", "pizzeria wood oven", "italian pizza"],
  default:       ["italian small business", "professional local shop italy", "modern italian workspace"],
};

/**
 * Trova keyword dalla categoria E dal nome del business (fallback).
 * Il nome è spesso più informativo della categoria quando quest'ultima è generica ("attività").
 */
export function getCategoryImageKeywords(category, name = "") {
  const haystack = `${category || ""} ${name || ""}`.toLowerCase();
  if (haystack.trim()) {
    for (const [key, kws] of Object.entries(CATEGORY_IMAGE_KEYWORDS)) {
      if (key === "default") continue;
      if (haystack.includes(key)) return kws;
    }
  }
  return CATEGORY_IMAGE_KEYWORDS.default;
}

/**
 * Scrapes Pixabay search results (CC0, no API key required).
 */
async function scrapePixabay(keyword, count = 6) {
  const { default: axios } = await import("axios");
  const encoded = encodeURIComponent(keyword);
  const res = await axios.get(
    `https://pixabay.com/images/search/${encoded}/?image_type=photo`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 15000,
    }
  );
  // Extract CDN image URLs from raw HTML — works regardless of markup changes
  const cdnPattern = /https:\/\/cdn\.pixabay\.com\/photo\/[^"'\s,]+?_(?:640|1280)\.(?:jpg|jpeg|png)/g;
  const matches = [...new Set(res.data.match(cdnPattern) || [])];
  return matches.slice(0, count);
}

/**
 * Keyword-based images via loremflickr (Flickr CC pool, no API key).
 * Follows redirects to return stable cache URLs directly usable in HTML.
 */
async function fetchLoremFlickrUrls(keywords, count) {
  const { default: axios } = await import("axios");
  const sizes = ["1600/900", "1200/800", "800/600"];
  const tasks = keywords.flatMap((kw, ki) => {
    const encoded = encodeURIComponent(kw.replace(/\s+/g, ","));
    return Array.from({ length: Math.ceil(count / keywords.length) }, (_, i) => {
      const size = sizes[i % sizes.length];
      const lock = ki * 20 + i + 1;
      return `https://loremflickr.com/${size}/${encoded}?lock=${lock}`;
    });
  }).slice(0, count);

  const results = await Promise.allSettled(
    tasks.map(url =>
      axios.get(url, { maxRedirects: 5, timeout: 10000, responseType: "arraybuffer" })
        .then(res => res.request.res?.responseUrl || url)
    )
  );

  return results
    .filter(r => r.status === "fulfilled")
    .map(r => r.value);
}

/**
 * Openverse: aggregatore WordPress CC (700M+ immagini), zero API key.
 */
async function fetchOpenverse(keyword, count = 8) {
  const { default: axios } = await import("axios");
  const res = await axios.get("https://api.openverse.org/v1/images/", {
    params: {
      q: keyword,
      license: "cc0,pdm,by",
      page_size: count,
      mature: false,
      aspect_ratio: "wide",
    },
    timeout: 12000,
  });
  return (res.data.results || []).map(r => r.url).filter(Boolean);
}

/**
 * Recupera URL immagini reali.
 * Priority: Pixabay API (se key) → Pexels API (se key) → Openverse (zero-config).
 */
async function fetchRealImageUrls(keywords, count = 6) {
  const { default: axios } = await import("axios");

  if (process.env.PIXABAY_API_KEY) {
    for (const kw of keywords) {
      try {
        const res = await axios.get("https://pixabay.com/api/", {
          params: {
            key: process.env.PIXABAY_API_KEY,
            q: kw,
            image_type: "photo",
            orientation: "horizontal",
            safesearch: "true",
            per_page: Math.max(20, count * 3),
            order: "popular",
          },
          timeout: 10000,
        });
        // webformatURL è l'unico URL hotlinkable di Pixabay (cdn.pixabay.com/photo/...).
        // largeImageURL (/get/..._1280.jpg) richiede download-flow autenticato e risponde 400 se usato come <img src>.
        const all = (res.data.hits || []).map(h => h.webformatURL || h.previewURL).filter(Boolean);
        if (all.length >= 2) {
          // Shuffle: evita che 2 business con stessa keyword ricevano stessa sequenza
          for (let i = all.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [all[i], all[j]] = [all[j], all[i]];
          }
          return all.slice(0, count);
        }
      } catch (e) {
        console.warn(`[images] Pixabay API fallito per "${kw}":`, e.message);
      }
    }
  }

  if (process.env.PEXELS_API_KEY) {
    try {
      const res = await axios.get("https://api.pexels.com/v1/search", {
        headers: { Authorization: process.env.PEXELS_API_KEY },
        params: { query: keywords[0], per_page: count, orientation: "landscape" },
        timeout: 10000,
      });
      const urls = res.data.photos.map(p => p.src.large);
      if (urls.length) return urls;
    } catch (e) {
      console.warn("[images] Pexels fallito:", e.message);
    }
  }

  // Openverse (zero-config, CC aggregato Wikimedia+Flickr+altri)
  for (const kw of keywords) {
    try {
      const urls = await fetchOpenverse(kw, count);
      if (urls.length >= 2) return urls;
    } catch (e) {
      console.warn(`[images] Openverse fallito per "${kw}":`, e.message);
    }
  }

  return [];
}

/**
 * Post-processor: sostituisce img src e background-image nell'HTML
 * con foto reali e pertinenti alla categoria del business.
 */
async function replaceImagesWithReal(html, biz) {
  const keywords = getCategoryImageKeywords(biz.category, biz.name);
  let imageUrls;
  try {
    imageUrls = await fetchRealImageUrls(keywords, 8);
  } catch (e) {
    console.warn("[images] Impossibile recuperare immagini reali:", e.message);
    return html;
  }
  if (!imageUrls.length) return html;

  let idx = 0;
  const nextUrl = () => imageUrls[idx++ % imageUrls.length];

  // Sostituisce <img src="...">
  html = html.replace(
    /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (match, before, src, after) => {
      // Salta data URI, SVG, icone piccole
      if (src.startsWith("data:") || src.includes(".svg") || src.includes("icon") || src.includes("logo")) {
        return match;
      }
      return `<img${before}src="${nextUrl()}"${after}>`;
    }
  );

  // Sostituisce background-image: url(...)
  html = html.replace(
    /background-image\s*:\s*url\(["']?([^"')]+)["']?\)/gi,
    (match, url) => {
      if (url.startsWith("data:") || url.includes(".svg") || url === "none") return match;
      return `background-image: url('${nextUrl()}')`;
    }
  );

  return html;
}

/**
 * Design spec per categoria — usata da Stitch per differenziare visivamente.
 * Stitch risponde meglio a prompt brevi, visivi e specifici.
 */
const CATEGORY_DESIGN_SPEC = {
  // Food & beverage
  ristorante:    { palette: "warm terracotta, cream, olive green", mood: "warm cozy Italian trattoria", hero: "full-bleed food photography hero", font: "serif headings + humanist sans" },
  pizzeria:      { palette: "red, white, green (Italian flag)", mood: "authentic Neapolitan pizzeria", hero: "stone oven pizza hero image", font: "bold italic display + clean sans" },
  bar:           { palette: "espresso brown, gold, off-white", mood: "classic Italian espresso bar", hero: "morning coffee scene hero", font: "retro-inspired serif + modern sans" },
  pasticceria:   { palette: "blush pink, ivory, gold", mood: "artisan patisserie", hero: "soft-lit pastries hero", font: "elegant script + light sans" },
  gelateria:     { palette: "pastel multicolor, white, sky blue", mood: "cheerful summer gelato shop", hero: "colorful gelato display hero", font: "rounded friendly display" },
  parrucchiere:  { palette: "black, white, rose gold", mood: "modern upscale hair salon", hero: "editorial hair styling hero", font: "fashion magazine sans-serif" },
  estetica:      { palette: "soft blush, ivory, champagne", mood: "luxury beauty & wellness spa", hero: "serene spa atmosphere hero", font: "elegant thin serif + clean body" },
  dentista:      { palette: "clean white, sky blue, soft teal", mood: "professional reassuring dental clinic", hero: "bright modern clinic interior hero", font: "trustworthy geometric sans" },
  avvocato:      { palette: "navy blue, charcoal, gold", mood: "authoritative professional law firm", hero: "formal office interior with bookshelves", font: "classic serif + clean sans" },
  commercialista:{ palette: "dark blue, silver, white", mood: "reliable financial consulting firm", hero: "clean modern office hero", font: "professional geometric sans" },
  idraulico:     { palette: "blue, white, orange accent", mood: "reliable local tradesman", hero: "professional tools and clean plumbing", font: "bold industrial sans" },
  elettricista:  { palette: "dark charcoal, electric yellow, white", mood: "expert electrical services", hero: "modern electrical panel / clean install", font: "strong technical sans" },
  palestra:      { palette: "black, neon yellow, dark grey", mood: "energetic modern gym", hero: "dynamic fitness action hero", font: "bold condensed display + strong sans" },
  yoga:          { palette: "sage green, warm sand, soft white", mood: "calm mindful wellness studio", hero: "serene yoga studio natural light", font: "soft humanist serif + light sans" },
  farmacia:      { palette: "green, white, clean blue", mood: "trusted professional pharmacy", hero: "clean bright pharmacy interior", font: "clear legible sans-serif" },
  ottico:        { palette: "modern grey, black, one accent color", mood: "contemporary optical boutique", hero: "designer eyewear on clean display", font: "modern geometric sans" },
  autofficina:   { palette: "gunmetal, orange, white", mood: "professional auto repair garage", hero: "clean workshop with premium cars", font: "bold industrial display" },
  immobiliare:   { palette: "navy, gold, white", mood: "premium real estate agency", hero: "luxury property exterior hero", font: "luxury serif + clean sans" },
};

function getCategorySpec(category) {
  if (!category) return null;
  const cat = category.toLowerCase();
  for (const [key, spec] of Object.entries(CATEGORY_DESIGN_SPEC)) {
    if (cat.includes(key)) return spec;
  }
  return null;
}

/**
 * Genera HTML via Google Stitch SDK.
 */
async function generateWithStitch(biz, style) {
  if (!process.env.STITCH_API_KEY) throw new Error("STITCH_API_KEY non configurata");

  const { stitch } = await import("@google/stitch-sdk");
  const { default: axios } = await import("axios");

  const socials = [biz.facebook_url, biz.instagram_url].filter(Boolean);
  const spec = getCategorySpec(biz.category);
  const styleOverride = WEBSITE_STYLES[style]?.prompt || "";

  // Prompt conciso e visivo — Stitch risponde meglio a design spec che a testo lungo
  const designDirective = spec
    ? `Visual identity: ${spec.palette} palette. Mood: ${spec.mood}. Hero: ${spec.hero}. Typography: ${spec.font}.`
    : styleOverride || "Modern Italian local business landing page. Professional and clean.";

  const contactLines = [
    biz.address && `Address: ${biz.address}`,
    biz.phone && `Phone: ${biz.phone}`,
    biz.email && `Email: ${biz.email}`,
    socials.length && `Social: ${socials.join(", ")}`,
    biz.rating && `Rating: ${biz.rating}/5 (${biz.review_count || 0} reviews)`,
  ].filter(Boolean).join(" | ");

  const prompt = `Italian business landing page — "${biz.name}" — ${biz.category || "local business"} in ${biz.area || "Italy"}.
${designDirective}${styleOverride && spec ? ` ${styleOverride}` : ""}
Sections: sticky navbar, full-width hero with CTA, services grid (3-4 cards), about section, testimonials (2-3 Italian), contact section with form.
${contactLines}
All text in Italian. Tailwind CSS. Unique non-generic design. Show real contact info prominently.`;

  // Unique project ID ogni generazione — evita caching di Stitch
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const project = await stitch.createProject(`${biz.name}-${uniqueId}`);
  const screen = await project.generate(prompt);
  const htmlUrl = await screen.getHtml();

  const htmlRes = await axios.get(htmlUrl, { timeout: 60000, responseType: "text" });
  const html = htmlRes.data;

  if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
    throw new Error("Stitch non ha restituito HTML valido");
  }

  return html;
}

/**
 * Genera HTML via Gemini API.
 */
async function generateWithGemini(biz, style, model = "gemini-2.5-pro", siteContext = null) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY non configurata");

  const { default: axios } = await import("axios");
  const prompt = buildWebsitePrompt(biz, style, siteContext);

  let response;
  try {
    response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 1, maxOutputTokens: 16384 } },
      { headers: { "Content-Type": "application/json" }, timeout: 120000 },
    );
  } catch (e) {
    if (e.response) {
      console.error(`[gemini ${model}] ${e.response.status}:`, JSON.stringify(e.response.data).slice(0, 500));
    }
    throw e;
  }

  let html = response.data.candidates[0].content.parts[0].text;
  html = html.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

  if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
    throw new Error("Gemini non ha restituito HTML valido");
  }

  return html;
}

/**
 * Genera un sito landing page completo.
 * @param {object} biz — dati del business dal DB
 * @param {string} [style="auto"] — stile visivo
 * @param {string} [engine="auto"] — "stitch", "gemini_pro", "gemini_flash", o "auto"
 * @returns {Promise<{html: string, engine: string}>} HTML + engine usato
 */
export async function generateWebsiteHtml(biz, style = "auto", engine = "auto") {
  let rawHtml, usedEngine;

  // Scrape context dal sito esistente del business (se presente) — dà a Gemini copy accurato
  const siteContext = biz.website ? await scrapeSiteContext(biz.website) : null;
  if (siteContext) console.log(`[generate-website] Context scraped from ${biz.website} (${siteContext.length} chars)`);

  // Auto: prova Stitch se disponibile, poi Gemini Pro, poi Flash
  if (engine === "auto") {
    if (process.env.STITCH_API_KEY) {
      try {
        rawHtml = await generateWithStitch(biz, style);
        usedEngine = "stitch";
      } catch (e) {
        console.warn("[generate-website] Stitch fallito, fallback a Gemini Pro:", e.message);
      }
    }
    if (!rawHtml && process.env.GEMINI_API_KEY) {
      const modelChain = [
        ["gemini-3.1-pro-preview", "gemini_3_pro"],
        ["gemini-3-flash-preview",  "gemini_3_flash"],
        ["gemini-2.5-pro",          "gemini_pro"],
        ["gemini-2.5-flash",        "gemini_flash"],
      ];
      for (const [model, key] of modelChain) {
        try {
          rawHtml = await generateWithGemini(biz, style, model, siteContext);
          usedEngine = key;
          break;
        } catch (e) {
          console.warn(`[generate-website] ${model} fallito:`, e.message);
        }
      }
      if (!rawHtml) throw new Error("Tutti i modelli Gemini hanno fallito");
    }
    if (!rawHtml) throw new Error("Nessuna API key configurata (STITCH_API_KEY o GEMINI_API_KEY)");
  } else if (engine === "stitch") {
    rawHtml = await generateWithStitch(biz, style);
    usedEngine = "stitch";
  } else if (engine === "gemini_3_pro") {
    rawHtml = await generateWithGemini(biz, style, "gemini-3.1-pro-preview", siteContext);
    usedEngine = "gemini_3_pro";
  } else if (engine === "gemini_pro") {
    rawHtml = await generateWithGemini(biz, style, "gemini-2.5-pro", siteContext);
    usedEngine = "gemini_pro";
  } else if (engine === "gemini_flash_lite") {
    rawHtml = await generateWithGemini(biz, style, "gemini-2.5-flash-lite", siteContext);
    usedEngine = "gemini_flash_lite";
  } else {
    rawHtml = await generateWithGemini(biz, style, "gemini-2.5-flash", siteContext);
    usedEngine = "gemini_flash";
  }

  // Post-processing: sostituisce immagini placeholder con foto reali
  const html = await replaceImagesWithReal(rawHtml, biz);
  return { html, engine: usedEngine };
}

/**
 * Fa il deploy dell'HTML su Netlify.
 * @param {string} html
 * @param {string} slug — slug del business (lettere minuscole, trattini)
 * @returns {Promise<string>} URL pubblico
 */
export async function deployPage(html, slug) {
  return deployToNetlify(html, slug);
}

/**
 * Genera uno slug URL-safe dal nome del business.
 * @param {string} name
 * @returns {string}
 */
export function makeSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // rimuovi accenti
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30)
    .replace(/-$/, "");
}

/**
 * Converts Tailwind CDN classes to inline CSS and strips all <script> tags.
 * Makes the HTML email-compatible (no JS, no CDN dependencies).
 */
export async function inlineForEmail(html) {
  const { makeStylesInline } = await import("tailwind-to-inline");
  const tmpFile = join(tmpdir(), `leadgen-inline-${Date.now()}.html`);
  try {
    writeFileSync(tmpFile, html, "utf8");
    const inlined = await makeStylesInline(tmpFile);
    // Strip all <script> tags
    return inlined.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Takes a 1440x900 screenshot of the generated HTML using Playwright.
 * Saves to uploads/screenshots/ and returns the public path.
 * @param {string} html
 * @param {string} slug
 * @returns {Promise<string>} path like "/uploads/screenshots/slug-timestamp.jpg"
 */
/**
 * Cattura screenshot del sito.
 * Preferisce URL live (rendering fedele: Tailwind CDN + fonts + immagini già caricate).
 * Fallback a HTML inline se URL non disponibile.
 */
export async function captureScreenshot({ url, html, slug }) {
  const { chromium } = await import("playwright");
  const screenshotDir = join(__dirname, "../../../uploads/screenshots");
  mkdirSync(screenshotDir, { recursive: true });

  const filename = `${slug}-${Date.now()}.jpg`;
  const filepath = join(screenshotDir, filename);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    if (url) {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    } else if (html) {
      await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      throw new Error("captureScreenshot: serve url o html");
    }

    // Attendi fonts + 1.5s per CSS transitions/animazioni settle
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(1500);

    await page.screenshot({ path: filepath, type: "jpeg", quality: 90, fullPage: false });
  } finally {
    await browser.close();
  }

  return `/uploads/screenshots/${filename}`;
}