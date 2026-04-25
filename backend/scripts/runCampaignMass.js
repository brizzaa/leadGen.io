// Mass outreach: genera N siti + invia email a N business del DB.
// Deploy su Cloudflare R2+Workers (*.leader-gen.com).
// Uso:
//   node scripts/runCampaignMass.js --demo                  # 3 siti, senza invio email (solo URL a te)
//   node scripts/runCampaignMass.js --limit 100             # 100 siti + 100 email
//   node scripts/runCampaignMass.js --limit 100 --dry-run   # genera siti ma NON invia email
//   node scripts/runCampaignMass.js --from 20 --limit 10    # range manuale

import "dotenv/config";
import axios from "axios";
import * as cheerio from "cheerio";
import nodemailer from "nodemailer";
import { getDb } from "../src/config/db.js";
import { PALETTES, pickTemplate, pickPalette, render } from "../src/services/siteRenderer.js";
import { deploySite, buildSlug } from "../src/services/cloudflareDeployer.js";
import { searchEmailViaDDG, searchSocialsViaDDGHttp, extractContactsFromWebsite, extractContactsFromFacebook, extractContactsFromInstagram } from "../src/services/socialScanner.js";
import { captureScreenshot } from "../src/services/landingPageBuilder.js";
import { sendOutreachEmail } from "../src/services/mailer.js";
import { scheduleFollowUps } from "../src/services/followUpEngine.js";

const USER_ID = parseInt(process.env.FOLLOWUP_USER_ID || "3", 10);

const args = process.argv.slice(2);
const arg = (k, def = null) => { const i = args.indexOf(k); return i === -1 ? def : args[i + 1]; };
const has = k => args.includes(k);

const DEMO = has("--demo");
const DRY = has("--dry-run");
const LIMIT = DEMO ? parseInt(arg("--limit", "5"), 10) : parseInt(arg("--limit", "100"), 10);
const FROM = parseInt(arg("--from", "0"), 10);

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

if (!GEMINI_KEY || !PIXABAY_KEY) {
  console.error("GEMINI_API_KEY o PIXABAY_API_KEY mancante");
  process.exit(1);
}

