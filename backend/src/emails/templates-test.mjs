import { createElement as h } from "react";
import { render } from "@react-email/render";
import {
  Html, Head, Body, Container, Section,
  Text, Button, Img, Hr, Preview, Font, Row, Column, Link, Heading,
} from "@react-email/components";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const BIZ = "Pizzeria Da Mario";
const TO  = "l.brizzante@bevolve.it";
const URL = "https://pizzeriadamario.it";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// ─── Layout 1: "CARTA BIANCA" — minimal editoriale ────────────────────────
function Layout1({ biz, url }) {
  return h(Html, { lang: "it" },
    h(Preview, null, `Una proposta per ${biz}`),
    h(Body, { style: { backgroundColor: "#fafafa", margin: 0, padding: "60px 0", fontFamily: "Georgia, serif" } },
      h(Container, { style: { maxWidth: "560px", margin: "0 auto", backgroundColor: "#fff", padding: "64px 56px" } },

        h(Text, { style: { fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#999", margin: "0 0 48px" } },
          "Una proposta per te"
        ),

        h(Heading, { as: "h1", style: { fontSize: "36px", fontWeight: "400", color: "#111", lineHeight: "1.2", margin: "0 0 32px", fontFamily: "Georgia, serif" } },
          `${biz} merita un sito all'altezza.`
        ),

        h(Hr, { style: { border: "none", borderTop: "1px solid #eee", margin: "0 0 32px" } }),

        h(Text, { style: { fontSize: "16px", lineHeight: "1.8", color: "#444", margin: "0 0 16px" } },
          "Buongiorno,"
        ),
        h(Text, { style: { fontSize: "16px", lineHeight: "1.8", color: "#444", margin: "0 0 16px" } },
          "Ho analizzato la vostra presenza online e ho preparato gratuitamente un'anteprima di come potrebbe apparire il vostro nuovo sito web."
        ),
        h(Text, { style: { fontSize: "16px", lineHeight: "1.8", color: "#444", margin: "0 0 40px" } },
          "Nessun impegno, nessun costo nascosto — solo un'idea concreta."
        ),

        h(Link, { href: url, style: { fontSize: "15px", color: "#111", fontWeight: "600", textDecoration: "underline", textUnderlineOffset: "4px" } },
          "Vedi l'anteprima →"
        ),

        h(Hr, { style: { border: "none", borderTop: "1px solid #eee", margin: "48px 0 24px" } }),
        h(Text, { style: { fontSize: "12px", color: "#bbb", margin: 0, lineHeight: "1.6" } },
          "Rispondi STOP per non ricevere ulteriori messaggi. Dati raccolti da fonti pubbliche — Art. 13 GDPR."
        ),
      ),
    ),
  );
}

// ─── Layout 2: "NOTTE" — dark premium ─────────────────────────────────────
function Layout2({ biz, url }) {
  return h(Html, { lang: "it" },
    h(Preview, null, `Ho un'idea per ${biz}`),
    h(Body, { style: { backgroundColor: "#0f172a", margin: 0, padding: "48px 0 64px", fontFamily: "-apple-system, Arial, sans-serif" } },
      h(Container, { style: { maxWidth: "560px", margin: "0 auto" } },

        // Header
        h(Section, { style: { textAlign: "center", padding: "0 0 40px" } },
          h(Text, { style: { fontSize: "13px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", margin: 0 } },
            "Proposta riservata"
          ),
        ),

        // Main card
        h(Section, { style: { backgroundColor: "#1e293b", borderRadius: "20px", padding: "48px 44px", marginBottom: "16px", border: "1px solid #334155" } },
          h(Text, { style: { fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#38bdf8", margin: "0 0 20px", fontWeight: "600" } },
            "⚡ Analisi completata"
          ),
          h(Heading, { as: "h1", style: { fontSize: "30px", fontWeight: "700", color: "#f1f5f9", lineHeight: "1.3", margin: "0 0 24px" } },
            `Abbiamo preparato qualcosa per ${biz}.`
          ),
          h(Text, { style: { fontSize: "15px", lineHeight: "1.75", color: "#94a3b8", margin: "0 0 32px" } },
            "Ho analizzato la vostra attività e creato un prototipo gratuito del vostro potenziale sito web. Moderno, veloce, ottimizzato per Google."
          ),
          h(Button, { href: url, style: { backgroundColor: "#38bdf8", color: "#0f172a", borderRadius: "10px", fontSize: "15px", fontWeight: "700", padding: "14px 32px", textDecoration: "none", display: "inline-block" } },
            "Vedi il prototipo"
          ),
        ),

        // Stats row
        h(Section, { style: { backgroundColor: "#1e293b", borderRadius: "16px", padding: "24px 32px", border: "1px solid #334155" } },
          h(Row, null,
            h(Column, { style: { textAlign: "center" } },
              h(Text, { style: { fontSize: "24px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 4px" } }, "3×"),
              h(Text, { style: { fontSize: "12px", color: "#64748b", margin: 0 } }, "più clienti online"),
            ),
            h(Column, { style: { textAlign: "center" } },
              h(Text, { style: { fontSize: "24px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 4px" } }, "24h"),
              h(Text, { style: { fontSize: "12px", color: "#64748b", margin: 0 } }, "consegna prototipo"),
            ),
            h(Column, { style: { textAlign: "center" } },
              h(Text, { style: { fontSize: "24px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 4px" } }, "€0"),
              h(Text, { style: { fontSize: "12px", color: "#64748b", margin: 0 } }, "costo iniziale"),
            ),
          ),
        ),

        h(Text, { style: { fontSize: "11px", color: "#475569", textAlign: "center", margin: "24px 0 0", lineHeight: "1.6" } },
          "Rispondi STOP per cancellarti. Dati da fonti pubbliche — Art. 13 GDPR."
        ),
      ),
    ),
  );
}

// ─── Layout 3: "GRADIENT HERO" — colorato moderno ─────────────────────────
function Layout3({ biz, url }) {
  return h(Html, { lang: "it" },
    h(Preview, null, `Abbiamo creato il sito di ${biz}`),
    h(Body, { style: { backgroundColor: "#f8fafc", margin: 0, padding: "40px 0 60px", fontFamily: "-apple-system, Arial, sans-serif" } },
      h(Container, { style: { maxWidth: "580px", margin: "0 auto" } },

        // Hero gradient
        h(Section, { style: { background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)", borderRadius: "20px 20px 0 0", padding: "48px 44px 40px", textAlign: "center" } },
          h(Text, { style: { fontSize: "13px", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", margin: "0 0 16px", fontWeight: "600" } },
            "Creato appositamente per te"
          ),
          h(Heading, { as: "h1", style: { fontSize: "32px", fontWeight: "800", color: "#fff", lineHeight: "1.2", margin: "0 0 16px" } },
            `Il sito web di ${biz} è pronto.`
          ),
          h(Text, { style: { fontSize: "15px", color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: "1.6" } },
            "Abbiamo preparato un prototipo gratuito. Dai un'occhiata, senza impegno."
          ),
        ),

        // White body
        h(Section, { style: { backgroundColor: "#fff", padding: "40px 44px", borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0" } },
          // Steps
          ...[
            ["🎨", "Design personalizzato", "Colori, font e stile su misura per la tua attività."],
            ["📱", "Mobile-first", "Perfetto su smartphone, tablet e desktop."],
            ["🔍", "Visibile su Google", "SEO locale integrato per farti trovare dai clienti vicini."],
          ].map(([emoji, title, desc]) =>
            h(Row, { key: title, style: { marginBottom: "24px" } },
              h(Column, { style: { width: "48px", verticalAlign: "top" } },
                h(Text, { style: { fontSize: "24px", margin: 0, lineHeight: "1" } }, emoji),
              ),
              h(Column, { style: { verticalAlign: "top" } },
                h(Text, { style: { fontSize: "15px", fontWeight: "700", color: "#1e293b", margin: "0 0 4px" } }, title),
                h(Text, { style: { fontSize: "14px", color: "#64748b", margin: 0, lineHeight: "1.6" } }, desc),
              ),
            )
          ),
        ),

        // CTA section
        h(Section, { style: { backgroundColor: "#f8fafc", borderRadius: "0 0 20px 20px", padding: "32px 44px 36px", textAlign: "center", border: "1px solid #e2e8f0", borderTop: "none" } },
          h(Button, { href: url, style: { background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", borderRadius: "12px", fontSize: "16px", fontWeight: "700", padding: "16px 40px", textDecoration: "none", display: "inline-block" } },
            "Vedi il tuo sito →"
          ),
          h(Text, { style: { fontSize: "13px", color: "#94a3b8", margin: "16px 0 0" } },
            "Gratuito · Nessun impegno · Risposta in 24h"
          ),
        ),

        h(Text, { style: { fontSize: "11px", color: "#cbd5e1", textAlign: "center", margin: "24px 0 0", lineHeight: "1.6" } },
          "Rispondi STOP per cancellarti. Dati da fonti pubbliche — Art. 13 GDPR."
        ),
      ),
    ),
  );
}

// ─── Layout 4: "SPOTLIGHT" — focus sul prodotto, ultra clean ──────────────
function Layout4({ biz, url }) {
  return h(Html, { lang: "it" },
    h(Preview, null, `Un sito per ${biz} — pronto da vedere`),
    h(Body, { style: { backgroundColor: "#fff", margin: 0, padding: "0", fontFamily: "-apple-system, Arial, sans-serif" } },
      h(Container, { style: { maxWidth: "600px", margin: "0 auto" } },

        // Top bar
        h(Section, { style: { borderBottom: "3px solid #000", padding: "24px 40px" } },
          h(Row, null,
            h(Column, null,
              h(Text, { style: { fontSize: "18px", fontWeight: "900", color: "#000", margin: 0, letterSpacing: "-0.02em" } }, "Studio Web"),
            ),
            h(Column, { style: { textAlign: "right" } },
              h(Text, { style: { fontSize: "12px", color: "#999", margin: 0 } }, "Proposta gratuita"),
            ),
          ),
        ),

        // Hero text
        h(Section, { style: { padding: "56px 40px 40px", backgroundColor: "#000" } },
          h(Text, { style: { fontSize: "13px", color: "#666", margin: "0 0 12px", letterSpacing: "0.1em", textTransform: "uppercase" } },
            "Per — " + biz
          ),
          h(Heading, { as: "h1", style: { fontSize: "48px", fontWeight: "900", color: "#fff", lineHeight: "1.05", margin: "0 0 32px", letterSpacing: "-0.03em" } },
            "Il tuo sito.\nDomani."
          ),
          h(Button, { href: url, style: { backgroundColor: "#fff", color: "#000", borderRadius: "0", fontSize: "14px", fontWeight: "800", padding: "14px 28px", textDecoration: "none", display: "inline-block", letterSpacing: "0.05em", textTransform: "uppercase" } },
            "Vedi ora →"
          ),
        ),

        // Divider with label
        h(Section, { style: { backgroundColor: "#f4f4f0", padding: "20px 40px" } },
          h(Text, { style: { fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#999", margin: 0 } },
            "Cosa è incluso"
          ),
        ),

        // Feature grid
        h(Section, { style: { padding: "0 40px 40px", backgroundColor: "#f4f4f0" } },
          ...[
            ["Design su misura", "Progettato per la tua categoria di business."],
            ["SEO locale", "Per apparire su Google Maps e ricerche locali."],
            ["Nessun costo iniziale", "Paghi solo se sei soddisfatto."],
            ["Consegna in 48h", "Dal tuo sì al sito online in due giorni."],
          ].map(([title, desc], i) =>
            h(Section, { key: i, style: { borderTop: "1px solid #e0e0dc", padding: "20px 0" } },
              h(Row, null,
                h(Column, { style: { width: "32px" } },
                  h(Text, { style: { fontSize: "14px", fontWeight: "900", color: "#000", margin: 0 } }, `0${i + 1}`),
                ),
                h(Column, null,
                  h(Text, { style: { fontSize: "14px", fontWeight: "700", color: "#000", margin: "0 0 2px" } }, title),
                  h(Text, { style: { fontSize: "13px", color: "#666", margin: 0, lineHeight: "1.5" } }, desc),
                ),
              ),
            )
          ),
        ),

        h(Section, { style: { padding: "24px 40px", borderTop: "1px solid #e0e0dc" } },
          h(Text, { style: { fontSize: "11px", color: "#bbb", margin: 0, lineHeight: "1.6" } },
            "Rispondi STOP per cancellarti. Dati da fonti pubbliche — Art. 13 GDPR."
          ),
        ),
      ),
    ),
  );
}

// ─── Layout 5: "LETTERA PERSONALE" — autentico, caldo, trust-first ─────────
function Layout5({ biz, url }) {
  return h(Html, { lang: "it" },
    h(Preview, null, `Ciao — ho pensato a ${biz}`),
    h(Body, { style: { backgroundColor: "#fef9f0", margin: 0, padding: "48px 0 64px", fontFamily: "Georgia, serif" } },
      h(Container, { style: { maxWidth: "540px", margin: "0 auto" } },

        // Stamp-like header
        h(Section, { style: { textAlign: "center", marginBottom: "40px" } },
          h(Section, { style: { display: "inline-block", border: "2px solid #d97706", borderRadius: "4px", padding: "6px 16px" } },
            h(Text, { style: { fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#d97706", margin: 0, fontFamily: "Arial, sans-serif", fontWeight: "700" } },
              "Proposta personale"
            ),
          ),
        ),

        // Letter card
        h(Section, { style: { backgroundColor: "#fff", borderRadius: "4px", padding: "48px 52px", boxShadow: "0 1px 4px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.04)" } },

          h(Text, { style: { fontSize: "17px", lineHeight: "1.85", color: "#1c1917", margin: "0 0 20px" } },
            `Gentile team di ${biz},`
          ),
          h(Text, { style: { fontSize: "17px", lineHeight: "1.85", color: "#1c1917", margin: "0 0 20px" } },
            "Vi scrivo perché mi occupo di realizzare siti web per attività locali come la vostra, e ho notato che potreste beneficiare di una presenza online più forte."
          ),
          h(Text, { style: { fontSize: "17px", lineHeight: "1.85", color: "#1c1917", margin: "0 0 28px" } },
            "Ho già preparato una bozza gratuita pensata appositamente per voi — nessuna spesa, nessun impegno. Solo un'idea concreta da valutare insieme."
          ),

          // Quote box
          h(Section, { style: { borderLeft: "3px solid #d97706", paddingLeft: "20px", margin: "0 0 32px" } },
            h(Text, { style: { fontSize: "15px", fontStyle: "italic", color: "#78716c", lineHeight: "1.7", margin: 0 } },
              `"Un sito ben fatto può portare ${biz} da invisibile online a prima scelta del quartiere."`
            ),
          ),

          h(Button, { href: url, style: { backgroundColor: "#d97706", color: "#fff", borderRadius: "6px", fontSize: "15px", fontWeight: "700", padding: "14px 32px", textDecoration: "none", display: "inline-block", fontFamily: "Arial, sans-serif" } },
            "Vedi la bozza gratuita"
          ),

          h(Hr, { style: { border: "none", borderTop: "1px solid #f0ebe3", margin: "40px 0 28px" } }),

          h(Text, { style: { fontSize: "15px", lineHeight: "1.7", color: "#1c1917", margin: "0 0 4px" } },
            "Con stima,"
          ),
          h(Text, { style: { fontSize: "17px", fontWeight: "700", color: "#1c1917", margin: 0 } },
            "Marco — Studio Web Locale"
          ),
          h(Text, { style: { fontSize: "14px", color: "#a8a29e", margin: "4px 0 0", fontFamily: "Arial, sans-serif" } },
            "marco@studioweb.it · +39 333 123 4567"
          ),
        ),

        h(Text, { style: { fontSize: "11px", color: "#c4b5a0", textAlign: "center", margin: "24px 0 0", lineHeight: "1.6", fontFamily: "Arial, sans-serif" } },
          "Rispondi STOP per cancellarti. Dati da fonti pubbliche — Art. 13 GDPR."
        ),
      ),
    ),
  );
}

// ─── Send all ──────────────────────────────────────────────────────────────
const layouts = [
  { name: "Layout 1 — Carta Bianca (minimal editoriale)", fn: Layout1 },
  { name: "Layout 2 — Notte (dark premium)",              fn: Layout2 },
  { name: "Layout 3 — Gradient Hero (colorato moderno)",  fn: Layout3 },
  { name: "Layout 4 — Spotlight (bold & product-focus)",  fn: Layout4 },
  { name: "Layout 5 — Lettera Personale (trust-first)",   fn: Layout5 },
];

for (const { name, fn } of layouts) {
  const html = await render(h(fn, { biz: BIZ, url: URL }));
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: TO,
    subject: name,
    html,
  });
  console.log(`✓ ${name}`);
}

console.log("\nTutte e 5 le mail inviate!");
