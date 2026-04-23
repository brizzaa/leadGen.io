// Fix in-place dei siti già deployati su Netlify per Campaign precedenti.
// Non cambia gli URL (stessa site.netlify.app) così i link nelle email continuano a valere.
// Rigenera HTML con il flow POC v2 (template-bank + Gemini JSON + Pixabay shuffle).
//
// Uso:
//   node scripts/fixOldSites.js --dry-run       # mostra lista, non tocca Netlify
//   node scripts/fixOldSites.js --only 3        # fixa solo i primi 3 (test)
//   node scripts/fixOldSites.js                 # fixa tutti (~90, ~90 min)
//   node scripts/fixOldSites.js --from 50       # riparte da indice 50

import "dotenv/config";
import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { getDb } from "../src/config/db.js";

const DRY = process.argv.includes("--dry-run");
const onlyArg = process.argv.indexOf("--only");
const ONLY = onlyArg !== -1 ? parseInt(process.argv[onlyArg + 1], 10) : null;
const fromArg = process.argv.indexOf("--from");
const FROM = fromArg !== -1 ? parseInt(process.argv[fromArg + 1], 10) : 0;

// ─── PALETTE / TEMPLATES (copia da poc-v2.js) ───────────────────────
const PALETTES = [
  { name: "warm",   primary: "#0F172A", accent: "#F59E0B", bg: "#FFFBF5", text: "#1F2937", muted: "#6B7280" },
  { name: "forest", primary: "#14532D", accent: "#65A30D", bg: "#F7FEE7", text: "#1F2937", muted: "#6B7280" },
  { name: "ocean",  primary: "#0C4A6E", accent: "#0EA5E9", bg: "#F0F9FF", text: "#0F172A", muted: "#64748B" },
  { name: "berry",  primary: "#4C1D95", accent: "#EC4899", bg: "#FAF5FF", text: "#1F2937", muted: "#6B7280" },
  { name: "slate",  primary: "#0F172A", accent: "#DC2626", bg: "#F8FAFC", text: "#0F172A", muted: "#64748B" },
];

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function renderEditorial({ biz, content, palette, images }) {
  const services = content.services.map(s =>
    `<div class="py-8 border-b border-gray-200">
       <h3 class="text-2xl mb-2" style="font-family:'Playfair Display',serif;color:${palette.primary}">${escapeHtml(s.title)}</h3>
       <p class="text-[15px] leading-relaxed" style="color:${palette.muted}">${escapeHtml(s.desc)}</p>
     </div>`).join("");
  return `<!DOCTYPE html><html lang="it"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(biz.name)} — ${escapeHtml(content.tagline)}</title>
<meta name="description" content="${escapeHtml(content.hero_subtitle)}">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>body{font-family:'Inter',sans-serif;background:${palette.bg};color:${palette.text}}</style>
</head><body>
<nav class="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-gray-200">
  <div class="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
    <div class="text-xl tracking-tight" style="font-family:'Playfair Display',serif;color:${palette.primary};font-weight:700">${escapeHtml(biz.name)}</div>
    <a href="tel:${escapeHtml(biz.phone || "")}" class="text-sm font-medium px-5 py-2 rounded-full text-white hover:opacity-90 transition" style="background:${palette.primary}">Chiamaci</a>
  </div>
</nav>
<section class="max-w-6xl mx-auto px-6 pt-24 pb-20 grid md:grid-cols-5 gap-12 items-center">
  <div class="md:col-span-3">
    <div class="text-xs uppercase tracking-[0.25em] mb-6" style="color:${palette.accent}">${escapeHtml(content.tagline)}</div>
    <h1 class="text-5xl md:text-6xl leading-[1.05] mb-8" style="font-family:'Playfair Display',serif;color:${palette.primary};font-weight:700">${escapeHtml(content.hero_title)}</h1>
    <p class="text-lg leading-relaxed mb-10 max-w-xl" style="color:${palette.muted}">${escapeHtml(content.hero_subtitle)}</p>
    <div class="flex gap-4">
      ${biz.phone ? `<a href="tel:${escapeHtml(biz.phone)}" class="px-7 py-3 rounded-full text-white font-medium hover:opacity-90" style="background:${palette.primary}">${escapeHtml(biz.phone)}</a>` : ""}
      ${biz.email ? `<a href="mailto:${escapeHtml(biz.email)}" class="px-7 py-3 rounded-full font-medium border hover:bg-gray-50" style="border-color:${palette.primary};color:${palette.primary}">Scrivici</a>` : ""}
    </div>
  </div>
  <div class="md:col-span-2 aspect-[3/4] rounded-2xl overflow-hidden shadow-xl">
    <img src="${images[0]}" alt="${escapeHtml(biz.name)}" class="w-full h-full object-cover">
  </div>
</section>
<section class="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-16">
  <div>
    <div class="text-xs uppercase tracking-[0.25em] mb-4" style="color:${palette.accent}">Cosa offriamo</div>
    <h2 class="text-4xl mb-6" style="font-family:'Playfair Display',serif;color:${palette.primary};font-weight:700">Servizi</h2>
  </div>
  <div>${services}</div>
</section>
<section class="py-24" style="background:${palette.primary}">
  <div class="max-w-4xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
    <div class="aspect-[4/3] rounded-2xl overflow-hidden"><img src="${images[1]}" class="w-full h-full object-cover" alt=""></div>
    <div>
      <div class="text-xs uppercase tracking-[0.25em] mb-4" style="color:${palette.accent}">Chi siamo</div>
      <h2 class="text-4xl mb-6 text-white" style="font-family:'Playfair Display',serif;font-weight:700">La nostra storia</h2>
      <p class="text-white/80 leading-relaxed">${escapeHtml(content.about)}</p>
    </div>
  </div>
</section>
<footer class="py-12 text-center text-sm" style="color:${palette.muted}">
  <div>${escapeHtml(biz.name)}${biz.area ? ` · ${escapeHtml(biz.area)}` : ""}</div>
  <div class="mt-1">${biz.phone ? escapeHtml(biz.phone) : ""}${biz.phone && biz.email ? " · " : ""}${biz.email ? escapeHtml(biz.email) : ""}</div>
</footer>
</body></html>`;
}

