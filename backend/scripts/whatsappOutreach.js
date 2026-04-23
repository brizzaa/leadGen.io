// Outreach WhatsApp a lead "warm": hanno aperto email 2+ volte, non risposto,
// hanno un numero di telefono, non già contattati via WA.
// Rate limit rigoroso per evitare ban.
//
// Uso:
//   node scripts/whatsappOutreach.js --dry-run       # mostra cosa manderebbe
//   node scripts/whatsappOutreach.js --limit 5       # invia max 5
//   node scripts/whatsappOutreach.js --min-opens 2   # soglia apertura (default 2)

import "dotenv/config";
import axios from "axios";
import { getDb } from "../src/config/db.js";
import { getWASocket, sendWhatsApp, closeSocket, toJid } from "../src/services/whatsappBaileys.js";

const args = process.argv.slice(2);
const arg = (k, def) => { const i = args.indexOf(k); return i === -1 ? def : args[i + 1]; };
const has = k => args.includes(k);

const DRY = has("--dry-run");
const LIMIT = parseInt(arg("--limit", "5"), 10);
const MIN_OPENS = parseInt(arg("--min-opens", "2"), 10);
const MIN_DELAY = 4000, MAX_DELAY = 9000;

const GEMINI_KEY = process.env.GEMINI_API_KEY;

const db = getDb();

function pickWarmLeads(n) {
  return db.prepare(`
    SELECT b.*, cr.landing_url,
           (SELECT SUM(open_count) FROM email_tracking et WHERE et.business_id = b.id) AS opens
    FROM businesses b
    JOIN campaign_results cr ON cr.business_id = b.id AND cr.status = 'sent'
    WHERE b.phone IS NOT NULL AND b.phone != ''
      AND b.is_blacklisted = 0
      AND b.status NOT IN ('Vinto (Cliente)', 'Perso', 'Risposto')
      AND (SELECT COALESCE(SUM(open_count),0) FROM email_tracking et WHERE et.business_id = b.id) >= ?
      AND NOT EXISTS (SELECT 1 FROM whatsapp_sends w WHERE w.business_id = b.id)
    GROUP BY b.id
    ORDER BY opens DESC, b.id
    LIMIT ?
  `).all(MIN_OPENS, n);
}

async function generateWAMessage(biz, siteUrl) {
  const myName = process.env.MY_NAME || "Luca";
  const prompt = `Scrivi un messaggio WhatsApp breve per ${biz.name} (${biz.category || "attività"} a ${biz.area || "Italia"}).

CONTESTO: gli ho mandato una email con una demo del loro sito (${siteUrl}) e l'hanno aperta più volte ma non hanno risposto.

REGOLE:
- Italiano, tono da persona, NON da venditore.
- Max 50 parole, 2-3 frasi brevi.
- Iniziare con "Buongiorno," o "Salve,"
- Riferire all'email SENZA insistere.
- Proporre 10 min di chiamata OPPURE rispondere qui.
- Zero emoji. Zero bold/italico.
- Firma: "${myName}"

JSON: {"message": "..."}`;

  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, responseMimeType: "application/json", maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } } },
    { headers: { "Content-Type": "application/json" }, timeout: 30000 }
  );
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("gemini empty");
  return JSON.parse(text).message;
}

const leads = pickWarmLeads(LIMIT);
console.log(`Lead warm trovati: ${leads.length} (min-opens=${MIN_OPENS})`);

if (leads.length === 0) { console.log("Nessun lead."); process.exit(0); }

if (DRY) {
  for (const l of leads) {
    console.log(`- ${l.name} (${l.phone}) opens=${l.opens} → ${toJid(l.phone)}`);
  }
  process.exit(0);
}

const sock = await getWASocket({ printQR: true });

let ok = 0, fail = 0;
for (const l of leads) {
  try {
    const msg = await generateWAMessage(l, l.landing_url);
    console.log(`→ ${l.name} (${l.phone}) opens=${l.opens}`);
    console.log(`  MSG: ${msg}`);
    const r = await sendWhatsApp(sock, l.phone, msg);
    db.prepare("INSERT INTO whatsapp_sends (business_id, phone, message, status) VALUES (?, ?, ?, 'sent')")
      .run(l.id, l.phone, msg);
    console.log(`  ✓ sent (id=${r.key.id})`);
    ok++;
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    db.prepare("INSERT INTO whatsapp_sends (business_id, phone, message, status, error) VALUES (?, ?, ?, 'failed', ?)")
      .run(l.id, l.phone, null, e.message);
    fail++;
  }
  // Delay random tra messaggi per non sembrare bot
  const delay = MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY));
  await new Promise(r => setTimeout(r, delay));
}

console.log(`\nDONE: ${ok} OK, ${fail} falliti.`);
await closeSocket(sock);
process.exit(0);
