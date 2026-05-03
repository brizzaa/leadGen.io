// Upload massivo dell'export statico Next.js (out/) di pezzoli-demo su
// Cloudflare R2 sotto la chiave pezzoli/<path>. Il subdomainRouter Worker
// servirà i file su https://pezzoli.leader-gen.com.
//
// Uso:
//   node scripts/deployPezzoliDemo.js                            # default ../../pezzoli-demo/out
//   node scripts/deployPezzoliDemo.js --src /altro/path/out      # custom
//   node scripts/deployPezzoliDemo.js --slug pezzoli2            # subdomain diverso
//   node scripts/deployPezzoliDemo.js --concurrency 20           # default 10

import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { uploadObject } from "../src/services/cloudflareDeployer.js";
import { readdir, stat } from "fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

const arg = (k, def) => { const i = process.argv.indexOf(k); return i === -1 ? def : process.argv[i+1]; };
const SRC = resolve(arg("--src", resolve(__dirname, "../../../pezzoli-demo/out")));
const SLUG = arg("--slug", "pezzoli");
const CONCURRENCY = parseInt(arg("--concurrency", "3"), 10);
const MAX_RETRIES = 6;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".otf":  "font/otf",
  ".txt":  "text/plain; charset=utf-8",
  ".xml":  "application/xml; charset=utf-8",
  ".map":  "application/json",
};

function mimeFor(file) {
  const ext = file.slice(file.lastIndexOf("."));
  return MIME[ext] || "application/octet-stream";
}

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...await walk(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

async function main() {
  console.log(`Source:      ${SRC}`);
  console.log(`Subdomain:   https://${SLUG}.${process.env.CF_DOMAIN}`);
  console.log(`Concurrency: ${CONCURRENCY}`);

  await stat(SRC).catch(() => { console.error(`SRC non trovato: ${SRC}`); process.exit(1); });

  const files = await walk(SRC);
  console.log(`Files da uploadare: ${files.length}\n`);

  const startTs = Date.now();
  const stats = { ok: 0, failed: 0, totalBytes: 0 };
  let idx = 0;
  const failedSamples = [];

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= files.length) return;
      const file = files[i];
      const relPath = file.slice(SRC.length); // "/foo/bar.html"
      const key = `${SLUG}${relPath}`;
      const body = readFileSync(file);
      let lastErr = null;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          await uploadObject(key, body, mimeFor(file));
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          // Retry su 429 (rate limit) o 5xx con backoff esponenziale
          if (/(429|5\d\d)/.test(e.message)) {
            await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt) + Math.random() * 200));
            continue;
          }
          break; // 4xx non retentabili
        }
      }
      if (lastErr) {
        stats.failed++;
        if (failedSamples.length < 5) failedSamples.push(`${key} → ${lastErr.message.slice(0, 80)}`);
      } else {
        stats.ok++;
        stats.totalBytes += body.length;
        if (stats.ok % 200 === 0) {
          const pct = Math.round((stats.ok / files.length) * 100);
          console.log(`  [${pct}%] uploaded ${stats.ok}/${files.length}`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const elapsed = Math.round((Date.now() - startTs) / 1000);
  console.log("\n=== REPORT ===");
  console.log(`  Ok:      ${stats.ok}`);
  console.log(`  Failed:  ${stats.failed}`);
  console.log(`  Bytes:   ${(stats.totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Tempo:   ${elapsed}s`);
  if (failedSamples.length) {
    console.log("\n  Esempi falliti:");
    failedSamples.forEach(s => console.log("    " + s));
  }
  console.log(`\n  Live: https://${SLUG}.${process.env.CF_DOMAIN}`);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
