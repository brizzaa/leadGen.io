// Setup infrastruttura tracking: KV namespace + Worker + DNS + Route.
// Uso: node scripts/setupTracking.js
// Idempotente: rilancia senza problemi se già esiste.

import "dotenv/config";
import axios from "axios";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { CF_ACCOUNT_ID, CF_API_TOKEN, CF_ZONE_ID, CF_DOMAIN } = process.env;
if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !CF_ZONE_ID || !CF_DOMAIN) {
  console.error("Mancano CF_ACCOUNT_ID / CF_API_TOKEN / CF_ZONE_ID / CF_DOMAIN in .env");
  process.exit(1);
}

const cf = axios.create({
  baseURL: "https://api.cloudflare.com/client/v4",
  headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
  validateStatus: () => true,
});

const WORKER_NAME = "leadgen-tracking";
const KV_TITLE = "leadgen-tracking";
const SUBDOMAIN = "track";
const TRACK_DOMAIN = `${SUBDOMAIN}.${CF_DOMAIN}`;

// 1. Crea KV namespace
console.log("1. KV namespace...");
let kvId;
const kvList = await cf.get(`/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces?per_page=100`);
const existing = kvList.data?.result?.find(n => n.title === KV_TITLE);
if (existing) {
  kvId = existing.id;
  console.log(`   ✓ Già esiste: ${kvId}`);
} else {
  const kvRes = await cf.post(`/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces`, { title: KV_TITLE });
  if (kvRes.status >= 400) { console.error("KV fail:", kvRes.data); process.exit(1); }
  kvId = kvRes.data.result.id;
  console.log(`   ✓ Creato: ${kvId}`);
}

// 2. Deploy Worker con KV binding
console.log("2. Worker deploy...");
const workerScript = readFileSync(join(__dirname, "../src/workers/trackingPixel.js"), "utf8");
const metadata = {
  main_module: "worker.js",
  bindings: [{ type: "kv_namespace", name: "TRACKING", namespace_id: kvId }],
  compatibility_date: "2024-01-01",
};

const form = new FormData();
form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
form.append("worker.js", new Blob([workerScript], { type: "application/javascript+module" }), "worker.js");

const wRes = await axios.put(
  `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${WORKER_NAME}`,
  form,
  { headers: { Authorization: `Bearer ${CF_API_TOKEN}` }, validateStatus: () => true, maxBodyLength: 10 * 1024 * 1024 }
);
if (wRes.status >= 400) { console.error("Worker fail:", JSON.stringify(wRes.data?.errors)); process.exit(1); }
console.log("   ✓ Worker deployato");

// 3. DNS record: track.leader-gen.com → AAAA 100:: proxied
console.log("3. DNS record...");
const dnsRes = await cf.get(`/zones/${CF_ZONE_ID}/dns_records?name=${TRACK_DOMAIN}&type=AAAA`);
if (dnsRes.data?.result?.length > 0) {
  console.log("   ✓ DNS già esiste");
} else {
  const d = await cf.post(`/zones/${CF_ZONE_ID}/dns_records`, {
    type: "AAAA", name: SUBDOMAIN, content: "100::", proxied: true, ttl: 1,
  });
  if (d.status >= 400) console.warn("   ⚠ DNS:", JSON.stringify(d.data?.errors));
  else console.log("   ✓ DNS creato");
}

// 4. Worker route
console.log("4. Worker route...");
const routePattern = `${TRACK_DOMAIN}/*`;
const routeList = await cf.get(`/zones/${CF_ZONE_ID}/workers/routes`);
const existingRoute = routeList.data?.result?.find(r => r.pattern === routePattern);
if (existingRoute) {
  console.log("   ✓ Route già esiste");
} else {
  const r = await cf.post(`/zones/${CF_ZONE_ID}/workers/routes`, {
    pattern: routePattern, script: WORKER_NAME,
  });
  if (r.status >= 400) console.warn("   ⚠ Route:", JSON.stringify(r.data?.errors));
  else console.log("   ✓ Route creata");
}

console.log(`\n✓ Tracking live su: https://${TRACK_DOMAIN}/t/:token`);
console.log(`\nAggiungi al .env:\nBASE_URL=https://${TRACK_DOMAIN}`);
