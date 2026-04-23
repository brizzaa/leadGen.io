import axios from "axios";

let _api;
function api() {
  if (_api) return _api;
  const { CF_ACCOUNT_ID, CF_API_TOKEN, CF_R2_TOKEN, CF_R2_BUCKET } = process.env;
  const token = CF_R2_TOKEN || CF_API_TOKEN;
  if (!CF_ACCOUNT_ID || !token || !CF_R2_BUCKET) {
    throw new Error("Missing CF_ACCOUNT_ID / CF_API_TOKEN (or CF_R2_TOKEN) / CF_R2_BUCKET in env");
  }
  _api = axios.create({
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${CF_R2_BUCKET}`,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
    maxBodyLength: 50 * 1024 * 1024,
  });
  return _api;
}

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomHash(len = 4) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let h = "";
  for (let i = 0; i < len; i++) h += chars[Math.floor(Math.random() * chars.length)];
  return h;
}

export function buildSlug(businessName) {
  const base = slugify(businessName) || "sito";
  return `${base}-${randomHash(4)}`;
}

export function siteUrl(slug) {
  return `https://${slug}.${process.env.CF_DOMAIN}`;
}

export async function uploadObject(key, body, contentType = "text/html; charset=utf-8") {
  const r = await api().put(`/objects/${encodeURI(key)}`, body, {
    headers: { "Content-Type": contentType },
  });
  if (r.status >= 400) {
    const msg = r.data?.errors?.[0]?.message || r.statusText;
    throw new Error(`R2 upload ${key}: ${r.status} ${msg}`);
  }
  return r.data?.result;
}

export async function deploySite(slug, html) {
  await uploadObject(`${slug}/index.html`, html);
  return { slug, url: siteUrl(slug) };
}

export async function deleteSite(slug) {
  const r = await api().delete(`/objects/${encodeURI(slug)}/index.html`);
  return r.status < 400;
}
