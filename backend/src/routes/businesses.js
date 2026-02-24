import express from "express";
import nodemailer from "nodemailer";
import { getDb } from "../db.js";
import { Parser } from "json2csv";
import { scanSocial, scanSocialBatch } from "../socialScanner.js";

const router = express.Router();

// GET /api/businesses
router.get("/", (req, res) => {
  try {
    const {
      area,
      category,
      noWebsite,
      fewReviews,
      facebookOnly,
      unclaimedOnly,
      search,
      status,
      groupId,
    } = req.query;

    const db = getDb();
    let whereClauses = ["1=1"];
    const params = [];

    if (status && status !== "Tutti") {
      whereClauses.push("status = ?");
      params.push(status);
    }
    if (groupId) {
      whereClauses.push(
        "id IN (SELECT business_id FROM business_groups WHERE group_id = ?)",
      );
      params.push(groupId);
    }
    if (area) {
      whereClauses.push("LOWER(area) LIKE ?");
      params.push(`%${area.toLowerCase()}%`);
    }
    if (category) {
      whereClauses.push("LOWER(category) LIKE ?");
      params.push(`%${category.toLowerCase()}%`);
    }

    // Safer check for boolean strings
    if (noWebsite === "true" || noWebsite === true) {
      whereClauses.push(
        '(website IS NULL OR website = "" OR website = "None")',
      );
    }
    if (fewReviews === "true" || fewReviews === true) {
      whereClauses.push("(review_count IS NOT NULL AND review_count < 10)");
    }
    if (facebookOnly === "true" || facebookOnly === true) {
      whereClauses.push("website LIKE '%facebook.com%'");
    }
    if (unclaimedOnly === "true" || unclaimedOnly === true) {
      whereClauses.push("is_claimed = 0");
    }
    if (search) {
      whereClauses.push("(LOWER(name) LIKE ? OR LOWER(address) LIKE ?)");
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }

    const whereSql = whereClauses.join(" AND ");

    const businessesSql = `
      SELECT * FROM businesses
      WHERE ${whereSql}
      ORDER BY created_at DESC
    `;
    const businesses = db.prepare(businessesSql).all(...params);

    res.json(businesses);
  } catch (error) {
    console.error("[businesses] Error fetching:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

// GET /api/businesses/scan-social-batch (SSE)
router.get("/scan-social-batch", async (req, res) => {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ error: "ids are required" });

  const idList = ids.split(",").map((id) => parseInt(id, 10));
  const db = getDb();

  // Fetch only the requested businesses
  const businesses = db
    .prepare(
      `SELECT * FROM businesses WHERE id IN (${idList.map(() => "?").join(",")})`,
    )
    .all(...idList);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendProgress = (message) => {
    res.write(`data: ${JSON.stringify({ type: "progress", message })}\n\n`);
  };

  try {
    const resultsMap = await scanSocialBatch(businesses, sendProgress);

    // Save results to DB
    const updateScanTimeStmt = db.prepare(`
      UPDATE businesses SET last_social_scan_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    const updateSocialsStmt = db.prepare(`
      UPDATE businesses
      SET facebook_url = ?, instagram_url = ?, social_last_active = ?
      WHERE id = ?
    `);

    const transaction = db.transaction(() => {
      // Mark all as scanned
      for (const id of idList) {
        updateScanTimeStmt.run(id);
      }
      // Update those that were found
      for (const [id, result] of resultsMap) {
        updateSocialsStmt.run(
          result.facebook_url,
          result.instagram_url,
          result.social_last_active,
          id,
        );
      }
    });

    transaction();

    res.write(
      `data: ${JSON.stringify({ type: "done", message: "Scansione batch completata!", resultsFound: resultsMap.size })}\n\n`,
    );
    res.end();
  } catch (error) {
    console.error("[batch-social] Error:", error);
    res.write(
      `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`,
    );
    res.end();
  }
});

// GET /api/businesses/export
router.get("/export", (req, res) => {
  try {
    const db = getDb();
    const businesses = db
      .prepare("SELECT * FROM businesses ORDER BY created_at DESC")
      .all();

    console.log(
      `[export] Esportazione in corso: ${businesses.length} business trovati.`,
    );

    const fields = [
      "id",
      "name",
      "address",
      "phone",
      "email",
      "website",
      "rating",
      "review_count",
      "category",
      "area",
      "maps_url",
      "status",
      "is_claimed",
      "facebook_url",
      "instagram_url",
      "social_last_active",
      "notes",
      "next_contact",
      "created_at",
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(businesses);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="businesses.csv"',
    );
    res.send(csv);
    console.log(`[export] Esportazione completata con successo.`);
  } catch (err) {
    console.error("[export] Errore durante l'esportazione:", err.message);
    res.status(500).json({
      error: "Errore durante la generazione del CSV",
      details: err.message,
    });
  }
});

// GET /api/businesses/:id
router.get("/:id", (req, res) => {
  const db = getDb();
  const business = db
    .prepare("SELECT * FROM businesses WHERE id = ?")
    .get(req.params.id);
  if (!business) return res.status(404).json({ error: "Business not found" });
  res.json(business);
});

// DELETE /api/businesses/:id
router.delete("/:id", (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM businesses WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// PATCH /api/businesses/:id/status
router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: "status is required" });
  }
  const db = getDb();
  const stmt = db.prepare("UPDATE businesses SET status = ? WHERE id = ?");
  const result = stmt.run(status, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }
  res.json({ success: true, status });
});

// PATCH /api/businesses/:id/email
router.patch("/:id/email", (req, res) => {
  const { email } = req.body;
  const db = getDb();
  const stmt = db.prepare("UPDATE businesses SET email = ? WHERE id = ?");
  const result = stmt.run(email, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }
  res.json({ success: true, email });
});

// PATCH /api/businesses/:id/phone
router.patch("/:id/phone", (req, res) => {
  const { phone } = req.body;
  const db = getDb();
  const stmt = db.prepare("UPDATE businesses SET phone = ? WHERE id = ?");
  const result = stmt.run(phone, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }
  res.json({ success: true, phone });
});

// PATCH /api/businesses/:id/website
router.patch("/:id/website", (req, res) => {
  const { website } = req.body;
  const db = getDb();
  const stmt = db.prepare("UPDATE businesses SET website = ? WHERE id = ?");
  const result = stmt.run(website, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }
  res.json({ success: true, website });
});

// PATCH /api/businesses/:id/details
router.patch("/:id/details", (req, res) => {
  const { notes, next_contact } = req.body;
  const db = getDb();
  const stmt = db.prepare(
    "UPDATE businesses SET notes = ?, next_contact = ? WHERE id = ?",
  );
  const result = stmt.run(notes, next_contact, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }
  res.json({ success: true, notes, next_contact });
});

// PATCH /api/businesses/:id/opt-out (GDPR Compliance)
router.patch("/:id/opt-out", (req, res) => {
  const db = getDb();
  const stmt = db.prepare(
    "UPDATE businesses SET is_blacklisted = 1, status = 'Perso', notes = IFNULL(notes || '\n', '') || '[GDPR] Richiesta disiscrizione/Opt-out' WHERE id = ?",
  );
  const result = stmt.run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }
  res.json({
    success: true,
    message: "Utente rimosso dalle liste di contatto.",
  });
});

// PATCH /api/businesses/:id/undo-opt-out
router.patch("/:id/undo-opt-out", (req, res) => {
  const db = getDb();
  const stmt = db.prepare(
    "UPDATE businesses SET is_blacklisted = 0, notes = IFNULL(notes || '\n', '') || '[GDPR] Opt-out annullato manualmente' WHERE id = ?",
  );
  const result = stmt.run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }
  res.json({
    success: true,
    message: "Utente riattivato per le liste di contatto.",
  });
});

// POST /api/businesses/:id/scan-social — On-demand social scan per un singolo business
router.post("/:id/scan-social", async (req, res) => {
  const db = getDb();
  const biz = db
    .prepare("SELECT * FROM businesses WHERE id = ?")
    .get(req.params.id);

  if (!biz) return res.status(404).json({ error: "Business not found" });

  try {
    console.log(`[social-scan] Scanning social for: ${biz.name} (${biz.area})`);
    const result = await scanSocial(biz);

    // Update DB with results
    const updates = [];
    const values = [];

    if (result.facebook_url) {
      updates.push("facebook_url = ?");
      values.push(result.facebook_url);
    }
    if (result.instagram_url) {
      updates.push("instagram_url = ?");
      values.push(result.instagram_url);
    }
    if (result.social_last_active) {
      updates.push("social_last_active = ?");
      values.push(result.social_last_active);
    }

    updates.push("last_social_scan_at = CURRENT_TIMESTAMP");

    values.push(req.params.id);
    db.prepare(`UPDATE businesses SET ${updates.join(", ")} WHERE id = ?`).run(
      ...values,
    );

    console.log(`[social-scan] Done for ${biz.name}:`, result);
    res.json({
      success: true,
      ...result,
      message:
        result.facebook_url || result.instagram_url
          ? "Profili social trovati!"
          : "Nessun profilo social trovato.",
    });
  } catch (error) {
    console.error(`[social-scan] Error for ${biz.name}:`, error.message);
    res.status(500).json({
      error: "Errore durante la scansione social: " + error.message,
    });
  }
});

// POST /api/businesses/:id/generate-email
router.post("/:id/generate-email", async (req, res) => {
  const { type = "social_only" } = req.body;
  const db = getDb();
  const biz = db
    .prepare("SELECT * FROM businesses WHERE id = ?")
    .get(req.params.id);

  if (!biz) return res.status(404).json({ error: "Business not found" });

  let prompt = "";
  const commonInstructions = `
REGOLE TASSATIVE DI FORMATTAZIONE:
1. NON aggiungere chiacchiere introduttive (es. NO "Ecco una bozza", NO "Certamente").
2. DIVIETO ASSOLUTO DI TITOLI: Non usare mai titoli di sezione, etichette o intestazioni in grassetto (es. NO "**Analisi**", NO "**Proposta Killer**", NO "**CTA**", NO "Oggetto:").
3. STRUTTURA A PARAGRAFI: Dividi il testo in paragrafi chiari e ben spaziati per separare le diverse parti del ragionamento (complimento, analisi, proposta). Deve sembrare un'email scritta con cura.
4. Inizia direttamente con il formato richiesto.
5. Inserisci OBBLIGATORIAMENTE questo footer legale alla fine del [CORPO]:

---
Informativa Privacy: Ti contatto perché ho trovato i tuoi riferimenti pubblicamente su Google Maps/Web e credo che il mio servizio possa essere di tuo interesse (Legittimo Interesse, Art. 6 GDPR). Se non desideri ricevere ulteriori comunicazioni, rispondi 'CANCELLAMI' a questa email e provvederò alla rimozione immediata dei tuoi dati.

6. Usa ESATTAMENTE questo schema:
[OGGETTO]
...testo dell'oggetto...
[CORPO]
...testo del messaggio diviso in paragrafi (SENZA TITOLI)...
`;

  if (type === "social_only") {
    prompt = `Agisci come un consulente di strategia digitale esperto e persuasivo. Scrivi un'email a un potenziale cliente (il titolare di "${biz.name}", settore "${biz.category}" a "${biz.area}") che attualmente non ha un sito web e comunica solo tramite social.

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
8. FIRMA: Chiudi il messaggio firmandoti come "${process.env.MY_NAME || "Luca Brizzante"}${process.env.MY_PHONE ? " - " + process.env.MY_PHONE : ""}".

TONO: Positivo, amichevole, lungimirante. Massimo 150 parole.
${commonInstructions}`;
  } else if (type === "weak_website") {
    prompt = `Agisci come un consulente di strategia digitale esperto. Scrivi un'email al titolare di "${biz.name}" (settore "${biz.category}", area "${biz.area}") facendogli notare che il suo attuale sito web (${biz.website}) è datato o poco efficace.

REGOLE DI CONTENUTO:
1. USA GOOGLE SEARCH per visitare il sito e vedere cosa vendono.
2. TONO: Rispettoso, utile, propositivo.
3. ARGOMENTO: Parla di restyling moderno per velocità, mobile e conversioni.
4. SOLUZIONE: Sito veloce e moderno.
5. CTA: Feedback o incontro di 10 minuti.
6. FIRMA: Chiudi il messaggio firmandoti come "${process.env.MY_NAME || "Luca Brizzante"}${process.env.MY_PHONE ? " - " + process.env.MY_PHONE : ""}".

TONO: Professionale. Massimo 120 parole.
${commonInstructions}`;
  } else if (type === "ai_strategy") {
    prompt = `Agisci come un Senior Digital Strategist esperto in psicologia della vendita. Il tuo obiettivo è analizzare "${biz.name}" (settore "${biz.category}", area "${biz.area}") e scrivere un'email professionale e ben strutturata.

REGOLE DI ANALISI:
1. USA GOOGLE SEARCH intensamente per trovare dettagli specifici che dimostrino che hai studiato l'attività.
2. IDENTIFICA IL PUNTO DEBOLE: Non limitarti ai siti. Pensa a SEO, automazioni, reputazione o e-commerce.

REGOLE DI SCRITTURA (PARAGRAFI SPAZIATI - NO TITOLI):
Organizza il messaggio in questo modo, usando solo lo spazio tra i paragrafi per dividere i concetti:
- PARAGRAFO 1: Saluto e complimento specifico scoperto online.
- PARAGRAFO 2: Descrivi la tua analisi di ciò che manca o potrebbe essere migliorato, integrando il discorso in modo naturale (senza titoli come "Analisi").
- PARAGRAFO 3: Presenta la tua SOLUZIONE PROPOSTA (la PROPOSTA "KILLER") spiegando perché è la mossa giusta per loro ora.
- PARAGRAFO 4: Chiusura con CTA (invito a 15 min di consulenza) e firma finale: "${process.env.MY_NAME || "Luca Brizzante"}${process.env.MY_PHONE ? " - " + process.env.MY_PHONE : ""}".

TONO: Alta consulenza, persuasivo, umano. Massimo 220 parole.
${commonInstructions}`;
  } else {
    prompt = `Scrivi un'email professionale ma amichevole a "${biz.name}" per proporre i tuoi servizi di sviluppo web.
Complimentati per la loro attività e offri una consulenza gratuita di 10 minuti.

${commonInstructions}
Firma il messaggio come: "${process.env.MY_NAME || "Luca Brizzante"}"`;
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    return res.json({
      success: true,
      generatedEmail: `[OGGETTO]\nProposta di collaborazione\n[CORPO]\nCiao, sono interessato alla tua attività... (Configura API KEY per testo reale)`,
    });
  }

  try {
    const axios = (await import("axios")).default;
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.7 },
      },
      { headers: { "Content-Type": "application/json" } },
    );

    const fullText = response.data.candidates[0].content.parts[0].text;

    // Parsing manuale dei tag [OGGETTO] e [CORPO]
    let subject = "";
    let body = fullText;

    const objMatch = fullText.match(/\[OGGETTO\]\s*([\s\S]*?)\s*\[CORPO\]/i);
    const bodyMatch = fullText.match(/\[CORPO\]\s*([\s\S]*)/i);

    if (objMatch && bodyMatch) {
      subject = objMatch[1].trim();
      body = bodyMatch[1].trim();
    } else {
      body = fullText.replace(/\[OGGETTO\]|\[CORPO\]/gi, "").trim();
    }

    res.json({
      success: true,
      generatedEmail: body,
      subject: subject,
    });
  } catch (error) {
    res.status(500).json({
      error:
        "Errore API Gemini: " +
        (error.response?.data?.error?.message || error.message),
    });
  }
});

// POST /api/businesses/:id/send-email

// POST /api/businesses/:id/send-email
router.post("/:id/send-email", async (req, res) => {
  const { generatedEmail, toEmail, subject } = req.body;

  const db = getDb();
  const biz = db
    .prepare("SELECT is_blacklisted FROM businesses WHERE id = ?")
    .get(req.params.id);

  if (!biz) return res.status(404).json({ error: "Business not found" });

  if (biz.is_blacklisted) {
    return res.status(403).json({
      error:
        "Impossibile inviare: l'utente ha richiesto l'Opt-out (disiscrizione).",
    });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(400).json({
      error:
        "Credenziali email non configurate nel file .env. Aggiungi EMAIL_USER e EMAIL_PASS (Password per le app di Google).",
    });
  }

  if (!toEmail) {
    return res.status(400).json({
      error: "Indirizzo email del destinatario mancante o non valido.",
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: subject || "Richiesta di contatto",
      text: generatedEmail,
    };

    await transporter.sendMail(mailOptions);

    const db = getDb();
    db.prepare(
      "UPDATE businesses SET status = 'Inviata Mail' WHERE id = ?",
    ).run(req.params.id);

    res.json({ success: true, message: "Email inviata con successo!" });
  } catch (error) {
    console.error("Errore invio email:", error);
    res
      .status(500)
      .json({ error: "Errore durante l'invio dell'email: " + error.message });
  }
});

// POST /api/businesses/delete-batch
router.post("/delete-batch", (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: "ids must be an array" });
  }
  const db = getDb();
  const deleteStmt = db.prepare("DELETE FROM businesses WHERE id = ?");
  const deleteBatch = db.transaction((idsArr) => {
    for (const id of idsArr) deleteStmt.run(id);
  });
  deleteBatch(ids);
  res.json({ success: true, deleted: ids.length });
});

export default router;
