import express from "express";
import * as repo from "../../services/businessRepository.js";
import { requireBusinessOwnership } from "../../middleware/requireBusinessOwnership.js";
import { logActivity } from "../../services/activityLogger.js";
import { generateEmail, GeminiNotConfiguredError } from "../../services/emailGenerator.js";
import { sendOutreachEmail, EmailCredentialsError } from "../../services/mailer.js";
import { scheduleFollowUps } from "../../services/followUpEngine.js";

const router = express.Router();

// GET /api/businesses/email-stats
router.get("/email-stats", (req, res) => {
  const stats = repo.findEmailStats(req.userId);
  const totalSent = stats.length;
  const totalOpened = stats.filter((s) => s.opened_at).length;

  res.json({
    total_sent: totalSent,
    total_opened: totalOpened,
    open_rate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
    recent: stats,
  });
});

// POST /api/businesses/:id/generate-email
router.post("/:id/generate-email", requireBusinessOwnership, async (req, res) => {
  const { type = "social_only" } = req.body;

  try {
    const { subject, body } = await generateEmail({ type, business: req.business });
    res.json({ success: true, generatedEmail: body, subject });
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return res.json({
        success: true,
        generatedEmail: `[OGGETTO]\nProposta di collaborazione\n[CORPO]\nCiao, sono interessato alla tua attività... (Configura API KEY per testo reale)`,
      });
    }
    res.status(500).json({
      error: "Errore API Gemini: " + (error.response?.data?.error?.message || error.message),
    });
  }
});

// POST /api/businesses/:id/send-email
router.post("/:id/send-email", async (req, res) => {
  const { generatedEmail, toEmail, subject } = req.body;
  const id = req.params.id;

  const blacklisted = repo.isBlacklisted(id, req.userId);
  if (blacklisted === null) {
    return res.status(404).json({ error: "Business not found" });
  }
  if (blacklisted) {
    return res.status(403).json({
      error: "Impossibile inviare: l'utente ha richiesto l'Opt-out (disiscrizione).",
    });
  }
  if (!toEmail) {
    return res.status(400).json({
      error: "Indirizzo email del destinatario mancante o non valido.",
    });
  }

  const { websiteUrl, screenshotUrl } = req.body;

  try {
    const { trackingToken } = await sendOutreachEmail({
      businessId: id,
      toEmail,
      subject,
      body: generatedEmail,
      businessName: req.business?.name,
      websiteUrl: websiteUrl || null,
      screenshotUrl: screenshotUrl || null,
    });

    repo.markEmailSent(id, req.userId);
    logActivity(id, "email", `Email inviata a: ${toEmail}`, { subject, toEmail, trackingToken });
    scheduleFollowUps(parseInt(id, 10), req.userId);

    res.json({ success: true, message: "Email inviata con successo!" });
  } catch (error) {
    if (error instanceof EmailCredentialsError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Errore invio email:", error);
    res.status(500).json({ error: "Errore durante l'invio dell'email: " + error.message });
  }
});

export default router;
