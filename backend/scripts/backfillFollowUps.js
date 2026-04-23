// Back-fill follow-up per email già inviate senza schedulazione.
// Uso: node scripts/backfillFollowUps.js [campaign_id]

import "dotenv/config";
import { getDb } from "../src/config/db.js";
import { scheduleFollowUps } from "../src/services/followUpEngine.js";

const USER_ID = parseInt(process.env.FOLLOWUP_USER_ID || "3", 10);
const campaignFilter = process.argv[2] ? parseInt(process.argv[2], 10) : null;

const db = getDb();

const rows = db.prepare(`
  SELECT cr.business_id, cr.campaign_id
  FROM campaign_results cr
  WHERE cr.status = 'sent'
    ${campaignFilter ? "AND cr.campaign_id = ?" : ""}
    AND NOT EXISTS (SELECT 1 FROM follow_ups fu WHERE fu.business_id = cr.business_id)
`).all(...(campaignFilter ? [campaignFilter] : []));

console.log(`Business da back-fillare: ${rows.length}`);

let ok = 0;
for (const r of rows) {
  try {
    scheduleFollowUps(r.business_id, USER_ID);
    ok++;
  } catch (e) {
    console.warn(`biz ${r.business_id}: ${e.message}`);
  }
}

console.log(`Follow-up schedulati: ${ok}/${rows.length}`);
