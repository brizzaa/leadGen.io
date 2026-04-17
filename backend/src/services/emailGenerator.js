import axios from "axios";

export class GeminiNotConfiguredError extends Error {}

const VALID_STRATEGIES = ["social_only", "weak_website", "ai_strategy", "generic"];

export function buildPrompt(type, biz) {
  const strategy = VALID_STRATEGIES.includes(type) ? type : "generic";
  const common = buildCommonInstructions();
  const signature = buildSignature();

  if (strategy === "social_only") return socialOnlyPrompt(biz, common, signature);
  if (strategy === "weak_website") return weakWebsitePrompt(biz, common, signature);
  if (strategy === "ai_strategy") return aiStrategyPrompt(biz, common, signature);
  return genericPrompt(biz, common, signature);
}

export async function generateEmail({ type, business }) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new GeminiNotConfiguredError("GEMINI_API_KEY non configurata");
  }

  const prompt = buildPrompt(type, business);
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.7 },
    },
    { headers: { "Content-Type": "application/json" } },
  );

  const fullText = response.data.candidates[0].content.parts[0].text;
  return parseGeneratedEmail(fullText);
}

export function parseGeneratedEmail(fullText) {
  const objMatch = fullText.match(/\[OGGETTO\]\s*([\s\S]*?)\s*\[CORPO\]/i);
  const bodyMatch = fullText.match(/\[CORPO\]\s*([\s\S]*)/i);

  if (objMatch && bodyMatch) {
    return { subject: objMatch[1].trim(), body: bodyMatch[1].trim() };
  }
  return {
    subject: "",
    body: fullText.replace(/\[OGGETTO\]|\[CORPO\]/gi, "").trim(),
  };
}

function buildSignature() {
  const name = process.env.MY_NAME || "Luca Brizzante";
  const phone = process.env.MY_PHONE ? ` - ${process.env.MY_PHONE}` : "";
  return `${name}${phone}`;
}

function buildCommonInstructions() {
  const owner = process.env.MY_NAME || "Luca Brizzante";
  return `
REGOLE TASSATIVE DI FORMATTAZIONE:
1. NON aggiungere chiacchiere introduttive (es. NO "Ecco una bozza", NO "Certamente").
2. DIVIETO ASSOLUTO DI TITOLI: Non usare mai titoli di sezione, etichette o intestazioni in grassetto (es. NO "**Analisi**", NO "**Proposta Killer**", NO "**CTA**", NO "Oggetto:").
3. STRUTTURA A PARAGRAFI: Dividi il testo in paragrafi chiari e ben spaziati per separare le diverse parti del ragionamento (complimento, analisi, proposta). Deve sembrare un'email scritta con cura.
4. Inizia direttamente con il formato richiesto.
5. Inserisci OBBLIGATORIAMENTE questo footer legale alla fine del [CORPO]:

---
Informativa Privacy ai sensi dell'Art. 13 del Reg. UE 2016/679 (GDPR): I tuoi dati di contatto (nome, email) sono stati raccolti da fonti pubblicamente accessibili (Google Maps, sito web aziendale). Titolare del trattamento: ${owner}. I dati vengono utilizzati esclusivamente per questa comunicazione e non ceduti a terzi. Puoi esercitare i tuoi diritti (accesso, rettifica, cancellazione, opposizione) rispondendo a questa email. Se non desideri ricevere ulteriori comunicazioni, rispondi 'CANCELLAMI' e provvederò alla rimozione immediata di tutti i tuoi dati entro 48 ore.

6. Usa ESATTAMENTE questo schema:
[OGGETTO]
...testo dell'oggetto...
[CORPO]
...testo del messaggio diviso in paragrafi (SENZA TITOLI)...
`;
}

