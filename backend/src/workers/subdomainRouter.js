// Cloudflare Worker: mappa sottodominio → oggetto R2
// Binding R2: SITES (bucket "leadgen-sites")
// Pattern: {slug}.leader-gen.com → R2 key "{slug}/index.html"

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

    const key = `${slug}${path}`;
    const obj = await env.SITES.get(key);

    if (!obj) {
      return new Response(`Not found: ${key}`, {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("cache-control", "public, max-age=300");

    if (!headers.get("content-type")) {
      if (key.endsWith(".html")) headers.set("content-type", "text/html; charset=utf-8");
      else if (key.endsWith(".css")) headers.set("content-type", "text/css");
      else if (key.endsWith(".js")) headers.set("content-type", "application/javascript");
      else if (key.endsWith(".png")) headers.set("content-type", "image/png");
      else if (key.endsWith(".jpg") || key.endsWith(".jpeg")) headers.set("content-type", "image/jpeg");
    }

    return new Response(obj.body, { headers });
  },
};
