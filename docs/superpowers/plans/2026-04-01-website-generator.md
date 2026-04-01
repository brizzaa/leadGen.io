# Website Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere alla scheda business la generazione AI di siti vetrina completi (single HTML) con anteprima fullscreen e download.

**Architecture:** Nuova route backend che chiama Gemini per generare un intero file HTML. Il frontend aggiunge un pulsante nella pagina BusinessDetail che apre un dialog fullscreen con iframe srcdoc per l'anteprima e pulsanti per rigenerare/scaricare.

**Tech Stack:** Gemini 2.5 Pro API, Tailwind CDN (nel sito generato), React + lucide-react (UI)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `backend/src/routes/businesses.js` | Aggiungere route `POST /:id/generate-website` |
| Create | `frontend/src/components/business/WebsitePreviewDialog.jsx` | Dialog fullscreen con iframe, toolbar, download |
| Modify | `frontend/src/pages/BusinessDetail.jsx` | Aggiungere pulsante + state + integrazione dialog |

---

### Task 1: Backend — Route `generate-website`

**Files:**
- Modify: `backend/src/routes/businesses.js` (aggiungere prima della route `send-email`, ~riga 594)

- [ ] **Step 1: Aggiungere la route POST /:id/generate-website**

Inserire questo blocco in `backend/src/routes/businesses.js`, prima del commento `// POST /api/businesses/:id/send-email` (~riga 594):

```javascript
// POST /api/businesses/:id/generate-website
router.post("/:id/generate-website", async (req, res) => {
  const db = getDb();
  const biz = db
    .prepare("SELECT * FROM businesses WHERE id = ?")
    .get(req.params.id);

  if (!biz) return res.status(404).json({ error: "Business not found" });

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(400).json({ error: "GEMINI_API_KEY non configurata nel file .env" });
  }

  const socialsInfo = [biz.facebook_url, biz.instagram_url]
    .filter(Boolean)
    .join(", ") || "nessuno";

  const prompt = `Sei un web designer italiano esperto e creativo. Genera un sito vetrina completo, moderno e professionale per questa attività, in un SINGOLO file HTML autocontenuto.

DATI ATTIVITÀ:
- Nome: ${biz.name}
- Settore: ${biz.category || "N/A"}
- Area: ${biz.area || "N/A"}
- Indirizzo: ${biz.address || "N/A"}
- Telefono: ${biz.phone || "N/A"}
- Email: ${biz.email || "N/A"}
- Social: ${socialsInfo}
- Rating: ${biz.rating ? biz.rating + "/5" : "N/A"} (${biz.review_count || 0} recensioni)
- Sito attuale: ${biz.website || "nessuno"}

REGOLE STRUTTURALI OBBLIGATORIE:
1. HTML singolo autocontenuto con <!DOCTYPE html>, <html lang="it">
2. Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
3. Google Fonts Inter via CDN: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
4. Font-family: 'Inter', sans-serif su tutto il body
5. Responsive mobile-first
6. Lingua italiana per tutti i testi

