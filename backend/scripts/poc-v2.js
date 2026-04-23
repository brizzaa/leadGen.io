// POC v2: landing generator con template-bank + Gemini JSON mode.
// Architettura: Gemini NON genera HTML, solo contenuto strutturato.
// Un renderer Node fonde contenuto + template scelto random + palette random + immagini Pixabay.
//
// Uso: node scripts/poc-v2.js [businessId1,businessId2,businessId3]
// Default business: 533 (gym), 555 (gelateria), 576 (pasticceria).

import "dotenv/config";
import axios from "axios";
import nodemailer from "nodemailer";
import * as cheerio from "cheerio";
import { getDb } from "../src/config/db.js";
import { deployToNetlify, makeSlug } from "../src/services/landingPageBuilder.js";

const DEFAULT_IDS = [533, 555, 576];
const ids = (process.argv[2] || "").split(",").map(s => parseInt(s, 10)).filter(Boolean);
const businessIds = ids.length === 3 ? ids : DEFAULT_IDS;

// ─── PALETTE PRESETS ───────────────────────────────────────────────
const PALETTES = [
  { name: "warm",     primary: "#0F172A", accent: "#F59E0B", bg: "#FFFBF5", text: "#1F2937", muted: "#6B7280" },
  { name: "forest",   primary: "#14532D", accent: "#65A30D", bg: "#F7FEE7", text: "#1F2937", muted: "#6B7280" },
  { name: "ocean",    primary: "#0C4A6E", accent: "#0EA5E9", bg: "#F0F9FF", text: "#0F172A", muted: "#64748B" },
  { name: "berry",    primary: "#4C1D95", accent: "#EC4899", bg: "#FAF5FF", text: "#1F2937", muted: "#6B7280" },
  { name: "slate",    primary: "#0F172A", accent: "#DC2626", bg: "#F8FAFC", text: "#0F172A", muted: "#64748B" },
];

// ─── TEMPLATE A: "Editorial" (serif headings, split layout) ────────
function renderTemplateEditorial({ biz, content, palette, images }) {
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

// ─── TEMPLATE B: "Modern Card" (sans, gradient hero, cards) ───────
function renderTemplateModern({ biz, content, palette, images }) {
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

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

// ─── SCRAPE CONTEXT (inline) ──────────────────────────────────────
async function scrapeContext(url) {
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: { "User-Agent": "Mozilla/5.0 LeadGenBot" },
    });
    const $ = cheerio.load(res.data);
    $("script,style,noscript").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000);
    return text || null;
  } catch {
    return null;
  }
}

// ─── GEMINI JSON CONTENT GENERATION ────────────────────────────────
async function generateContent(biz, siteContext) {
  const prompt = `Sei un copywriter italiano. Scrivi il CONTENUTO (non HTML) per una landing page di: ${biz.name} (${biz.category || "attività"}, ${biz.area || "Italia"}).

${siteContext ? `CONTESTO REALE DAL LORO SITO (usa SOLO questi fatti, non inventare):\n${siteContext}\n` : "Nessun contesto disponibile. Scrivi testi plausibili per la categoria ma senza inventare dettagli specifici (niente nomi, date, numeri inventati).\n"}
REGOLE:
- Italiano, tono professionale ma umano, niente "siamo leader del settore" o slogan vuoti.
- VIETATO inventare testimonial, anni di esperienza specifici, numeri di clienti, premi.
- Se un dato manca, parla del servizio in astratto.

OUTPUT JSON (SOLO JSON, NO markdown):
{
  "tagline": "string 2-5 parole, frase corta in caps-style (es 'Artigiani del gusto')",
  "hero_title": "string 5-10 parole, specifico, non generico",
  "hero_subtitle": "string 15-30 parole, cosa fai e per chi",
  "services": [
    {"title": "nome servizio", "desc": "30-50 parole"},
    {"title": "...", "desc": "..."},
    {"title": "...", "desc": "..."}
  ],
  "about": "40-80 parole, chi siete, cosa vi distingue, evitando cliché"
}`;

  const schema = {
    type: "object",
    properties: {
      tagline: { type: "string" },
      hero_title: { type: "string" },
      hero_subtitle: { type: "string" },
      services: {
        type: "array",
        items: { type: "object", properties: { title: { type: "string" }, desc: { type: "string" } }, required: ["title", "desc"] },
      },
      about: { type: "string" },
    },
    required: ["tagline", "hero_title", "hero_subtitle", "services", "about"],
  };
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: "application/json",
        responseSchema: schema,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
    { headers: { "Content-Type": "application/json" }, timeout: 90000 }
  );
  const raw = res.data.candidates[0].content.parts[0].text;
  try { return JSON.parse(raw); }
  catch (e) { console.error("  raw:", raw.slice(0, 400)); throw e; }
}

