import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Assicura che la cartella uploads esista
const uploadDir = path.join(__dirname, "../../uploads/documents");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Aggiunge un timestamp per evitare sovrascritture di file con lo stesso nome
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Servire i file statici
router.use("/download", express.static(uploadDir));

// GET /api/documents/:businessId — Ottiene i documenti per un business
router.get("/:businessId", (req, res) => {
  try {
    const db = getDb();
    const docs = db
      .prepare(
        "SELECT * FROM business_documents WHERE business_id = ? ORDER BY uploaded_at DESC",
      )
      .all(req.params.businessId);

    // Costruiamo l'URL di download pubblico
    const docsWithUrls = docs.map((d) => ({
      ...d,
      url: `/api/documents/download/${d.file_path}`,
    }));

    res.json(docsWithUrls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/documents/:businessId — Carica un nuovo documento per un business
router.post("/:businessId", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const db = getDb();
    const stmt = db.prepare(
      "INSERT INTO business_documents (business_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)",
    );

    const result = stmt.run(
      req.params.businessId,
      req.file.originalname,
      req.file.filename,
      req.file.mimetype,
      req.file.size,
    );

    // Registra nell'activity log
    const logStmt = db.prepare(
      "INSERT INTO activity_logs (business_id, type, message) VALUES (?, ?, ?)",
    );
    logStmt.run(
      req.params.businessId,
      "note",
      `Caricato documento: "${req.file.originalname}"`,
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      file_name: req.file.originalname,
      url: `/api/documents/download/${req.file.filename}`,
    });
  } catch (error) {
    // Pulizia file se errore DB
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/documents/:fileId — Rimuove un documento
router.delete("/:fileId", (req, res) => {
  try {
    const db = getDb();
    const doc = db
      .prepare("SELECT * FROM business_documents WHERE id = ?")
      .get(req.params.fileId);

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const filePath = path.join(uploadDir, doc.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.prepare("DELETE FROM business_documents WHERE id = ?").run(
      req.params.fileId,
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
