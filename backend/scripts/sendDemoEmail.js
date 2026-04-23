import "dotenv/config";
import nodemailer from "nodemailer";

const urls = [
  { name: "BODYTEC dammi venti minuti Rovigo", template: "modern/slate", kw: "EMS training session", url: "https://leadgen-bodytec-dammi-venti-minuti-rov-t375m0.netlify.app" },
  { name: "Movimenti Creativi asd", template: "editorial/ocean", kw: "aerial silks performance", url: "https://leadgen-movimenti-creativi-asd-s5r1pv.netlify.app" },
  { name: "Movement - Personal Training Studio", template: "editorial/berry", kw: "personal training studio", url: "https://leadgen-movement-personal-training-stu-pgsj3k.netlify.app" },
];

const t = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
const body = `Ciao,

Seconda iterata. Fix applicato al problema "immagini senza senso":

1. Le keyword immagini ora le genera GEMINI leggendo il business reale (non più regex fragili tipo "se contiene 'fitness' → gym").
2. Filtro anti-generico: blocco foto con tag sofa/office/collaboration/pasta/handshake (quelli che davano sofà su siti palestra).

Risultato sui 3 siti di test:
${urls.map(u => `• ${u.name}\n  keyword AI: "${u.kw}" [${u.template}]\n  ${u.url}`).join("\n\n")}

Controlla. Se ora le immagini hanno senso, mando il via per i restanti 87.
`;

await t.sendMail({ from: `"${process.env.MY_NAME || "Studio Web"}" <${process.env.EMAIL_USER}>`, to: "l.brizzante@bevolve.it", subject: "Demo nuovo flusso v2 — keyword AI-generated", text: body });
console.log("sent");
