# Legitimate Interest Assessment (LIA)

**Sistema**: leader-gen (cold outreach B2B + generazione siti demo)
**Titolare del trattamento**: Luca Brizzante
**Data assessment**: 25 aprile 2026
**Versione**: 1.0
**Riferimento normativo**: art. 6, comma 1, lett. f) Regolamento UE 2016/679 — considerando 47 — Linee guida WP29/EDPB sul legittimo interesse — provvedimenti Garante Privacy n. 9899880/2023.

---

## 1. Identificazione dell'interesse legittimo perseguito

| Voce | Descrizione |
|---|---|
| **Interesse perseguito** | Sviluppo di attività commerciale di servizi web (siti, marketing digitale) tramite contatto diretto di potenziali clienti business (B2B). |
| **Natura dell'interesse** | Economico, lecito, reale (non ipotetico), specifico e attuale. |
| **Beneficio per gli interessati** | Servizi di sviluppo sito web e presenza digitale potenzialmente utili alle attività contattate, valutati gratuitamente caso per caso. |
| **Beneficio per terzi/società** | Riduzione asimmetria informativa nel mercato delle PMI italiane sulla disponibilità di soluzioni digitali a basso costo. |

---

## 2. Test di necessità

> Il trattamento è necessario al perseguimento dell'interesse?

**Sì.** Senza disporre dei dati di contatto pubblici delle aziende destinatarie non è materialmente possibile proporre i servizi né raggiungere il pubblico di riferimento (microimprese italiane).

> Esistono mezzi meno invasivi per raggiungere lo stesso scopo?

Sono stati considerati e adottati:

- **Selezione canale meno invasivo**: email asincrona, scelta deliberatamente al posto di chiamate telefoniche, SMS o messaggistica istantanea (WhatsApp), che il Garante considera mezzi più intrusivi e che richiedono consenso espresso preventivo.
- **Volume contenuto**: massimo 2 email per destinatario (primo contatto + un follow-up). Nessuna campagna massiva ricorrente.
- **Pre-qualifica**: il contatto avviene solo verso aziende la cui categoria merceologica è attinente all'offerta (web/digitale), non a tappeto.
- **Dati strettamente necessari**: trattati solo nome attività, indirizzo email, sede e categoria. Nessun dato sensibile, nessun dato personale eccedente.

---

## 3. Test di bilanciamento (balancing test)

### 3.1 Dati trattati e loro fonte

| Tipo di dato | Fonte | Pubblicità della fonte |
|---|---|---|
| Email aziendale (`info@`, `commerciale@`) | Sito web aziendale pubblico, scheda Google Business Profile, profili social pubblici dell'attività | I dati sono stati pubblicati dall'interessato medesimo con la finalità esplicita di ricevere contatti commerciali |
| Telefono | Stesse fonti | Idem |
| Indirizzo sede | Google Maps, sito web | Idem |
| Categoria attività | Google Business Profile | Idem |

