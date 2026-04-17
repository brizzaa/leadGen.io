import express from "express";
import axios from "axios";
import nodemailer from "nodemailer";
import { getDb } from "../config/db.js";
import { makeSlug, deployToNetlify, generateWebsiteHtml } from "../services/landingPageBuilder.js";

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

// Pipeline asincrona
async function runCampaign(campaignId, businessIds) {
  const db = getDb();
  let sent = 0;
  let failed = 0;

  for (const businessId of businessIds) {
    let landingUrl = null;
    let error = null;

    try {
      const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(businessId);
      if (!biz) throw new Error("Business non trovato");

      if (!biz.email || biz.email.trim() === "") {
        throw new Error("Nessun indirizzo email");
      }

      // Step 1: genera sito con Gemini AI
      const { html } = await generateWebsiteHtml(biz);

      // Step 2: pubblica su Netlify
      landingUrl = await deployToNetlify(html, makeSlug(biz.name));

      // Step 3: genera email personalizzata con Gemini
      const emailContent = await generateEmail(biz, landingUrl);

      // Step 4: invia email
      await sendEmail(biz.email, emailContent.subject, emailContent.body);

      // Step 5: aggiorna DB
      db.prepare("UPDATE businesses SET status = 'Inviata Mail' WHERE id = ?").run(businessId);
      db.prepare("UPDATE campaign_results SET status = 'sent', landing_url = ? WHERE campaign_id = ? AND business_id = ?")
        .run(landingUrl, campaignId, businessId);

      sent++;
      sendSSE(campaignId, "progress", { businessId, name: biz.name, status: "sent", landingUrl, error: null });

    } catch (e) {
      failed++;
      error = e.message;
      console.error(`[campaign ${campaignId}] Business ${businessId} failed:`, e.message);
      db.prepare("UPDATE campaign_results SET status = 'failed', error = ? WHERE campaign_id = ? AND business_id = ?")
        .run(error, campaignId, businessId);
      sendSSE(campaignId, "progress", { businessId, name: null, status: "failed", landingUrl: null, error });
    }
  }

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
- Essere in italiano, tono professionale ma diretto
- Menzionare che hai già preparato una demo del sito (link: ${siteUrl})
- Proporre una chiamata per discutere
- Includere questa frase testualmente: "${contactLine}"
- Essere max 150 parole
- Firmare con il nome "${myName}"
- Includere footer GDPR: "Ti contatto perché ho trovato i tuoi riferimenti pubblici online (Legittimo Interesse, Art. 6 GDPR). Rispondi STOP per non ricevere altre comunicazioni."

Rispondi SOLO con JSON: {"subject": "...", "body": "HTML con <p> tags"}`;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
    },
    { headers: { "Content-Type": "application/json" }, timeout: 30000 }
  );

  return JSON.parse(response.data.candidates[0].content.parts[0].text);
}

async function sendEmail(toEmail, subject, htmlBody) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Credenziali email non configurate");
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: subject || "Proposta di collaborazione",
    html: htmlBody,
  });
}

export default router;
