// Cloudflare Worker: tracking pixel per aperture email.
// Route: track.leader-gen.com/t/:token
// KV binding: TRACKING (namespace creato da setupTracking.js)

const GIF = Uint8Array.from([
  71,73,70,56,57,97,1,0,1,0,128,0,0,255,255,255,0,0,0,33,249,4,0,0,0,0,0,44,
  0,0,0,0,1,0,1,0,0,2,2,68,1,0,59,
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    // GET /t/:token — tracking pixel
    if (parts[0] === "t" && parts[1]) {
      const token = parts[1];
      try {
        const raw = await env.TRACKING.get(token);
        const data = raw ? JSON.parse(raw) : { count: 0, first_open: null, last_open: null };
        data.count += 1;
        data.last_open = new Date().toISOString();
        if (!data.first_open) data.first_open = data.last_open;
        await env.TRACKING.put(token, JSON.stringify(data), { expirationTtl: 60 * 60 * 24 * 90 });
      } catch {}
      return new Response(GIF, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
        },
      });
    }

    // GET /stats/:token — debug (opzionale)
    if (parts[0] === "stats" && parts[1]) {
      const raw = await env.TRACKING.get(parts[1]);
      return new Response(raw || "{}", { headers: { "Content-Type": "application/json" } });
    }

    return new Response("ok", { status: 200 });
  },
};
