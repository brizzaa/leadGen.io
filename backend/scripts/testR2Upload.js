import "dotenv/config";
import axios from "axios";

const { CF_ACCOUNT_ID, CF_API_TOKEN, CF_R2_BUCKET, CF_DOMAIN } = process.env;
const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>leader-gen test</title></head>
<body style="font-family:system-ui;max-width:600px;margin:40px auto;padding:20px">
<h1>R2 + Workers OK</h1>
<p>Ciao. Questo HTML vive su Cloudflare R2, servito da un Worker, su un sottodominio wildcard.</p>
<p>URL: test.${CF_DOMAIN}</p>
</body></html>`;

const r = await axios.put(
  `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${CF_R2_BUCKET}/objects/test/index.html`,
  HTML,
  {
    headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "text/html" },
    validateStatus: () => true,
  }
);
console.log("upload status:", r.status);
if (r.status >= 400) console.log(JSON.stringify(r.data).slice(0, 300));

console.log("\nTest fetch in 5s...");
await new Promise(r => setTimeout(r, 5000));

const resp = await axios.get(`https://test.${CF_DOMAIN}/`, { validateStatus: () => true });
console.log("fetch status:", resp.status);
console.log("body (first 200 chars):", String(resp.data).slice(0, 200));
