// Login Instagram manuale via Playwright.
// Apre il browser, aspetta che tu faccia login (polling automatico), poi salva la sessione.
// Uso: node scripts/instagramLogin.js

import "dotenv/config";
import { chromium } from "playwright";
import { copyFileSync } from "fs";

const SESSION_FILE = "ig-session.json";
const ROOT_SESSION = "../../ig-session.json";

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  locale: "it-IT",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
});
const page = await context.newPage();

await page.goto("https://www.instagram.com/accounts/login/", { waitUntil: "domcontentloaded" });
console.log("Browser aperto — fai login su Instagram. Salvo automaticamente appena rilevo la sessione...");

// Polling ogni 3s per max 3 minuti
let sessionCookie = null;
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const cookies = await context.cookies("https://www.instagram.com");
  sessionCookie = cookies.find(c => c.name === "sessionid");
  if (sessionCookie) break;
  if (i % 5 === 4) console.log(`Attendo login... (${(i + 1) * 3}s)`);
}

if (!sessionCookie) {
  console.error("✗ Timeout — nessun sessionid rilevato dopo 3 minuti.");
  await browser.close();
  process.exit(1);
}

console.log(`✓ sessionid trovato: ${sessionCookie.value.substring(0, 20)}...`);
await context.storageState({ path: SESSION_FILE });
try { copyFileSync(SESSION_FILE, ROOT_SESSION); } catch {}
console.log(`✓ Sessione salvata in ${SESSION_FILE} e ${ROOT_SESSION}`);

await browser.close();
process.exit(0);
