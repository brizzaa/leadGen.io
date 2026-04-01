# Generatore Siti Vetrina AI — Design Spec

## Obiettivo

Aggiungere alla scheda dettaglio business la possibilità di generare un sito vetrina completo (single-page, tutto in un HTML) usando Gemini API. Il sito viene mostrato in anteprima fullscreen e può essere scaricato come file HTML.

## Decisioni di Design

| Aspetto | Scelta |
|---------|--------|
| Posizione UI | Pulsante "Genera Sito Vetrina" nella pagina BusinessDetail |
| Output | Solo anteprima + download HTML (no deploy automatico) |
| Approccio generazione | Gemini genera l'intero HTML in un singolo file |
| Animazioni | Fade-up elegante con CSS @keyframes + Intersection Observer |
| Tema | Gemini sceglie dark/light in base alla categoria del business |
| Sezioni | Modulare — Gemini sceglie 5-8 sezioni rilevanti per l'attività |
| Immagini | picsum.photos (funzionanti, no API key) + placeholder.co fallback |
| CSS Framework | Tailwind CSS via CDN |
| Icone | SVG inline (zero emoji in tutto il sito) |
| Persistenza | Nessuna — HTML vive solo nello state React |

## Backend

### Nuova Route: `POST /api/businesses/:id/generate-website`

**File:** `backend/src/routes/businesses.js`

**Flusso:**
1. Recupera il business dal DB tramite `id`
2. Costruisce il prompt per Gemini con i dati del business e le regole di design
3. Chiama `gemini-2.5-pro` via `generativelanguage.googleapis.com` con `responseMimeType: "text/plain"`
4. Estrae l'HTML dalla risposta (rimuove eventuali ``` markdown wrapping)
5. Ritorna `{ success: true, html: "<html>..." }`

**Errori:**
- 404 se business non trovato
- 500 se Gemini API fallisce (con messaggio errore)
- 400 se GEMINI_API_KEY non configurata

### Prompt Gemini — Struttura

**Ruolo:** Web designer italiano esperto che genera siti vetrina professionali.

**Input dati business:**
- Nome, categoria, area, indirizzo, telefono, email
- Social (facebook_url, instagram_url)
- Rating e numero recensioni
- Sito web attuale (se presente)

**Regole strutturali:**
- HTML singolo autocontenuto con `<!DOCTYPE html>`
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Google Fonts (Inter) via CDN
- Animazioni custom in blocco `<style>` nel `<head>`
- Piccolo script inline per Intersection Observer (animazioni al scroll)
- Responsive mobile-first
- Lingua italiana
- NO emoji da nessuna parte — usare icone SVG inline

**Regole tema:**
- Gemini sceglie dark mode o light mode in base alla categoria:
  - Dark: ristoranti, bar, pub, idraulici, elettricisti, meccanici, palestre
  - Light: pasticcerie, estetiste, fioristi, studi medici, commercialisti, avvocati
  - Gemini valuta caso per caso per categorie ambigue
- Colore accent coerente con il settore

**Regole animazioni:**
- Solo fade-up staggerato con `@keyframes fadeUp` + `animation-delay` incrementale
- Transizioni smooth su hover (transform, box-shadow)
- Intersection Observer per triggerare le animazioni quando le sezioni entrano nel viewport
- Zero librerie JS esterne

**Regole sezioni (Gemini sceglie 5-8):**
- **Hero** (obbligatorio): immagine di sfondo, headline, subheadline, CTA
- **Servizi**: 3-4 card con icone SVG e descrizioni
- **Chi Siamo**: testo narrativo, immagine laterale
- **Numeri/Statistiche**: 3-4 numeri chiave (anni attività, clienti, progetti, etc.)
- **Galleria**: 3-6 immagini in griglia
- **Testimonianze**: 2-3 review card con stelle
- **FAQ**: 3-5 domande frequenti, accordion con CSS `:target` o `<details>`
- **Contatti** (obbligatorio): indirizzo, telefono, email, link social, mappa placeholder
- **Footer** (obbligatorio): copyright, nome business, link rapidi

Gemini sceglie le sezioni più sensate per il tipo di attività.

**Regole immagini:**
- Usare `https://picsum.photos/seed/{keyword}/{width}/{height}` per immagini realistiche (il seed deve essere una parola chiave legata al business, es. "restaurant", "barber", "plumber")
- Fallback: `https://placehold.co/{width}x{height}/{bg}/{text}?text={label}`
- Hero: immagine a tutto schermo con overlay gradient
- Galleria: immagini con aspect ratio consistente
- Le immagini devono caricarsi aprendo il file nel browser (URL pubblici, no API key)

## Frontend

### Pulsante "Genera Sito Vetrina"

**File:** `frontend/src/pages/BusinessDetail.jsx`

- Posizionato nella pagina dettaglio, prima della sezione AI Generator
- Icona: Globe + Zap (da lucide-react)
- Testo: "Genera Sito Vetrina"
- Al click: chiama `POST /api/businesses/:id/generate-website`
- Durante generazione: bottone disabilitato con spinner Loader2

**Nuovo state:**
- `isGeneratingWebsite: boolean` — true durante la chiamata API
- `generatedWebsiteHtml: string | null` — HTML del sito generato

### Componente `WebsitePreviewDialog`

**Nuovo file:** `frontend/src/components/business/WebsitePreviewDialog.jsx`

**Struttura:**
- Dialog fullscreen (non il Dialog di shadcn — un div fixed inset-0 con z-50)
- **Toolbar fixed in alto** (h-14, bg semi-trasparente con backdrop-blur):
  - Sinistra: nome business (troncato)
  - Destra: 3 bottoni
    - "Rigenera" (RefreshCw icon) — richiama l'API
    - "Scarica" (Download icon) — scarica come `{slug}-sito.html`
    - "Chiudi" (X icon) — chiude il dialog
- **Iframe** sotto la toolbar, occupa tutto lo spazio restante
  - Usa `srcdoc={html}` per renderizzare l'HTML generato
  - `sandbox="allow-scripts"` per permettere Intersection Observer
  - Bordo sottile per separare dalla toolbar

**Props:**
- `open: boolean`
- `onClose: () => void`
- `html: string`
- `businessName: string`
- `onRegenerate: () => void`
- `isRegenerating: boolean`

**Download:** Crea un Blob dall'HTML, genera un URL temporaneo, triggera il download con un `<a>` invisibile. Il nome file è `{makeSlug(businessName)}-sito.html`.

## Non in scope

- Deploy automatico su surge.sh o hosting
- Salvataggio del sito generato nel DB
- Editing inline del sito
- Generazione bulk (campagne)
- Immagini caricate dall'utente
