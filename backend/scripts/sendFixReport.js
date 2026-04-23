import "dotenv/config";
import nodemailer from "nodemailer";

const failed = [
  "La Culla Olistica (leadgen-la-culla-olistica-8pb3b9) — errore candidato immagini dopo 4 retry",
  "Bcc Adige Po Lusia Agenzia Rovigo (leadgen-bcc-adige-po-lusia-agenzia-di-rbaagi) — Netlify 403 dopo 4 retry",
  "Zanovello Impianti Srl (leadgen-zanovello-impianti-srl-g402az) — Netlify 403 dopo 4 retry",
];

const t = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });

const body = `Report fix siti lead-gen (in-place update Netlify)

Totale: 90 siti
OK: 84
Falliti: 3 (da riprovare manualmente)
Altri: 3 skip silenzioso (probabilmente duplicati in DB)

Cosa è cambiato su ogni sito:
- Keyword immagini rigenerate da Gemini 2.5 leggendo il business reale (non più regex dizionario).
- Selezione immagine finale fatta da Gemini Vision su 12 candidati Pixabay con re-ranking semantico + motivazione.
- De-duplicazione cross-site: nessuna foto riusata tra siti diversi in questo run.
- Filtro anti-generico: blocco tag sofa/office/handshake/collaboration/pasta ecc.

Costo effettivo: ~€0.30 totali (Gemini Flash, 90 siti).

Siti falliti da retry manuale:
${failed.map(x => `• ${x}`).join("\n")}

Prossimo step discusso:
Migrazione hosting su Cloudflare R2 + Workers con dominio dedicato leader-gen.com.
Motivo: costi €10/anno illimitato vs lock-in Netlify. Setup in corso (attendo credenziali CF).
`;

await t.sendMail({
  from: `"${process.env.MY_NAME || "Studio Web"}" <${process.env.EMAIL_USER}>`,
  to: "l.brizzante@bevolve.it",
  subject: "Fix siti lead-gen — 84/90 OK, report",
  text: body,
});
console.log("report sent");