function renderModern({ biz, content, palette, images }) {
  const cards = content.services.map((s, i) =>
    `<div class="p-8 rounded-2xl bg-white shadow-sm hover:shadow-md transition border border-gray-100">
       <div class="w-12 h-12 rounded-xl mb-5 flex items-center justify-center text-white font-bold text-xl" style="background:${palette.accent}">${i+1}</div>
       <h3 class="text-xl font-semibold mb-3" style="color:${palette.primary}">${escapeHtml(s.title)}</h3>
       <p class="text-[15px] leading-relaxed" style="color:${palette.muted}">${escapeHtml(s.desc)}</p>
     </div>`).join("");
  return `<!DOCTYPE html><html lang="it"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(biz.name)} — ${escapeHtml(content.tagline)}</title>
<meta name="description" content="${escapeHtml(content.hero_subtitle)}">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>body{font-family:'Plus Jakarta Sans',sans-serif;background:${palette.bg};color:${palette.text}}</style>
</head><body>
<nav class="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-gray-100">
  <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
    <div class="font-bold text-lg flex items-center gap-2">
      <span class="w-8 h-8 rounded-lg" style="background:linear-gradient(135deg,${palette.primary},${palette.accent})"></span>
      <span style="color:${palette.primary}">${escapeHtml(biz.name)}</span>
    </div>
    <a href="#contatti" class="text-sm font-semibold px-5 py-2.5 rounded-full text-white hover:opacity-90" style="background:${palette.primary}">Contattaci</a>
  </div>
</nav>
<section class="relative overflow-hidden">
  <div class="absolute inset-0" style="background:linear-gradient(135deg,${palette.primary}15 0%,${palette.accent}15 100%)"></div>
  <div class="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
    <div class="inline-block text-xs font-semibold px-4 py-1.5 rounded-full mb-6" style="background:${palette.accent}20;color:${palette.accent}">${escapeHtml(content.tagline)}</div>
    <h1 class="text-5xl md:text-7xl font-extrabold leading-[1.05] mb-8" style="color:${palette.primary}">${escapeHtml(content.hero_title)}</h1>
    <p class="text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto" style="color:${palette.muted}">${escapeHtml(content.hero_subtitle)}</p>
    <div class="flex gap-3 justify-center flex-wrap">
      ${biz.phone ? `<a href="tel:${escapeHtml(biz.phone)}" class="px-7 py-3.5 rounded-full text-white font-semibold hover:opacity-90" style="background:${palette.primary}">📞 ${escapeHtml(biz.phone)}</a>` : ""}
      ${biz.email ? `<a href="mailto:${escapeHtml(biz.email)}" class="px-7 py-3.5 rounded-full font-semibold bg-white border-2 hover:bg-gray-50" style="border-color:${palette.primary};color:${palette.primary}">✉️ Scrivici</a>` : ""}
    </div>
  </div>
  <div class="max-w-5xl mx-auto px-6 pb-20">
    <div class="aspect-[16/9] rounded-3xl overflow-hidden shadow-2xl"><img src="${images[0]}" class="w-full h-full object-cover" alt=""></div>
  </div>
</section>
<section class="max-w-6xl mx-auto px-6 py-20">
  <div class="text-center mb-14">
    <div class="text-xs font-bold uppercase tracking-widest mb-3" style="color:${palette.accent}">Servizi</div>
    <h2 class="text-4xl md:text-5xl font-extrabold" style="color:${palette.primary}">Quello che facciamo</h2>
  </div>
  <div class="grid md:grid-cols-3 gap-6">${cards}</div>
</section>
<section class="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-16 items-center">
  <div class="aspect-square rounded-3xl overflow-hidden"><img src="${images[1]}" class="w-full h-full object-cover" alt=""></div>
  <div>
    <div class="text-xs font-bold uppercase tracking-widest mb-3" style="color:${palette.accent}">Chi siamo</div>
    <h2 class="text-4xl font-extrabold mb-6" style="color:${palette.primary}">Dietro le quinte</h2>
    <p class="text-lg leading-relaxed" style="color:${palette.muted}">${escapeHtml(content.about)}</p>
  </div>
</section>
<section id="contatti" class="py-20" style="background:${palette.primary}">
  <div class="max-w-3xl mx-auto px-6 text-center">
    <h2 class="text-4xl md:text-5xl font-extrabold text-white mb-4">Parliamone</h2>
    <p class="text-lg text-white/70 mb-10">Siamo ${biz.area ? `a ${escapeHtml(biz.area)}` : "qui"} per te.</p>
    <div class="flex gap-3 justify-center flex-wrap">
      ${biz.phone ? `<a href="tel:${escapeHtml(biz.phone)}" class="px-8 py-4 rounded-full font-bold" style="background:${palette.accent};color:white">${escapeHtml(biz.phone)}</a>` : ""}
      ${biz.email ? `<a href="mailto:${escapeHtml(biz.email)}" class="px-8 py-4 rounded-full font-bold bg-white" style="color:${palette.primary}">${escapeHtml(biz.email)}</a>` : ""}
    </div>
  </div>
</section>
<footer class="py-8 text-center text-sm border-t" style="color:${palette.muted};border-color:${palette.muted}30">
  © ${new Date().getFullYear()} ${escapeHtml(biz.name)}${biz.area ? ` · ${escapeHtml(biz.area)}` : ""}
</footer>
</body></html>`;
}

