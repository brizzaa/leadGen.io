import express from "express";
import { getDb } from "../config/db.js";

const router = express.Router();

// GET /api/analytics/overview
router.get("/overview", (req, res) => {
  const db = getDb();
  const userId = req.userId;

  // Totale lead
  const { total } = db.prepare("SELECT COUNT(*) as total FROM businesses WHERE user_id = ?").get(userId);

  // Per status
  const byStatus = db.prepare(
    "SELECT status, COUNT(*) as count FROM businesses WHERE user_id = ? GROUP BY status"
  ).all(userId);

  // Lead questa settimana
  const { this_week } = db.prepare(
    "SELECT COUNT(*) as this_week FROM businesses WHERE user_id = ? AND created_at >= date('now', '-7 days')"
  ).get(userId);

  // Email stats
  const emailStats = db.prepare(`
    SELECT
      COUNT(*) as sent,
      SUM(CASE WHEN et.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened
    FROM email_tracking et
    JOIN businesses b ON b.id = et.business_id
    WHERE b.user_id = ?
  `).get(userId);

  // Campaigns
  const campaignStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(sent) as total_sent,
      SUM(failed) as total_failed
    FROM campaigns WHERE user_id = ?
  `).get(userId);

  // Conversioni (Vinto)
  const { conversions } = db.prepare(
    "SELECT COUNT(*) as conversions FROM businesses WHERE user_id = ? AND status = 'Vinto (Cliente)'"
  ).get(userId);

  // Top aree
  const topAreas = db.prepare(
    "SELECT area, COUNT(*) as count FROM businesses WHERE user_id = ? AND area IS NOT NULL GROUP BY area ORDER BY count DESC LIMIT 5"
  ).all(userId);

  // Top categorie
  const topCategories = db.prepare(
    "SELECT category, COUNT(*) as count FROM businesses WHERE user_id = ? AND category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 5"
  ).all(userId);

  // Lead score distribution
  const scoreDistribution = db.prepare(`
    SELECT
      SUM(CASE WHEN website IS NULL OR website = '' OR website = 'None' THEN 1 ELSE 0 END) as no_website,
      SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) as has_email,
      SUM(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 ELSE 0 END) as has_phone
    FROM businesses WHERE user_id = ?
  `).get(userId);

  // Attività recenti
  const recentActivity = db.prepare(`
    SELECT al.type, al.message, al.created_at, b.name as business_name
    FROM activity_logs al
    JOIN businesses b ON b.id = al.business_id
    WHERE b.user_id = ?
    ORDER BY al.created_at DESC
    LIMIT 10
  `).all(userId);

  res.json({
    total,
    this_week,
    conversions,
    conversion_rate: total > 0 ? Math.round((conversions / total) * 100) : 0,
    by_status: byStatus,
    email: {
      sent: emailStats.sent || 0,
      opened: emailStats.opened || 0,
      open_rate: emailStats.sent > 0 ? Math.round((emailStats.opened / emailStats.sent) * 100) : 0,
    },
    campaigns: {
      total: campaignStats.total || 0,
      completed: campaignStats.completed || 0,
      total_sent: campaignStats.total_sent || 0,
      total_failed: campaignStats.total_failed || 0,
    },
    top_areas: topAreas,
    top_categories: topCategories,
    data_quality: scoreDistribution,
    recent_activity: recentActivity,
  });
});

// GET /api/analytics/follow-ups — lista follow-up programmati
router.get("/follow-ups", (req, res) => {
  const db = getDb();
  const followUps = db.prepare(`
    SELECT fu.*, b.name, b.email, b.category, b.area
    FROM follow_ups fu
    JOIN businesses b ON b.id = fu.business_id
    WHERE fu.user_id = ?
    ORDER BY fu.scheduled_at ASC
    LIMIT 100
  `).all(req.userId);
  res.json(followUps);
});

// POST /api/analytics/follow-ups/:businessId/cancel — cancella follow-up per un business
router.post("/follow-ups/:businessId/cancel", (req, res) => {
  const db = getDb();
  const result = db.prepare(
    "UPDATE follow_ups SET status = 'cancelled' WHERE business_id = ? AND user_id = ? AND status = 'pending'"
  ).run(req.params.businessId, req.userId);
  res.json({ success: true, cancelled: result.changes });
});

export default router;
