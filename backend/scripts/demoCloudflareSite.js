// Scarica HTML di 3 siti Netlify esistenti e li rideploya su Cloudflare R2.
// Serve per validare end-to-end pipeline R2+Worker con HTML di produzione.

import "dotenv/config";
import axios from "axios";
import { deploySite, buildSlug } from "../src/services/cloudflareDeployer.js";

const DEMOS = [
  { name: "BODYTEC dammi venti minuti Rovigo", netlify: "https://leadgen-bodytec-dammi-venti-minuti-rov-t375m0.netlify.app" },
  { name: "Karma Ristorante Indiano", netlify: "https://leadgen-karma-ristorante-indiano-8o2v3s.netlify.app" },
  { name: "Studio Legale De Bellis", netlify: "https://leadgen-studio-legale-de-bellis-8uol6s.netlify.app" },
];

const results = [];
for (const d of DEMOS) {
  process.stdout.write(`→ ${d.name}... `);
  const { data: html } = await axios.get(d.netlify);
  const slug = buildSlug(d.name);
  const deployed = await deploySite(slug, html);
  console.log(`✓ ${deployed.url}`);
  results.push({ ...d, slug, cf_url: deployed.url });
}

console.log("\n--- Riepilogo ---");
results.forEach(r => console.log(`${r.name}\n  Netlify: ${r.netlify}\n  CF:      ${r.cf_url}\n`));

// Invia email a l.brizzante@bevolve.it
import nodemailer from "nodemailer";
const t = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
const body = `Demo hosting Cloudflare R2 + Workers (dominio leader-gen.com)

Setup completato:
- R2 bucket: leadgen-sites
- Worker: leadgen-router (serve HTML da R2 leggendo sottodominio host)
- DNS: wildcard *.leader-gen.com
- SSL: Universal wildcard (gratis)
- Costo: €10/anno dominio, tutto il resto free tier forever (10GB storage, 100k req/giorno)

Gli stessi HTML già su Netlify sono ora disponibili anche via R2:

${results.map(r => `• ${r.name}\n  Netlify originale: ${r.netlify}\n  Cloudflare nuovo:  ${r.cf_url}`).join("\n\n")}

Apri tutti e 3 i link "Cloudflare nuovo" e confrontali con i relativi Netlify. Dovrebbero essere identici (stesso HTML).

Se ti convince, la prossima campagna genera siti direttamente su Cloudflare.
`;
await t.sendMail({
  from: `"${process.env.MY_NAME || "Studio Web"}" <${process.env.EMAIL_USER}>`,
  to: "l.brizzante@bevolve.it",
  subject: "Demo hosting Cloudflare — 3 siti di prova",
  text: body,
});
console.log("Email riepilogo inviata a l.brizzante@bevolve.it");
