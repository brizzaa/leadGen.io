// Cloudflare Worker: mappa sottodominio → oggetto R2
// Binding R2: SITES (bucket "leadgen-sites")
// Pattern: {slug}.leader-gen.com/{path} → R2 key "{slug}/{path}"
//
// Resolution rules (compatibili sia con i siti single-page generati dal builder
// che con export Next.js statici tipo `out/` con trailingSlash=true):
//   /                  → {slug}/index.html
//   /sub/              → {slug}/sub/index.html
//   /sub               → prova {slug}/sub, poi fallback {slug}/sub/index.html, poi {slug}/sub.html

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = request.headers.get("host") || url.hostname;

    const rootDomain = env.ROOT_DOMAIN || "leader-gen.com";
    const slug = host.replace(`.${rootDomain}`, "").replace(rootDomain, "");

    if (!slug || slug === host || slug === "www") {
      return new Response("leader-gen.com", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }

    let path = url.pathname;
    if (path === "/" || path === "") path = "/index.html";
    else if (path.endsWith("/")) path += "index.html";

    const tryKeys = [`${slug}${path}`];
    // Fallback per Next.js export: se path "/sub" non esiste come oggetto,
    // prova "/sub/index.html" e poi "/sub.html".
    if (!path.endsWith(".html") && !path.includes(".")) {
      tryKeys.push(`${slug}${path}/index.html`, `${slug}${path}.html`);
    }

    let obj = null;
    let foundKey = null;
    for (const k of tryKeys) {
      obj = await env.SITES.get(k);
      if (obj) { foundKey = k; break; }
    }

    if (!obj) {
      return new Response(`Not found: ${tryKeys.join(" | ")}`, {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("cache-control", "public, max-age=300");

    if (!headers.get("content-type")) {
      const key = foundKey;
      if (key.endsWith(".html")) headers.set("content-type", "text/html; charset=utf-8");
      else if (key.endsWith(".css")) headers.set("content-type", "text/css");
      else if (key.endsWith(".js") || key.endsWith(".mjs")) headers.set("content-type", "application/javascript");
      else if (key.endsWith(".json")) headers.set("content-type", "application/json");
      else if (key.endsWith(".png")) headers.set("content-type", "image/png");
      else if (key.endsWith(".jpg") || key.endsWith(".jpeg")) headers.set("content-type", "image/jpeg");
      else if (key.endsWith(".webp")) headers.set("content-type", "image/webp");
      else if (key.endsWith(".svg")) headers.set("content-type", "image/svg+xml");
      else if (key.endsWith(".ico")) headers.set("content-type", "image/x-icon");
      else if (key.endsWith(".woff2")) headers.set("content-type", "font/woff2");
      else if (key.endsWith(".woff")) headers.set("content-type", "font/woff");
      else if (key.endsWith(".txt")) headers.set("content-type", "text/plain; charset=utf-8");
      else if (key.endsWith(".xml")) headers.set("content-type", "application/xml; charset=utf-8");
    }

    return new Response(obj.body, { headers });
  },
};
