// Login Facebook manuale via Playwright.
// Apre il browser, aspetta che tu completi login + consent/2FA/captcha, poi salva.
//
// Il salvataggio avviene quando:
//   - chiudi la finestra del browser,      oppure
//   - premi Enter nel terminale,           oppure
//   - URL arriva al feed "normale" e sei fuori da /privacy/consent/ (auto-detect soft)
//
// Uso: node scripts/facebookLogin.js

import "dotenv/config";
import { chromium } from "playwright";
import { copyFileSync } from "fs";

const SESSION_FILE = "fb-session.json";
const ROOT_SESSION = "../../fb-session.json";

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  locale: "it-IT",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
});
const page = await context.newPage();
await page.goto("https://www.facebook.com/login/", { waitUntil: "domcontentloaded" });

console.log("\n════════════════════════════════════════════════════════════════");
console.log("Browser aperto su Facebook.");
console.log("1) Fai login (se non sei già loggato).");
console.log("2) Completa eventuali schermate: consent ad, 2FA, captcha, popup.");
console.log("3) Quando sei sul feed normale, torna qui e PREMI INVIO,");
console.log("   oppure chiudi la finestra del browser.");
console.log("════════════════════════════════════════════════════════════════\n");

async function saveAndExit(reason) {
  try {
    const cookies = await context.cookies("https://www.facebook.com");
    const cuser = cookies.find(c => c.name === "c_user");
    if (!cuser) {
      console.error(`✗ ${reason} — nessun cookie c_user, non salvo nulla.`);
      try { await browser.close(); } catch {}
      process.exit(1);
    }
    console.log(`\n→ ${reason}`);
    console.log(`✓ Facebook user ID: ${cuser.value}`);
    await context.storageState({ path: SESSION_FILE });
    try { copyFileSync(SESSION_FILE, ROOT_SESSION); } catch {}
    console.log(`✓ Sessione salvata in ${SESSION_FILE} e ${ROOT_SESSION}`);
    try { await browser.close(); } catch {}
    process.exit(0);
  } catch (e) {
    console.error(`✗ Errore durante save: ${e.message}`);
    process.exit(1);
  }
}

// Trigger 1: user preme Enter in terminale
process.stdin.setEncoding("utf-8");
process.stdin.resume();
process.stdin.on("data", () => saveAndExit("Enter premuto in terminale"));

// Trigger 2: user chiude la finestra (disconnect del browser)
browser.on("disconnected", () => saveAndExit("Browser chiuso dall'utente"));

// Safety net: timeout 15 minuti
setTimeout(() => {
  console.error("\n✗ Timeout 15 min — nessuna azione, esco senza salvare.");
  process.exit(1);
}, 15 * 60 * 1000);