// ─── CONTENT + IMAGES ──────────────────────────────────────────────
async function scrapeContext(url) {
  try {
    const res = await axios.get(url, { timeout: 15000, maxRedirects: 5, headers: { "User-Agent": "Mozilla/5.0 LeadGenBot" } });
    const $ = cheerio.load(res.data);
    $("script,style,noscript").remove();
    return $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000) || null;
  } catch { return null; }
}

async function generateContent(biz, siteContext) {
  const prompt = `Sei un copywriter italiano. Scrivi il CONTENUTO (non HTML) per una landing page di: ${biz.name} (${biz.category || "attività"}, ${biz.area || "Italia"}).

${siteContext ? `CONTESTO REALE DAL LORO SITO (usa SOLO questi fatti, non inventare):\n${siteContext}\n` : "Nessun contesto disponibile. Scrivi testi plausibili per la categoria ma senza inventare dettagli specifici.\n"}
REGOLE:
- Italiano, tono professionale ma umano.
- VIETATO inventare testimonial, anni di esperienza, numeri di clienti, premi.
- Se un dato manca parla del servizio in astratto.

IMAGE KEYWORDS:
Genera 3 keyword IN INGLESE per Pixabay, concrete e visive, specifiche al tipo di attività REALE (non generiche).
Esempi:
- Toelettatura cani → ["dog grooming salon", "professional dog wash", "groomed poodle"]
- Associazione di danza creativa → ["contemporary dance studio", "children dance class", "ballet rehearsal room"]
- Officina meccanica → ["car repair workshop", "mechanic tools garage", "auto engine diagnostic"]
- Compro oro → ["gold coins jewelry", "antique gold necklace", "jewelry appraiser"]
VIETATO: "small business", "local shop", "italian storefront", "people collaboration", "office interior" (troppo generico = immagini sbagliate).

OUTPUT JSON.`;
  const schema = {
    type: "object",
    properties: {
      tagline: { type: "string" },
      hero_title: { type: "string" },
      hero_subtitle: { type: "string" },
      services: { type: "array", items: { type: "object", properties: { title: { type: "string" }, desc: { type: "string" } }, required: ["title","desc"] } },
      about: { type: "string" },
      image_keywords: { type: "array", items: { type: "string" } },
    },
    required: ["tagline","hero_title","hero_subtitle","services","about","image_keywords"],
  };
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } } },
    { headers: { "Content-Type": "application/json" }, timeout: 90000 }
  );
  return JSON.parse(res.data.candidates[0].content.parts[0].text);
}

