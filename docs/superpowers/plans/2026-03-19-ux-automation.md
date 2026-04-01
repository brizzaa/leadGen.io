# UX Automation & AI Landing Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere selezione bulk, wizard campagna a 4 step, generazione landing page AI con hosting su surge.sh e invio email automatico in batch.

**Architecture:** Il backend gestisce l'intera pipeline (Gemini → template injection → surge deploy → Nodemailer) in sequenza per ogni business, trasmettendo il progresso via SSE. Il frontend ha un wizard modale a 4 step che si connette all'SSE per aggiornare la progress bar in tempo reale.

**Tech Stack:** Node.js/Express (ESM), better-sqlite3, Gemini 2.5 Pro API (axios), surge npm package, Nodemailer/Gmail, React 19, shadcn/ui, Framer Motion, EventSource API.

**Spec:** `docs/superpowers/specs/2026-03-19-leadgen-ux-automation-design.md`

---

## File Map

**Creati:**
- `backend/src/routes/campaigns.js` — POST /campaigns, GET /campaigns/:id/progress (SSE)
- `backend/src/landingPageBuilder.js` — template selection, content injection, surge deploy
- `backend/src/templates/local-pro.html` — template per servizi locali
- `backend/src/templates/digital-presence.html` — template per sito debole/assente
- `backend/src/templates/social-first.html` — template per business solo-social
- `frontend/src/components/CampaignWizard.jsx` — wizard modale a 4 step

**Modificati:**
- `backend/src/db.js` — aggiunge tabelle campaigns + campaign_results
- `backend/src/routes/businesses.js` — aggiunge POST /businesses/bulk (prima di /:id)
- `backend/src/index.js` — registra campaignsRouter
- `frontend/src/components/BusinessTable.jsx` — aggiunge pulsante "Avvia Campagna" alla barra di selezione esistente

---

## Task 1: Spike — verifica surge.sh programmatico

**Files:**
- Create: `backend/surge-test.mjs` (temporaneo, da cancellare dopo)

- [ ] **Step 1: Installa surge nel backend**

```bash
cd ~/Documents/progetti/findbusiness/backend
npm install surge
```

- [ ] **Step 2: Crea account surge.sh e ottieni il token**

⚠️ **Richiede terminale interattivo** (non funziona in modalità non-interattiva).

```bash
cd ~/Documents/progetti/findbusiness/backend
./node_modules/.bin/surge login
# Inserisci email e password quando richiesto
# Dopo il login esegui:
./node_modules/.bin/surge token
```

Aggiungi al file `backend/.env`:
```
SURGE_TOKEN=your_token_here
```

- [ ] **Step 3: Crea lo script di test `backend/surge-test.mjs`**

```js
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import "dotenv/config";

const dir = join(tmpdir(), "surge-test-" + Date.now());
mkdirSync(dir);
writeFileSync(join(dir, "index.html"), "<h1>LeadGen Test</h1><p>Surge works!</p>");

const domain = `leadgen-test-${Math.random().toString(36).slice(2, 8)}.surge.sh`;
try {
  const out = execSync(
    `./node_modules/.bin/surge ${dir} ${domain} --token ${process.env.SURGE_TOKEN}`,
    { encoding: "utf8", timeout: 30000 }
  );
  console.log("SUCCESS:", domain);
  console.log(out);
} catch (e) {
  console.error("FAILED:", e.message);
} finally {
  rmSync(dir, { recursive: true });
}
```

- [ ] **Step 4: Esegui il test**

```bash
cd ~/Documents/progetti/findbusiness/backend
node surge-test.mjs
```

Risultato atteso: `SUCCESS: leadgen-test-xxxxxx.surge.sh` e URL accessibile nel browser.

- [ ] **Step 5 (solo se surge fallisce per ogni business): debug**

Controlla i log del backend — surge restituisce l'errore dettagliato. I business che falliscono il deploy vengono marcati come `failed` nel wizard. Puoi ritentarli.

- [ ] **Step 6: Cancella lo script di test e committa**

```bash
rm ~/Documents/progetti/findbusiness/backend/surge-test.mjs
cd ~/Documents/progetti/findbusiness
git add backend/package.json backend/package-lock.json
git commit -m "feat: add surge dependency for landing page hosting"
```

---

## Task 2: DB — tabelle campaigns e campaign_results

**Files:**
- Modify: `backend/src/db.js`

- [ ] **Step 1: Aggiungi le tabelle nel blocco `db.exec()` in `db.js`**

Inserisci dopo la definizione di `business_documents` (prima della chiusura del backtick):

```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'running',
  total INTEGER,
  sent INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS campaign_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  business_id INTEGER REFERENCES businesses(id),
  status TEXT DEFAULT 'pending',
  landing_url TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, business_id)
);
```

- [ ] **Step 2: Avvia il backend e verifica le tabelle**

```bash
cd ~/Documents/progetti/findbusiness/backend && npm run dev &
sleep 2
curl http://localhost:3001/api/health
# Deve rispondere: {"status":"ok"}
```

- [ ] **Step 3: Commit**

```bash
cd ~/Documents/progetti/findbusiness
git add backend/src/db.js
git commit -m "feat: add campaigns and campaign_results tables"
```

---

## Task 3: Backend — POST /businesses/bulk

**Files:**
- Modify: `backend/src/routes/businesses.js`

- [ ] **Step 1: Aggiungi l'endpoint PRIMA del blocco `GET /export` (riga ~164)**

```js
// POST /api/businesses/bulk — fetch multiple businesses by ID array
router.post("/bulk", (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids must be a non-empty array" });
  }
  if (ids.length > 50) {
    return res.status(400).json({ error: "Max 50 businesses per request" });
  }
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const businesses = db
    .prepare(`SELECT * FROM businesses WHERE id IN (${placeholders})`)
    .all(...ids);
  res.json(businesses);
});
```