// ─── Social enrichment a cascata ────────────────────────────────────
// Ordine: sito → FB page → IG bio → scan DDG social → DDG email
async function enrichSocial(biz) {
  const db = getDb();

  function patch(updates) {
    if (!Object.keys(updates).length) return;
    const sets = Object.keys(updates).map(k => `${k}=?`).join(", ");
    db.prepare(`UPDATE businesses SET ${sets} WHERE id=?`).run(...Object.values(updates), biz.id);
    biz = { ...biz, ...updates };
    const labels = Object.entries(updates).map(([k, v]) => `${k}:${v}`).join(" ");
    console.log(`    enriched → ${labels}`);
  }

  // 1. Sito web: email, tel, IG, FB
  if (biz.website && (!biz.email || !biz.phone || !biz.instagram_url)) {
    try {
      const c = await extractContactsFromWebsite(biz.website);
      const updates = {};
      if (c.email && !biz.email) { updates.email = c.email; updates.email_source_url = biz.website; }
      if (c.phone && !biz.phone) updates.phone = c.phone;
      if (c.instagram_url && !biz.instagram_url) updates.instagram_url = c.instagram_url;
      if (c.facebook_url && !biz.facebook_url) updates.facebook_url = c.facebook_url;
      patch(updates);
    } catch {}
  }

  // 2. Facebook page: email, tel
  if (biz.facebook_url && (!biz.email || !biz.phone)) {
    try {
      const c = await extractContactsFromFacebook(biz.facebook_url);
      const updates = {};
      if (c.email && !biz.email) { updates.email = c.email; updates.email_source_url = biz.facebook_url; }
      if (c.phone && !biz.phone) updates.phone = c.phone;
      patch(updates);
    } catch {}
  }

  // 3. Instagram bio (Playwright): email, tel
  if (biz.instagram_url && (!biz.email || !biz.phone)) {
    try {
      const c = await extractContactsFromInstagram(biz.instagram_url);
      const updates = {};
      if (c.email && !biz.email) { updates.email = c.email; updates.email_source_url = biz.instagram_url; }
      if (c.phone && !biz.phone) updates.phone = c.phone;
      patch(updates);
    } catch {}
  }

  // 4. DDG HTTP social scan: trova IG/FB se non trovati sopra (no Playwright)
  if (!biz.instagram_url && !biz.facebook_url && biz.name) {
    try {
      const social = await searchSocialsViaDDGHttp(biz.name, biz.area);
      const updates = {};
      if (social.instagram_url) updates.instagram_url = social.instagram_url;
      if (social.facebook_url) updates.facebook_url = social.facebook_url;
      if (Object.keys(updates).length) {
        patch(updates);
        // Ri-scrapa FB/IG appena trovati
        if (!biz.email || !biz.phone) {
          if (biz.facebook_url) {
            const c = await extractContactsFromFacebook(biz.facebook_url).catch(() => ({}));
            const u = {};
            if (c.email && !biz.email) { u.email = c.email; u.email_source_url = biz.facebook_url; }
            if (c.phone && !biz.phone) u.phone = c.phone;
            patch(u);
          }
          if (biz.instagram_url) {
            const c = await extractContactsFromInstagram(biz.instagram_url).catch(() => ({}));
            const u = {};
            if (c.email && !biz.email) { u.email = c.email; u.email_source_url = biz.instagram_url; }
            if (c.phone && !biz.phone) u.phone = c.phone;
            patch(u);
          }
        }
      }
    } catch (e) { console.warn(`    social scan fail: ${e.message}`); }
  }

  // 5. DDG email search: ultima risorsa
  if (!biz.email && biz.name) {
    try {
      const email = await searchEmailViaDDG(biz.name, biz.area);
      if (email) patch({ email, email_source_url: `https://duckduckgo.com/?q=${encodeURIComponent(biz.name + " " + biz.area + " email")}` });
    } catch (e) { console.warn(`    DDG email fail: ${e.message}`); }
  }

  return biz;
}

// ─── Scrape context ────────────────────────────────────────────────
async function scrapeContext(url) {
  try {
    const res = await axios.get(url, { timeout: 15000, maxRedirects: 5, headers: { "User-Agent": "Mozilla/5.0 LeadGenBot" } });
    const $ = cheerio.load(res.data);
    $("script,style,noscript").remove();
    return $("body").text().replace(/\s+/g, " ").trim().slice(0, 2000) || null;
  } catch { return null; }
}

