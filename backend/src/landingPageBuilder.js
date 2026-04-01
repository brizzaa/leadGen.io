import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Determina il template da usare in base ai dati del business.
 * @param {object} business
 * @returns {"local-pro" | "digital-presence" | "social-first"}
 */
export function determineTemplate(business) {
  const hasSocial = business.facebook_url || business.instagram_url;
  const hasWebsite =
    business.website &&
    business.website !== "" &&
    business.website !== "None";

  if (hasSocial && !hasWebsite) return "social-first";

  if (hasWebsite) {
    const url = business.website.toLowerCase();
    const isWeakUrl =
      url.includes("facebook.com") ||
      url.includes("instagram.com") ||
      url.includes("linktr.ee") ||
      url.includes("linktree");
    if (isWeakUrl) return "digital-presence";
  }

  if (!hasWebsite) return "digital-presence";

  return "local-pro";
}

/**
 * Inietta il contenuto Gemini nel template HTML.
 * @param {object} content — oggetto JSON generato da Gemini
 * @param {string} templateName — "local-pro" | "digital-presence" | "social-first"
 * @param {object} business — dati del business dal DB
 * @returns {string} HTML finale
 */
export function buildLandingPage(content, templateName, business) {
  const templatePath = join(__dirname, "templates", `${templateName}.html`);
  let html = readFileSync(templatePath, "utf8");

  const replacements = {
    "{{HEADLINE}}": content.headline || business.name,
    "{{SUBHEADLINE}}": content.subheadline || "",
    "{{SERVICE_1}}": content.services?.[0] || "Servizio professionale",
    "{{SERVICE_2}}": content.services?.[1] || "Qualità garantita",
    "{{SERVICE_3}}": content.services?.[2] || "Assistenza clienti",
    "{{CTA_TEXT}}": content.cta_text || "Contattaci",
    "{{ACCENT_COLOR}}": content.accent_color || "#00d4aa",
    "{{BUSINESS_NAME}}": business.name || "",
    "{{BUSINESS_PHONE}}": business.phone || "",
    "{{BUSINESS_EMAIL}}": business.email || "",
    "{{BUSINESS_ADDRESS}}": business.address || "",
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(key, value);
  }

  return html;
}

/**
 * Fa il deploy dell'HTML su surge.sh (fallback: Netlify).
 * @param {string} html
 * @param {string} slug — slug del business (lettere minuscole, trattini)
 * @returns {Promise<string>} URL pubblico
 */
export async function deployPage(html, slug) {
  const randomId = Math.random().toString(36).slice(2, 8);
  const domain = `leadgen-${slug}-${randomId}.surge.sh`;
  const dir = join(tmpdir(), `leadgen-deploy-${Date.now()}`);

  try {
    mkdirSync(dir);
    writeFileSync(join(dir, "index.html"), html, "utf8");

    // Deploy su surge.sh (usa execFileSync per evitare command injection)
    try {
      const surgeBin = join(__dirname, "../../node_modules/.bin/surge");
      execFileSync(surgeBin, [dir, domain, "--token", process.env.SURGE_TOKEN], {
        encoding: "utf8",
        timeout: 45000,
      });
      return `https://${domain}`;
    } catch (surgeError) {
      // surge fallito — rilancia l'errore, il business verrà marcato come failed
      throw new Error("surge deploy fallito: " + surgeError.message);
    }
  } finally {
    try { rmSync(dir, { recursive: true }); } catch {}
  }
}

/**
 * Genera uno slug URL-safe dal nome del business.
 * @param {string} name
 * @returns {string}
 */
export function makeSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // rimuovi accenti
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30)
    .replace(/-$/, "");
}