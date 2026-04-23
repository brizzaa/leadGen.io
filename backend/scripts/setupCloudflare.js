import "dotenv/config";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  CF_ACCOUNT_ID,
  CF_ZONE_ID,
  CF_API_TOKEN,
  CF_DOMAIN,
  CF_R2_BUCKET,
  CF_WORKER_NAME,
} = process.env;

for (const [k, v] of Object.entries({ CF_ACCOUNT_ID, CF_ZONE_ID, CF_API_TOKEN, CF_DOMAIN, CF_R2_BUCKET, CF_WORKER_NAME })) {
  if (!v) { console.error(`Missing env ${k}`); process.exit(1); }
}

const api = axios.create({
  baseURL: "https://api.cloudflare.com/client/v4",
  headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
  validateStatus: () => true,
});

async function step(label, fn) {
  process.stdout.write(`→ ${label}... `);
  try {
    const r = await fn();
    console.log("✓");
    return r;
  } catch (e) {
    console.log("✗");
    console.error(`   ${e.message}`);
    if (e.response?.data) console.error(`   ${JSON.stringify(e.response.data).slice(0, 300)}`);
    throw e;
  }
}

function ok(r, label) {
  if (r.status >= 400 || r.data?.success === false) {
    const errs = r.data?.errors || [];
    const msg = errs.map(e => `${e.code}: ${e.message}`).join("; ") || r.statusText;
    throw new Error(`${label}: ${r.status} ${msg}`);
  }
  return r.data?.result;
}

// 1. R2 bucket
await step("Create R2 bucket", async () => {
  const r = await api.post(`/accounts/${CF_ACCOUNT_ID}/r2/buckets`, { name: CF_R2_BUCKET });
  if (r.data?.errors?.[0]?.code === 10004) return; // already exists
  ok(r, "r2 create");
});

// 2. Worker script upload (module syntax)
const workerPath = path.resolve(__dirname, "../src/workers/subdomainRouter.js");
const workerCode = fs.readFileSync(workerPath, "utf8");

await step("Upload Worker script", async () => {
  const metadata = {
    main_module: "worker.js",
    compatibility_date: "2024-11-01",
    bindings: [
      { type: "r2_bucket", name: "SITES", bucket_name: CF_R2_BUCKET },
      { type: "plain_text", name: "ROOT_DOMAIN", text: CF_DOMAIN },
    ],
  };

  const boundary = `----WorkerFormBoundary${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="metadata"; filename="metadata.json"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n` +
    `Content-Type: application/javascript+module\r\n\r\n` +
    `${workerCode}\r\n` +
    `--${boundary}--\r\n`;

  const r = await axios.put(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${CF_WORKER_NAME}`,
    body,
    {
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      validateStatus: () => true,
    }
  );
  ok(r, "worker upload");
});

// 3. DNS wildcard: *.leader-gen.com → AAAA 100:: (placeholder), Worker route cattura
//    In realtà CF usa "Custom Domain" su Worker per wildcard con SSL universal.
//    Alternativa più robusta: Worker Route *.leader-gen.com/*
await step("Create wildcard DNS record *.{domain} (proxied)", async () => {
  // Check existing
  const existing = await api.get(`/zones/${CF_ZONE_ID}/dns_records`, {
    params: { type: "AAAA", name: `*.${CF_DOMAIN}` },
  });
  ok(existing, "dns list");
  if (existing.data.result?.length > 0) return;

  const r = await api.post(`/zones/${CF_ZONE_ID}/dns_records`, {
    type: "AAAA",
    name: `*.${CF_DOMAIN}`,
    content: "100::",
    proxied: true,
    ttl: 1,
  });
  ok(r, "dns create");
});

// 4. Worker Route: *.leader-gen.com/*
await step("Create Worker route *.{domain}/*", async () => {
  const existing = await api.get(`/zones/${CF_ZONE_ID}/workers/routes`);
  ok(existing, "routes list");
  const hit = existing.data.result?.find(r => r.pattern === `*.${CF_DOMAIN}/*`);
  if (hit) return;

  const r = await api.post(`/zones/${CF_ZONE_ID}/workers/routes`, {
    pattern: `*.${CF_DOMAIN}/*`,
    script: CF_WORKER_NAME,
  });
  ok(r, "route create");
});

console.log("\n✅ Setup Cloudflare completo.");
console.log(`   R2 bucket:    ${CF_R2_BUCKET}`);
console.log(`   Worker:       ${CF_WORKER_NAME}`);
console.log(`   Route:        *.${CF_DOMAIN}/*`);
console.log(`   Test URL:     https://test.${CF_DOMAIN} (dopo upload di un oggetto test/index.html)`);
