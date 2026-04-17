import express from "express";
import { scanSocial, scanSocialBatch } from "../../services/socialScanner.js";
import * as repo from "../../services/businessRepository.js";
import { requireBusinessOwnership } from "../../middleware/requireBusinessOwnership.js";

const router = express.Router();

// GET /api/businesses/scan-social-batch (SSE)
router.get("/scan-social-batch", async (req, res) => {
  const { ids } = req.query;
  if (!ids) return res.status(400).json({ error: "ids are required" });

  const idList = ids.split(",").map((id) => parseInt(id, 10));
  const businesses = repo.findManyByIds(idList, req.userId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendProgress = (message) => {
    res.write(`data: ${JSON.stringify({ type: "progress", message })}\n\n`);
  };

  try {
    const resultsMap = await scanSocialBatch(businesses, sendProgress);
    repo.bulkUpdateSocials(idList, resultsMap);

    res.write(
      `data: ${JSON.stringify({ type: "done", message: "Scansione batch completata!", resultsFound: resultsMap.size })}\n\n`,
    );
    res.end();
  } catch (error) {
    console.error("[batch-social] Error:", error);
    res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
    res.end();
  }
});

// POST /api/businesses/:id/scan-social
router.post("/:id/scan-social", requireBusinessOwnership, async (req, res) => {
  const biz = req.business;
  try {
    console.log(`[social-scan] Scanning social for: ${biz.name} (${biz.area})`);
    const result = await scanSocial(biz);
    repo.updateSocials(req.params.id, req.userId, result);

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
    res.status(500).json({ error: "Errore durante la scansione social: " + error.message });
  }
});

export default router;
