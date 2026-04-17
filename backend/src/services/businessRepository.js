import { getDb } from "../config/db.js";
import { buildMobilePhoneSqlClause } from "../utils/phoneCountries.js";

export function findOwnedById(id, userId) {
  return getDb()
    .prepare("SELECT * FROM businesses WHERE id = ? AND user_id = ?")
    .get(id, userId);
}

export function findAllOwned(userId) {
  return getDb()
    .prepare("SELECT * FROM businesses WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId);
}

export function findManyByIds(ids, userId) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return getDb()
    .prepare(`SELECT * FROM businesses WHERE user_id = ? AND id IN (${placeholders})`)
    .all(userId, ...ids);
}

export function findFiltered(userId, filters) {
  const {
    area,
    category,
    noWebsite,
    fewReviews,
    facebookOnly,
    unclaimedOnly,
    mobileOnly,
    search,
    status,
    groupId,
  } = filters;

  const where = ["user_id = ?"];
  const params = [userId];

  if (status && status !== "Tutti") {
    where.push("status = ?");
    params.push(status);
  }
  if (groupId) {
    where.push("id IN (SELECT business_id FROM business_groups WHERE group_id = ?)");
    params.push(groupId);
  }
  if (area) {
    where.push("LOWER(area) LIKE ?");
    params.push(`%${area.toLowerCase()}%`);
  }
  if (category) {
    where.push("LOWER(category) LIKE ?");
    params.push(`%${category.toLowerCase()}%`);
  }
  if (isTrue(noWebsite)) {
    where.push('(website IS NULL OR website = "" OR website = "None")');
  }
  if (isTrue(fewReviews)) {
    where.push("(review_count IS NOT NULL AND review_count < 10)");
  }
  if (isTrue(facebookOnly)) {
    where.push("website LIKE '%facebook.com%'");
  }
  if (isTrue(unclaimedOnly)) {
    where.push("is_claimed = 0");
  }
  if (isTrue(mobileOnly)) {
    where.push(buildMobilePhoneSqlClause("phone"));
  }
  if (search) {
    where.push("(LOWER(name) LIKE ? OR LOWER(address) LIKE ?)");
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }

  const sql = `SELECT * FROM businesses WHERE ${where.join(" AND ")} ORDER BY created_at DESC`;
  return getDb().prepare(sql).all(...params);
}

export function findFollowUps(userId) {
  return getDb().prepare(`
    SELECT b.*,
      CASE
        WHEN b.next_contact <= date('now') THEN 'overdue'
        WHEN b.next_contact <= date('now', '+3 days') THEN 'upcoming'
        ELSE 'scheduled'
      END as follow_up_status
    FROM businesses b
    WHERE b.user_id = ?
      AND b.next_contact IS NOT NULL
      AND b.next_contact != ''
      AND b.status NOT IN ('Vinto (Cliente)', 'Perso')
    ORDER BY b.next_contact ASC
  `).all(userId);
}

export function findEmailStats(userId) {
  return getDb().prepare(`
    SELECT
      b.id, b.name, b.status,
      et.sent_at, et.opened_at, et.open_count
    FROM email_tracking et
    JOIN businesses b ON b.id = et.business_id
    WHERE b.user_id = ?
    ORDER BY et.sent_at DESC
    LIMIT 100
  `).all(userId);
}

export function updateField(id, userId, field, value) {
  return getDb()
    .prepare(`UPDATE businesses SET ${field} = ? WHERE id = ? AND user_id = ?`)
    .run(value, id, userId);
}

export function updateDetails(id, userId, { notes, next_contact }) {
  return getDb()
    .prepare("UPDATE businesses SET notes = ?, next_contact = ? WHERE id = ? AND user_id = ?")
    .run(notes, next_contact, id, userId);
}

export function toggleFollowUps(id, userId) {
  const db = getDb();
  const row = db.prepare("SELECT follow_ups_enabled FROM businesses WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) return null;
  const next = row.follow_ups_enabled ? 0 : 1;
  db.prepare("UPDATE businesses SET follow_ups_enabled = ? WHERE id = ? AND user_id = ?").run(next, id, userId);
  return { follow_ups_enabled: next };
}

export function updateStatus(id, userId, status) {
  return getDb()
    .prepare("UPDATE businesses SET status = ? WHERE id = ? AND user_id = ?")
    .run(status, id, userId);
}

export function getStatus(id, userId) {
  return getDb()
    .prepare("SELECT status FROM businesses WHERE id = ? AND user_id = ?")
    .get(id, userId);
}

export function markBlacklisted(id, userId) {
  return getDb().prepare(
    "UPDATE businesses SET is_blacklisted = 1, status = 'Perso', notes = IFNULL(notes || '\n', '') || '[GDPR] Richiesta disiscrizione/Opt-out' WHERE id = ? AND user_id = ?",
  ).run(id, userId);
}

export function unmarkBlacklisted(id, userId) {
  return getDb().prepare(
    "UPDATE businesses SET is_blacklisted = 0, notes = IFNULL(notes || '\n', '') || '[GDPR] Opt-out annullato manualmente' WHERE id = ? AND user_id = ?",
  ).run(id, userId);
}

export function deleteOwned(id, userId) {
  return getDb()
    .prepare("DELETE FROM businesses WHERE id = ? AND user_id = ?")
    .run(id, userId);
}

export function deleteManyOwned(ids, userId) {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM businesses WHERE id = ? AND user_id = ?");
  const tx = db.transaction((idList, uid) => {
    for (const id of idList) stmt.run(id, uid);
  });
  tx(ids, userId);
}

export function updateSocials(id, userId, { facebook_url, instagram_url, social_last_active }) {
  const db = getDb();
  const updates = [];
  const values = [];
  if (facebook_url) { updates.push("facebook_url = ?"); values.push(facebook_url); }
  if (instagram_url) { updates.push("instagram_url = ?"); values.push(instagram_url); }
  if (social_last_active) { updates.push("social_last_active = ?"); values.push(social_last_active); }
  updates.push("last_social_scan_at = CURRENT_TIMESTAMP");
  values.push(id, userId);
  return db
    .prepare(`UPDATE businesses SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`)
    .run(...values);
}

export function bulkUpdateSocials(idList, resultsMap) {
  const db = getDb();
  const markScanned = db.prepare(
    "UPDATE businesses SET last_social_scan_at = CURRENT_TIMESTAMP WHERE id = ?",
  );
  const updateRow = db.prepare(`
    UPDATE businesses
    SET facebook_url = ?, instagram_url = ?, social_last_active = ?
    WHERE id = ?
  `);
  const tx = db.transaction(() => {
    for (const id of idList) markScanned.run(id);
    for (const [id, r] of resultsMap) {
      updateRow.run(r.facebook_url, r.instagram_url, r.social_last_active, id);
    }
  });
  tx();
}

export function markEmailSent(id, userId) {
  return getDb()
    .prepare("UPDATE businesses SET status = 'Inviata Mail' WHERE id = ? AND user_id = ?")
    .run(id, userId);
}

export function isBlacklisted(id, userId) {
  const row = getDb()
    .prepare("SELECT is_blacklisted FROM businesses WHERE id = ? AND user_id = ?")
    .get(id, userId);
  return row ? Boolean(row.is_blacklisted) : null;
}

function isTrue(v) {
  return v === "true" || v === true;
}