// ─── Gemini content ────────────────────────────────────────────────
async function generateContent(biz, siteContext) {
  const contactsInDb = [biz.phone, biz.email].filter(Boolean).join(", ") || "nessun contatto in DB";

  const prompt = `Sei un copywriter italiano esperto. Scrivi il CONTENUTO di una landing page per: ${biz.name} (${biz.category || "attività"}, ${biz.area || "Italia"}).

${siteContext ? `CONTESTO REALE DAL LORO SITO (usa SOLO questi fatti, non inventare):\n${siteContext}\n` : "Nessun contesto disponibile. Scrivi testi plausibili per la categoria ma senza inventare dettagli specifici.\n"}

CONTATTI AUTORIZZATI (solo questi, NESSUN altro numero/email):
${contactsInDb}

REGOLE GENERALI:
- Italiano, tono professionale ma umano, mai commerciale stucchevole.
- VIETATO inventare: testimonial, anni di esperienza, numeri di clienti, premi, certificazioni, numeri di telefono, email, indirizzi precisi.
- Se il contesto sopra menziona città/provincia DIVERSE da "${biz.area || "Italia"}", usa quelle (più affidabili). Altrimenti usa "${biz.area || "Italia"}".

FIELD RULES:
- tagline: MAX 40 caratteri, 3-6 parole, NO frase completa. Es: "Colli Berici · Vicenza" o "Pane fresco dal 1985". NON "Un sorso di tradizione e storia sui Colli".
- hero_title: nome business o variante breve (max 6 parole).
- hero_subtitle: 1 frase, max 18 parole.
- services_intro: 1 frase CONCRETA riferita al business, NON filler tipo "pensato per te", "su misura", "con attenzione". Es: "Tre vini, una sola vigna, tutto fatto a mano." VIETATO: "Ogni servizio è pensato attorno a te", "Soluzioni per ogni esigenza", simili.
- trust_points: 3 qualità CONCRETE e verosimili (es. "Ascolto", "Trasparenza", "Qualità"), desc da 1 frase corta. NO numeri/anni/quantità inventate.
- services: 3-4 servizi coerenti col business (title max 4 parole, desc 1-2 frasi, SENZA numeri/prezzi).
- faq: 3 Q&A realistiche. Nelle risposte USA SOLO i contatti autorizzati sopra. VIETATO inserire numeri di telefono diversi da quelli in DB. Mai inventare orari/prezzi.
- about: 2-4 frasi, solo fatti dal contesto (o generico se manca contesto).

IMAGE KEYWORDS:
Genera 3 keyword IN INGLESE per Pixabay, concrete e visive, specifiche al business reale.
Esempi per settore:
- Toelettatura cani → ["dog grooming salon","professional dog wash","groomed poodle"]
- Palestra → ["modern gym weights","fitness training","gym interior"]
- Avvocato → ["law firm office","legal consultation","scales of justice"]
VIETATO: "small business","italian storefront","people collaboration","office interior" (troppo generici).

EXTRA:
- display_area: città reale del business (estratta dal contesto se disponibile, altrimenti "${biz.area || ""}").

OUTPUT JSON solo.`;

  const schema = {
    type: "object",
    properties: {
      tagline: { type: "string" },
      hero_title: { type: "string" },
      hero_subtitle: { type: "string" },
      services_intro: { type: "string" },
      services: {
        type: "array",
        items: { type: "object", properties: { title: { type: "string" }, desc: { type: "string" } }, required: ["title", "desc"] },
      },
      about: { type: "string" },
      trust_points: {
        type: "array",
        items: { type: "object", properties: { title: { type: "string" }, desc: { type: "string" } }, required: ["title", "desc"] },
      },
      faq: {
        type: "array",
        items: { type: "object", properties: { q: { type: "string" }, a: { type: "string" } }, required: ["q", "a"] },
      },
      image_keywords: { type: "array", items: { type: "string" } },
      display_area: { type: "string" },
    },
    required: ["tagline", "hero_title", "hero_subtitle", "services", "about", "trust_points", "faq", "image_keywords"],
  };

  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } } },
      { headers: { "Content-Type": "application/json" }, timeout: 90000 }
    );
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return JSON.parse(text);
    last = `gemini empty: finishReason=${res.data?.candidates?.[0]?.finishReason} promptFeedback=${JSON.stringify(res.data?.promptFeedback || {})}`;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(last);
}

// ─── Pixabay + Gemini Vision re-rank ───────────────────────────────
const USED_IMAGE_IDS = new Set();

async function fetchImageCandidates(keywords, maxCandidates = 12) {
  const candidates = [];
  const seen = new Set();
  for (const kw of keywords) {
    if (candidates.length >= maxCandidates) break;
    for (const page of [1, 2, 3]) {
      if (candidates.length >= maxCandidates) break;
      try {
        const res = await axios.get("https://pixabay.com/api/", {
          params: { key: PIXABAY_KEY, q: kw, image_type: "photo", orientation: "horizontal", per_page: 20, page, order: "popular", safesearch: "true" },
          timeout: 10000,
        });
        for (const h of res.data.hits || []) {
          if (candidates.length >= maxCandidates) break;
          if (seen.has(h.id) || USED_IMAGE_IDS.has(h.id)) continue;
          seen.add(h.id);
          // webformatURL è hotlinkable; largeImageURL (_1280) risponde 400 come <img src>.
          candidates.push({ id: h.id, large: h.webformatURL || h.previewURL, preview: h.previewURL, tags: h.tags, keyword: kw });
        }
      } catch { /* skip */ }
    }
  }
  return candidates;
}

