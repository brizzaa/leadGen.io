import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Pubblica un file HTML su Netlify tramite file-digest API.
 * @param {string} html
 * @param {string} slug
 * @returns {Promise<string>} URL pubblico del sito
 */
export async function deployToNetlify(html, slug) {
  const netlifyToken = process.env.NETLIFY_TOKEN;
  if (!netlifyToken) throw new Error("NETLIFY_TOKEN non configurato nel .env");

  const { default: axios } = await import("axios");
  const randomId = Math.random().toString(36).slice(2, 8);
  const siteName = `leadgen-${slug}-${randomId}`;

  const fileBuffer = Buffer.from(html, "utf-8");
  const sha1 = createHash("sha1").update(fileBuffer).digest("hex");
  const jsonHeaders = {
    Authorization: `Bearer ${netlifyToken}`,
    "Content-Type": "application/json",
  };

  const siteRes = await axios.post(
    "https://api.netlify.com/api/v1/sites",
    { name: siteName },
    { headers: jsonHeaders, timeout: 30000 }
  );
  const siteId = siteRes.data.id;
  const siteUrl = siteRes.data.ssl_url || siteRes.data.url;

  const deployRes = await axios.post(
    `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
    { files: { "/index.html": sha1 } },
    { headers: jsonHeaders, timeout: 30000 }
  );
  const deployId = deployRes.data.id;

  await axios.put(
    `https://api.netlify.com/api/v1/deploys/${deployId}/files/index.html`,
    fileBuffer,
    {
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
        "Content-Type": "application/octet-stream",
      },
      timeout: 30000,
    }
  );

  return siteUrl;
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
  gemini_pro: { label: "Gemini 2.5 Pro", desc: "Alta qualità, 100 req/giorno free" },
  gemini_flash: { label: "Gemini 2.5 Flash", desc: "Veloce, 250 req/giorno free" },
};

/**
 * Costruisce il prompt Gemini per la landing page.
 */
