import express from "express";
import * as repo from "../../services/businessRepository.js";

const router = express.Router();

function updateSingleField(field, bodyKey = field) {
  return (req, res) => {
    const value = req.body[bodyKey];
    const result = repo.updateField(req.params.id, req.userId, field, value ?? null);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Business not found" });
    }
    res.json({ success: true, [bodyKey]: value });
  };
}

router.patch("/:id/email", updateSingleField("email"));
router.patch("/:id/phone", updateSingleField("phone"));
router.patch("/:id/website", updateSingleField("website"));
router.patch("/:id/vat", updateSingleField("vat_number"));

router.patch("/:id/details", (req, res) => {
  const { notes, next_contact } = req.body;
  const result = repo.updateDetails(req.params.id, req.userId, { notes, next_contact });
  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }
  res.json({ success: true, notes, next_contact });
});

router.patch("/:id/next-contact", (req, res) => {
  const { next_contact } = req.body;
  const result = repo.updateField(req.params.id, req.userId, "next_contact", next_contact ?? "");
  if (result.changes === 0) {
    return res.status(404).json({ error: "Business not found" });
  }
  res.json({ success: true, next_contact });
});

export default router;
