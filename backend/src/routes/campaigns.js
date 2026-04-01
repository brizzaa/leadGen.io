import express from "express";
import axios from "axios";
import nodemailer from "nodemailer";
import { getDb } from "../db.js";
import {
  determineTemplate,
  buildLandingPage,
  deployPage,
  makeSlug,
} from "../landingPageBuilder.js";

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
    "INSERT INTO campaigns (total, status) VALUES (?, 'running')"
  ).run(businessIds.length);
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
  runCampaign(campaignId, businessIds, aiStrategy, templateName).catch((e) =>
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
async function runCampaign(campaignId, businessIds, aiStrategy, templateName) {
  const db = getDb();
  let sent = 0;
  let failed = 0;

  for (const businessId of businessIds) {
    let error = null;
    let landingUrl = null;

    try {
      const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(businessId);
      if (!biz) throw new Error("Business non trovato");

      // Step 1: controlla email
      if (!biz.email || biz.email.trim() === "") {
        throw new Error("Nessun indirizzo email");
      }

      // Step 2: determina template
      const template = templateName === "auto"
        ? determineTemplate(biz)
        : templateName;

      // Step 3: genera content JSON da Gemini
      const content = await generateLandingContent(biz, template, aiStrategy);

      // Step 4: valida placeholder nell'email_body (prima del deploy per evitare deploy inutili)
      if (!content.email_body || !content.email_body.includes("{{LANDING_URL}}")) {
        throw new Error("Missing LANDING_URL placeholder nell'email generata");
      }

      // Step 5: costruisce HTML
      const html = buildLandingPage(content, template, biz);

      // Step 6: deploy
      landingUrl = await deployPage(html, makeSlug(biz.name));

      // Step 7: sostituisce URL
      const emailBody = content.email_body.replace(/\{\{LANDING_URL\}\}/g, landingUrl);

      // Step 8: invia email
      await sendEmail(biz.email, content.email_subject, emailBody);

      // Step 9: aggiorna DB business
      db.prepare("UPDATE businesses SET status = 'Inviata Mail' WHERE id = ?").run(businessId);

      sent++;
      db.prepare("UPDATE campaign_results SET status = 'sent', landing_url = ? WHERE campaign_id = ? AND business_id = ?")
        .run(landingUrl, campaignId, businessId);

      sendSSE(campaignId, "progress", {
        businessId,
        name: biz.name,
        status: "sent",
        landingUrl,
        error: null,
      });

    } catch (e) {
      failed++;
      error = e.message;
      console.error(`[campaign ${campaignId}] Business ${businessId} failed:`, e.message);

      db.prepare("UPDATE campaign_results SET status = 'failed', error = ? WHERE campaign_id = ? AND business_id = ?")
        .run(error, campaignId, businessId);

      sendSSE(campaignId, "progress", {
        businessId,
        name: null,
        status: "failed",
        landingUrl: null,
        error,
      });
    }
  }

  // Aggiorna stato finale campaign
  const finalStatus = failed === 0 ? "completed" : "partial";
  db.prepare("UPDATE campaigns SET status = ?, sent = ?, failed = ? WHERE id = ?")
    .run(finalStatus, sent, failed, campaignId);

  sendSSE(campaignId, "complete", {
    total: businessIds.length,
    sent,
    failed,
  });

  // Chiude le connessioni SSE
  const clients = sseClients.get(campaignId) || [];
  for (const c of clients) {
    try { c.end(); } catch {}
  }
  sseClients.delete(campaignId);
}

async function generateLandingContent(biz, templateName, aiStrategy) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY non configurata");

  const accentColors = {
    // categorie → colore
    ristorante: "#f97316", pizzeria: "#f97316", bar: "#f97316", food: "#f97316",
    parrucchiere: "#a855f7", estetica: "#a855f7", benessere: "#a855f7",
    avvocato: "#2563eb", commercialista: "#2563eb", consulente: "#2563eb",
    idraulico: "#ea580c", elettricista: "#eab308", falegname: "#92400e",
  };
  const cat = (biz.category || "").toLowerCase();
  let accentColor = "#00d4aa";
  for (const [key, color] of Object.entries(accentColors)) {
    if (cat.includes(key)) { accentColor = color; break; }
  }

  const prompt = `Sei un copywriter esperto di marketing digitale italiano. Genera un oggetto JSON per una landing page personalizzata per questa azienda:

Nome: ${biz.name}
Settore: ${biz.category || "N/A"}
Area: ${biz.area || "N/A"}
Sito web attuale: ${biz.website || "nessuno"}
Social: ${[biz.facebook_url, biz.instagram_url].filter(Boolean).join(", ") || "nessuno"}

Template scelto: ${templateName}
Strategia AI: ${aiStrategy}

RISPONDI SOLO CON JSON VALIDO, nessun testo prima o dopo. Schema ESATTO da rispettare:
{
  "headline": "max 80 caratteri, convincente e personalizzato per ${biz.name}",
  "subheadline": "max 140 caratteri, spiega il vantaggio principale",
  "services": ["servizio 1 specifico", "servizio 2 specifico", "servizio 3 specifico"],
  "cta_text": "max 40 caratteri, invito all'azione",
  "accent_color": "${accentColor}",
  "tone": "friendly",
  "email_subject": "oggetto email max 80 caratteri",
  "email_body": "corpo email HTML in italiano (usa <p> per i paragrafi), includi il link alla landing page con ESATTAMENTE questo testo: {{LANDING_URL}} — il sistema lo sostituirà automaticamente. Massimo 200 parole. Includi questo footer legale alla fine:\\n<hr><p style='font-size:11px;color:#999'>Informativa Privacy: Ti contatto perché ho trovato i tuoi riferimenti su Google Maps (Legittimo Interesse, Art. 6 GDPR). Rispondi CANCELLAMI per la rimozione immediata.</p>"
}`;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
    },
    { headers: { "Content-Type": "application/json" }, timeout: 60000 }
  );

  const text = response.data.candidates[0].content.parts[0].text;
  const content = JSON.parse(text);
  return content;
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