function keywordFor(biz) {
  const n = (biz.name + " " + (biz.category || "")).toLowerCase();
  if (/palestra|fit|gym|personal train|bodytec|slimmer|crossfit/.test(n)) return "modern gym interior";
  if (/gelat/.test(n)) return "italian gelato shop";
  if (/pasticc|dolc|forner|pane/.test(n)) return "italian pastry bakery";
  if (/ristorant|trattoria|osteria|pizzeria/.test(n)) return "cozy italian restaurant";
  if (/caffe|bar |caffett|pub/.test(n)) return "italian espresso cafe";
  if (/toelett|dog|pet|zampa|cane|veterinari/.test(n)) return "dog grooming salon";
  if (/dent|odonto/.test(n)) return "modern dental clinic";
  if (/parrucch|acconc|salon|barbiere/.test(n)) return "hair salon interior";
  if (/oreficer|gioiell|compro oro/.test(n)) return "jewelry store elegant";
  if (/macelleri/.test(n)) return "italian butcher shop";
  if (/fiorai|vivaio/.test(n)) return "flower shop interior";
  if (/avvoc|legal|notai/.test(n)) return "elegant law office";
  if (/medic|dott|ambulator|clinic|sanitari|fisio|psicol|ortoped/.test(n)) return "modern medical office";
  if (/autonom|autoneri|officina|meccanic|carrozzeri/.test(n)) return "car repair workshop";
  if (/onoranze|funebre/.test(n)) return "elegant funeral flowers";
  if (/pesch/.test(n)) return "fresh fish market";
  if (/alimentari|market/.test(n)) return "italian grocery shop";
  if (/ottica/.test(n)) return "optical store modern";
  if (/erborister|farmac|parafarm/.test(n)) return "pharmacy herbal shop";
  if (/immobili|agenzia/.test(n)) return "modern real estate office";
  if (/assicuraz|generali/.test(n)) return "insurance office professional";
  if (/tipografi|stamperi/.test(n)) return "print shop typography";
  if (/ferramenta/.test(n)) return "hardware store tools";
  if (/agritur/.test(n)) return "italian agriturismo countryside";
  if (/studio|consulenz/.test(n)) return "professional office modern";
  return "italian small business storefront";
}

// De-dup cross-site: immagini già usate nella run corrente
const USED_IMAGE_IDS = new Set();

