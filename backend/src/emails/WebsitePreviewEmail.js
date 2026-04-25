import { createElement as h } from "react";
import { render } from "@react-email/render";
import {
  Html, Head, Body, Container, Section,
  Text, Button, Img, Hr, Preview, Row, Column,
} from "@react-email/components";

function WebsitePreviewEmail({ businessName, emailBody, websiteUrl, screenshotCid, unsubscribeUrl }) {
  const paragraphs = (emailBody || "").split("\n").filter((l) => l.trim() !== "");
  const displayUrl = websiteUrl || `${(businessName || "").toLowerCase().replace(/\s+/g, "")}.it`;

  return h(Html, { lang: "it" },
    h(Preview, null, `Una proposta per ${businessName} — dai un'occhiata`),

    h(Body, { style: { backgroundColor: "#fff", margin: 0, padding: 0, fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif" } },
      h(Container, { style: { maxWidth: "600px", margin: "0 auto" } },

        // ── Top bar ──────────────────────────────────────────
        h(Section, { style: { borderBottom: "3px solid #000", padding: "22px 40px" } },
          h(Row, null,
            h(Column, null,
              h(Text, { style: { fontSize: "17px", fontWeight: "900", color: "#000", margin: 0, letterSpacing: "-0.02em" } },
                "Studio Web"
              ),
            ),
            h(Column, { style: { textAlign: "right" } },
              h(Text, { style: { fontSize: "11px", color: "#999", margin: 0, letterSpacing: "0.05em", textTransform: "uppercase" } },
                "Proposta gratuita"
              ),
            ),
          ),
        ),

        // ── Hero nero ────────────────────────────────────────
        h(Section, { style: { backgroundColor: "#000", padding: "52px 40px 44px" } },
          h(Text, { style: { fontSize: "12px", color: "#666", margin: "0 0 12px", letterSpacing: "0.12em", textTransform: "uppercase" } },
            "Per — " + businessName
          ),
          h(Text, { as: "h1", style: { fontSize: "44px", fontWeight: "900", color: "#fff", lineHeight: "1.08", margin: "0 0 36px", letterSpacing: "-0.03em" } },
            "Il tuo sito.\nDomani."
          ),
          h(Button, {
            href: websiteUrl || "#",
            style: { backgroundColor: "#fff", color: "#000", borderRadius: "0", fontSize: "13px", fontWeight: "800", padding: "14px 28px", textDecoration: "none", display: "inline-block", letterSpacing: "0.06em", textTransform: "uppercase" },
          }, "Vedi l'anteprima →"),
        ),

        // ── Messaggio personale ──────────────────────────────
        h(Section, { style: { padding: "40px 40px 32px", backgroundColor: "#fff" } },
          ...paragraphs.map((p, i) =>
            h(Text, { key: i, style: { fontSize: "16px", lineHeight: "1.8", color: "#1c1917", margin: "0 0 16px" } }, p)
          ),
        ),

        // ── Screenshot ───────────────────────────────────────
        ...(screenshotCid ? [
          h(Section, { key: "screenshot", style: { padding: "0 40px 40px", backgroundColor: "#fff" } },
            // Browser chrome
            h(Section, { style: { backgroundColor: "#e8eaed", padding: "8px 14px", borderRadius: "8px 8px 0 0" } },
              h(Row, null,
                h(Column, { style: { width: "80px" } },
                  h(Text, { style: { margin: 0, lineHeight: 1, fontSize: "10px" } },
                    h("span", { style: { display: "inline-block", width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#ff5f57", marginRight: "4px", verticalAlign: "middle" } }),
                    h("span", { style: { display: "inline-block", width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#febc2e", marginRight: "4px", verticalAlign: "middle" } }),
                    h("span", { style: { display: "inline-block", width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "#28c840", verticalAlign: "middle" } }),
                  ),
                ),
                h(Column, null,
                  h(Text, { style: { margin: 0, fontSize: "11px", color: "#666", fontFamily: "monospace", backgroundColor: "#fff", borderRadius: "4px", padding: "2px 10px", display: "inline-block" } },
                    displayUrl
                  ),
                ),
              ),
            ),
            h(Section, { style: { border: "1px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" } },
              h(Img, {
                src: `cid:${screenshotCid}`,
                width: "520",
                alt: `Anteprima sito ${businessName}`,
                style: { display: "block", width: "100%" },
              }),
            ),
          ),
        ] : []),

        // ── Divisore label ───────────────────────────────────
        h(Section, { style: { backgroundColor: "#f4f4f0", padding: "18px 40px" } },
          h(Text, { style: { fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#999", margin: 0, fontWeight: "700" } },
            "Cosa è incluso"
          ),
        ),

        // ── Feature list ─────────────────────────────────────
        h(Section, { style: { backgroundColor: "#f4f4f0", padding: "0 40px 8px" } },
          ...[
            ["Design su misura",    "Progettato per la tua categoria di business."],
            ["SEO locale",          "Per apparire su Google Maps e ricerche locali."],
            ["Nessun costo iniziale","Paghi solo se sei soddisfatto del risultato."],
            ["Consegna in 48h",     "Dal tuo sì al sito online in due giorni."],
          ].map(([title, desc], i) =>
            h(Section, { key: i, style: { borderTop: "1px solid #e0e0dc", padding: "18px 0" } },
              h(Row, null,
                h(Column, { style: { width: "36px", verticalAlign: "top" } },
                  h(Text, { style: { fontSize: "13px", fontWeight: "900", color: "#000", margin: 0, lineHeight: "1.4" } },
                    `0${i + 1}`
                  ),
                ),
                h(Column, { style: { verticalAlign: "top" } },
                  h(Text, { style: { fontSize: "14px", fontWeight: "700", color: "#000", margin: "0 0 2px", lineHeight: "1.4" } }, title),
                  h(Text, { style: { fontSize: "13px", color: "#666", margin: 0, lineHeight: "1.55" } }, desc),
                ),
              ),
            )
          ),
        ),

        // ── CTA finale ───────────────────────────────────────
        h(Section, { style: { backgroundColor: "#000", padding: "36px 40px", textAlign: "center" } },
          h(Button, {
            href: websiteUrl || "#",
            style: { backgroundColor: "#fff", color: "#000", borderRadius: "0", fontSize: "13px", fontWeight: "800", padding: "14px 36px", textDecoration: "none", display: "inline-block", letterSpacing: "0.06em", textTransform: "uppercase" },
          }, "Vedi il sito completo →"),
        ),

        // ── Footer ────────────────────────────────────────────
        h(Section, { style: { padding: "24px 40px", borderTop: "1px solid #e5e7eb" } },
          h(Text, { style: { fontSize: "11px", color: "#bbb", margin: "0 0 8px", lineHeight: "1.6" } },
            "Mittente: Luca Brizzante — l.brizzante@leader-gen.com. Dati raccolti da fonti pubbliche (Google Maps, sito web aziendale). Contatto motivato da legittimo interesse B2B ex art. 6.1.f Reg. UE 2016/679. Informativa privacy completa: ",
            h("a", { href: "https://privacy.leader-gen.com", style: { color: "#888", textDecoration: "underline" } }, "privacy.leader-gen.com"),
            "."
          ),
          unsubscribeUrl
            ? h(Text, { style: { fontSize: "11px", color: "#999", margin: 0, lineHeight: "1.6" } },
                "Non vuoi più ricevere queste email? ",
                h("a", { href: unsubscribeUrl, style: { color: "#666", textDecoration: "underline" } }, "Annulla iscrizione"),
                " (un click, senza ulteriori conferme)."
              )
            : null,
        ),

      ),
    ),
  );
}

export async function renderWebsitePreviewEmail({ businessName, emailBody, websiteUrl, screenshotCid = "website-preview", unsubscribeUrl = null }) {
  return render(
    h(WebsitePreviewEmail, { businessName, emailBody, websiteUrl, screenshotCid, unsubscribeUrl }),
  );
}
