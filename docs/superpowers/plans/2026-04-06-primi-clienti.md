# Acquisizione Primi Clienti — Piano d'Azione

> **Per agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chiudere 3–5 clienti paganti in 2 settimane usando LeadGen.io come motore di outreach.

**Architettura:** Fase 1 (GBP) genera cash rapido e testimonial; Fase 2 (demo sito) sfrutta i testimonial e la preview AI per chiudere clienti più grandi. Il tool automatizza la ricerca e l'email; Luca si concentra solo sulla chiusura telefonica.

**Tool:** LeadGen.io (locale, SQLite, frontend React su localhost:5173)

---

## Fase 1 — Google Business Profile (Settimana 1)

### Task 1: Setup campagna GBP

**Files/risorse:**
- LeadGen.io → filtro `unclaimedOnly`
- Template email da personalizzare (vedi sotto)

- [ ] **Step 1: Scegli città e categoria**

  Apri LeadGen.io. Nel pannello ricerca, imposta:
  - **Città:** scegli una città che conosci (non serve essere lì fisicamente)
  - **Categoria:** scegli una sola categoria per iniziare — consigliato: `ristorante`, `parrucchiere`, `idraulico`, `estetista`
  - Lascia tutto il resto vuoto per ora

- [ ] **Step 2: Estrai i lead**

  Clicca "Cerca" e lascia girare lo scraper. Obiettivo: 30–50 risultati.
  Al termine, vai nella tab CRM e filtra per `Non rivendicato` (checkbox `unclaimedOnly`).
  Dovresti avere 10–20 business con profilo Google non rivendicato.

- [ ] **Step 3: Scrematura manuale (5 minuti)**

  Per ogni lead nella lista, guarda velocemente:
  - Ha un numero di telefono? (priorità alta)
  - Ha un'email? (priorità media)
  - Ha meno di 10 recensioni? (segnale di bassa cura del profilo = più sensibile al problema)

  Segna i migliori 10 con stato "Da Contattare".

- [ ] **Step 4: Genera le email AI**

  Apri ogni business selezionato, vai nella sezione AI Email Generator.
  Seleziona strategia: **"Sito assente / Solo social"** (è quella più vicina al pitch GBP).
  Genera l'email, poi modifica manualmente l'oggetto e la prima riga con questo schema:

  ```
  Oggetto: Il profilo Google di [Nome Attività] non è ancora verificato

  Prima riga:
  "Ho notato che il profilo Google di [Nome Attività] non è ancora rivendicato —
  questo significa che chiunque la cerchi online potrebbe trovare informazioni
  errate o incomplete."
  ```

  Il resto dell'email AI va bene così. Aggiungi in fondo:

  ```
  "Posso configurarlo in giornata per €200 — nessun abbonamento, pagamento
  una tantum. Se vuole, mi chiami o risponda a questa email e lo sistemiamo subito."
  ```

- [ ] **Step 5: Invia le email**

  Invia dal tool (pulsante "Invia Email"). Il tool aggiorna lo stato a "Inviata Mail".
  Obiettivo: 10 email inviate entro martedì mattina.

---

### Task 2: Gestione risposte e chiusura telefonica

- [ ] **Step 1: Monitora le risposte**

  Controlla la casella email ogni mattina alle 9. Chi risponde positivamente, chiamalo entro 2 ore. Chi non risponde dopo 3 giorni, manda un follow-up breve:

  ```
  Oggetto: Re: Il profilo Google di [Nome Attività]

  Buongiorno [Nome],
  le scrivo per verificare se ha ricevuto la mia email di qualche giorno fa.
  Bastano 10 minuti al telefono per capire se posso esserle utile.
  Ha un momento questa settimana?
  ```

- [ ] **Step 2: Script chiamata telefonica (10 minuti)**

  ```
  Apertura (30 sec):
  "Buongiorno, sono [Luca], le ho scritto ieri riguardo al suo profilo Google.
  Ha 5 minuti? Volevo mostrarle una cosa veloce."

  Dimostrazione del problema (2 min):
  "Se cerca '[Nome Attività] [Città]' su Google, vede questo profilo?
  Vede che dice 'Rivendica questa attività'? Questo significa che Google
  non sa che è lei il proprietario — e chiunque potrebbe modificare le informazioni."

  Proposta (1 min):
  "Posso rivendicarlo e ottimizzarlo in giornata — orari, foto, descrizione,
  categoria corretta. Costa €200 una tantum, nessun contratto."

  Chiusura:
  "Vuole che proceda? Posso mandarle la fattura su PayPal/bonifico e
  iniziare oggi stesso."
  ```

- [ ] **Step 3: Delivery GBP (2 ore per cliente)**

  Una volta confermato e pagato:
  1. Fatti dare l'accesso all'account Google del cliente (o fai tu con delega)
  2. Verifica il profilo via SMS/cartolina (scegli SMS se disponibile)
  3. Compila: nome esatto, categoria principale, orari, numero telefono, sito (se esiste), descrizione 750 caratteri con parole chiave locali
  4. Carica almeno 5 foto (logo, esterno, interno, prodotti/servizi)
  5. Attiva le risposte automatiche ai messaggi
  6. Manda screenshot "prima/dopo" al cliente via WhatsApp

- [ ] **Step 4: Chiedi il testimonial**

  Subito dopo la consegna, manda questo messaggio WhatsApp:

  ```
  "Ciao [Nome], tutto configurato! Ecco lo screenshot del profilo aggiornato.
  Se è soddisfatto, le chiedo un favore: potrebbe lasciarmi una recensione
  su Google? Per me è molto importante. Ecco il link diretto: [link profilo Google tuo]
  Grazie mille!"
  ```