async function thumbnailToBase64(url) {
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
  return Buffer.from(res.data).toString("base64");
}

async function rerankWithVision(biz, content, candidates) {
  const context = `Business: ${biz.name} (${biz.category || "attività"}, ${biz.area || "Italia"})
Servizi: ${content.services.map(s => s.title).join(", ")}`;
  const parts = [
    { text: `Seleziona le 2 foto che meglio rappresentano questo business.\n\n${context}\n\nCRITERI: pertinente al settore, non generica, no sofà/laptop se non è un'attività IT.\n\n${candidates.length} candidati indicizzati 0-${candidates.length - 1}.\n\nJSON: {"best": <idx>, "second": <idx>, "reason": "<breve>"}` },
  ];
  for (let i = 0; i < candidates.length; i++) {
    parts.push({ text: `[${i}]` });
    parts.push({ inlineData: { mimeType: "image/jpeg", data: await thumbnailToBase64(candidates[i].preview) } });
  }
  const schema = {
    type: "object",
    properties: { best: { type: "integer" }, second: { type: "integer" }, reason: { type: "string" } },
    required: ["best", "second", "reason"],
  };
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    { contents: [{ parts }], generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } } },
    { headers: { "Content-Type": "application/json" }, timeout: 120000 }
  );
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { best: 0, second: 1, reason: "fallback" };
  return JSON.parse(text);
}

async function fetchImages(keywords, biz, content) {
  const candidates = await fetchImageCandidates(keywords, 12);
  if (candidates.length < 2) throw new Error(`solo ${candidates.length} candidati Pixabay`);
  const pick = await rerankWithVision(biz, content, candidates);
  const bestIdx = Math.min(Math.max(pick.best, 0), candidates.length - 1);
  const secondIdx = Math.min(Math.max(pick.second, 0), candidates.length - 1);
  const others = candidates.filter((_, i) => i !== bestIdx && i !== secondIdx);
  const third = (others.length ? others[Math.floor(Math.random() * others.length)] : null) ?? candidates[bestIdx] ?? candidates[0];
  const best = candidates[bestIdx] ?? candidates[0];
  const second = candidates[secondIdx] ?? candidates[Math.min(1, candidates.length - 1)];
  if (best?.id) USED_IMAGE_IDS.add(best.id);
  if (second?.id) USED_IMAGE_IDS.add(second.id);
  if (third?.id) USED_IMAGE_IDS.add(third.id);
  console.log(`    img best=${best?.id} "${best?.keyword}"`);
  return [best.large, second.large, third.large];
}

