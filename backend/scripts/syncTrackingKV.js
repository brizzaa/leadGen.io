// Sincronizza aperture email da CF KV → SQLite locale.
// Uso: node scripts/syncTrackingKV.js
// Schedula con cron: 0 8 * * * (ogni mattina)

import "dotenv/config";
import axios from "axios";
import { getDb } from "../src/config/db.js";

const { CF_ACCOUNT_ID, CF_API_TOKEN } = process.env;
if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
  console.error("CF_ACCOUNT_ID / CF_API_TOKEN mancanti");
  process.exit(1);
}

const cf = axios.create({
  baseURL: "https://api.cloudflare.com/client/v4",
  headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
  validateStatus: () => true,
});

// Trova KV namespace ID
const nsRes = await cf.get(`/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces?per_page=100`);
const ns = nsRes.data?.result?.find(n => n.title === "leadgen-tracking");
if (!ns) { console.error("KV namespace 'leadgen-tracking' non trovato — esegui setupTracking.js"); process.exit(1); }
const nsId = ns.id;

// Lista tutte le chiavi (token)
let keys = [], cursor;
do {
  const params = { limit: 1000, ...(cursor ? { cursor } : {}) };
  const r = await cf.get(`/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${nsId}/keys`, { params });
  keys.push(...(r.data?.result || []));
  cursor = r.data?.result_info?.cursor;
} while (cursor);

console.log(`KV keys trovate: ${keys.length}`);

const db = getDb();
let updated = 0;

for (const key of keys) {
  const token = key.name;
  const valRes = await cf.get(`/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${nsId}/values/${token}`);
  if (valRes.status !== 200) continue;

  let data;
  try { data = typeof valRes.data === "string" ? JSON.parse(valRes.data) : valRes.data; }
  catch { continue; }

  const { count, first_open, last_open } = data;
  if (!count) continue;

  const row = db.prepare("SELECT id FROM email_tracking WHERE token = ?").get(token);
  if (!row) continue;

  db.prepare(`
    UPDATE email_tracking
    SET open_count = ?,
        opened_at = COALESCE(opened_at, ?)
    WHERE token = ?
  `).run(count, first_open, token);
  updated++;
}

console.log(`Aggiornati: ${updated}/${keys.length} token in SQLite`);
console.log(`[${new Date().toISOString()}] Sync completato`);
