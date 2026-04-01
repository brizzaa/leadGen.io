# LeadGen.io — UX Automation & AI Landing Pages

**Date:** 2026-03-19
**Status:** Approved (surge.sh tested at implementation start; fallback to Netlify if needed)

---

## Overview

Redesign the outreach flow to eliminate manual one-by-one processing. Users can select multiple businesses via checkboxes or filters, launch a campaign wizard, and send personalized AI-generated emails with hosted landing pages — all in one flow.

---

## 1. Bulk Selection & Campaign Flow

### BusinessTable Changes
- Add per-row checkboxes
- "Select all" and "Select filtered" (applies current active filters) controls
- Contextual bottom bar appears on selection: shows count + "Avvia Campagna" button
- Max batch size: 50 businesses per campaign (UI enforces with a warning)

### Campaign Wizard (modal, 4 steps)
1. **Review** — list of selected businesses, remove individuals if needed
2. **Strategia AI** — choose one strategy for all, or "Auto" (per-business auto-selection)
3. **Landing Page** — choose template (or "Auto"), preview a generated example
4. **Invio** — sequential processing with SSE-driven progress bar. After completion: summary + retry button for failed items

---

## 2. Landing Page Templates & AI Generation

### Template Auto-Selection Logic
Evaluated in order:
1. **Social First** → `(facebook_url OR instagram_url) AND (website IS NULL OR website = '')`
2. **Digital Presence** → `website IS NOT NULL` but no meaningful content (heuristic: URL doesn't respond with 200, or is a Facebook/linktree URL)
3. **Local Pro** → all other cases (fallback)

No new DB fields required — all conditions use existing columns.

### Templates (3 pre-built, standalone HTML output)
| Template | Target | Focus |
|---|---|---|
| **Local Pro** | Tradespeople, local services | Contacts, services, coverage area |
| **Digital Presence** | Weak/no website | What they're missing online + urgent CTA |
| **Social First** | Social-only businesses | Website value vs Instagram/Facebook only |

Each template includes: animated hero, services section, social proof, contact CTA.

### Gemini Content Schema
```json
{
  "headline": "string (max 80 chars)",
  "subheadline": "string (max 140 chars)",
  "services": ["string", "string", "string"],
  "cta_text": "string (max 40 chars)",
  "accent_color": "#hexcode",
  "tone": "friendly | professional | urgent",
  "email_subject": "string (max 80 chars)",
  "email_body": "string (HTML, must contain {{LANDING_URL}} placeholder)"
}
```

Accent color defaults by category: blue (#2563eb) professionals, green (#16a34a) wellness/food, orange (#ea580c) trades.
If services cannot be inferred from data, Gemini uses 3 generic benefits for the category.

### Output
Single `index.html` with inlined CSS/JS, no external dependencies.

---

## 3. Hosting

**Primary:** surge.sh via `surge` npm package programmatically
- URL: `leadgen-{slug}-{6char-random}.surge.sh`
- `slug`: business name lowercased, spaces→hyphens, non-ASCII stripped, max 30 chars
- `6char-random`: `Math.random().toString(36).slice(2,8)`

**Fallback → Netlify Deploy API:**
Triggered when surge CLI exits with non-zero code OR throws a network error.
Fallback is per-business (not global switch). Uses zip upload to `api.netlify.com/api/v1/sites`.
Netlify token stored in `NETLIFY_TOKEN` env var. Site name: same slug format.

---

## 4. Architecture

### New Files
```
backend/src/routes/campaigns.js         — POST /campaigns (create+start), GET /campaigns/:id/progress (SSE)
backend/src/landingPageBuilder.js       — injects Gemini JSON into template, returns HTML string
frontend/src/pages/Campaign.jsx         — 4-step campaign wizard modal
frontend/src/templates/
  local-pro.html
  digital-presence.html
  social-first.html
```

### Modified Files
```
frontend/src/components/BusinessTable.jsx   — checkboxes + selection bar
backend/src/routes/businesses.js            — POST /businesses/bulk: receives { ids: [int] }, returns array of business objects
backend/src/db.js                           — campaigns + campaign_results tables
```

### DB Schema
```sql
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'running',   -- running | completed | partial | abandoned
  total INTEGER,
  sent INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0
);
-- Status transitions:
-- running → completed  (all items processed, failed = 0)
-- running → partial    (all items processed, failed > 0)
-- running → abandoned  (server restart or unhandled crash mid-run)

CREATE TABLE campaign_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  business_id INTEGER REFERENCES businesses(id),
  status TEXT DEFAULT 'pending',   -- pending | sent | failed
  landing_url TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, business_id)   -- prevents duplicates on concurrent retries
);
-- Use INSERT OR REPLACE when writing results to handle idempotent retries
```

### Backend Flow (sequential, per business)
1. Fetch business data
2. If `email` is null or empty → mark as `failed` with error "No email address", skip to next
3. Gemini → content JSON
4. `landingPageBuilder` → `index.html` string
5. Deploy to surge.sh (fallback: Netlify on error) → URL
6. Validate `{{LANDING_URL}}` placeholder is present in `email_body` — if missing, mark as `failed` with error "Missing landing URL placeholder", skip to next
7. Replace `{{LANDING_URL}}` with the deployed URL
8. Send via Nodemailer (uses existing `EMAIL_USER`/`EMAIL_PASS` from `.env`)
8. Update `campaign_results` row → `sent` or `failed`
9. Emit SSE event (see schema below)
10. Update business `status` in DB → "Email Sent"
11. After all items done: update `campaigns.status` → `completed` or `partial`

### SSE Event Schema
Each event on `GET /campaigns/:id/progress`:
```
event: progress
data: {"businessId": 42, "name": "Pizzeria Roma", "status": "sent"|"failed", "landingUrl": "...", "error": null}

event: complete
data: {"total": 10, "sent": 8, "failed": 2}
```
SSE connection closes after `complete` event is emitted.
If client disconnects: processing continues server-side (fire-and-forget). Client can reconnect to same endpoint.

### Retry Behavior
- Creates a NEW campaign row (new `campaign_id`)
- Processes only `failed` items from the original campaign
- Rebuilds everything from scratch (new Gemini call, new landing page, new URL)
- Original campaign row is NOT modified

---

## 5. Error Handling

- Per-business failure at any step: log `error` string to `campaign_results`, mark `status = failed`, continue
- Summary shown after wizard Step 4 completes
- Retry button creates a new campaign for failed items only
- Activity log: campaign summary written on `complete` event

---

## 6. Out of Scope

- Landing page editor / pre-send preview of content
- Custom domains for hosted pages
- Campaign analytics / email open tracking
- Scheduled / delayed sending
- Multi-user auth (single-user app)