// Fetch candidati Pixabay per tutte le keyword, escludendo già usate.
// Combina page=1 e page=2 per diversità.
async function fetchImageCandidates(keywords, maxCandidates = 12) {
  const candidates = [];
  const seen = new Set();
  for (const kw of keywords) {
    if (candidates.length >= maxCandidates) break;
    for (const page of [1, 2, 3]) {
      if (candidates.length >= maxCandidates) break;
      try {
        const res = await axios.get("https://pixabay.com/api/", {
          params: {
            key: process.env.PIXABAY_API_KEY,
            q: kw,
            image_type: "photo",
            orientation: "horizontal",
            per_page: 20,
            page,
            order: "popular",
            safesearch: "true",
          },
          timeout: 10000,
        });
        for (const h of (res.data.hits || [])) {
          if (candidates.length >= maxCandidates) break;
          if (seen.has(h.id) || USED_IMAGE_IDS.has(h.id)) continue;
          seen.add(h.id);
          // webformatURL è l'unico hotlinkable; largeImageURL (_1280) risponde 400 se usato come <img src>.
          candidates.push({ id: h.id, large: h.webformatURL || h.previewURL, preview: h.previewURL, tags: h.tags, keyword: kw });
        }
      } catch (e) {
        console.warn(`    pixabay "${kw}" page ${page} fail: ${e.message}`);
      }
    }
  }
  return candidates;
}

// Scarica thumbnail e la converte in base64 inline per Gemini Vision
async function thumbnailToBase64(url) {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
  return Buffer.from(res.data).toString("base64");
}

// Usa Gemini Vision per scegliere il miglior candidato (index-based) e il 2nd/3rd
async function rerankWithVision(biz, content, candidates) {
  const context = `Business: ${biz.name} (${biz.category || "attività"}, ${biz.area || "Italia"})
Descrizione: ${content.tagline} — ${content.hero_subtitle}
Servizi: ${content.services.map(s => s.title).join(", ")}`;

  const parts = [
    { text: `Seleziona le 2 foto che meglio rappresentano visivamente questo business per la hero section di una landing page.

${context}

CRITERI:
- Deve essere pertinente al settore/servizio (no generica, no fuori contesto, no sofà/uffici se è un business fisico diverso).
- Preferisci foto reali dell'attività/ambiente/oggetto, non astratte né persone-con-laptop.
- Se tutte sono deboli, scegli le meno fuori tema.

Ecco ${candidates.length} candidati (index 0-${candidates.length-1}):

RISPOSTA JSON: {"best": <index>, "second": <index>, "reason_best": "<breve>"}` },
  ];

  for (let i = 0; i < candidates.length; i++) {
    parts.push({ text: `[${i}]` });
    parts.push({ inlineData: { mimeType: "image/jpeg", data: await thumbnailToBase64(candidates[i].preview) } });
  }

  const schema = {
    type: "object",
    properties: {
      best: { type: "integer" },
      second: { type: "integer" },
      reason_best: { type: "string" },
    },
    required: ["best", "second", "reason_best"],
  };

  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{ parts }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
    },
    { headers: { "Content-Type": "application/json" }, timeout: 120000 }
  );
  return JSON.parse(res.data.candidates[0].content.parts[0].text);
}

async function fetchImages(keywords, count = 3, biz, content) {
  const candidates = await fetchImageCandidates(keywords, 12);
  if (candidates.length < 2) throw new Error(`solo ${candidates.length} candidati Pixabay`);

  const pick = await rerankWithVision(biz, content, candidates);
  const bestIdx = Math.min(Math.max(pick.best, 0), candidates.length - 1);
  const secondIdx = Math.min(Math.max(pick.second, 0), candidates.length - 1);

  console.log(`    img ✓ best=[${bestIdx}] id=${candidates[bestIdx].id} "${candidates[bestIdx].keyword}" · ${pick.reason_best.slice(0, 80)}`);

  // 3a immagine: random dai rimanenti (per sezione about)
  const others = candidates.filter((_, i) => i !== bestIdx && i !== secondIdx);
  const third = others.length ? others[Math.floor(Math.random() * others.length)] : candidates[bestIdx];

  // Registra le immagini usate per evitare cloni nelle iterazioni successive
  USED_IMAGE_IDS.add(candidates[bestIdx].id);
  USED_IMAGE_IDS.add(candidates[secondIdx].id);
  USED_IMAGE_IDS.add(third.id);

  return [candidates[bestIdx].large, candidates[secondIdx].large, third.large];
}