// ─── Email ─────────────────────────────────────────────────────────
async function generateEmail(biz, siteUrl, siteContext) {
  const myName = process.env.MY_NAME || "Luca Brizzante";
  const myWhatsapp = process.env.MY_WHATSAPP || "";
  const contactLine = myWhatsapp
    ? `Puoi rispondermi qui o scrivermi su WhatsApp al ${myWhatsapp}.`
    : "Puoi rispondermi direttamente a questa email.";

  const ctxBlock = siteContext
    ? `\nCONTESTO REALE DAL LORO SITO (usa per un riferimento specifico, SENZA inventare):\n${siteContext.slice(0, 1200)}\n`
    : "";

  const prompt = `Sei un consulente che aiuta piccole attività italiane a lavorare meglio. Scrivi una cold email per ${biz.name} (${biz.category || "attività locale"} a ${biz.area || "Italia"}).
${ctxBlock}
CHI SEI E COSA OFFRI:
Non fai solo siti web. Analizzi il business e proponi soluzioni concrete per ridurre i tempi morti: prenotazioni online, automazioni WhatsApp, gestione recensioni, liste d'attesa digitali, follow-up clienti, ecc. Il sito è il punto di partenza — poi lavori sul problema vero: far rendere di più le ore già aperte.

PSICOLOGIA DA USARE (sottile, non spinta):
- Specchio: apri descrivendo un piccolo attrito che vivono davvero ("il telefono che squilla mentre sei col cliente", "clienti che non ti richiamano dopo il preventivo", "ore morte tra un appuntamento e l'altro"). Scegli quello più plausibile per ${biz.category || "il settore"}.
- Paura della perdita (1 riga, mai gridato): inserisci UNA frase che fa toccare il costo dell'inazione — clienti persi senza saperlo, concorrenti trovati al posto loro, preventivi mai seguiti. Non scrivere statistiche inventate. Scegli la perdita più concreta per il settore. Es: "Ogni settimana qualcuno cerca [categoria] a [città] e trova qualcun altro." oppure "I preventivi che non rispondono vanno da qualche altra parte." Deve sembrare ovvio, non allarmistico.
- Aggancio specifico (OBBLIGATORIO se c'è contesto sopra): cita UNA cosa concreta pescata dal loro sito (un servizio, una peculiarità, una località, un piatto, un orario) in modo naturale. Dimostra che hai letto, non mandato broadcast. Mai copiare frasi intere — parafrasa.
- Dono senza "devo": hai già fatto la demo, è lì, nessun impegno.
- Curiosità > pitch: accenna altre cose oltre al sito senza elencarle, lascia spazio alla domanda.
- Tono pari-a-pari: non da venditore, da professionista che conosce il mestiere.

VALORE CONCRETO DA TRASMETTERE (scegli 1-2 angoli più plausibili per ${biz.category || "il settore"}):
- Risparmio di tempo: es. "prenotazioni che arrivano da soli mentre sei col cliente", "preventivi che si rispondono da soli", "recensioni gestite in automatico", "follow-up che partono senza che tu ci pensi". Scegli quello più realistico per la categoria.
- Più clienti senza più ore: non lavorare di più — fare in modo che ogni ora aperta renda di più. Un cliente che trova risposte subito non va altrove.
- Concretezza: non dire "digitalizziamo il tuo business". Di' cosa cambia nel quotidiano: meno telefonate che interrompono, meno preventivi nel vuoto, meno "ti richiamo" che non arrivano.

DEMO: ${siteUrl}

VINCOLI:
- Italiano, asciutto, zero aggettivi da brochure ("moderno","innovativo","eccellente"). Zero emoji.
- Iniziare con "Buongiorno,"
- Menzionare il link demo esattamente una volta, SEMPRE con la parola "bozza" o "prototipo" — mai presentarlo come sito finito. Es: "ho preparato una bozza" / "è un prototipo di 24h" / "è solo un punto di partenza".
- Includere UNA frase concreta su tempo risparmiato o problema eliminato specifico per ${biz.category || "il settore"} — deve essere qualcosa che riconoscono subito nella loro giornata.
- Precisare che il contenuto vero verrebbe costruito insieme a loro — la bozza mostra solo il potenziale della struttura, non è il prodotto finale.
- Chiedere 10 minuti di chiamata entro 48h.
- Chiudere con: "${contactLine}"
- Max 140 parole. Plain text, niente HTML.
- Firma "${myName}"

Subject: 40-55 caratteri, curiosità + nome attività, nessun punto esclamativo.

JSON: {"subject": "...", "body": "..."}`;

  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, responseMimeType: "application/json", maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } } },
    { headers: { "Content-Type": "application/json" }, timeout: 30000 }
  );
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`gemini email empty: ${JSON.stringify(res.data?.promptFeedback || res.data?.candidates?.[0]?.finishReason)}`);
  return JSON.parse(text);
}

const mailer = nodemailer.createTransport(
  process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_KEY
    ? { host: "smtp-relay.brevo.com", port: 587, secure: false, auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_KEY } }
    : { service: "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } }
);

