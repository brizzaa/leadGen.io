// Verifica deliverability email del DB tramite deep-email-validator (npm).
//
// Pipeline per ogni email:
//   regex → tipo errore comuni → disposable → MX lookup → SMTP handshake (RCPT TO)
// Output:
//   email_verified         = 'valid' | 'invalid' | 'risky' | 'disposable' | 'unknown'
//   email_verified_reason  = etichetta motivo (es. "smtp", "mx_records", "regex", "disposable")
//   email_verified_at      = timestamp
//
// Note operative:
//   - SMTP handshake da IP residenziale tipico viene tollerato dalla maggior
//     parte dei provider, ma alcuni (es. Yahoo, AOL) bloccano dopo molte richieste
//     ravvicinate. Rate limit 1 req / 2s + batch piccoli. Per 1.000 email = ~35 min.
//   - I risultati 'unknown' sono spesso catch-all server (non si distinguono dai
//     veri valid). Da NON spedire ma da non cancellare.
//   - Rilanciabile: skippa email già verificate.
//
// Uso:
//   node scripts/verifyEmails.js --limit 30          # pilot
//   node scripts/verifyEmails.js                     # tutti i pending
//   node scripts/verifyEmails.js --reverify          # ri-verifica anche già fatte

import "dotenv/config";
import { validate } from "deep-email-validator";
import { getDb } from "../src/config/db.js";

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : null;
const REVERIFY = process.argv.includes("--reverify");
const DELAY_MS = 2000; // throttle SMTP

const db = getDb();

let sql = `
  SELECT id, name, email FROM businesses
  WHERE email IS NOT NULL AND email != '' AND email LIKE '%@%'
    AND is_blacklisted = 0
    ${REVERIFY ? "" : "AND email_verified IS NULL"}
  ORDER BY id DESC
`;
if (LIMIT) sql += ` LIMIT ${LIMIT}`;

const rows = db.prepare(sql).all();
console.log(`${rows.length} email da verificare${LIMIT ? ` (limit ${LIMIT})` : ""}, throttle ${DELAY_MS}ms\n`);
if (!rows.length) { console.log("Niente da fare."); process.exit(0); }

const upd = db.prepare(
  "UPDATE businesses SET email_verified=?, email_verified_reason=?, email_verified_at=CURRENT_TIMESTAMP WHERE id=?"
);

const stats = { valid: 0, invalid: 0, risky: 0, disposable: 0, unknown: 0 };
const startTs = Date.now();

// Provider italiani major spesso flaggati erroneamente come "disposable" dalla
// lista USA-centric della libreria. NON sono disposable: vanno trattati come
// normali provider mainstream.
const IT_LEGIT_PROVIDERS = new Set([
  "libero.it", "tin.it", "tiscali.it", "virgilio.it", "alice.it",
  "email.it", "iol.it", "inwind.it", "fastwebnet.it", "vodafone.it",
  "tim.it", "katamail.com", "supereva.it", "lycos.it",
]);

function classify(r, email) {
  // r = { valid: bool, validators: { regex, typo, disposable, mx, smtp }, reason }
  const v = r.validators || {};
  const domain = (email.split("@")[1] || "").toLowerCase();
  const isLegitItProvider = IT_LEGIT_PROVIDERS.has(domain);

  if (r.valid) return { status: "valid", reason: "smtp+mx_ok" };
  const reason = r.reason || "unknown";

  // Se la lib dice "disposable" ma è provider IT legittimo, ribilancia su MX/SMTP
  if (v.disposable && !v.disposable.valid && !isLegitItProvider) {
    return { status: "disposable", reason: "disposable_provider" };
  }
  if (v.disposable && !v.disposable.valid && isLegitItProvider) {
    // Skippa il flag disposable, valuta gli altri validator
    if (v.mx && !v.mx.valid) return { status: "invalid", reason: "mx_records_missing" };
    if (v.smtp && !v.smtp.valid) return { status: "unknown", reason: "smtp_skipped_legit_it_provider" };
    return { status: "valid", reason: "legit_it_provider_override" };
  }
  if (v.regex && !v.regex.valid) return { status: "invalid", reason: "regex" };
  if (v.typo && !v.typo.valid) return { status: "invalid", reason: "typo:" + (v.typo.reason || "?") };
  if (v.mx && !v.mx.valid) return { status: "invalid", reason: "mx_records_missing" };
  // smtp può essere "non-deterministic" su catch-all → risky
  if (v.smtp && !v.smtp.valid) {
    const msg = (v.smtp.reason || "").toLowerCase();
    if (msg.includes("greylisted") || msg.includes("temporary") || msg.includes("timeout"))
      return { status: "unknown", reason: "smtp_temporary" };
    return { status: "invalid", reason: "smtp:" + (v.smtp.reason || "rejected") };
  }
  return { status: "unknown", reason };
}

for (let i = 0; i < rows.length; i++) {
  const biz = rows[i];
  try {
    const r = await validate({ email: biz.email, sender: process.env.EMAIL_USER || "noreply@leader-gen.com" });
    const { status, reason } = classify(r, biz.email);
    upd.run(status, reason.slice(0, 200), biz.id);
    stats[status]++;
    const pct = Math.round(((i + 1) / rows.length) * 100);
    console.log(`[${String(i+1).padStart(4)}/${rows.length} ${String(pct).padStart(3)}%] ${biz.email.padEnd(40)} → ${status.padEnd(10)} (${reason})`);
  } catch (e) {
    stats.unknown++;
    upd.run("unknown", "exception:" + e.message.slice(0, 100), biz.id);
    console.log(`[${i+1}/${rows.length}] ${biz.email}: ERR ${e.message.slice(0,60)}`);
  }
  if (i < rows.length - 1) await new Promise(r => setTimeout(r, DELAY_MS));
}

const elapsed = Math.round((Date.now() - startTs) / 1000);
console.log("\n=== REPORT ===");
console.log(`  Verificate:     ${rows.length}`);
console.log(`  ✓ valid:        ${stats.valid}`);
console.log(`  ✗ invalid:      ${stats.invalid}`);
console.log(`  ⚠ risky:        ${stats.risky}`);
console.log(`  ⚠ disposable:   ${stats.disposable}`);
console.log(`  ? unknown:      ${stats.unknown}`);
console.log(`  Tempo:          ${elapsed}s`);
process.exit(0);
