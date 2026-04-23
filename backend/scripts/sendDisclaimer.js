// Follow-up disclaimer email: avvisa i destinatari di Campaign-* che le immagini
// potrebbero essere sbagliate perché la pipeline automazione è in sperimentazione.
//
// Uso:
//   node scripts/sendDisclaimer.js --dry-run   # stampa lista, non invia
//   node scripts/sendDisclaimer.js             # invia (1 email/sec)
//
// Filtri: solo businesses con email valida, non blacklisted,
// che compaiono almeno una volta in campaign_results con status='sent'.

import "dotenv/config";
import nodemailer from "nodemailer";
import { getDb } from "../src/config/db.js";

const DRY = process.argv.includes("--dry-run");

const SUBJECT = "Precisazione sulla mail di prima";

function buildBody(senderName) {
  return `Ciao,

una riga veloce sulla mail di prima: mi piace sperimentare con le automazioni, e il pezzo che sceglie le immagini è andato storto. Se sul sito demo trovi qualcosa di fuori posto, è colpa della pipeline, non del tuo business.

Il resto (layout e testi) l'ho pensato su misura per voi.

Scusate il disagio,
${senderName}
`;
}

async function main() {
  const db = getDb();
  const all = db.prepare(`
    SELECT DISTINCT b.id, b.name, b.email
    FROM businesses b
    JOIN campaign_results cr ON cr.business_id = b.id
    WHERE cr.status = 'sent'
      AND b.email IS NOT NULL AND TRIM(b.email) != ''
      AND (b.is_blacklisted = 0 OR b.is_blacklisted IS NULL)
    ORDER BY b.id
  `).all();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.(com|it|net|org|eu|info|biz|co|io|me)$/i;
  const rows = all.filter(r => EMAIL_RE.test(r.email.trim()));
  const skipped = all.length - rows.length;
  if (skipped) console.log(`(filtrati ${skipped} email malformate)`);

  console.log(`Destinatari: ${rows.length}`);

  if (DRY) {
    for (const r of rows) console.log(`  #${r.id} ${r.name} <${r.email}>`);
    console.log("\nDRY-RUN: nessuna email inviata.");
    return;
  }

  const senderName = process.env.MY_NAME || "Studio Web";
  const senderEmail = process.env.EMAIL_USER;
  if (!senderEmail || !process.env.EMAIL_PASS) {
    throw new Error("EMAIL_USER/EMAIL_PASS mancanti nel .env");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: senderEmail, pass: process.env.EMAIL_PASS },
  });

  const body = buildBody(senderName);
  let sent = 0, failed = 0;

  for (const r of rows) {
    try {
      await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        replyTo: senderEmail,
        to: r.email,
        subject: SUBJECT,
        text: body,
      });
      sent++;
      console.log(`[${sent}/${rows.length}] sent -> ${r.email}`);
    } catch (e) {
      failed++;
      console.error(`  FAIL ${r.email}: ${e.message}`);
    }
    await new Promise(res => setTimeout(res, 1000));
  }

  console.log(`\nDONE: ${sent} sent, ${failed} failed.`);
}

main().catch(e => { console.error(e); process.exit(1); });
