import express from "express";
import { getDb } from "../db.js";

const router = express.Router();

// GET /api/groups
router.get("/", (req, res) => {
  try {
    const db = getDb();
    const groups = db.prepare("SELECT * FROM groups ORDER BY name ASC").all();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/groups
router.post("/", (req, res) => {
  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  try {
    const db = getDb();
    const result = db
      .prepare("INSERT INTO groups (name, description, color) VALUES (?, ?, ?)")
      .run(name, description, color || "#3b82f6");
    res.json({ id: result.lastInsertRowid, name, description, color });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/groups/:id
router.delete("/:id", (req, res) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM groups WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/businesses/:id/groups
router.get("/business/:businessId", (req, res) => {
  try {
    const db = getDb();
    const groups = db
      .prepare(
        `
      SELECT g.* FROM groups g
      JOIN business_groups bg ON g.id = bg.group_id
      WHERE bg.business_id = ?
    `,
      )
      .all(req.params.businessId);
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/businesses/:id/groups
router.post("/business/:businessId", (req, res) => {
  const { groupId } = req.body;
  try {
    const db = getDb();
    db.prepare(
      "INSERT OR IGNORE INTO business_groups (business_id, group_id) VALUES (?, ?)",
    ).run(req.params.businessId, groupId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/businesses/:id/groups/:groupId
router.delete("/business/:businessId/:groupId", (req, res) => {
  try {
    const db = getDb();
    db.prepare(
      "DELETE FROM business_groups WHERE business_id = ? AND group_id = ?",
    ).run(req.params.businessId, req.params.groupId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/groups/:id/batch-add
router.post("/:id/batch-add", (req, res) => {
  const { businessIds } = req.body;
  const groupId = req.params.id;

  if (!businessIds || !Array.isArray(businessIds)) {
    return res.status(400).json({ error: "businessIds array is required" });
  }

  try {
    const db = getDb();
    const insert = db.prepare(
      "INSERT OR IGNORE INTO business_groups (business_id, group_id) VALUES (?, ?)",
    );
    const transaction = db.transaction((ids) => {
      for (const id of ids) insert.run(id, groupId);
    });
    transaction(businessIds);
    res.json({ success: true, count: businessIds.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
