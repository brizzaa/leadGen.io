import { getDb } from "./db.js";
import { generateWebsiteHtml, makeSlug, deployToNetlify } from "./landingPageBuilder.js";
import nodemailer from "nodemailer";
import crypto from "crypto";
import axios from "axios";

const MAX_FOLLOW_UPS = 3;
const FOLLOW_UP_DELAYS_DAYS = [3, 7, 14]; // step 1 dopo 3gg, step 2 dopo 7gg, step 3 dopo 14gg

/**
 * Schedula follow-up per un business dopo invio email iniziale.
 */
export function scheduleFollowUps(businessId, userId) {
  const db = getDb();
  const now = new Date();

  for (let step = 1; step <= MAX_FOLLOW_UPS; step++) {
    const scheduledAt = new Date(now);
    scheduledAt.setDate(scheduledAt.getDate() + FOLLOW_UP_DELAYS_DAYS[step - 1]);

    db.prepare(
      "INSERT INTO follow_ups (business_id, user_id, step, scheduled_at) VALUES (?, ?, ?, ?)"
    ).run(businessId, userId, step, scheduledAt.toISOString());
  }
}

/**
 * Cancella follow-up pending per un business (es. ha risposto o ha aperto l'email).
 */
export function cancelFollowUps(businessId) {
  const db = getDb();
  db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE business_id = ? AND status = 'pending'")
    .run(businessId);
}

/**
 * Processa i follow-up scaduti. Chiamato dal cron job.
 */
export async function processFollowUps() {
  const db = getDb();

  // Trova follow-up da inviare (pending + scaduti + business non ha aperto email)
  const pending = db.prepare(`
    SELECT fu.*, b.name, b.email, b.category, b.area, b.status as biz_status,
           u.email as user_email, u.name as user_name
    FROM follow_ups fu
    JOIN businesses b ON b.id = fu.business_id
    JOIN users u ON u.id = fu.user_id
    WHERE fu.status = 'pending'
      AND fu.scheduled_at <= datetime('now')
      AND b.is_blacklisted = 0
      AND b.follow_ups_enabled = 1
      AND b.status NOT IN ('Vinto (Cliente)', 'Perso')
    ORDER BY fu.scheduled_at ASC
    LIMIT 20
  `).all();

  if (pending.length === 0) return { processed: 0 };

  let sent = 0;
  let skipped = 0;

  for (const fu of pending) {
    // Controlla se l'email è stata aperta → cancella follow-up rimanenti
    const tracking = db.prepare(`
      SELECT opened_at FROM email_tracking
      WHERE business_id = ? AND opened_at IS NOT NULL
      LIMIT 1
    `).get(fu.business_id);

    if (tracking) {
      db.prepare("UPDATE follow_ups SET status = 'cancelled' WHERE business_id = ? AND status = 'pending'")
        .run(fu.business_id);
      skipped++;
      continue;
    }

    if (!fu.email) {
      db.prepare("UPDATE follow_ups SET status = 'skipped' WHERE id = ?").run(fu.id);
      skipped++;
      continue;
    }

    try {
      await sendFollowUpEmail(fu);
      db.prepare("UPDATE follow_ups SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(fu.id);
      sent++;
    } catch (e) {
      console.error(`[follow-up] Error sending to ${fu.email}:`, e.message);
      db.prepare("UPDATE follow_ups SET status = 'failed' WHERE id = ?").run(fu.id);
    }
  }

  console.log(`[follow-up] Processed: ${sent} sent, ${skipped} skipped`);
  return { processed: sent + skipped, sent, skipped };
}

async function sendFollowUpEmail(fu) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY non configurata");

  const myName = process.env.MY_NAME || "Il team LeadGen";
  const stepTexts = {
    1: "un gentile promemoria alla prima email",
    2: "un secondo follow-up più breve e diretto",
    3: "un ultimo tentativo cordiale di contatto",
  };

  const prompt = `Scrivi ${stepTexts[fu.step] || "un follow-up"} per "${fu.name}" (${fu.category || "attività locale"} a ${fu.area || "Italia"}).
Questo è il follow-up #${fu.step} di 3. Il tono deve essere progressivamente più conciso.
Step 1: gentile reminder. Step 2: breve e diretto. Step 3: ultimo tentativo, rispettoso.
Max ${fu.step === 1 ? 80 : fu.step === 2 ? 60 : 40} parole.
Firma come "${myName}".
Includi footer GDPR: "Rispondi CANCELLAMI per non ricevere altre comunicazioni."
Rispondi SOLO con JSON: {"subject": "...", "body": "..."}`;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
    },
    { headers: { "Content-Type": "application/json" }, timeout: 30000 }
  );

  const emailContent = JSON.parse(response.data.candidates[0].content.parts[0].text);

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Credenziali email non configurate");
  }

  // Tracking pixel
  const db = getDb();
  const trackingToken = crypto.randomBytes(16).toString("hex");
  db.prepare("INSERT INTO email_tracking (business_id, token) VALUES (?, ?)").run(fu.business_id, trackingToken);

  const baseUrl = process.env.BASE_URL || "http://localhost:3001";
  const pixel = `<img src="${baseUrl}/api/track/${trackingToken}" width="1" height="1" style="display:none" alt="" />`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: fu.email,
    subject: emailContent.subject || `Follow-up: proposta per ${fu.name}`,
    html: `<div style="font-family:sans-serif;line-height:1.6;color:#333">${emailContent.body}${pixel}</div>`,
    text: emailContent.body.replace(/<[^>]+>/g, ""),
  });

  // Log attività
  db.prepare(
    "INSERT INTO activity_logs (business_id, type, message, meta) VALUES (?, ?, ?, ?)"
  ).run(fu.business_id, "follow-up", `Follow-up #${fu.step} inviato a ${fu.email}`, JSON.stringify({ step: fu.step, trackingToken }));
}

/**
 * Avvia il cron job per i follow-up (ogni 30 minuti).
 */
export function startFollowUpCron() {
  const INTERVAL = 30 * 60 * 1000; // 30 min
  console.log("[follow-up] Cron avviato (ogni 30 min)");

  setInterval(async () => {
    try {
      await processFollowUps();
    } catch (e) {
      console.error("[follow-up] Cron error:", e.message);
    }
  }, INTERVAL);

  // Primo check dopo 1 minuto dall'avvio
  setTimeout(() => processFollowUps().catch(console.error), 60000);
}
