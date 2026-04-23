import express from "express";
import {
  makeSlug,
  deployToNetlify,
  generateWebsiteHtml,
  captureScreenshot,
  WEBSITE_STYLES,
  WEBSITE_ENGINES,
} from "../../services/landingPageBuilder.js";
import { requireBusinessOwnership } from "../../middleware/requireBusinessOwnership.js";

const router = express.Router();

// GET /api/businesses/website-styles
router.get("/website-styles", (_req, res) => {
  const toList = (obj) =>
    Object.entries(obj).map(([id, val]) => ({ id, label: val.label, description: val.desc }));
  res.json({ styles: toList(WEBSITE_STYLES), engines: toList(WEBSITE_ENGINES) });
});

// POST /api/businesses/:id/generate-website
router.post("/:id/generate-website", requireBusinessOwnership, async (req, res) => {
  const { style, engine } = req.body || {};
  try {
    const result = await generateWebsiteHtml(req.business, style || "auto", engine || "auto");
    res.json({ success: true, html: result.html, engine: result.engine });
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    console.error("[generate-website] Error:", msg);
    res.status(500).json({ error: "Errore generazione sito: " + msg });
  }
});

// POST /api/businesses/:id/publish-website
router.post("/:id/publish-website", requireBusinessOwnership, async (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: "html is required" });

  try {
    const slug = makeSlug(req.business.name);
    const [url, screenshotUrl] = await Promise.all([
      deployToNetlify(html, slug),
      captureScreenshot(html, slug).catch((e) => {
        console.warn("[screenshot] Failed:", e.message);
        return null;
      }),
    ]);
    res.json({ success: true, url, screenshotUrl });
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    console.error("[publish-website] Error:", msg);
    res.status(500).json({ error: "Errore pubblicazione Netlify: " + msg });
  }
});

export default router;