I dati **non** sono stati ottenuti da:
- registri INI-PEC (che il Garante ha esplicitamente escluso dall'uso commerciale);
- database privati di terzi;
- elenchi telefonici;
- scraping di profili LinkedIn personali o di altri canali di contatto privati.

### 3.2 Aspettative ragionevoli dell'interessato

L'interessato:

- è il titolare o legale rappresentante di un'**attività commerciale**, non un consumatore privato;
- ha **pubblicato volontariamente** i dati di contatto su canali pubblici progettati per ricevere contatti (footer del sito aziendale, scheda Google "Contatti", "Informazioni" Facebook, bio Instagram con link al sito);
- esercita un'attività in un settore (commercio, servizi, ristorazione) dove ricevere proposte commerciali da fornitori è prassi quotidiana e attesa;
- nella sua veste imprenditoriale può **ragionevolmente attendersi** di ricevere proposte di servizi B2B coerenti con la sua attività, soprattutto quando i dati sono esposti in fonti destinate a quella finalità.

### 3.3 Possibili pregiudizi all'interessato

| Rischio teorico | Mitigazione adottata |
|---|---|
| Email indesiderata (disturbo) | Volume max 2 messaggi; opt-out one-click in tutte le email; rispetto immediato delle preferenze |
| Comunicazioni reiterate dopo richiesta di non contatto | Blacklist permanente con flag `is_blacklisted = 1` sul record + disabilitazione follow-up automatici |
| Uso secondario non previsto (vendita dataset, marketing terzi) | Esclusa contrattualmente: i dati non sono ceduti né venduti a terzi |
| Profilazione invasiva | Esclusa: solo dati di contatto, nessun comportamento online tracciato al di fuori dell'apertura email |
| Discriminazione per categorie protette | Esclusa: la categoria merceologica usata per la qualifica è quella dichiarata pubblicamente da Google Business |

### 3.4 Bilanciamento

L'interesse del titolare al contatto commerciale B2B verso destinatari che hanno deliberatamente pubblicato i propri dati di contatto su fonti pubbliche aziendali con finalità di ricezione contatti, mitigato dalle salvaguardie tecniche e organizzative sopra descritte (volume contenuto, opt-out immediato, niente cessione, niente profilazione), **prevale sul rischio teorico** di disturbo e di trattamento incompatibile, in considerazione della natura imprenditoriale e non personale dei destinatari e della loro ragionevole aspettativa di ricezione di proposte commerciali coerenti con la loro attività.

---

## 4. Salvaguardie tecniche e organizzative

| Salvaguardia | Stato | Implementazione tecnica |
|---|---|---|
| Privacy policy pubblica e linkata in ogni email | ✅ Attiva | `https://leader-gen.com/privacy` |
| Identità mittente chiara (nome + email persona fisica) | ✅ Attiva | Sender header e firma email reali |
| Opt-out one-click in ogni messaggio | ✅ Attiva | Link `/api/track/unsubscribe/<token>` |
| `List-Unsubscribe` + `List-Unsubscribe-Post` header RFC 8058 | ✅ Attiva | Implementato in `mailer.js` |
| Blacklist permanente alla prima richiesta | ✅ Attiva | Flag `is_blacklisted = 1` |
| Rispetto delle richieste di accesso/cancellazione entro 30gg | ✅ Procedura definita | Email a `l.brizzante@leader-gen.com` |
| Limite volume per destinatario (max 2) | ✅ Attiva | Logica `follow_ups` con `step` max 2 |
| Conservazione max 24 mesi | ✅ Definita | Procedura cleanup periodica |
| Non cessione/vendita del dataset | ✅ Vincolante | Decisione del titolare |
| Demo siti generati: `noindex,nofollow` + disclaimer visibile | ✅ Attiva | Patch automatica `addNoindexDisclaimer.js` |
| Nessun trattamento di categorie particolari (art. 9) | ✅ Verificato | Filtro a monte sui campi raccolti |
| Nessun trattamento dati di minori | ✅ Verificato | Pubblico target = imprese registrate |

---

## 5. Esiti e revisione

L'assessment conclude che il trattamento è **lecito** sotto la base giuridica del legittimo interesse del titolare ex art. 6.1.f GDPR, **a condizione del mantenimento integrale delle salvaguardie elencate al §4**.

L'assessment è soggetto a revisione:

- **annuale** (almeno una volta l'anno);
- **al variare** delle finalità di trattamento;
- **al variare** dei volumi (significativo aumento del numero di destinatari per ciclo);
- **al variare** dei canali (integrazione di mezzi diversi dall'email);
- **a seguito** di provvedimento Garante o di evoluzione interpretativa delle linee guida EDPB rilevante per il caso.

---

## 6. Esclusioni esplicite

Sono **espressamente esclusi** dal presente assessment e dalla relativa base giuridica:

- ❌ Invio di email a indirizzi PEC raccolti da INI-PEC o registri analoghi (espressamente vietato dal Garante);
- ❌ Invio di SMS, telefonate non sollecitate, messaggi WhatsApp commerciali senza consenso preventivo specifico documentato;
- ❌ Trasmissione del database o di sue porzioni a soggetti terzi;
- ❌ Cross-utilizzo dei dati per finalità diverse da quella commerciale qui descritta.

Per estendere il trattamento a una qualsiasi delle voci sopra è necessario un nuovo LIA o, dove previsto dalla normativa, l'acquisizione di un consenso esplicito e documentato.

---

## 7. Firma del titolare

Luca Brizzante — 25 aprile 2026

---

*Documento di evidenza interna conservato a fini di accountability ex art. 5.2 GDPR. Esibibile su richiesta del Garante o di un interessato che ne faccia istanza.*