// ─── DB ────────────────────────────────────────────────────────────
function pickBusinesses(n, from) {
  const db = getDb();
  // Esclude categorie inadatte alla demo "vetrina commerciale": agenzie funebri,
  // notai, banche, enti pubblici, scuole pubbliche, forze dell'ordine. Sono
  // settori dove un sito demo non sollecitato suona o offensivo o irrilevante.
  return db.prepare(`
    SELECT b.* FROM businesses b
    WHERE b.is_blacklisted = 0
      AND NOT EXISTS (SELECT 1 FROM campaign_results cr WHERE cr.business_id = b.id AND cr.status = 'sent')
      AND (b.status IS NULL OR b.status != 'Inviata Mail')
      AND (
        (b.email IS NOT NULL AND b.email != '')
        OR b.instagram_url IS NOT NULL
        OR (b.name IS NOT NULL AND b.area IS NOT NULL)
      )
      -- ESCLUSIONE PEC: il Garante Privacy ha esplicitamente vietato l'uso
      -- delle PEC pubblicate su INI-PEC e simili a fini di marketing diretto.
      -- Provvedimento doc-web 9899880/2023, sanzione tipica 10k€.
      -- Vedi anche legal/LIA.md §6 (esclusioni esplicite).
      AND (b.email IS NULL OR (
        b.email NOT LIKE '%@pec.%'
        AND b.email NOT LIKE '%legalmail%'
        AND b.email NOT LIKE '%legal-mail%'
        AND b.email NOT LIKE '%pecimprese%'
        AND b.email NOT LIKE '%pec.it%'
      ))
      AND (b.category IS NULL OR (
        b.category NOT LIKE '%funebre%'
        AND b.category NOT LIKE '%notaio%'
        AND b.category NOT LIKE '%banca%'
        AND b.category NOT LIKE '%poste%'
        AND b.category NOT LIKE '%municipi%'
        AND b.category NOT LIKE '%comune%'
        AND b.category NOT LIKE '%chiesa%'
        AND b.category NOT LIKE '%ospedale%'
        AND b.category NOT LIKE '%scuola%'
        AND b.category NOT LIKE '%previdenza%'
        AND b.category NOT LIKE '%sindacato%'
        AND b.category NOT LIKE '%carabinier%'
        AND b.category NOT LIKE '%polizia%'
        AND b.category NOT LIKE '%vigili del fuoco%'
        AND b.category NOT LIKE '%ente pubblico%'
        AND b.category NOT LIKE '%pubblico%'
      ))
    ORDER BY (b.email IS NOT NULL AND b.email != '') DESC, b.id
    LIMIT ? OFFSET ?
  `).all(n, from);
}

function createCampaign(total) {
  const db = getDb();
  const r = db.prepare("INSERT INTO campaigns (total, status) VALUES (?, 'running')").run(total);
  return r.lastInsertRowid;
}

function recordResult(campaignId, businessId, status, landingUrl, error) {
  const db = getDb();
  db.prepare("INSERT OR REPLACE INTO campaign_results (campaign_id, business_id, status, landing_url, error) VALUES (?, ?, ?, ?, ?)")
    .run(campaignId, businessId, status, landingUrl, error);
  if (status === "sent") {
    db.prepare("UPDATE businesses SET status = 'Inviata Mail' WHERE id = ?").run(businessId);
  }
}

function finalizeCampaign(campaignId, sent, failed) {
  const db = getDb();
  db.prepare("UPDATE campaigns SET status = ?, sent = ?, failed = ? WHERE id = ?")
    .run(failed === 0 ? "completed" : "partial", sent, failed, campaignId);
}