REGOLE TEMA:
1. Scegli DARK MODE (sfondo #0a0a0a, testo #f0f0f0) o LIGHT MODE (sfondo #fafafa, testo #111) in base alla categoria:
   - Dark: ristoranti, bar, pub, pizzerie, idraulici, elettricisti, meccanici, palestre, tatuatori, barber shop
   - Light: pasticcerie, fioristi, estetiste, parrucchiere, studi medici, dentisti, commercialisti, avvocati, fotografi, wedding planner
   - Per categorie ambigue, scegli tu quello più adatto
2. Scegli un colore accent coerente con il settore (es. arancione per food, viola per beauty, blu per professional)
3. Usa il colore accent con parsimonia: CTA, hover, bordi, dettagli

REGOLE ANIMAZIONI:
1. Definisci questa animazione nel <style>:
   @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
2. Aggiungi la classe .fade-up { opacity: 0; } agli elementi da animare
3. Aggiungi questo script PRIMA di </body> per Intersection Observer:
   <script>
   const observer = new IntersectionObserver((entries) => {
     entries.forEach((entry, index) => {
       if (entry.isIntersecting) {
         entry.target.style.animation = 'fadeUp 0.8s ' + (index * 0.1) + 's ease forwards';
         observer.unobserve(entry.target);
       }
     });
   }, { threshold: 0.1 });
   document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
   </script>
4. Transizioni smooth su hover (transform, box-shadow, opacity) con transition: all 0.3s ease
5. ZERO librerie JS esterne

REGOLE SEZIONI — Scegli 5-8 tra queste, le più sensate per il tipo di attività:
- Hero (OBBLIGATORIO): immagine di sfondo a tutto schermo, overlay gradient, headline grande, subheadline, pulsante CTA
- Servizi: 3-4 card con icone SVG inline e descrizioni specifiche per l'attività
- Chi Siamo: testo narrativo realistico, layout a 2 colonne con immagine
- Numeri/Statistiche: 3-4 numeri chiave (anni attività, clienti serviti, progetti completati, etc.)
- Galleria: griglia di 3-6 immagini con hover zoom
- Testimonianze: 2-3 card con stelle SVG, nomi e testi realistici
- FAQ: 3-5 domande frequenti, usa <details><summary> per l'accordion
- Contatti (OBBLIGATORIO): indirizzo, telefono cliccabile, email cliccabile, link social se presenti
- Footer (OBBLIGATORIO): copyright con anno corrente, nome business, link rapidi alle sezioni

REGOLE IMMAGINI:
1. Per le immagini usa ESCLUSIVAMENTE https://picsum.photos/seed/{keyword}/{width}/{height} dove {keyword} è una parola inglese legata al settore (es. "restaurant", "hair", "plumber", "flower", "gym")
2. Usa keyword DIVERSE per ogni immagine (es. "restaurant1", "food2", "dining3")
3. Hero: immagine 1920x1080 con overlay gradient scuro/chiaro sopra
4. Galleria: immagini 600x400
5. Chi Siamo: immagine 800x600
6. Tutte le immagini devono avere alt text descrittivo

DIVIETI ASSOLUTI:
- ZERO emoji in qualsiasi parte del sito
- ZERO placeholder "Lorem ipsum"
- ZERO immagini da domini diversi da picsum.photos
- ZERO commenti HTML nel codice
- ZERO librerie JS esterne (solo Tailwind CDN e lo script Intersection Observer sopra)
- NON usare immagini SVG come sfondo per la hero — usa SOLO picsum.photos

RISPONDI SOLO CON IL CODICE HTML COMPLETO. Nessun testo prima o dopo, nessun markdown, nessun backtick.`;

  try {
    const axios = (await import("axios")).default;
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 16384,
        },
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 120000,
      },
    );

    let html = response.data.candidates[0].content.parts[0].text;

    // Strip markdown code fences se Gemini le aggiunge
    html = html.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    // Validazione minimale
    if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
      throw new Error("La risposta non contiene HTML valido");
    }

    res.json({ success: true, html });
  } catch (error) {
    console.error("[generate-website] Error:", error.message);
    res.status(500).json({
      error:
        "Errore generazione sito: " +
        (error.response?.data?.error?.message || error.message),
    });
  }
});
```

- [ ] **Step 2: Verificare che il server si avvia senza errori**

Run: `cd backend && node src/index.js`
Expected: `✅ LeadGen.io running on http://localhost:3001` senza errori di sintassi.

Terminare il server con Ctrl+C dopo la verifica.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/businesses.js
git commit -m "feat: add POST /api/businesses/:id/generate-website route"
```

---

### Task 2: Frontend — Componente WebsitePreviewDialog

**Files:**
- Create: `frontend/src/components/business/WebsitePreviewDialog.jsx`

- [ ] **Step 1: Creare il componente WebsitePreviewDialog**

Creare il file `frontend/src/components/business/WebsitePreviewDialog.jsx`:

```jsx
import { RefreshCw, Download, X, Loader2 } from "lucide-react";

export default function WebsitePreviewDialog({
  open,
  onClose,
  html,
  businessName,
  onRegenerate,
  isRegenerating,
}) {
  if (!open) return null;

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const slug = businessName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30)
      .replace(/-$/, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-sito.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border bg-background/80 backdrop-blur-sm">
        <span className="text-sm font-semibold truncate max-w-[50%]">
          {businessName} — Sito Vetrina
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            {isRegenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Rigenera
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Scarica HTML
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Iframe Preview */}
      <div className="flex-1 overflow-hidden">
        <iframe
          srcDoc={html}
          title="Website Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificare che il file è importabile**

Run: `cd frontend && npx vite build --mode development 2>&1 | head -20`
Expected: nessun errore di import (il componente non è ancora usato, ma la build non deve fallire per file non importati).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/business/WebsitePreviewDialog.jsx
git commit -m "feat: add WebsitePreviewDialog component"
```

---

### Task 3: Frontend — Integrare pulsante e dialog in BusinessDetail

**Files:**
- Modify: `frontend/src/pages/BusinessDetail.jsx`

- [ ] **Step 1: Aggiungere import del nuovo componente e icone**

In `frontend/src/pages/BusinessDetail.jsx`, aggiungere `Zap` e `Globe` alle icone importate da lucide-react (riga 2-14). `Globe` è già importato, aggiungere solo `Zap`. Poi aggiungere l'import del dialog.

Aggiungere `Zap` all'import di lucide-react:
```javascript
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Facebook,
  ExternalLink,
  Loader2,
  Hash,
  Zap,
} from "lucide-react";
```

Aggiungere l'import del componente sotto gli altri import dei componenti business (~riga 35):
```javascript
import WebsitePreviewDialog from "@/components/business/WebsitePreviewDialog";
```

- [ ] **Step 2: Aggiungere state per il website generator**

In `BusinessDetail`, dopo la riga `const [isSavingVat, setIsSavingVat] = useState(false);` (~riga 85), aggiungere:

```javascript
const [isGeneratingWebsite, setIsGeneratingWebsite] = useState(false);
const [generatedWebsiteHtml, setGeneratedWebsiteHtml] = useState(null);
```

- [ ] **Step 3: Aggiungere la funzione handleGenerateWebsite**

Dopo la funzione `handleUndoOptOut` (~riga 384), aggiungere:

```javascript
const handleGenerateWebsite = async () => {
  setIsGeneratingWebsite(true);
  try {
    const res = await fetch(
      `${API_URL}/api/businesses/${id}/generate-website`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );
    const data = await res.json();
    if (res.ok && data.success) {
      setGeneratedWebsiteHtml(data.html);
    } else {
      setAlertConfig({
        title: "Errore Generazione",
        description: data.error || "Errore sconosciuto durante la generazione del sito",
      });
    }
  } catch (e) {
    console.error(e);
    setAlertConfig({
      title: "Errore",
      description: "Errore di connessione al server",
    });
  }
  setIsGeneratingWebsite(false);
};
```

- [ ] **Step 4: Aggiungere il pulsante e il dialog nel JSX**

In `BusinessDetail`, nel blocco `<main>`, prima di `<CRMSection` (~riga 508), aggiungere il pulsante:

```jsx
        {/* Website Generator */}
        <div className="flex flex-col gap-3 p-6 rounded-xl border border-border/50 bg-card shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Sito Vetrina AI
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Genera un sito vetrina completo e personalizzato con l'AI
              </p>
            </div>
            <Button
              onClick={handleGenerateWebsite}
              disabled={isGeneratingWebsite}
              className="bg-[#00d4aa] text-black hover:bg-[#00d4aa]/90 font-semibold"
            >
              {isGeneratingWebsite ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {isGeneratingWebsite ? "Generazione..." : "Genera Sito"}
            </Button>
          </div>
        </div>
```

Poi, prima del tag di chiusura `</div>` del componente (dopo l'`AlertDialog`, ~riga 553), aggiungere il dialog:

```jsx
      <WebsitePreviewDialog
        open={generatedWebsiteHtml !== null}
        onClose={() => setGeneratedWebsiteHtml(null)}
        html={generatedWebsiteHtml || ""}
        businessName={business.name}
        onRegenerate={handleGenerateWebsite}
        isRegenerating={isGeneratingWebsite}
      />
```

- [ ] **Step 5: Verificare che il frontend compila**

Run: `cd frontend && npx vite build 2>&1 | tail -5`
Expected: build completata senza errori.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/BusinessDetail.jsx
git commit -m "feat: integrate website generator button and preview dialog in BusinessDetail"
```

---

### Task 4: Test End-to-End Manuale

- [ ] **Step 1: Avviare backend e frontend**

Run (in due terminali separati):
```bash
cd backend && node src/index.js
cd frontend && npx vite
```

- [ ] **Step 2: Testare il flusso completo**

1. Aprire http://localhost:5173
2. Cliccare su un business dalla tabella per aprire la scheda dettaglio
3. Scrollare fino alla sezione "Sito Vetrina AI"
4. Cliccare "Genera Sito"
5. Verificare: spinner appare durante la generazione
6. Verificare: dialog fullscreen si apre con il sito renderizzato nell'iframe
7. Verificare: le immagini da picsum.photos si caricano
8. Verificare: le animazioni fade-up funzionano allo scroll
9. Cliccare "Scarica HTML" — verificare che il file viene scaricato
10. Aprire il file scaricato nel browser — verificare che funziona standalone
11. Cliccare "Rigenera" — verificare che viene generato un nuovo sito
12. Cliccare "Chiudi" — verificare che il dialog si chiude

- [ ] **Step 3: Commit finale**

```bash
git add -A
git commit -m "feat: complete AI website generator with fullscreen preview and download"
```