---

## Fase 2 — Demo Sito Vetrina (Settimana 2)

### Task 3: Setup campagna demo sito

- [ ] **Step 1: Filtra i nuovi lead**

  Nel tool, applica i filtri:
  - `noWebsite` = sì
  - oppure `facebookOnly` = sì
  - Stessa città della Fase 1 (hai già credibilità lì)

  Seleziona 15–20 business. Dai priorità a quelli con:
  - Email presente (puoi contattarli subito)
  - Rating ≥ 3.5 (hanno una base di clienti, possono permettersi il sito)
  - Categoria "presentabile" (ristorante, salone, studio, negozio — non idraulico senza sito)

- [ ] **Step 2: Genera le demo**

  Per ogni lead selezionato:
  1. Apri la scheda business nel tool
  2. Clicca "Genera Sito Vetrina"
  3. Attendi 30–60 secondi
  4. Nella preview, clicca "Scarica" → salva come `[nome-business]-demo.html`
  5. Carica il file su surge.sh:
     ```bash
     npm install -g surge
     # crea una cartella temporanea con il file rinominato index.html
     mkdir demo-[nome] && cp [nome-business]-demo.html demo-[nome]/index.html
     surge demo-[nome]/ [nome-business]-preview.surge.sh
     ```
  6. Annota il link nella nota del business nel CRM

  Fai questo per i migliori 10 lead (non tutti — solo quelli che vuoi contattare davvero).

- [ ] **Step 3: Genera le email con la demo**

  Per ogni business con demo pronta, usa l'AI email generator, poi sostituisci l'intero corpo con questo template:

  ```
  Oggetto: Ho già preparato una bozza del sito per [Nome Attività]

  Gentile [Nome / titolare],

  mi chiamo [Luca] e lavoro nel settore web da alcuni anni.

  Ho notato che [Nome Attività] al momento non ha un sito web proprio,
  e ho pensato di prepararle una bozza per mostrarle come potrebbe apparire online.

  Può vederla qui: [link surge.sh]

  Ovviamente è solo un punto di partenza — i testi, le foto e i contenuti
  verrebbero personalizzati con lei. Il sito finale includerebbe:
  • Pagina presentazione attività e servizi
  • Sezione contatti con numero cliccabile
  • Ottimizzazione per Google (SEO locale)
  • Versione mobile perfetta

  Il costo è €[600–900] una tantum, nessun abbonamento.

  Se le fa piacere, possiamo sentirci 10 minuti al telefono questa settimana.

  Cordiali saluti,
  [Luca]
  [Telefono]
  ```

- [ ] **Step 4: Invia e monitora**

  Invia dal tool o manualmente. Segna lo stato "Inviata Mail" nel CRM.
  Attendi 48 ore prima del follow-up.

  Follow-up (se nessuna risposta dopo 2 giorni):
  ```
  Oggetto: Re: Bozza sito [Nome Attività]

  Buongiorno,
  volevo assicurarmi che abbia ricevuto la mia email con la bozza del sito.
  Il link è ancora attivo: [link]
  È disponibile per una chiamata veloce questa settimana?
  ```

---

### Task 4: Chiusura sito e upsell

- [ ] **Step 1: Script chiamata sito (15 minuti)**

  ```
  Apertura:
  "Ha visto la bozza che le ho mandato? Cosa ne pensa?"
  [aspetta risposta — non parlare sopra]

  Se positivo:
  "Perfetto. Per il sito finale ci vogliono circa 5 giorni lavorativi.
  Avrei bisogno di alcune informazioni da lei: i testi che vuole mostrare,
  eventualmente alcune foto, e i servizi che vuole mettere in evidenza."

  Sul prezzo (non scendere sotto €500):
  "Il costo è [X] euro una tantum. Comprende sviluppo, messa online,
  dominio per il primo anno e configurazione Google. Non ha abbonamenti mensili."

  Chiusura:
  "Possiamo iniziare questa settimana. Le mando una mail con i dettagli
  e le coordinate per il pagamento — di solito si fa un 50% in anticipo."
  ```

- [ ] **Step 2: Proponi il bundle GBP + sito**

  Se il cliente non ha il GBP configurato, proponi il bundle:
  ```
  "Tra l'altro, visto che facciamo il sito, potrei configurarle anche
  il profilo Google in contemporanea. Il pacchetto completo è €[700–900].
  In questo modo quando qualcuno la cerca su Google trova sia il profilo
  che il sito."
  ```

- [ ] **Step 3: Aggiorna il CRM**

  - Stato → "In Trattativa" durante la trattativa
  - Stato → "Vinto (Cliente)" dopo il pagamento
  - Aggiungi nota con: data accordo, importo, scadenza consegna

---

## KPI di riferimento

| Metrica | Obiettivo settimana 1 | Obiettivo settimana 2 |
|---|---|---|
| Email inviate | 10 | 10 |
| Risposte ricevute | 3–4 | 2–3 |
| Chiamate effettuate | 3–4 | 2–3 |
| Clienti chiusi | 2–3 GBP | 1–2 siti |
| Fatturato | €400–600 | €600–1.800 |

---

## Note operative

- **Quando chiamare:** martedì–giovedì, 9:30–12:00 e 14:30–17:30. Evita lunedì mattina e venerdì pomeriggio.
- **Pagamento:** accetta PayPal, bonifico, Satispay. Non iniziare il lavoro senza almeno il 50% anticipato.
- **Contratto:** per i siti usa una semplice email di conferma con: oggetto, prezzo, tempi, cosa include. Non serve un contratto formale per i primi clienti.
- **Se chiedono referenze:** usa i clienti GBP della settimana 1 come referenze per la settimana 2.