function buildWebsitePrompt(biz, style) {
  const socials = [biz.facebook_url, biz.instagram_url].filter(Boolean);
  const hasSocials = socials.length > 0;
  const hasRating = biz.rating && biz.review_count;

  return `You are an expert web designer. Generate a COMPLETE, PRODUCTION-READY single HTML file for a local Italian business landing page.

BUSINESS INFO:
- Name: "${biz.name}"
- Category: ${biz.category || "Attività locale"}
- City: ${biz.area || "Italia"}
${biz.address ? `- Address: ${biz.address}` : ""}
${biz.phone ? `- Phone: ${biz.phone}` : ""}
${biz.email ? `- Email: ${biz.email}` : ""}
${hasSocials ? `- Social: ${socials.join(", ")}` : ""}
${hasRating ? `- Google rating: ${biz.rating}/5 (${biz.review_count} recensioni)` : ""}

TECHNICAL REQUIREMENTS:
- Single self-contained HTML file (no external files except CDN)
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Use Google Fonts: pick a DISTINCTIVE font pairing appropriate for "${biz.category || "business"}" (avoid Inter, Roboto, Open Sans — use fonts like Playfair Display, DM Sans, Outfit, Sora, Space Grotesk, Libre Baskerville, etc.)
- Use Lucide Icons via CDN for all icons (NO emoji): <script src="https://unpkg.com/lucide@latest"></script> then <i data-lucide="icon-name"></i> and call lucide.createIcons() at the end
- Use placeholder images from https://picsum.photos with appropriate sizes (e.g. https://picsum.photos/800/500?random=1)
- Responsive design (mobile-first)
- Smooth scroll behavior
- Subtle animations on scroll (CSS only, use @keyframes and intersection observer pattern with Tailwind)

DESIGN REQUIREMENTS:
- Choose a color palette that fits the business category "${biz.category || "business"}". DO NOT default to purple/indigo. Think about what colors evoke the right feeling for this specific type of business.
- Light or dark theme based on what fits the business category better (restaurants/food = warm light theme, tech/digital = dark, beauty/wellness = soft pastels, construction/trades = bold and industrial)
- Configure Tailwind with custom colors in a <script> block: tailwind.config = { theme: { extend: { colors: { primary: '...', secondary: '...' }}}}
- Professional, modern, NOT generic "AI slop". Make it look like a real business website.
- Good whitespace, visual hierarchy, readable typography
${WEBSITE_STYLES[style]?.prompt || ""}

PAGE SECTIONS (in order):
1. NAVBAR: sticky, business name on left, nav links on right (Servizi, Chi Siamo, Contatti), mobile hamburger menu with JS toggle
2. HERO: full-width, gradient or image background, business name as large heading, compelling Italian tagline for this specific business type, primary CTA button ("Contattaci" or similar)${hasRating ? `, show the Google rating (${biz.rating}★ — ${biz.review_count} recensioni) as a trust badge` : ""}
3. SERVICES: 3-4 service cards with Lucide icons. INVENT realistic services that a "${biz.category || "business"}" in Italy would actually offer. Each with title + short description.
4. ABOUT: brief "Chi Siamo" section with a placeholder image on one side and text on the other. Write 2-3 sentences about a "${biz.category || "business"}" in ${biz.area || "Italia"}.
5. TESTIMONIALS: 2-3 fake but realistic Italian testimonials with names and star ratings. Make them specific to "${biz.category || "this business"}".
6. CONTACT: clean contact section with business info (address, phone, email) displayed with Lucide icons. Add a simple styled contact form (name, email, message, submit button — form action="#" is fine).${hasSocials ? ` Include social media links.` : ""}
7. FOOTER: business name, copyright 2025, "Tutti i diritti riservati"

ALL TEXT MUST BE IN ITALIAN.
Display the real business name, phone, email and address prominently throughout.

OUTPUT: Return ONLY the complete HTML code. No markdown fences, no explanations, no comments before or after. Start with <!DOCTYPE html> and end with </html>.`;
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
async function generateWithGemini(biz, style, model = "gemini-2.5-pro") {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY non configurata");

  const { default: axios } = await import("axios");
  const prompt = buildWebsitePrompt(biz, style);

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1,
        maxOutputTokens: 16384,
      },
    },
    { headers: { "Content-Type": "application/json" }, timeout: 120000 },
  );

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
  // Auto: prova Stitch se disponibile, poi Gemini Pro, poi Flash
  if (engine === "auto") {
    if (process.env.STITCH_API_KEY) {
      try {
        const html = await generateWithStitch(biz, style);
        return { html, engine: "stitch" };
      } catch (e) {
        console.warn("[generate-website] Stitch fallito, fallback a Gemini Pro:", e.message);
      }
    }
    if (process.env.GEMINI_API_KEY) {
      try {
        const html = await generateWithGemini(biz, style, "gemini-2.5-pro");
        return { html, engine: "gemini_pro" };
      } catch (e) {
        console.warn("[generate-website] Gemini Pro fallito, fallback a Flash:", e.message);
        const html = await generateWithGemini(biz, style, "gemini-2.5-flash");
        return { html, engine: "gemini_flash" };
      }
    }
    throw new Error("Nessuna API key configurata (STITCH_API_KEY o GEMINI_API_KEY)");
  }

  if (engine === "stitch") {
    const html = await generateWithStitch(biz, style);
    return { html, engine: "stitch" };
  }

  if (engine === "gemini_pro") {
    const html = await generateWithGemini(biz, style, "gemini-2.5-pro");
    return { html, engine: "gemini_pro" };
  }

  // gemini_flash
  const html = await generateWithGemini(biz, style, "gemini-2.5-flash");
  return { html, engine: "gemini_flash" };
}

/**
 * Fa il deploy dell'HTML su surge.sh (fallback: Netlify).
 * @param {string} html
 * @param {string} slug — slug del business (lettere minuscole, trattini)
 * @returns {Promise<string>} URL pubblico
 */
export async function deployPage(html, slug) {
  const randomId = Math.random().toString(36).slice(2, 8);
  const domain = `leadgen-${slug}-${randomId}.surge.sh`;
  const dir = join(tmpdir(), `leadgen-deploy-${Date.now()}`);

  try {
    mkdirSync(dir);
    writeFileSync(join(dir, "index.html"), html, "utf8");

    // Deploy su surge.sh (usa execFileSync per evitare command injection)
    try {
      const surgeBin = join(__dirname, "../../node_modules/.bin/surge");
      execFileSync(surgeBin, [dir, domain, "--token", process.env.SURGE_TOKEN], {
        encoding: "utf8",
        timeout: 45000,
      });
      return `https://${domain}`;
    } catch (surgeError) {
      // surge fallito — rilancia l'errore, il business verrà marcato come failed
      throw new Error("surge deploy fallito: " + surgeError.message);
    }
  } finally {
    try { rmSync(dir, { recursive: true }); } catch {}
  }
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