function socialOnlyPrompt(biz, common, signature) {
  return `Agisci come un consulente di strategia digitale esperto e persuasivo. Scrivi un'email a un potenziale cliente (il titolare di "${biz.name}", settore "${biz.category}" a "${biz.area}") che attualmente non ha un sito web e comunica solo tramite social.

INFORMAZIONI AZIENDA:
- Nome: ${biz.name}
- Area: ${biz.area}
- Indirizzo: ${biz.address || "N/A"}
- Social trovati: ${biz.facebook_url || ""} ${biz.instagram_url || ""}

REGOLE DI CONTENUTO:
1. USA GOOGLE SEARCH per cercare questa specifica azienda prima di rispondere. Scopri ESATTAMENTE cosa offrono.
2. COMPLIMENTO REALE: Inizia con un complimento genuino su quello che hai visto dalla ricerca.
3. ARGOMENTO 1 (CASA IN AFFITTO): Metafora social vs sito di proprietà.
4. ARGOMENTO 2 (GOOGLE VS SOCIAL): Visibilità per nuovi clienti.
5. ARGOMENTO 3 (CREDIBILITÀ): Professionalità del sito web.
6. SOLUZIONE: Proponi un sito "vetrina" di una sola pagina.
7. CTA: Caffè virtuale di 10 minuti.
8. FIRMA: Chiudi il messaggio firmandoti come "${signature}".

TONO: Positivo, amichevole, lungimirante. Massimo 150 parole.
${common}`;
}

function weakWebsitePrompt(biz, common, signature) {
  return `Agisci come un consulente di strategia digitale esperto. Scrivi un'email al titolare di "${biz.name}" (settore "${biz.category}", area "${biz.area}") facendogli notare che il suo attuale sito web (${biz.website}) è datato o poco efficace.

REGOLE DI CONTENUTO:
1. USA GOOGLE SEARCH per visitare il sito e vedere cosa vendono.
2. TONO: Rispettoso, utile, propositivo.
3. ARGOMENTO: Parla di restyling moderno per velocità, mobile e conversioni.
4. SOLUZIONE: Sito veloce e moderno.
5. CTA: Feedback o incontro di 10 minuti.
6. FIRMA: Chiudi il messaggio firmandoti come "${signature}".

TONO: Professionale. Massimo 120 parole.
${common}`;
}

function aiStrategyPrompt(biz, common, signature) {
  return `Agisci come un Senior Digital Strategist esperto in psicologia della vendita. Il tuo obiettivo è analizzare "${biz.name}" (settore "${biz.category}", area "${biz.area}") e scrivere un'email professionale e ben strutturata.

REGOLE DI ANALISI:
1. USA GOOGLE SEARCH intensamente per trovare dettagli specifici che dimostrino che hai studiato l'attività.
2. IDENTIFICA IL PUNTO DEBOLE: Non limitarti ai siti. Pensa a SEO, automazioni, reputazione o e-commerce.

REGOLE DI SCRITTURA (PARAGRAFI SPAZIATI - NO TITOLI):
Organizza il messaggio in questo modo, usando solo lo spazio tra i paragrafi per dividere i concetti:
- PARAGRAFO 1: Saluto e complimento specifico scoperto online.
- PARAGRAFO 2: Descrivi la tua analisi di ciò che manca o potrebbe essere migliorato, integrando il discorso in modo naturale (senza titoli come "Analisi").
- PARAGRAFO 3: Presenta la tua SOLUZIONE PROPOSTA (la PROPOSTA "KILLER") spiegando perché è la mossa giusta per loro ora.
- PARAGRAFO 4: Chiusura con CTA (invito a 15 min di consulenza) e firma finale: "${signature}".

TONO: Alta consulenza, persuasivo, umano. Massimo 220 parole.
${common}`;
}

function genericPrompt(biz, common, signature) {
  return `Scrivi un'email professionale ma amichevole a "${biz.name}" per proporre i tuoi servizi di sviluppo web.
Complimentati per la loro attività e offri una consulenza gratuita di 10 minuti.

${common}
Firma il messaggio come: "${signature}"`;
}
