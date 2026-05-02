import { getDb } from "../config/db.js";
import { generateWebsiteHtml, makeSlug, deployToNetlify } from "./landingPageBuilder.js";
import { buildTransporter } from "./mailer.js";
import crypto from "crypto";
import axios from "axios";

const MAX_FOLLOW_UPS = 1;
const FOLLOW_UP_DELAYS_DAYS = [3];

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
  };

  const prompt = `Scrivi ${stepTexts[fu.step] || "un follow-up"} per "${fu.name}" (${fu.category || "attività locale"} a ${fu.area || "Italia"}).
Questo è un gentile follow-up al primo messaggio. Tono professionale e rispettoso.
Max 80 parole.
Firma come "${myName}".
Includi footer GDPR: "Rispondi CANCELLAMI per non ricevere altre comunicazioni."
Rispondi SOLO con JSON: {"subject": "...", "body": "..."}`;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${geminiApiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
    },
    { headers: { "Content-Type": "application/json" }, timeout: 30000 }
  );

  const emailContent = JSON.parse(response.data.candidates[0].content.parts[0].text);

  // Tracking pixel
  const db = getDb();
  const trackingToken = crypto.randomBytes(16).toString("hex");
  db.prepare("INSERT INTO email_tracking (business_id, token) VALUES (?, ?)").run(fu.business_id, trackingToken);

  const baseUrl = process.env.BASE_URL || "http://localhost:3001";
  const pixel = `<img src="${baseUrl}/api/track/${trackingToken}" width="1" height="1" style="display:none" alt="" />`;

  const { transport: transporter, fromAddress } = buildTransporter(fu.business_id);

  await transporter.sendMail({
    from: fromAddress,
    to: fu.email,
    subject: emailContent.subject || `Follow-up: proposta per ${fu.name}`,
    html: `<div style="font-family:sans-serif;line-height:1.6;color:#333">${emailContent.body}${pixel}</div>`,
    text: emailContent.body.replace(/<[^>]+>/g, ""),
    headers: {
      "List-Unsubscribe": `<mailto:${process.env.EMAIL_USER || "l.brizzante@leader-gen.com"}?subject=Unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
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
