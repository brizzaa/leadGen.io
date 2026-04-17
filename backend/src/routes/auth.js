import express from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../config/db.js";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, name, company } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Email, password e nome sono obbligatori" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "La password deve avere almeno 6 caratteri" });
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ error: "Email già registrata" });
  }

  const hash = await bcrypt.hash(password, 10);
  const result = db.prepare(
    "INSERT INTO users (email, password_hash, name, company) VALUES (?, ?, ?, ?)"
  ).run(email.toLowerCase().trim(), hash, name.trim(), company?.trim() || null);

  const token = signToken(result.lastInsertRowid);
  res.status(201).json({
    token,
    user: { id: result.lastInsertRowid, email: email.toLowerCase().trim(), name: name.trim(), company: company?.trim() || null },
  });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email e password sono obbligatori" });
  }

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ error: "Credenziali non valide" });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Credenziali non valide" });
  }

  const token = signToken(user.id);
  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, company: user.company },
  });
});

// GET /api/auth/me — restituisce utente corrente
router.get("/me", requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare("SELECT id, email, name, company, created_at FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "Utente non trovato" });
  res.json({ user });
});

export default router;