// ─── PIXABAY IMAGES ────────────────────────────────────────────────
async function fetchImages(keyword, count = 3) {
  const res = await axios.get("https://pixabay.com/api/", {
    params: {
      key: process.env.PIXABAY_API_KEY,
      q: keyword,
      image_type: "photo",
      orientation: "horizontal",
      per_page: 30,
      order: "popular",
      safesearch: "true",
    },
    timeout: 10000,
  });
  const all = (res.data.hits || []).map(h => h.largeImageURL);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count);
}

function keywordFor(biz) {
  const n = (biz.name + " " + (biz.category || "")).toLowerCase();
  if (/palestra|fit|gym|personal train|bodytec|slimmer/.test(n)) return "modern gym interior";
  if (/gelat/.test(n)) return "italian gelato shop";
  if (/pasticc|dolc|forner|pane/.test(n)) return "italian pastry bakery";
  if (/ristorant|trattoria|osteria/.test(n)) return "cozy italian restaurant";
  if (/caffe|bar |caffett/.test(n)) return "italian espresso cafe";
  if (/toelett|dog|pet/.test(n)) return "dog grooming salon";
  if (/dent|odonto/.test(n)) return "modern dental clinic";
  if (/parrucch|acconc|salon/.test(n)) return "hair salon interior";
  if (/oreficer|gioiell|compro oro/.test(n)) return "jewelry store elegant";
  if (/macelleri/.test(n)) return "italian butcher shop";
  if (/fiorai|vivaio/.test(n)) return "flower shop interior";
  if (/avvoc|legal|notai/.test(n)) return "elegant law office";
  return "local italian small business";
}

// ─── MAIN ──────────────────────────────────────────────────────────
async function processOne(biz) {
  console.log(`\n=== ${biz.name} (#${biz.id}) ===`);
  const siteContext = biz.website ? await scrapeContext(biz.website) : null;
  if (siteContext) console.log(`  context: ${siteContext.length} chars`);

  const content = await generateContent(biz, siteContext);
  console.log(`  content: "${content.hero_title}"`);

  const images = await fetchImages(keywordFor(biz), 3);
  if (images.length < 2) throw new Error("immagini insufficienti");
  console.log(`  images: ${images.length}`);

  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const template = Math.random() < 0.5 ? "editorial" : "modern";
  console.log(`  template: ${template}, palette: ${palette.name}`);

  const renderer = template === "editorial" ? renderTemplateEditorial : renderTemplateModern;
  const html = renderer({ biz, content, palette, images });

  const slug = `pocv2-${makeSlug(biz.name)}`;
  let url, lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try { url = await deployToNetlify(html, slug); break; }
    catch (e) {
      lastErr = e;
      const wait = attempt * 20000;
      console.log(`  netlify ${e.message} — retry ${attempt}/4 in ${wait/1000}s`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  if (!url) throw lastErr;
  console.log(`  → ${url}`);
  return { biz, url, template, palette: palette.name };
}

async function sendReport(results) {
  const senderName = process.env.MY_NAME || "Studio Web";
  const senderEmail = process.env.EMAIL_USER;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: senderEmail, pass: process.env.EMAIL_PASS },
  });
  const rows = results.map(r =>
    `• ${r.biz.name} [${r.template}/${r.palette}]\n  ${r.url}`
  ).join("\n\n");
  await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to: "l.brizzante@bevolve.it",
    subject: "POC v2 — 3 siti template-bank + JSON mode",
    text: `Ciao,\n\nEcco 3 siti generati col nuovo flusso (template-bank + Gemini JSON-only + palette random + Pixabay shuffle).\n\n${rows}\n\nConfronta con la versione vecchia. Se convince, facciamo il refactor sul flusso principale.\n`,
  });
  console.log("\n✉️  Report inviato a l.brizzante@bevolve.it");
}

(async () => {
  const db = getDb();
  const rows = businessIds.map(id => db.prepare("SELECT * FROM businesses WHERE id = ?").get(id)).filter(Boolean);
  if (rows.length !== 3) {
    console.error("Non ho trovato 3 business validi. IDs richiesti:", businessIds);
    process.exit(1);
  }
  const results = [];
  for (const biz of rows) {
    try {
      results.push(await processOne(biz));
    } catch (e) {
      console.error(`  FAIL ${biz.name}:`, e.message);
    }
    await new Promise(r => setTimeout(r, 15000)); // rate limit friendly (Netlify /sites)
  }
  if (results.length === 0) { console.error("Nessun sito generato"); process.exit(1); }
  await sendReport(results);
})().catch(e => { console.error(e); process.exit(1); });
