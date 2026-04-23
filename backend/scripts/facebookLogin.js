// Login Facebook manuale via Playwright.
// Apre il browser, aspetta che tu faccia login (polling automatico), poi salva la sessione.
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
console.log("Browser aperto — fai login su Facebook. Salvo automaticamente appena rilevo la sessione...");

// Polling ogni 3s per max 3 minuti
let sessionCookie = null;
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 3000));
  const cookies = await context.cookies("https://www.facebook.com");
  sessionCookie = cookies.find(c => c.name === "c_user");
  if (sessionCookie) break;
  if (i % 5 === 4) console.log(`Attendo login... (${(i + 1) * 3}s)`);
}

if (!sessionCookie) {
  console.error("✗ Timeout — nessun cookie c_user rilevato dopo 3 minuti.");
  await browser.close();
  process.exit(1);
}

console.log(`✓ Facebook user ID: ${sessionCookie.value}`);
await context.storageState({ path: SESSION_FILE });
try { copyFileSync(SESSION_FILE, ROOT_SESSION); } catch {}
console.log(`✓ Sessione salvata in ${SESSION_FILE} e ${ROOT_SESSION}`);

await browser.close();
process.exit(0);