// ─── Process one ───────────────────────────────────────────────────
async function processOne(biz, index) {
  // Enrich: trova social + email da bio IG se mancante
  biz = await enrichSocial(biz);
  if (!biz.email) throw new Error("nessuna email disponibile (né DB né IG bio)");
  // Se l'email era già nel DB senza fonte, salva almeno il website come riferimento
  if (biz.email && !biz.email_source_url && biz.website) {
    getDb().prepare("UPDATE businesses SET email_source_url = ? WHERE id = ? AND email_source_url IS NULL").run(biz.website, biz.id);
  }

  const siteContext = biz.website ? await scrapeContext(biz.website) : null;
  const content = await generateContent(biz, siteContext);
  const images = await fetchImages(content.image_keywords || [biz.category || biz.name], biz, content);

  const template = pickTemplate(index);
  const palette = pickPalette(index + Math.floor(Math.random() * 5));
  const bizForRender = { ...biz, area: content.display_area || biz.area };
  const html = await render(template, { biz: bizForRender, content, palette, images });

  const slug = buildSlug(biz.name);
  const { url } = await deploySite(slug, html);

  let email = null;
  let screenshotPath = null;
  if (!DEMO && !DRY) {
    email = await generateEmail(biz, url, siteContext);
    try {
      screenshotPath = await captureScreenshot({ url, slug });
    } catch (e) {
      console.warn(`    screenshot fail: ${e.message}`);
    }
    await sendOutreachEmail({
      businessId: biz.id,
      toEmail: biz.email,
      subject: email.subject,
      body: email.body,
      businessName: biz.name,
      websiteUrl: url,
      screenshotPath,
    });
    try {
      scheduleFollowUps(biz.id, USER_ID);
    } catch (e) {
      console.warn(`    schedule follow-up fail: ${e.message}`);
    }
  }

  return { url, template, palette: palette.name, email, screenshotPath };
}

// ─── Main ──────────────────────────────────────────────────────────
(async () => {
  console.log(`Mode: ${DEMO ? "DEMO (3 siti, no email)" : DRY ? "DRY-RUN (sito OK, no email)" : `LIVE (${LIMIT} siti + email)`}`);

  const list = pickBusinesses(LIMIT, FROM);
  if (list.length === 0) { console.log("Nessun business eligible."); return; }

  console.log(`Eligibili: ${list.length}\n`);

  const campaignId = DEMO ? null : createCampaign(list.length);
  if (campaignId) console.log(`Campaign #${campaignId} creata\n`);

  const results = [];
  let ok = 0, fail = 0;

  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    console.log(`[${i + 1}/${list.length}] ${b.name} (${b.email || "no-email"})`);
    try {
      const info = await processOne(b, i);
      console.log(`  ✓ ${info.template}/${info.palette} → ${info.url}`);
      results.push({ business: b, ...info, ok: true });
      if (campaignId) recordResult(campaignId, b.id, "sent", info.url, null);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
      if (process.env.DEBUG) console.error(e.stack);
      results.push({ business: b, error: e.message, ok: false });
      if (campaignId) recordResult(campaignId, b.id, "failed", null, e.message);
      fail++;
    }
    await new Promise(r => setTimeout(r, 5000)); // throttle tra iterazioni
  }

  if (campaignId) finalizeCampaign(campaignId, ok, fail);

  console.log(`\nDONE: ${ok} OK, ${fail} failed.`);

  // Invia report a brizzantelucax@gmail.com
  const okResults = results.filter(r => r.ok);
  const failResults = results.filter(r => !r.ok);
  const reportBody = `Campagna ${DEMO ? "DEMO" : `#${campaignId}`} — ${DEMO ? "3 siti di prova, nessuna mail ai clienti" : DRY ? "dry-run (no email)" : "LIVE"}

Totale: ${list.length}
OK:     ${ok}
Falliti: ${fail}

${DEMO ? "SITI DEMO — controlla layout e dimmi OK prima di runnare i 100:\n\n" : "Siti generati:\n\n"}${okResults.map(r => `• ${r.business.name}\n  ${r.url}\n  Template: ${r.template} · Palette: ${r.palette}`).join("\n\n")}

${failResults.length ? `\nFalliti:\n${failResults.map(r => `• ${r.business.name} — ${r.error}`).join("\n")}` : ""}
`;

  try {
    await mailer.sendMail({
      from: `"${process.env.MY_NAME || "Luca"}" <${process.env.EMAIL_USER}>`,
      to: "brizzantelucax@gmail.com",
      subject: DEMO ? "Demo layout upgrade — 3 siti da validare" : `Campagna #${campaignId} completata — ${ok}/${list.length}`,
      text: reportBody,
    });
    console.log("Report email inviato.");
  } catch (e) {
    console.error("Report email fallito:", e.message);
  }
})().catch(e => { console.error(e); process.exit(1); });
