import express from "express";
import axios from "axios";
import pLimit from "p-limit";
import { getDb } from "../config/db.js";
import { makeSlug, deployToNetlify, generateWebsiteHtml, captureScreenshot } from "../services/landingPageBuilder.js";
import { sendOutreachEmail } from "../services/mailer.js";

const router = express.Router();

// Mappa campaignId → array di SSE response objects (può esserci una sola connessione)
const sseClients = new Map();

function sendSSE(campaignId, event, data) {
  const clients = sseClients.get(campaignId) || [];
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

// POST /api/campaigns
router.post("/", async (req, res) => {
  const { businessIds, aiStrategy = "auto", templateName = "auto" } = req.body;

  if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
    return res.status(400).json({ error: "businessIds must be a non-empty array" });
  }
  if (businessIds.length > 50) {
    return res.status(400).json({ error: "Max 50 businesses per campaign" });
  }

  const db = getDb();

  // Crea la riga campaign
  const result = db.prepare(
    "INSERT INTO campaigns (total, status, user_id) VALUES (?, 'running', ?)"
  ).run(businessIds.length, req.userId);
  const campaignId = result.lastInsertRowid;

  // Inserisce tutti i risultati come pending
  const insertResult = db.prepare(
    "INSERT OR IGNORE INTO campaign_results (campaign_id, business_id, status) VALUES (?, ?, 'pending')"
  );
  const insertBatch = db.transaction(() => {
    for (const id of businessIds) insertResult.run(campaignId, id);
  });
  insertBatch();

  // Avvia la pipeline in background (non await)
  runCampaign(campaignId, businessIds).catch((e) =>
    console.error("[campaign] Fatal error:", e)
  );

  res.json({ campaignId });
});

// GET /api/campaigns/:id/progress (SSE)
router.get("/:id/progress", (req, res) => {
  const campaignId = parseInt(req.params.id, 10);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  if (!sseClients.has(campaignId)) sseClients.set(campaignId, []);
  sseClients.get(campaignId).push(res);

  req.on("close", () => {
    const clients = sseClients.get(campaignId) || [];
    sseClients.set(campaignId, clients.filter((c) => c !== res));
  });

  // Invia immediatamente lo stato corrente (per riconnessioni)
  const db = getDb();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
  if (campaign && campaign.status !== "running") {
    res.write(`event: complete\ndata: ${JSON.stringify({ total: campaign.total, sent: campaign.sent, failed: campaign.failed })}\n\n`);
    res.end();
  }
});

// Pipeline asincrona — 3 lead in parallelo (rate-limit-safe per Gemini 15 RPM)
async function runCampaign(campaignId, businessIds) {
  const db = getDb();
  let sent = 0;
  let failed = 0;
  const limit = pLimit(1);

  const processLead = async (businessId) => {
    let landingUrl = null;

    try {
      const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(businessId);
      if (!biz) throw new Error("Business non trovato");

      if (!biz.email || biz.email.trim() === "") {
        throw new Error("Nessun indirizzo email");
      }

      const slug = makeSlug(biz.name);

      // Step 1: genera sito con Gemini AI (+ scrape context dal loro sito)
      const { html } = await generateWebsiteHtml(biz, "auto", "gemini_flash");

      // Step 2: pubblica su Netlify
      landingUrl = await deployToNetlify(html, slug);

      // Step 3: screenshot dal URL live (rendering fedele: Tailwind CDN + fonts caricati)
      const screenshotPath = await captureScreenshot({ url: landingUrl, slug });

      // Step 4: genera email personalizzata con Gemini
      const emailContent = await generateEmail(biz, landingUrl);

      // Step 5: invia email con template Spotlight + screenshot CID + tracking
      await sendOutreachEmail({
        businessId,
        toEmail: biz.email,
        subject: emailContent.subject,
        body: emailContent.body,
        businessName: biz.name,
        websiteUrl: landingUrl,
        screenshotPath,
      });

      // Step 6: aggiorna DB
      db.prepare("UPDATE businesses SET status = 'Inviata Mail' WHERE id = ?").run(businessId);
      db.prepare("UPDATE campaign_results SET status = 'sent', landing_url = ? WHERE campaign_id = ? AND business_id = ?")
        .run(landingUrl, campaignId, businessId);

      sent++;
      sendSSE(campaignId, "progress", { businessId, name: biz.name, status: "sent", landingUrl, error: null });

    } catch (e) {
      failed++;
      const error = e.message;
      console.error(`[campaign ${campaignId}] Business ${businessId} failed:`, e.message);
      db.prepare("UPDATE campaign_results SET status = 'failed', error = ? WHERE campaign_id = ? AND business_id = ?")
        .run(error, campaignId, businessId);
      sendSSE(campaignId, "progress", { businessId, name: null, status: "failed", landingUrl: null, error });
    }
  };

  await Promise.all(businessIds.map((id) => limit(() => processLead(id))));

  const finalStatus = failed === 0 ? "completed" : "partial";
  db.prepare("UPDATE campaigns SET status = ?, sent = ?, failed = ? WHERE id = ?")
    .run(finalStatus, sent, failed, campaignId);

  sendSSE(campaignId, "complete", { total: businessIds.length, sent, failed });

  const clients = sseClients.get(campaignId) || [];
  for (const c of clients) { try { c.end(); } catch {} }
  sseClients.delete(campaignId);
}

async function generateEmail(biz, siteUrl) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY non configurata");

  const myName = process.env.MY_NAME || "Il team LeadGen";
  const myWhatsapp = process.env.MY_WHATSAPP || "";
  const contactLine = myWhatsapp
    ? `Puoi rispondermi qui o scrivermi su WhatsApp al ${myWhatsapp}.`
    : "Puoi rispondermi direttamente a questa email.";

  const prompt = `Sei un consulente web italiano. Scrivi una email breve e professionale per ${biz.name} (${biz.category || "attività locale"} a ${biz.area || "Italia"}).

Hai creato una demo gratuita del loro sito: ${siteUrl}

L'email deve:
- Essere in italiano, tono diretto e umano, non commerciale
- Iniziare con "Buongiorno,"
- Menzionare la demo con il link: ${siteUrl}
- Proporre di sentirsi entro 24h
- Includere: "${contactLine}"
- Max 120 parole, testo semplice con newline (nessun tag HTML)
- Firmare come "${myName}"

Rispondi SOLO con JSON: {"subject": "...", "body": "..."}`;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, responseMimeType: "application/json" } },
    { headers: { "Content-Type": "application/json" }, timeout: 30000 }
  );

  return JSON.parse(response.data.candidates[0].content.parts[0].text);
}

export default router;