- [ ] **Step 2: Testa**

```bash
# Usa ID reali del tuo DB (puoi vederli con GET /api/businesses)
curl -X POST http://localhost:3001/api/businesses/bulk \
  -H "Content-Type: application/json" \
  -d '{"ids": [1, 2]}'
```

Risultato atteso: array JSON con i business.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/businesses.js
git commit -m "feat: add POST /businesses/bulk endpoint"
```

---

## Task 4: HTML Templates

**Files:**
- Create: `backend/src/templates/local-pro.html`
- Create: `backend/src/templates/digital-presence.html`
- Create: `backend/src/templates/social-first.html`

I template usano questi segnaposto: `{{HEADLINE}}`, `{{SUBHEADLINE}}`, `{{SERVICE_1}}`,
`{{SERVICE_2}}`, `{{SERVICE_3}}`, `{{CTA_TEXT}}`, `{{ACCENT_COLOR}}`, `{{BUSINESS_NAME}}`,
`{{BUSINESS_PHONE}}`, `{{BUSINESS_EMAIL}}`, `{{BUSINESS_ADDRESS}}`.

- [ ] **Step 1: Crea la directory**

```bash
mkdir -p ~/Documents/progetti/findbusiness/backend/src/templates
```

- [ ] **Step 2: Crea `local-pro.html`** — template per professionisti/servizi locali

```html
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{BUSINESS_NAME}}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{--accent:{{ACCENT_COLOR}}}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0a0a0a;color:#f0f0f0;overflow-x:hidden}
  .hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:2rem;background:linear-gradient(135deg,#0a0a0a 0%,#111 60%,color-mix(in srgb,var(--accent) 15%,#0a0a0a) 100%);position:relative;overflow:hidden}
  .hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 70% 30%,color-mix(in srgb,var(--accent) 20%,transparent) 0%,transparent 60%)}
  .badge{display:inline-block;background:color-mix(in srgb,var(--accent) 20%,transparent);border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);color:var(--accent);padding:.4rem 1.2rem;border-radius:2rem;font-size:.85rem;font-weight:600;letter-spacing:.05em;margin-bottom:1.5rem;animation:fadeUp .8s ease both}
  h1{font-size:clamp(2.2rem,6vw,4rem);font-weight:800;line-height:1.1;margin-bottom:1.2rem;animation:fadeUp .8s .1s ease both}
  .sub{font-size:clamp(1rem,2vw,1.3rem);color:#aaa;max-width:600px;line-height:1.7;animation:fadeUp .8s .2s ease both}
  .cta{display:inline-block;margin-top:2.5rem;background:var(--accent);color:#000;padding:.9rem 2.5rem;border-radius:3rem;font-weight:700;font-size:1.1rem;text-decoration:none;transition:transform .2s,box-shadow .2s;animation:fadeUp .8s .3s ease both;box-shadow:0 0 30px color-mix(in srgb,var(--accent) 40%,transparent)}
  .cta:hover{transform:translateY(-2px)}
  .services{padding:5rem 2rem;max-width:1100px;margin:0 auto}
  .services h2{text-align:center;font-size:2rem;margin-bottom:3rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem}
  .card{background:#111;border:1px solid #222;border-radius:1.2rem;padding:2rem;transition:border-color .3s,transform .3s}
  .card:hover{border-color:var(--accent);transform:translateY(-4px)}
  .card-icon{width:3rem;height:3rem;background:color-mix(in srgb,var(--accent) 15%,transparent);border-radius:.8rem;display:flex;align-items:center;justify-content:center;margin-bottom:1.2rem;font-size:1.5rem}
  .card h3{font-size:1.15rem;margin-bottom:.5rem}
  .card p{color:#888;line-height:1.6;font-size:.95rem}
  .contact{background:#111;padding:5rem 2rem;text-align:center}
  .contact h2{font-size:2rem;margin-bottom:2rem}
  .contact-info{display:flex;flex-wrap:wrap;justify-content:center;gap:1.5rem;max-width:700px;margin:0 auto}
  .contact-item{display:flex;align-items:center;gap:.75rem;background:#1a1a1a;border:1px solid #2a2a2a;padding:1rem 1.5rem;border-radius:.8rem;font-size:.95rem}
  .contact-item a{color:var(--accent);text-decoration:none}
  footer{text-align:center;padding:2rem;color:#444;font-size:.8rem}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body>
<section class="hero">
  <div class="badge">Professionisti Locali</div>
  <h1>{{HEADLINE}}</h1>
  <p class="sub">{{SUBHEADLINE}}</p>
  <a href="#contatti" class="cta">{{CTA_TEXT}}</a>
</section>
<section class="services">
  <h2>I nostri servizi</h2>
  <div class="grid">
    <div class="card"><div class="card-icon">⚡</div><h3>{{SERVICE_1}}</h3><p>Intervento rapido e professionale, disponibili 7 giorni su 7.</p></div>
    <div class="card"><div class="card-icon">🛡️</div><h3>{{SERVICE_2}}</h3><p>Materiali certificati e garanzia sul lavoro svolto.</p></div>
    <div class="card"><div class="card-icon">💬</div><h3>{{SERVICE_3}}</h3><p>Preventivo gratuito e trasparente, senza sorprese.</p></div>
  </div>
</section>
<section class="contact" id="contatti">
  <h2>Contattaci oggi</h2>
  <div class="contact-info">
    <div class="contact-item">📍 {{BUSINESS_ADDRESS}}</div>
    <div class="contact-item">📞 <a href="tel:{{BUSINESS_PHONE}}">{{BUSINESS_PHONE}}</a></div>
    <div class="contact-item">✉️ <a href="mailto:{{BUSINESS_EMAIL}}">{{BUSINESS_EMAIL}}</a></div>
  </div>
</section>
<footer>© 2025 {{BUSINESS_NAME}}</footer>
</body>
</html>
```

- [ ] **Step 3: Crea `digital-presence.html`** — per business con sito debole/assente

```html
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{BUSINESS_NAME}} — Nuova Presenza Online</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{--accent:{{ACCENT_COLOR}}}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#030712;color:#f0f0f0;overflow-x:hidden}
  .hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:2rem;position:relative;overflow:hidden;background:#030712}
  .grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:60px 60px}
  .glow{position:absolute;top:20%;left:50%;transform:translateX(-50%);width:600px;height:300px;background:radial-gradient(ellipse,color-mix(in srgb,var(--accent) 25%,transparent) 0%,transparent 70%);pointer-events:none}
  .content{position:relative;z-index:1}
  .tag{background:color-mix(in srgb,var(--accent) 15%,transparent);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);color:var(--accent);display:inline-block;padding:.35rem 1rem;border-radius:2rem;font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:1.5rem;animation:pop .6s ease both}
  h1{font-size:clamp(2rem,5.5vw,3.8rem);font-weight:900;line-height:1.1;margin-bottom:1.2rem;animation:pop .6s .1s ease both}
  .sub{font-size:clamp(.95rem,1.8vw,1.2rem);color:#9ca3af;max-width:560px;line-height:1.8;animation:pop .6s .2s ease both}
  .cta{margin-top:2.5rem;display:inline-flex;align-items:center;gap:.5rem;background:var(--accent);color:#000;padding:.85rem 2.2rem;border-radius:3rem;font-weight:700;font-size:1rem;text-decoration:none;animation:pop .6s .3s ease both;transition:all .2s}
  .cta:hover{transform:scale(1.05)}
  .missing{padding:5rem 2rem;max-width:1100px;margin:0 auto}
  .missing h2{text-align:center;font-size:1.8rem;margin-bottom:3rem}
  .miss-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.2rem}
  .miss-item{background:#0f172a;border:1px solid #1e293b;border-radius:1rem;padding:1.5rem;display:flex;gap:1rem;transition:border-color .3s}
  .miss-item:hover{border-color:var(--accent)}
  .miss-num{min-width:2.2rem;height:2.2rem;background:color-mix(in srgb,var(--accent) 20%,transparent);color:var(--accent);border-radius:.5rem;display:flex;align-items:center;justify-content:center;font-weight:800}
  .miss-item h3{font-size:1rem;margin-bottom:.3rem}
  .miss-item p{color:#6b7280;font-size:.88rem;line-height:1.5}
  .cta-bottom{background:#0f172a;padding:5rem 2rem;text-align:center}
  .cta-bottom h2{font-size:2rem;margin-bottom:2rem}
  .cta-row{display:flex;flex-wrap:wrap;gap:1rem;justify-content:center}
  .btn-main{background:var(--accent);color:#000;padding:.9rem 2.5rem;border-radius:3rem;font-weight:700;text-decoration:none}
  .btn-sec{border:1px solid var(--accent);color:var(--accent);padding:.9rem 2.5rem;border-radius:3rem;font-weight:700;text-decoration:none}
  footer{text-align:center;padding:2rem;color:#374151;font-size:.8rem}
  @keyframes pop{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:none}}
</style>
</head>
<body>
<section class="hero">
  <div class="grid-bg"></div>
  <div class="glow"></div>
  <div class="content">
    <span class="tag">Nuova Presenza Digitale</span>
    <h1>{{HEADLINE}}</h1>
    <p class="sub">{{SUBHEADLINE}}</p>
    <a href="#azione" class="cta">{{CTA_TEXT}} →</a>
  </div>
</section>
<section class="missing">
  <h2>Cosa stai perdendo ogni giorno</h2>
  <div class="miss-grid">
    <div class="miss-item"><div class="miss-num">01</div><div><h3>{{SERVICE_1}}</h3><p>I clienti cercano online prima di chiamare. Se non ci sei, trovano qualcun altro.</p></div></div>
    <div class="miss-item"><div class="miss-num">02</div><div><h3>{{SERVICE_2}}</h3><p>Una presenza curata trasmette affidabilità ancora prima del primo contatto.</p></div></div>
    <div class="miss-item"><div class="miss-num">03</div><div><h3>{{SERVICE_3}}</h3><p>Un sito veloce converte i visitatori in clienti, automaticamente.</p></div></div>
  </div>
</section>
<section class="cta-bottom" id="azione">
  <h2>Pronto a crescere online?</h2>
  <div class="cta-row">
    <a href="tel:{{BUSINESS_PHONE}}" class="btn-main">Chiamaci</a>
    <a href="mailto:{{BUSINESS_EMAIL}}" class="btn-sec">Scrivici</a>
  </div>
</section>
<footer>© 2025 {{BUSINESS_NAME}}</footer>
</body>
</html>
```

- [ ] **Step 4: Crea `social-first.html`** — per business solo-social

```html
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{BUSINESS_NAME}}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{--accent:{{ACCENT_COLOR}}}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#0d0d0d;color:#f0f0f0;overflow-x:hidden}
  .hero{min-height:100vh;display:grid;place-items:center;text-align:center;padding:2rem;background:conic-gradient(from 180deg at 50% 50%,#0d0d0d 0deg,color-mix(in srgb,var(--accent) 8%,#0d0d0d) 120deg,#0d0d0d 240deg,#0d0d0d 360deg);position:relative}
  .blob{position:absolute;width:500px;height:500px;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 20%,transparent),transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%);animation:pulse 4s ease-in-out infinite;pointer-events:none}
  .content{position:relative;z-index:1}
  .pill{display:inline-flex;align-items:center;gap:.5rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);padding:.4rem 1rem;border-radius:2rem;font-size:.82rem;margin-bottom:2rem}
  .pill span{color:var(--accent)}
  h1{font-size:clamp(2.2rem,6vw,4.2rem);font-weight:900;line-height:1.1;max-width:750px;margin-bottom:1.2rem}
  .sub{font-size:1.1rem;color:#9ca3af;max-width:520px;line-height:1.7}
  .actions{margin-top:2.5rem;display:flex;flex-wrap:wrap;gap:1rem;justify-content:center}
  .btn-p{background:var(--accent);color:#000;padding:.85rem 2.2rem;border-radius:3rem;font-weight:700;text-decoration:none;transition:all .25s}
  .btn-p:hover{transform:translateY(-2px)}
  .btn-s{border:1px solid rgba(255,255,255,.15);color:#e5e7eb;padding:.85rem 2.2rem;border-radius:3rem;font-weight:600;text-decoration:none}
  .why{padding:5rem 2rem;max-width:1000px;margin:0 auto}
  .why h2{text-align:center;font-size:1.9rem;margin-bottom:3rem}
  .why-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.2rem}
  .why-card{background:#141414;border:1px solid #1f1f1f;border-radius:1.2rem;padding:1.8rem;transition:all .3s}
  .why-card:hover{border-color:var(--accent)}
  .icon{font-size:2rem;margin-bottom:1rem}
  .why-card h3{font-size:1.05rem;margin-bottom:.5rem}
  .why-card p{color:#6b7280;font-size:.9rem;line-height:1.6}
  .social-cta{padding:4rem 2rem;text-align:center;background:#111}
  .social-cta h2{font-size:1.7rem;margin-bottom:2rem}
  .contact-links{display:flex;flex-wrap:wrap;gap:1rem;justify-content:center}
  .c-link{display:flex;align-items:center;gap:.6rem;padding:.8rem 1.5rem;border-radius:.8rem;text-decoration:none;font-weight:600;border:1px solid #2a2a2a;color:#e5e7eb;transition:all .2s}
  .c-link:hover{border-color:var(--accent);color:var(--accent)}
  footer{text-align:center;padding:2rem;color:#333;font-size:.8rem}
  @keyframes pulse{0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:.8;transform:translate(-50%,-50%) scale(1.1)}}
</style>
</head>
<body>
<section class="hero">
  <div class="blob"></div>
  <div class="content">
    <div class="pill">Social → <span>Sito Web</span></div>
    <h1>{{HEADLINE}}</h1>
    <p class="sub">{{SUBHEADLINE}}</p>
    <div class="actions">
      <a href="#contatti" class="btn-p">{{CTA_TEXT}}</a>
      <a href="tel:{{BUSINESS_PHONE}}" class="btn-s">Chiamaci</a>
    </div>
  </div>
</section>
<section class="why">
  <h2>Perché un sito, non solo i social</h2>
  <div class="why-grid">
    <div class="why-card"><div class="icon">🔍</div><h3>{{SERVICE_1}}</h3><p>Google indicizza i siti, non i profili social.</p></div>
    <div class="why-card"><div class="icon">🏆</div><h3>{{SERVICE_2}}</h3><p>Un sito professionale ti distingue dalla concorrenza.</p></div>
    <div class="why-card"><div class="icon">⚡</div><h3>{{SERVICE_3}}</h3><p>Nessun algoritmo. Il tuo sito è sempre tuo.</p></div>
  </div>
</section>
<section class="social-cta" id="contatti">
  <h2>Parliamoci</h2>
  <div class="contact-links">
    <a href="tel:{{BUSINESS_PHONE}}" class="c-link">📞 {{BUSINESS_PHONE}}</a>
    <a href="mailto:{{BUSINESS_EMAIL}}" class="c-link">✉️ {{BUSINESS_EMAIL}}</a>
  </div>
</section>
<footer>© 2025 {{BUSINESS_NAME}}</footer>
</body>
</html>
```

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/progetti/findbusiness
git add backend/src/templates/
git commit -m "feat: add 3 landing page HTML templates"
```

---

## Task 5: landingPageBuilder.js

**Files:**
- Create: `backend/src/landingPageBuilder.js`

Questo modulo esporta 3 funzioni:
- `determineTemplate(business)` — restituisce `"local-pro" | "digital-presence" | "social-first"`
- `buildLandingPage(content, templateName, business)` — inietta il JSON nel template HTML
- `deployPage(html, slug)` — fa il deploy su surge.sh (fallback: Netlify)

- [ ] **Step 1: Crea `backend/src/landingPageBuilder.js`**

```js
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
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

    // Deploy su surge.sh
    try {
      execSync(
        `${join(__dirname, "../../node_modules/.bin/surge")} ${dir} ${domain} --token ${process.env.SURGE_TOKEN}`,
        { encoding: "utf8", timeout: 45000 }
      );
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
```


- [ ] **Step 2: Testa il builder manualmente**

```bash
cd ~/Documents/progetti/findbusiness/backend
node -e "
import('./src/landingPageBuilder.js').then(({ determineTemplate, buildLandingPage, makeSlug }) => {
  const biz = { name: 'Idraulico Roma', website: null, facebook_url: null, instagram_url: null, phone: '06123456', email: 'info@test.it', address: 'Via Roma 1' };
  const tmpl = determineTemplate(biz);
  console.log('Template:', tmpl); // deve essere digital-presence

  const content = {
    headline: 'Impianti idraulici professionali a Roma',
    subheadline: 'Interventi rapidi, prezzi chiari.',
    services: ['Riparazioni urgenti', 'Installazioni', 'Manutenzione'],
    cta_text: 'Richiedi preventivo',
    accent_color: '#ea580c'
  };
  const html = buildLandingPage(content, tmpl, biz);
  console.log('HTML length:', html.length, '— OK se > 2000');
  console.log('Slug:', makeSlug(biz.name));
});
"
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/landingPageBuilder.js
git commit -m "feat: add landingPageBuilder module with template injection and surge deploy"
```

---

## Task 6: campaigns.js route

**Files:**
- Create: `backend/src/routes/campaigns.js`

Questo file gestisce:
- `POST /api/campaigns` — crea il campaign, avvia la pipeline asincrona, risponde con `{campaignId}`
- `GET /api/campaigns/:id/progress` — SSE endpoint, trasmette eventi `progress` e `complete`

La pipeline per ogni business (in sequenza):
1. Controlla email valida
2. Chiama Gemini per generare il content JSON
3. `buildLandingPage()` → HTML
4. `deployPage()` → URL
5. Valida `{{LANDING_URL}}` sostituito (controllo pre-invio)
6. Sostituisce `{{LANDING_URL}}` nel `email_body`
7. Invia email via Nodemailer
8. Aggiorna DB + emette SSE

- [ ] **Step 1: Crea `backend/src/routes/campaigns.js`**

```js
import express from "express";
import axios from "axios";
import nodemailer from "nodemailer";
import { getDb } from "../db.js";
import {
  determineTemplate,
  buildLandingPage,
  deployPage,
  makeSlug,
} from "../landingPageBuilder.js";

const router = express.Router();

// Mappa campaignId → array di SSE response objects (può esserci una sola connessione)
const sseClients = new Map();

function sendSSE(campaignId, event, data) {
  const clients = sseClients.get(campaignId) || [];
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

// POST /api/campaigns
router.post("/", async (req, res) => {
  const { businessIds, aiStrategy = "auto", templateName = "auto" } = req.body;

  if (!businessIds || !Array.isArray(businessIds) || businessIds.length === 0) {
    return res.status(400).json({ error: "businessIds must be a non-empty array" });
  }
  if (businessIds.length > 50) {
    return res.status(400).json({ error: "Max 50 businesses per campaign" });
  }

  const db = getDb();

  // Crea la riga campaign
  const result = db.prepare(
    "INSERT INTO campaigns (total, status) VALUES (?, 'running')"
  ).run(businessIds.length);
  const campaignId = result.lastInsertRowid;

  // Inserisce tutti i risultati come pending
  const insertResult = db.prepare(
    "INSERT OR IGNORE INTO campaign_results (campaign_id, business_id, status) VALUES (?, ?, 'pending')"
  );
  const insertBatch = db.transaction(() => {
    for (const id of businessIds) insertResult.run(campaignId, id);
  });
  insertBatch();

  // Avvia la pipeline in background (non await)
  runCampaign(campaignId, businessIds, aiStrategy, templateName).catch((e) =>
    console.error("[campaign] Fatal error:", e)
  );

  res.json({ campaignId });
});

// GET /api/campaigns/:id/progress (SSE)
router.get("/:id/progress", (req, res) => {
  const campaignId = parseInt(req.params.id, 10);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  if (!sseClients.has(campaignId)) sseClients.set(campaignId, []);
  sseClients.get(campaignId).push(res);

  req.on("close", () => {
    const clients = sseClients.get(campaignId) || [];
    sseClients.set(campaignId, clients.filter((c) => c !== res));
  });

  // Invia immediatamente lo stato corrente (per riconnessioni)
  const db = getDb();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
  if (campaign && campaign.status !== "running") {
    res.write(`event: complete\ndata: ${JSON.stringify({ total: campaign.total, sent: campaign.sent, failed: campaign.failed })}\n\n`);
    res.end();
  }
});

// Pipeline asincrona
async function runCampaign(campaignId, businessIds, aiStrategy, templateName) {
  const db = getDb();
  let sent = 0;
  let failed = 0;

  for (const businessId of businessIds) {
    let error = null;
    let landingUrl = null;

    try {
      const biz = db.prepare("SELECT * FROM businesses WHERE id = ?").get(businessId);
      if (!biz) throw new Error("Business non trovato");

      // Step 1: controlla email
      if (!biz.email || biz.email.trim() === "") {
        throw new Error("Nessun indirizzo email");
      }

      // Step 2: determina template
      const template = templateName === "auto"
        ? determineTemplate(biz)
        : templateName;

      // Step 3: genera content JSON da Gemini
      const content = await generateLandingContent(biz, template, aiStrategy);

      // Step 4: costruisce HTML
      const html = buildLandingPage(content, template, biz);

      // Step 5: deploy
      landingUrl = await deployPage(html, makeSlug(biz.name));

      // Step 6: valida placeholder nell'email_body
      if (!content.email_body || !content.email_body.includes("{{LANDING_URL}}")) {
        throw new Error("Missing LANDING_URL placeholder nell'email generata");
      }

      // Step 7: sostituisce URL
      const emailBody = content.email_body.replace(/\{\{LANDING_URL\}\}/g, landingUrl);

      // Step 8: invia email
      await sendEmail(biz.email, content.email_subject, emailBody);

      // Step 9: aggiorna DB business
      db.prepare("UPDATE businesses SET status = 'Inviata Mail' WHERE id = ?").run(businessId);

      sent++;
      db.prepare("UPDATE campaign_results SET status = 'sent', landing_url = ? WHERE campaign_id = ? AND business_id = ?")
        .run(landingUrl, campaignId, businessId);

      sendSSE(campaignId, "progress", {
        businessId,
        name: biz.name,
        status: "sent",
        landingUrl,
        error: null,
      });

    } catch (e) {
      failed++;
      error = e.message;
      console.error(`[campaign ${campaignId}] Business ${businessId} failed:`, e.message);

      db.prepare("UPDATE campaign_results SET status = 'failed', error = ? WHERE campaign_id = ? AND business_id = ?")
        .run(error, campaignId, businessId);

      sendSSE(campaignId, "progress", {
        businessId,
        name: null,
        status: "failed",
        landingUrl: null,
        error,
      });
    }
  }

  // Aggiorna stato finale campaign
  const finalStatus = failed === 0 ? "completed" : "partial";
  db.prepare("UPDATE campaigns SET status = ?, sent = ?, failed = ? WHERE id = ?")
    .run(finalStatus, sent, failed, campaignId);

  sendSSE(campaignId, "complete", {
    total: businessIds.length,
    sent,
    failed,
  });

  // Chiude le connessioni SSE
  const clients = sseClients.get(campaignId) || [];
  for (const c of clients) {
    try { c.end(); } catch {}
  }
  sseClients.delete(campaignId);
}

async function generateLandingContent(biz, templateName, aiStrategy) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY non configurata");

  const accentColors = {
    // categorie → colore
    ristorante: "#f97316", pizzeria: "#f97316", bar: "#f97316", food: "#f97316",
    parrucchiere: "#a855f7", estetica: "#a855f7", benessere: "#a855f7",
    avvocato: "#2563eb", commercialista: "#2563eb", consulente: "#2563eb",
    idraulico: "#ea580c", elettricista: "#eab308", falegname: "#92400e",
  };
  const cat = (biz.category || "").toLowerCase();
  let accentColor = "#00d4aa";
  for (const [key, color] of Object.entries(accentColors)) {
    if (cat.includes(key)) { accentColor = color; break; }
  }

  const prompt = `Sei un copywriter esperto di marketing digitale italiano. Genera un oggetto JSON per una landing page personalizzata per questa azienda:

Nome: ${biz.name}
Settore: ${biz.category || "N/A"}
Area: ${biz.area || "N/A"}
Sito web attuale: ${biz.website || "nessuno"}
Social: ${[biz.facebook_url, biz.instagram_url].filter(Boolean).join(", ") || "nessuno"}

Template scelto: ${templateName}
Strategia AI: ${aiStrategy}

RISPONDI SOLO CON JSON VALIDO, nessun testo prima o dopo. Schema ESATTO da rispettare:
{
  "headline": "max 80 caratteri, convincente e personalizzato per ${biz.name}",
  "subheadline": "max 140 caratteri, spiega il vantaggio principale",
  "services": ["servizio 1 specifico", "servizio 2 specifico", "servizio 3 specifico"],
  "cta_text": "max 40 caratteri, invito all'azione",
  "accent_color": "${accentColor}",
  "tone": "friendly",
  "email_subject": "oggetto email max 80 caratteri",
  "email_body": "corpo email HTML in italiano (usa <p> per i paragrafi), includi il link alla landing page con ESATTAMENTE questo testo: {{LANDING_URL}} — il sistema lo sostituirà automaticamente. Massimo 200 parole. Includi questo footer legale alla fine:\\n<hr><p style='font-size:11px;color:#999'>Informativa Privacy: Ti contatto perché ho trovato i tuoi riferimenti su Google Maps (Legittimo Interesse, Art. 6 GDPR). Rispondi CANCELLAMI per la rimozione immediata.</p>"
}`;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
    },
    { headers: { "Content-Type": "application/json" }, timeout: 60000 }
  );

  const text = response.data.candidates[0].content.parts[0].text;
  const content = JSON.parse(text);
  return content;
}

async function sendEmail(toEmail, subject, htmlBody) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Credenziali email non configurate");
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: subject || "Proposta di collaborazione",
    html: htmlBody,
  });
}

export default router;
```

- [ ] **Step 2: Testa l'endpoint POST /campaigns con dati reali**

```bash
# Usa business IDs reali con email impostata
curl -X POST http://localhost:3001/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{"businessIds": [1], "aiStrategy": "auto", "templateName": "auto"}'
# Deve rispondere: {"campaignId": 1}
```

- [ ] **Step 3: Testa SSE in un secondo terminale**

```bash
curl -N http://localhost:3001/api/campaigns/1/progress
# Deve mostrare eventi progress e infine complete
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/campaigns.js
git commit -m "feat: add campaigns route with SSE progress and AI pipeline"
```

---

## Task 7: Registra il campaign route in index.js

**Files:**
- Modify: `backend/src/index.js`

- [ ] **Step 1: Aggiungi import e use in `index.js`**

Aggiungi dopo l'import di `documentsRouter`:
```js
import campaignsRouter from "./routes/campaigns.js";
```

Aggiungi dopo `app.use("/api/documents", documentsRouter)`:
```js
app.use("/api/campaigns", campaignsRouter);
```

- [ ] **Step 2: Riavvia il backend e verifica**

```bash
curl http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{"businessIds": []}'
# Deve rispondere 400 con errore
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/index.js
git commit -m "feat: register campaigns route"
```

---

## Task 8: CampaignWizard.jsx — frontend

**Files:**
- Create: `frontend/src/components/CampaignWizard.jsx`

Wizard modale a 4 step con Framer Motion. Usa componenti shadcn/ui esistenti:
`Dialog`, `Button`, `Badge`, `Progress` (da `@radix-ui/react-progress`).

- [ ] **Step 1: Crea `frontend/src/components/CampaignWizard.jsx`**

```jsx
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  X, ChevronRight, ChevronLeft, Rocket, Zap, Globe, Send,
  CheckCircle, XCircle, Loader2
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

const AI_STRATEGIES = [
  { value: "auto", label: "Auto", desc: "Sceglie la strategia migliore per ogni business" },
  { value: "social_only", label: "Social Only", desc: "Per chi ha solo Facebook/Instagram" },
  { value: "weak_website", label: "Sito Debole", desc: "Per chi ha un sito datato" },
  { value: "ai_strategy", label: "AI Strategy", desc: "Analisi approfondita personalizzata" },
];

const TEMPLATES = [
  { value: "auto", label: "Auto", desc: "Scelto in base ai dati del business", icon: "🤖" },
  { value: "local-pro", label: "Local Pro", desc: "Servizi locali e artigiani", icon: "🔧" },
  { value: "digital-presence", label: "Digital Presence", desc: "Business senza sito efficace", icon: "🌐" },
  { value: "social-first", label: "Social First", desc: "Business solo-social", icon: "📱" },
];

const STEPS = ["Review", "Strategia AI", "Landing Page", "Invio"];

export default function CampaignWizard({ open, onClose, selectedBusinesses, onCampaignComplete }) {
  const [step, setStep] = useState(0);
  const [businesses, setBusinesses] = useState(selectedBusinesses || []);
  const [aiStrategy, setAiStrategy] = useState("auto");
  const [templateName, setTemplateName] = useState("auto");
  const [campaignId, setCampaignId] = useState(null);
  const [progress, setProgress] = useState([]); // [{businessId, name, status, landingUrl, error}]
  const [summary, setSummary] = useState(null); // {total, sent, failed}
  const [isRunning, setIsRunning] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (open) {
      setBusinesses(selectedBusinesses || []);
      setStep(0);
      setCampaignId(null);
      setProgress([]);
      setSummary(null);
      setIsRunning(false);
      setAiStrategy("auto");
      setTemplateName("auto");
    }
  }, [open, selectedBusinesses]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const removeBusiness = (id) =>
    setBusinesses((prev) => prev.filter((b) => b.id !== id));

  const startCampaign = async () => {
    setIsRunning(true);
    setProgress([]);
    setSummary(null);

    try {
      const res = await fetch(`${API_URL}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessIds: businesses.map((b) => b.id),
          aiStrategy,
          templateName,
        }),
      });
      const { campaignId: id } = await res.json();
      setCampaignId(id);

      // Connetti SSE
      const es = new EventSource(`${API_URL}/api/campaigns/${id}/progress`);
      eventSourceRef.current = es;

      es.addEventListener("progress", (e) => {
        const data = JSON.parse(e.data);
        setProgress((prev) => [...prev, data]);
      });

      es.addEventListener("complete", (e) => {
        const data = JSON.parse(e.data);
        setSummary(data);
        setIsRunning(false);
        es.close();
        onCampaignComplete?.();
      });

      es.onerror = () => {
        setIsRunning(false);
        es.close();
      };
    } catch (err) {
      console.error("[campaign]", err);
      setIsRunning(false);
    }
  };

  const retryFailed = async () => {
    const failedIds = progress
      .filter((p) => p.status === "failed")
      .map((p) => p.businessId);
    if (failedIds.length === 0) return;

    const failedBusinesses = businesses.filter((b) => failedIds.includes(b.id));
    setProgress([]);
    setSummary(null);

    const prevBusinesses = businesses;
    setBusinesses(failedBusinesses);

    // Riavvia con i soli business falliti
    setIsRunning(true);
    try {
      const res = await fetch(`${API_URL}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessIds: failedIds,
          aiStrategy,
          templateName,
        }),
      });
      const { campaignId: id } = await res.json();
      setCampaignId(id);

      const es = new EventSource(`${API_URL}/api/campaigns/${id}/progress`);
      eventSourceRef.current = es;

      es.addEventListener("progress", (e) => {
        setProgress((prev) => [...prev, JSON.parse(e.data)]);
      });
      es.addEventListener("complete", (e) => {
        setSummary(JSON.parse(e.data));
        setIsRunning(false);
        es.close();
        onCampaignComplete?.();
      });
      es.onerror = () => { setIsRunning(false); es.close(); };
    } catch {
      setIsRunning(false);
      setBusinesses(prevBusinesses);
    }
  };

  const canGoNext = () => {
    if (step === 0) return businesses.length > 0;
    return true;
  };

  const slideVariants = {
    enter: { opacity: 0, x: 30 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-[#00d4aa]" />
            Avvia Campagna
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i < step ? "bg-[#00d4aa] text-black" : i === step ? "bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]" : "bg-muted text-muted-foreground"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-[#00d4aa]" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            {/* Step 0: Review */}
            {step === 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  {businesses.length} business selezionati. Rimuovi quelli da escludere.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {businesses.map((b) => (
                    <div key={b.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium">{b.name}</span>
                        {b.area && <span className="text-muted-foreground ml-2 text-xs">{b.area}</span>}
                        {!b.email && <Badge variant="outline" className="ml-2 text-xs text-yellow-500 border-yellow-500/30">Senza email</Badge>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeBusiness(b.id)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                {businesses.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Nessun business rimasto. Torna indietro per aggiungerne.</p>
                )}
              </div>
            )}

            {/* Step 1: Strategia AI */}
            {step === 1 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">Scegli la strategia per generare le email.</p>
                {AI_STRATEGIES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setAiStrategy(s.value)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${aiStrategy === s.value ? "border-[#00d4aa] bg-[#00d4aa]/10" : "border-border hover:border-[#00d4aa]/40"}`}
                  >
                    <div className="font-medium text-sm">{s.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Landing Page */}
            {step === 2 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">Scegli il template della landing page.</p>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTemplateName(t.value)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${templateName === t.value ? "border-[#00d4aa] bg-[#00d4aa]/10" : "border-border hover:border-[#00d4aa]/40"}`}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <div className="font-medium text-sm">{t.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 3: Invio */}
            {step === 3 && (
              <div>
                {!isRunning && !summary && (
                  <div className="text-center py-6">
                    <Send className="w-12 h-12 text-[#00d4aa] mx-auto mb-4" />
                    <p className="text-lg font-semibold mb-1">Pronto per l'invio</p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Verranno elaborate <strong>{businesses.length} aziende</strong> in sequenza.
                    </p>
                    <Button onClick={startCampaign} className="bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90 font-bold">
                      <Rocket className="w-4 h-4 mr-2" />
                      Avvia ora
                    </Button>
                  </div>
                )}

                {(isRunning || progress.length > 0) && !summary && (
                  <div>
                    <Progress
                      value={(progress.length / businesses.length) * 100}
                      className="mb-4 h-2"
                    />
                    <p className="text-xs text-muted-foreground mb-3">
                      {progress.length} / {businesses.length} elaborate
                    </p>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {progress.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                          {p.status === "sent"
                            ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                          <span className="flex-1 truncate">{p.name || `ID ${p.businessId}`}</span>
                          {p.landingUrl && (
                            <a href={p.landingUrl} target="_blank" rel="noopener noreferrer" className="text-[#00d4aa] text-xs hover:underline">
                              <Globe className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {p.error && <span className="text-red-400 text-xs truncate max-w-[120px]">{p.error}</span>}
                        </div>
                      ))}
                      {isRunning && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Elaborazione in corso...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {summary && (
                  <div className="text-center py-4">
                    <div className={`text-4xl font-black mb-2 ${summary.failed === 0 ? "text-emerald-500" : "text-yellow-500"}`}>
                      {summary.sent}/{summary.total}
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">
                      Email inviate con successo
                      {summary.failed > 0 && ` · ${summary.failed} fallite`}
                    </p>
                    {summary.failed > 0 && (
                      <Button variant="outline" size="sm" onClick={retryFailed} className="mr-2">
                        Riprova i falliti ({summary.failed})
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={onClose}>
                      Chiudi
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        {!(step === 3 && (isRunning || summary)) && (
          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => step > 0 ? setStep(step - 1) : onClose()}
              disabled={isRunning}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {step === 0 ? "Annulla" : "Indietro"}
            </Button>
            {step < 3 && (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canGoNext()}
                className="bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90 font-semibold"
              >
                Avanti
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verifica che `Progress` sia disponibile**

```bash
# Controlla se esiste già
ls ~/Documents/progetti/findbusiness/frontend/src/components/ui/progress.jsx
```

**Se esiste:** non fare nulla, l'import in CampaignWizard.jsx funzionerà già.

**Se NON esiste:**
```bash
cd ~/Documents/progetti/findbusiness/frontend
npm install @radix-ui/react-progress
```
Poi crea `frontend/src/components/ui/progress.jsx`:
```jsx
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export function Progress({ className, value, ...props }) {
  return (
    <ProgressPrimitive.Root
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-[#00d4aa] transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CampaignWizard.jsx frontend/src/components/ui/progress.jsx
git commit -m "feat: add CampaignWizard 4-step modal with SSE progress"
```

---

## Task 9: BusinessTable — pulsante "Avvia Campagna"

**Files:**
- Modify: `frontend/src/components/BusinessTable.jsx`

`selectedIds` esiste già nel componente (usato per batch delete/scan). Aggiungere:
1. Pulsante "Avvia Campagna" nella barra di selezione esistente
2. Stato `showCampaignWizard` + rendering del wizard

- [ ] **Step 1: Aggiungi import nel file `BusinessTable.jsx`**

Aggiungi all'inizio, dopo gli altri import:
```jsx
import CampaignWizard from "./CampaignWizard";
```

Aggiungi `Rocket` all'import di lucide-react (se non c'è già).

- [ ] **Step 2: Aggiungi stato `showCampaignWizard`**

Nei `useState` del componente (riga ~159), aggiungi:
```jsx
const [showCampaignWizard, setShowCampaignWizard] = useState(false);
```

- [ ] **Step 3: Trova la barra contestuale di selezione**

Cerca nel JSX la barra che mostra i pulsanti "Batch Social Scan" e "Elimina selezionati" (contiene `selectedIds.length > 0`). Aggiungi il pulsante "Avvia Campagna" in quella stessa barra:

```jsx
<Button
  size="sm"
  className="bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90 font-semibold"
  onClick={() => setShowCampaignWizard(true)}
>
  <Rocket className="w-3.5 h-3.5 mr-1.5" />
  Avvia Campagna ({selectedIds.length})
</Button>
```

- [ ] **Step 4: Verifica che il parent passi la lista completa**

In `Dashboard.jsx`, il componente `BusinessTable` riceve una prop `businesses`. Verifica che sia la lista completa (non solo la pagina corrente) — il wizard usa `selectedIds` che possono essere su pagine diverse. Se il parent passa solo i business visualizzati, le selezioni fuori pagina mancheranno di nome/email nel wizard. La lista completa è già filtrata lato server e passata come prop, quindi normalmente va bene.

- [ ] **Step 5: Aggiungi rendering del wizard nel return del componente**

Prima del tag di chiusura del componente, aggiungi:
```jsx
<CampaignWizard
  open={showCampaignWizard}
  onClose={() => setShowCampaignWizard(false)}
  selectedBusinesses={businesses.filter((b) => selectedIds.includes(b.id))}
  onCampaignComplete={() => {
    setShowCampaignWizard(false);
    setSelectedIds([]);
    onRefresh?.();
  }}
/>
```

- [ ] **Step 6: Verifica visiva nel browser**

```bash
cd ~/Documents/progetti/findbusiness
npm start
# Apri http://localhost:5173
# Seleziona alcuni business → deve apparire la barra con "Avvia Campagna"
# Clicca → il wizard si apre e i 4 step funzionano
```

- [ ] **Step 7: Commit finale**

```bash
cd ~/Documents/progetti/findbusiness
git add frontend/src/components/BusinessTable.jsx
git commit -m "feat: add Avvia Campagna button to BusinessTable selection bar"
```

---

## Verifica End-to-End

- [ ] Seleziona 2-3 business con email → clicca "Avvia Campagna"
- [ ] Wizard Step 1: verifica lista, rimuovi uno
- [ ] Step 2: seleziona "Auto"
- [ ] Step 3: seleziona "Auto"
- [ ] Step 4: clicca "Avvia ora" → vedi progress bar aggiornata in tempo reale
- [ ] Al termine: summary mostra sent/failed
- [ ] Le email sono arrivate nella casella del destinatario
- [ ] I business nel DB hanno status "Inviata Mail"
- [ ] Le landing page sono accessibili agli URL surge.sh restituiti

