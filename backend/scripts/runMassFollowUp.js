// Follow-up mass ai business delle campagne 23-26 (~313 unique).
// Uso: node scripts/runMassFollowUp.js [--dry] [--limit N]

import "dotenv/config";
import nodemailer from "nodemailer";
import axios from "axios";
import { getDb } from "../src/config/db.js";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const LIMIT = parseInt(args[args.indexOf("--limit") + 1], 10) || 9999;
const CAMPAIGNS = [23, 24, 25, 26];

const mailer = nodemailer.createTransport({
  host: "smtp-relay.brevo.com", port: 587, secure: false,
  auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_KEY },
});

const FROM_EMAIL = process.env.EMAIL_USER || "l.brizzante@leader-gen.com";
const FROM_NAME = process.env.MY_NAME || "Luca Brizzante";
const GEMINI_KEY = process.env.GEMINI_API_KEY;

function pickRecipients() {
  return getDb().prepare(`
    SELECT DISTINCT b.id, b.name, b.email, b.category, b.area, cr.landing_url
    FROM campaign_results cr
    JOIN businesses b ON b.id = cr.business_id
    WHERE cr.status = 'sent'
      AND cr.campaign_id IN (${CAMPAIGNS.join(",")})
      AND b.is_blacklisted = 0
      AND b.email IS NOT NULL
      AND b.email != ''
      AND NOT EXISTS (
        SELECT 1 FROM activity_logs al
        WHERE al.business_id = b.id AND al.type = 'mass-followup'
      )
    ORDER BY b.id
    LIMIT ?
  `).all(LIMIT);
}

async function generateFollowUpCopy(biz) {
  const prompt = `Sei Luca, un web designer freelance. Scrivi un follow-up email MOLTO breve (max 60 parole) a "${biz.name}" (${biz.category || "attività"} a ${biz.area || "Italia"}).

Contesto: una settimana fa gli hai mandato una mail con una demo del loro sito web (link: ${biz.landing_url}). Non hanno risposto. Ora gli scrivi un breve reminder cordiale e rilassato.

Tono: umano, informale, breve, zero pressione. Non usare "spero di non disturbare". Non ripetere il link nel corpo (lo aggiungo io). Fai una domanda concreta alla fine tipo "fammi sapere se l'idea ti interessa" o "ci sentiamo?".

Firma: "Luca"

Rispondi SOLO con JSON valido: {"subject":"...","body":"..."}`;

  const r = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, responseMimeType: "application/json" },
    },
    { headers: { "Content-Type": "application/json" }, timeout: 30000 }
  );
  return JSON.parse(r.data.candidates[0].content.parts[0].text);
}

async function sendFollowUp(biz) {
  const copy = await generateFollowUpCopy(biz);
  const bodyHtml = `<div style="font-family:-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#222;max-width:560px">
${copy.body.split("\n").map(l => `<p>${l}</p>`).join("")}
${biz.landing_url ? `<p style="margin-top:16px"><a href="${biz.landing_url}" style="color:#2563eb">${biz.landing_url}</a></p>` : ""}
<p style="color:#999;font-size:12px;margin-top:24px">Se non vuoi più ricevere email scrivi CANCELLAMI.</p>
</div>`;

  const bodyText = `${copy.body}\n\n${biz.landing_url || ""}\n\n---\nRispondi CANCELLAMI per non ricevere altre email.`;

  if (DRY) {
    console.log(`[DRY] ${biz.email} — ${copy.subject}`);
    return { ok: true };
  }

  await mailer.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    replyTo: FROM_EMAIL,
    to: biz.email,
    subject: copy.subject,
    html: bodyHtml,
    text: bodyText,
  });

  getDb().prepare(
    "INSERT INTO activity_logs (business_id, type, message, meta) VALUES (?, ?, ?, ?)"
  ).run(biz.id, "mass-followup", `Follow-up inviato a ${biz.email}`, JSON.stringify({ subject: copy.subject }));

  return { ok: true };
}

(async () => {
  const list = pickRecipients();
  console.log(`Follow-up mass: ${list.length} destinatari${DRY ? " (DRY)" : ""}`);
  if (!list.length) { console.log("Niente da inviare."); return; }

  let ok = 0, fail = 0;
  const fails = [];
  for (let i = 0; i < list.length; i++) {
    const biz = list[i];
    process.stdout.write(`[${i + 1}/${list.length}] ${biz.name} → ${biz.email} ... `);
    try {
      await sendFollowUp(biz);
      console.log("✓");
      ok++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      fails.push({ biz, err: e.message });
      fail++;
    }
    await new Promise(r => setTimeout(r, 4000));
  }

  console.log(`\nDONE: ${ok} ok, ${fail} fail`);

  if (!DRY) {
    try {
      await mailer.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: "brizzantelucax@gmail.com",
        subject: `Follow-up mass completato — ${ok}/${list.length}`,
        text: `Follow-up a lead campagne 23-26.\n\nOK: ${ok}\nFAIL: ${fail}\n\n${fails.length ? "Falliti:\n" + fails.map(f => `• ${f.biz.name} — ${f.err}`).join("\n") : ""}`,
      });
      console.log("Recap inviato.");
    } catch (e) {
      console.error("Recap fallito:", e.message);
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