// ─── NETLIFY UPDATE IN-PLACE ──────────────────────────────────────
function extractSiteName(url) {
  const m = url.match(/https?:\/\/([^.]+)\.netlify\.app/);
  return m ? m[1] : null;
}

async function updateNetlifySite(siteName, html) {
  const token = process.env.NETLIFY_TOKEN;
  const auth = { Authorization: `Bearer ${token}` };

  // 1. Get site by name
  const listRes = await axios.get(`https://api.netlify.com/api/v1/sites?name=${encodeURIComponent(siteName)}`, { headers: auth, timeout: 20000 });
  const site = (listRes.data || []).find(s => s.name === siteName);
  if (!site) throw new Error(`sito ${siteName} non trovato su Netlify`);

  // 2. Create deploy with file digest
  const buf = Buffer.from(html, "utf-8");
  const sha1 = crypto.createHash("sha1").update(buf).digest("hex");
  const deployRes = await axios.post(
    `https://api.netlify.com/api/v1/sites/${site.id}/deploys`,
    { files: { "/index.html": sha1 } },
    { headers: { ...auth, "Content-Type": "application/json" }, timeout: 30000 }
  );

  // 3. Upload file
  await axios.put(
    `https://api.netlify.com/api/v1/deploys/${deployRes.data.id}/files/index.html`,
    buf,
    { headers: { ...auth, "Content-Type": "application/octet-stream" }, timeout: 30000 }
  );
  return site.ssl_url || site.url;
}

// ─── MAIN ──────────────────────────────────────────────────────────
async function fixOne(biz, siteName) {
  const siteContext = biz.website ? await scrapeContext(biz.website) : null;
  const content = await generateContent(biz, siteContext);
  const aiKeywords = Array.isArray(content.image_keywords) && content.image_keywords.length ? content.image_keywords : [keywordFor(biz)];
  const images = await fetchImages(aiKeywords, 3, biz, content);
  if (images.length < 2) throw new Error("immagini insufficienti");
  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const template = Math.random() < 0.5 ? "editorial" : "modern";
  const render = template === "editorial" ? renderEditorial : renderModern;
  const html = render({ biz, content, palette, images });
  await updateNetlifySite(siteName, html);
  return { template, palette: palette.name };
}

async function withRetry(fn, label) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const code = e.response?.status;
      const wait = attempt * 20000;
      console.log(`  ${label} ${e.message} (${code||"-"}) — retry ${attempt}/4 in ${wait/1000}s`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

(async () => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT DISTINCT cr.landing_url, cr.business_id, b.*
    FROM campaign_results cr
    JOIN businesses b ON b.id = cr.business_id
    WHERE cr.status='sent' AND cr.landing_url IS NOT NULL
    ORDER BY cr.business_id
  `).all();

  console.log(`Totale siti da fixare: ${rows.length}`);

  let list = rows.slice(FROM);
  if (ONLY) list = list.slice(0, ONLY);

  if (DRY) {
    list.forEach((r, i) => console.log(`  [${i+FROM}] ${r.name} → ${r.landing_url}`));
    console.log(`\nDRY-RUN: selezionati ${list.length}`);
    return;
  }

  let ok = 0, fail = 0;
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const idx = i + FROM;
    const siteName = extractSiteName(r.landing_url);
    if (!siteName) { console.log(`[${idx}] SKIP ${r.name}: url non parsabile`); continue; }
    console.log(`\n[${idx}/${rows.length-1}] ${r.name} (${siteName})`);
    try {
      const info = await withRetry(() => fixOne(r, siteName), "fix");
      console.log(`  ✓ ${info.template}/${info.palette}`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
      fail++;
    }
    // Sleep tra siti per rispettare rate limit Netlify/Gemini
    await new Promise(res => setTimeout(res, 12000));
  }
  console.log(`\nDONE: ${ok} fixed, ${fail} failed.`);
})().catch(e => { console.error(e); process.exit(1); });
