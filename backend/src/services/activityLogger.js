import { getDb } from "../config/db.js";

export function logActivity(businessId, type, message, meta = null) {
  try {
    getDb().prepare(
      "INSERT INTO activity_logs (business_id, type, message, meta) VALUES (?, ?, ?, ?)",
    ).run(businessId, type, message, meta ? JSON.stringify(meta) : null);
  } catch (e) {
    console.error("[activity-log] Error:", e.message);
  }
}
