// Landing page renderer — 2 template premium, pure CSS, Lucide icons, responsive.
// Input: { biz, content, palette, images }
// biz:     { name, phone, email, area, category, fb_url, ig_url }
// content: { hero_title, hero_subtitle, tagline, about, services[], trust_points[],
//            faq[], services_intro, cta_text, process[], testimonials[] }

export const PALETTES = [
  { name: "warm",   primary: "#1A0F00", accent: "#C8820A", bg: "#FDFAF4", text: "#1A1A15", muted: "#7A7060" },
  { name: "forest", primary: "#0E2818", accent: "#C4A052", bg: "#F8F5EE", text: "#1A1A17", muted: "#7A7A6A" },
  { name: "ocean",  primary: "#0A1F2E", accent: "#1B7EA6", bg: "#F5F9FC", text: "#0F1E2A", muted: "#607080" },
  { name: "berry",  primary: "#1A0A28", accent: "#9D4EDD", bg: "#FAF7FE", text: "#1A1020", muted: "#72608A" },
  { name: "slate",  primary: "#111827", accent: "#C0392B", bg: "#F9FAFB", text: "#111827", muted: "#6B7280" },
];

export const TEMPLATES = ["editorial", "modern"];

export function esc(s) {
  return String(s || "").replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function hexToRgb(hex) {
  const h = (hex || "#000000").replace("#", "");
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

const LUCIDE = `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"><\/script>`;

function grain() {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`;
}

// ─── SHARED BLOCKS ─────────────────────────────────────────────

function ticker(content) {
  const kw = [
    ...(content.services || []).map(s => s.title),
    ...(content.trust_points || []).map(t => t.title),
    content.tagline,
  ].filter(Boolean);
  if (kw.length < 2) return "";
  const items = [...kw, ...kw].map(k =>
    `<span class="tk-item">${esc(k)}</span><span class="tk-sep">·</span>`
  ).join("");
  return `<div class="ticker" aria-hidden="true"><div class="ticker-track">${items}</div></div>`;
}

// "Come funziona" — 3-step process strip
function processSection(content) {
  const steps = (content.process || []).slice(0, 3);
  if (!steps.length) return "";
  return `<section class="process reveal">
  <div class="wrap">
    <div class="s-label"><span class="s-line"></span>Come funziona</div>
    <h2 class="process-h2">Tre passi per iniziare</h2>
    <div class="process-grid">
      ${steps.map((s, i) => `
      <div class="process-item" style="--i:${i}">
        <div class="process-num">${String(i + 1).padStart(2, "0")}</div>
        <div class="process-arrow"><i data-lucide="arrow-right"></i></div>
        <div class="process-title">${esc(s.title)}</div>
        <div class="process-desc">${esc(s.desc)}</div>
      </div>`).join("")}
    </div>
  </div>
</section>`;
}

// Testimonials with star ratings
function testimonialsSection(content, p) {
  const items = (content.testimonials || []).slice(0, 3);
  if (!items.length) return "";
  const stars = `<span class="stars" aria-label="5 stelle">★★★★★</span>`;
  const cards = items.map((t, i) => `
    <div class="t-card reveal" style="--i:${i}">
      ${stars}
      <p class="t-text">"${esc(t.text)}"</p>
      <div class="t-author">
        <div class="t-avatar">${esc((t.author || "?").slice(0, 1).toUpperCase())}</div>
        <div>
          <div class="t-name">${esc(t.author)}</div>
          ${t.role ? `<div class="t-role">${esc(t.role)}</div>` : ""}
        </div>
      </div>
    </div>`).join("");
  return `<section class="testimonials">
  <div class="wrap">
    <div class="s-label"><span class="s-line"></span>Recensioni</div>
    <h2 class="t-h2">Cosa dicono di noi</h2>
    <div class="t-grid">${cards}</div>
  </div>
</section>`;
}

// FAQ accordion
function faqBlock(items) {
  if (!items?.length) return "";
  const rows = items.map((f, i) => `
    <details class="faq-item">
      <summary class="faq-sum">
        <span class="faq-q">${esc(f.q)}</span>
        <span class="faq-icon" aria-hidden="true">+</span>
      </summary>
      <p class="faq-ans">${esc(f.a)}</p>
    </details>`).join("");
  return `<section class="faq-wrap reveal">
    <div class="wrap">
      <div class="s-label"><span class="s-line"></span>Domande frequenti</div>
      <h2 class="faq-h2">Hai domande?</h2>
      ${rows}
    </div>
  </section>`;
}

// Floating WhatsApp / phone bubble
function floatingCTA(biz) {
  const wa = biz.phone ? `https://wa.me/${biz.phone.replace(/\D/g, "")}` : null;
  if (!wa && !biz.phone) return "";
  const href = wa || `tel:${biz.phone}`;
  const icon = wa ? "message-circle" : "phone";
  const label = wa ? "WhatsApp" : "Chiama";
  return `<a href="${esc(href)}" class="float-cta" target="${wa ? "_blank" : "_self"}"
  rel="${wa ? "noopener" : ""}" title="${label}" aria-label="${label}">
  <i data-lucide="${icon}"></i>
</a>`;
}

// Social icon buttons
function socialBtns(biz) {
  const wa = biz.phone ? `https://wa.me/${biz.phone.replace(/\D/g, "")}` : null;
  return [
    biz.ig_url ? `<a href="${esc(biz.ig_url)}" class="s-btn" target="_blank" rel="noopener" title="Instagram"><i data-lucide="instagram"></i></a>` : "",
    biz.fb_url ? `<a href="${esc(biz.fb_url)}" class="s-btn" target="_blank" rel="noopener" title="Facebook"><i data-lucide="facebook"></i></a>` : "",
    wa         ? `<a href="${esc(wa)}" class="s-btn" target="_blank" rel="noopener" title="WhatsApp"><i data-lucide="message-circle"></i></a>` : "",
  ].join("");
}

function footer(biz, content) {
  const social = socialBtns(biz);
  return `<footer class="footer">
  <div class="footer-in">
    <div>
      <div class="footer-logo">${esc(biz.name)}</div>
      <p class="footer-tag">${esc(content.tagline || content.hero_subtitle || "")}</p>
      ${social ? `<div class="social-row">${social}</div>` : ""}
    </div>
    <div>
      <div class="footer-col-h">Contatti</div>
      ${biz.phone ? `<a href="tel:${esc(biz.phone)}" class="footer-link"><i data-lucide="phone"></i>${esc(biz.phone)}</a>` : ""}
      ${biz.email ? `<a href="mailto:${esc(biz.email)}" class="footer-link"><i data-lucide="mail"></i>${esc(biz.email)}</a>` : ""}
      ${biz.area  ? `<div class="footer-link"><i data-lucide="map-pin"></i>${esc(biz.area)}</div>` : ""}
    </div>
    <div>
      <div class="footer-col-h">Servizi</div>
      ${(content.services || []).slice(0, 5).map(s => `<div class="footer-link">${esc(s.title)}</div>`).join("")}
    </div>
  </div>
  <div class="footer-bot">
    <span class="footer-copy">© ${new Date().getFullYear()} ${esc(biz.name)}${biz.area ? ` · ${esc(biz.area)}` : ""}</span>
    ${social ? `<div class="social-row">${social}</div>` : ""}
  </div>
</footer>`;
}

// Disclaimer obbligatorio per i siti demo: dichiara la natura non-ufficiale
// del sito (i dati del business sono raccolti da fonti pubbliche senza
// consenso) e fornisce un canale di contatto per richiederne la rimozione.
// Inserito automaticamente al fondo di ogni template prima di SHARED_JS.
const DEMO_DISCLAIMER = `
<div style="position:fixed;bottom:0;left:0;right:0;background:#fffbe6;border-top:1px solid #d4a72c;padding:10px 16px;font:12px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#8b5a00;text-align:center;z-index:99999">
<strong>Sito demo dimostrativo</strong> — generato a scopo di valutazione, non affiliato con l'attività menzionata. Per richiederne la rimozione: <a href="mailto:l.brizzante@leader-gen.com" style="color:#8b5a00;text-decoration:underline">l.brizzante@leader-gen.com</a>.
</div>`;

// Shared JS injected at bottom of every template
const SHARED_JS = `
<script>
// Forza scroll top — impedisce browser scroll restoration e details[open] autoscroll
if (history.scrollRestoration) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// Lucide icons
lucide.createIcons();

// Scroll reveal with stagger
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const delay = (parseInt(e.target.style.getPropertyValue('--i') || 0)) * 100;
      setTimeout(() => e.target.classList.add('in'), delay);
      io.unobserve(e.target);
    }
  });
}, { threshold: .1 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Animated counters — runs when stats section enters viewport
const counterEls = document.querySelectorAll('[data-count]');
if (counterEls.length) {
  const countIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const isFloat = target % 1 !== 0;
      const dur = 1800;
      let start = null;
      function step(ts) {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = eased * target;
        el.textContent = (isFloat ? val.toFixed(1) : Math.floor(val)).toLocaleString('it-IT') + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      countIO.unobserve(el);
    });
  }, { threshold: .5 });
  counterEls.forEach(el => countIO.observe(el));
}

// Nav: add shadow on scroll
const nav = document.querySelector('.nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('nav-scrolled', window.scrollY > 40);
  }, { passive: true });
}

// FAQ: smooth height transition via max-height
document.querySelectorAll('.faq-item').forEach(det => {
  det.addEventListener('toggle', () => {
    if (det.open) det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
});
<\/script>`;

// ─── SHARED CSS BLOCKS ──────────────────────────────────────────

function sharedCSS(p, rgb, bgRgb) {
  return `
/* ── RESET & BASE ── */
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box }
html { background:var(--bg); color:var(--text); scroll-behavior:smooth; -webkit-font-smoothing:antialiased }
body::after { content:''; position:fixed; inset:0; background:${grain()};
              opacity:.022; pointer-events:none; z-index:9999 }
a { text-decoration:none; color:inherit }
img { display:block }
[data-lucide] { display:inline-block; vertical-align:middle; stroke-width:1.75; width:16px; height:16px }
.wrap { max-width:1160px; margin:0 auto; padding:0 40px }

/* ── TICKER ── */
@keyframes mq { from { transform:translateX(0) } to { transform:translateX(-50%) } }
.ticker { overflow:hidden; border-top:1px solid rgba(var(--rgb),.08);
          border-bottom:1px solid rgba(var(--rgb),.08); padding:15px 0; background:var(--bg) }
.ticker-track { display:flex; animation:mq 34s linear infinite; width:max-content }
.tk-item { margin:0 22px; font-size:.68rem; font-weight:600; letter-spacing:.13em;
           text-transform:uppercase; color:rgba(var(--rgb),.28); white-space:nowrap }
.tk-sep { color:var(--accent); opacity:.7; margin:0 2px }

/* ── LABELS ── */
.s-label { font-size:.67rem; font-weight:600; letter-spacing:.15em; text-transform:uppercase;
           color:var(--accent); display:flex; align-items:center; gap:12px; margin-bottom:20px }
.s-line { width:28px; height:1px; background:var(--accent); display:inline-block; flex-shrink:0 }

/* ── PROCESS ── */
.process { padding:80px 0; background:rgba(var(--rgb),.025) }
.process .wrap { }
.process-h2 { font-family:var(--fd); font-size:clamp(1.8rem,3.5vw,2.8rem); font-weight:400;
              color:var(--primary); letter-spacing:-.025em; margin-bottom:52px }
.process-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:2px;
                background:rgba(var(--rgb),.08) }
.process-item { background:var(--bg); padding:36px 32px; position:relative;
                opacity:0; transform:translateY(20px);
                transition:opacity .55s ease, transform .55s ease;
                transition-delay:calc(var(--i) * 110ms) }
.process-item.in { opacity:1; transform:translateY(0) }
.process-num { font-family:var(--fd); font-size:3.5rem; font-weight:300;
               color:rgba(var(--rgb),.1); line-height:1; margin-bottom:6px }
.process-arrow { color:var(--accent); margin-bottom:18px }
.process-arrow [data-lucide] { width:20px; height:20px; stroke:var(--accent); stroke-width:1.75 }
.process-title { font-family:var(--fd); font-size:1.3rem; font-weight:500;
                 color:var(--primary); margin-bottom:10px }
.process-desc { font-size:.87rem; line-height:1.85; color:var(--muted); font-weight:300 }
.process-item:hover { box-shadow:inset 0 2px 0 var(--accent) }

/* ── TESTIMONIALS ── */
.testimonials { padding:88px 0; background:var(--bg) }
.t-h2 { font-family:var(--fd); font-size:clamp(1.8rem,3.5vw,2.8rem); font-weight:400;
        color:var(--primary); letter-spacing:-.025em; margin-bottom:48px }
.t-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px }
.t-card { background:rgba(var(--rgb),.03); border:1px solid rgba(var(--rgb),.07);
          padding:36px 30px; display:flex; flex-direction:column; gap:16px;
          opacity:0; transform:translateY(20px);
          transition:opacity .55s ease, transform .55s ease, box-shadow .2s;
          transition-delay:calc(var(--i) * 110ms) }
.t-card.in { opacity:1; transform:translateY(0) }
.t-card:hover { box-shadow:0 8px 32px rgba(var(--rgb),.06) }
.stars { color:var(--accent); font-size:1.1rem; letter-spacing:2px }
.t-text { font-family:var(--fd); font-size:1.05rem; font-style:italic;
          line-height:1.7; color:var(--primary); flex:1 }
.t-author { display:flex; align-items:center; gap:12px; margin-top:8px }
.t-avatar { width:36px; height:36px; border-radius:50%; background:var(--accent);
            display:flex; align-items:center; justify-content:center;
            font-family:var(--fd); font-size:.9rem; font-weight:600; color:#fff; flex-shrink:0 }
.t-name { font-size:.87rem; font-weight:600; color:var(--primary) }
.t-role { font-size:.78rem; color:var(--muted) }

/* ── FAQ ── */
.faq-wrap { padding:80px 0 }
.faq-h2 { font-family:var(--fd); font-size:2.4rem; font-weight:400;
          color:var(--primary); margin-bottom:44px; letter-spacing:-.025em }
.faq-item { border-bottom:1px solid rgba(var(--rgb),.09); padding:22px 0 }
.faq-sum { display:flex; align-items:center; justify-content:space-between;
           cursor:pointer; list-style:none; gap:16px }
.faq-sum::-webkit-details-marker { display:none }
.faq-q { font-family:var(--fd); font-size:1.15rem; font-weight:500; color:var(--primary) }
.faq-icon { width:28px; height:28px; min-width:28px; border-radius:50%;
            background:var(--accent); color:#fff;
            display:flex; align-items:center; justify-content:center;
            font-size:1.2rem; line-height:1; transition:transform .28s }
details[open] .faq-icon { transform:rotate(45deg) }
.faq-ans { padding-top:14px; font-size:.9rem; line-height:1.85; color:var(--muted) }

/* ── CTA BAND ── */
.cta-band { background:var(--accent); padding:80px 40px; text-align:center }
.cta-h2 { font-family:var(--fd); font-size:clamp(2rem,4vw,3rem); font-weight:400;
          color:#fff; letter-spacing:-.02em; margin-bottom:12px }
.cta-sub { font-size:.95rem; color:rgba(255,255,255,.82); margin-bottom:36px;
           font-weight:300; line-height:1.75; max-width:480px; margin-left:auto; margin-right:auto }
.cta-buttons { display:flex; gap:14px; justify-content:center; flex-wrap:wrap }
.btn-w { display:inline-flex; align-items:center; gap:10px;
         padding:14px 30px; background:#fff; color:var(--accent);
         font-size:.78rem; font-weight:600; letter-spacing:.07em; text-transform:uppercase;
         transition:opacity .2s }
.btn-w:hover { opacity:.88 }
.btn-w [data-lucide] { stroke:var(--accent); width:15px; height:15px }
.btn-w2 { display:inline-flex; align-items:center; gap:10px;
          padding:14px 30px; border:1.5px solid rgba(255,255,255,.45); color:#fff;
          font-size:.78rem; font-weight:500; letter-spacing:.07em; text-transform:uppercase;
          transition:background .2s }
.btn-w2:hover { background:rgba(255,255,255,.12) }
.btn-w2 [data-lucide] { stroke:#fff; width:15px; height:15px }

/* ── FOOTER ── */
.footer { background:var(--primary); padding:52px 40px 28px }
.footer-in { max-width:1160px; margin:0 auto;
             display:grid; grid-template-columns:1.6fr 1fr 1fr; gap:40px;
             padding-bottom:32px; border-bottom:1px solid rgba(255,255,255,.07) }
.footer-logo { font-family:var(--fd); font-size:1.35rem; color:#fff; margin-bottom:10px }
.footer-tag { font-size:.82rem; line-height:1.75; color:rgba(255,255,255,.4);
              font-weight:300; margin-bottom:22px }
.footer-col-h { font-size:.64rem; font-weight:600; letter-spacing:.14em;
                text-transform:uppercase; color:rgba(255,255,255,.28); margin-bottom:18px }
.footer-link { display:flex; align-items:center; gap:10px;
               font-size:.84rem; color:rgba(255,255,255,.52); margin-bottom:13px;
               transition:color .2s }
.footer-link:hover { color:rgba(255,255,255,.9) }
.footer-link [data-lucide] { stroke:var(--accent); flex-shrink:0 }
.footer-bot { max-width:1160px; margin:0 auto; padding-top:22px;
              display:flex; justify-content:space-between; align-items:center }
.footer-copy { font-size:.72rem; color:rgba(255,255,255,.24) }
.social-row { display:flex; gap:10px }
.s-btn { width:34px; height:34px; border:1px solid rgba(255,255,255,.15);
         display:flex; align-items:center; justify-content:center;
         color:rgba(255,255,255,.55); transition:border-color .2s, color .2s }
.s-btn:hover { border-color:rgba(255,255,255,.4); color:rgba(255,255,255,.92) }
.s-btn [data-lucide] { stroke:currentColor; width:15px; height:15px }

/* ── FLOATING CTA (WhatsApp / Phone) ── */
@keyframes wa-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(37,211,102,.45) }
  50%       { box-shadow: 0 0 0 12px rgba(37,211,102,0) }
}
.float-cta { position:fixed; bottom:28px; right:28px; z-index:900;
             width:52px; height:52px; border-radius:50%;
             background:#25D366; color:#fff;
             display:flex; align-items:center; justify-content:center;
             box-shadow:0 4px 18px rgba(0,0,0,.22);
             animation:wa-pulse 2.4s ease-in-out infinite;
             transition:transform .2s }
.float-cta:hover { transform:scale(1.08) }
.float-cta [data-lucide] { stroke:#fff; width:24px; height:24px; stroke-width:2 }

/* ── SCROLL REVEAL ── */
.reveal { opacity:0; transform:translateY(22px);
          transition:opacity .65s ease, transform .65s ease }
.reveal.in { opacity:1; transform:translateY(0) }

/* ── RESPONSIVE ── */
@media (max-width:900px) {
  .process-grid { grid-template-columns:1fr }
  .t-grid { grid-template-columns:1fr 1fr }
  .footer-in { grid-template-columns:1fr 1fr }
}
@media (max-width:640px) {
  .wrap { padding:0 20px }
  .process-grid, .t-grid { grid-template-columns:1fr }
  .cta-band { padding:64px 20px }
  .cta-buttons { flex-direction:column; align-items:center }
  .btn-w, .btn-w2 { width:100%; justify-content:center; max-width:320px }
  .footer { padding:40px 20px 24px }
  .footer-in { grid-template-columns:1fr }
  .footer-bot { flex-direction:column; gap:16px; text-align:center }
  .float-cta { bottom:20px; right:20px; width:48px; height:48px }
}`;
}


// ════════════════════════════════════════════════════════════════
// TEMPLATE 1 — EDITORIAL
// Cormorant Garamond + DM Sans · full-bleed hero · layout asimmetrico
// ════════════════════════════════════════════════════════════════
export async function renderEditorial({ biz, content, palette: p, images }) {
  const img0 = images?.[0] || "";
  const img1 = images?.[1] || images?.[0] || "";
  const rgb   = hexToRgb(p.primary);
  const bgRgb = hexToRgb(p.bg);

  const services = (content.services || []).map((s, i) => `
    <div class="svc-item reveal" style="--i:${i}">
      <div class="svc-n">0${i + 1}</div>
      <div>
        <div class="svc-title">${esc(s.title)}</div>
        <div class="svc-desc">${esc(s.desc)}</div>
      </div>
    </div>`).join("");

  const trust = (content.trust_points || []).slice(0, 3).map((t, i) => {
    // Detect if title contains a number for animated counter
    const numMatch = t.title.match(/([\d.,]+)\s*(\+)?/);
    const numVal = numMatch ? parseFloat(numMatch[1].replace(/\./g, "").replace(",", ".")) : null;
    const suffix = numMatch?.[2] || "";
    return `
    <div class="trust-item reveal" style="--i:${i}">
      <div class="trust-num">
        ${numVal !== null
          ? `<span data-count="${numVal}" data-suffix="${esc(suffix)}">${esc(t.title)}</span>`
          : `<span>${esc(t.title)}</span>`}
      </div>
      <div class="trust-desc">${esc(t.desc)}</div>
    </div>`;
  }).join("");

  const ctaText = content.cta_text || "Contattaci oggi per saperne di più.";

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="googlebot" content="noindex,nofollow">
<title>${esc(biz.name)}${content.tagline ? ` — ${esc(content.tagline)}` : ""}</title>
<meta name="description" content="${esc(content.hero_subtitle || "")}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap" rel="stylesheet">
${LUCIDE}
<style>
:root {
  --primary: ${p.primary};
  --accent:  ${p.accent};
  --bg:      ${p.bg};
  --text:    ${p.text};
  --muted:   ${p.muted};
  --fd:      'Cormorant Garamond', Georgia, serif;
  --fb:      'DM Sans', system-ui, sans-serif;
  --rgb:     ${rgb};
  --bg-rgb:  ${bgRgb};
}
html { font-family:var(--fb) }
${sharedCSS(p, rgb, bgRgb)}

/* ── NAV (editorial) ── */
.nav { position:fixed; top:0; left:0; right:0; z-index:800; height:60px;
       background:rgba(var(--bg-rgb),.9); backdrop-filter:blur(16px);
       border-bottom:1px solid rgba(var(--rgb),.07);
       transition:box-shadow .3s }
.nav.nav-scrolled { box-shadow:0 2px 24px rgba(var(--rgb),.08) }
.nav-in { max-width:1160px; margin:0 auto; padding:0 40px; height:100%;
          display:flex; align-items:center; justify-content:space-between }
.nav-logo { font-family:var(--fd); font-size:1.1rem; font-weight:600;
            color:var(--primary); letter-spacing:-.02em }
.nav-cta { display:inline-flex; align-items:center; gap:8px;
           padding:8px 20px; background:var(--primary); color:#fff;
           font-size:.72rem; font-weight:500; letter-spacing:.08em; text-transform:uppercase;
           transition:opacity .2s }
.nav-cta:hover { opacity:.8 }
.nav-cta [data-lucide] { stroke:#fff }

/* ── HERO (editorial) ── */
.hero { min-height:100vh; display:flex; align-items:flex-end; position:relative;
        overflow:hidden; padding-top:60px }
.hero-bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover }
.hero-solid { position:absolute; inset:0; background:var(--primary) }
.hero-ov { position:absolute; inset:0;
           background:linear-gradient(160deg, rgba(0,0,0,.06) 0%, rgba(0,0,0,.74) 100%) }
.hero-c { position:relative; z-index:2; max-width:1160px; margin:0 auto;
          padding:0 40px 80px; width:100% }
.hero-badge { display:inline-flex; align-items:center; gap:8px;
              font-size:.68rem; font-weight:600; letter-spacing:.16em; text-transform:uppercase;
              color:rgba(255,255,255,.72); border:1px solid rgba(255,255,255,.2);
              padding:6px 16px; margin-bottom:28px }
.hero-dot { width:5px; height:5px; border-radius:50%; background:var(--accent) }
.hero h1 { font-family:var(--fd); font-size:clamp(2.8rem,6.5vw,6.2rem); font-weight:400;
           line-height:1; color:#fff; letter-spacing:-.03em;
           max-width:860px; margin-bottom:24px }
.hero-sub { font-size:1.05rem; line-height:1.85; color:rgba(255,255,255,.72);
            max-width:500px; font-weight:300; margin-bottom:44px }
.btn-row { display:flex; gap:14px; flex-wrap:wrap }

/* ── PRIMARY BUTTON with shimmer ── */
@keyframes shimmer {
  0%   { background-position: -200% center }
  100% { background-position: 200% center }
}
.btn-a {
  display:inline-flex; align-items:center; gap:10px;
  padding:14px 28px; color:#fff;
  font-size:.78rem; font-weight:500; letter-spacing:.07em; text-transform:uppercase;
  position:relative; overflow:hidden;
  background:linear-gradient(90deg, var(--accent) 0%, color-mix(in srgb,var(--accent) 80%,#fff) 50%, var(--accent) 100%);
  background-size:200% auto;
  animation:shimmer 3.5s linear infinite;
  transition:opacity .2s }
.btn-a:hover { opacity:.88 }
.btn-a [data-lucide] { stroke:#fff; width:15px; height:15px; flex-shrink:0 }
.btn-g { display:inline-flex; align-items:center; gap:10px;
         padding:14px 28px; background:rgba(255,255,255,.1); color:#fff;
         font-size:.78rem; font-weight:500; letter-spacing:.07em; text-transform:uppercase;
         border:1px solid rgba(255,255,255,.28); transition:background .2s }
.btn-g:hover { background:rgba(255,255,255,.2) }
.btn-g [data-lucide] { stroke:#fff; width:15px; height:15px }

/* ── SCROLL HINT ── */
@keyframes bounce-y { 0%,100% { transform:translateY(0) } 50% { transform:translateY(6px) } }
.scroll-hint { position:absolute; bottom:28px; left:50%; transform:translateX(-50%);
               z-index:3; display:flex; flex-direction:column; align-items:center; gap:6px;
               opacity:.6; animation:bounce-y 2s ease-in-out infinite }
.scroll-hint [data-lucide] { stroke:#fff; width:20px; height:20px }
.scroll-hint-label { font-size:.62rem; font-weight:500; letter-spacing:.12em;
                     text-transform:uppercase; color:#fff }

/* ── TRUST STRIP ── */
.trust { padding:56px 0; border-bottom:1px solid rgba(var(--rgb),.07) }
.trust-inner { max-width:1160px; margin:0 auto; padding:0 40px;
               display:grid; grid-template-columns:repeat(3,1fr) }
.trust-item { padding:0 28px; border-right:1px solid rgba(var(--rgb),.07); text-align:center }
.trust-item:last-child { border-right:none }
.trust-num { font-family:var(--fd); font-size:2.8rem; font-weight:300;
             color:var(--primary); letter-spacing:-.03em; line-height:1; margin-bottom:8px }
.trust-desc { font-size:.8rem; line-height:1.65; color:var(--muted); font-weight:400 }

/* ── SERVICES ── */
.svc-wrap { max-width:1160px; margin:0 auto; padding:88px 40px;
            display:grid; grid-template-columns:1fr 1.8fr; gap:88px; align-items:start }
.svc-stick { position:sticky; top:80px }
.svc-h2 { font-family:var(--fd); font-size:clamp(2rem,4vw,3.2rem); font-weight:400;
          color:var(--primary); letter-spacing:-.025em; line-height:1.05; margin-bottom:20px }
.svc-intro { font-size:.9rem; line-height:1.9; color:var(--muted); font-weight:300 }
.svc-area { margin-top:24px; font-size:.76rem; letter-spacing:.08em; text-transform:uppercase;
            color:var(--muted); display:flex; align-items:center; gap:8px }
.svc-area [data-lucide] { stroke:var(--accent) }
.svc-list { border-top:1px solid rgba(var(--rgb),.09) }
.svc-item { padding:30px 0; border-bottom:1px solid rgba(var(--rgb),.09);
            display:grid; grid-template-columns:52px 1fr; gap:18px; align-items:start;
            opacity:0; transform:translateY(18px);
            transition:opacity .55s ease, transform .55s ease;
            transition-delay:calc(var(--i) * 90ms) }
.svc-item.in { opacity:1; transform:translateY(0) }
.svc-n { font-family:var(--fd); font-size:2.4rem; font-weight:300;
         color:rgba(var(--rgb),.13); line-height:1 }
.svc-title { font-family:var(--fd); font-size:1.42rem; font-weight:500;
             color:var(--primary); margin-bottom:8px; line-height:1.2 }
.svc-desc { font-size:.87rem; line-height:1.85; color:var(--muted) }

/* ── ABOUT DARK ── */
.about { background:var(--primary); padding:88px 0 }
.about-in { max-width:1160px; margin:0 auto; padding:0 40px;
            display:grid; grid-template-columns:1fr 1fr; gap:72px; align-items:center }
.about-img-w { position:relative; overflow:hidden }
.about-img-w img { width:100%; height:420px; object-fit:cover;
                   transition:transform .6s ease }
.about-img-w:hover img { transform:scale(1.03) }
.about-img-w::after { content:''; position:absolute; top:0; left:0;
                      width:100%; height:3px;
                      background:linear-gradient(90deg,var(--accent),transparent) }
.about-img-ph { height:320px; background:rgba(255,255,255,.04);
                display:flex; align-items:center; justify-content:center;
                font-family:var(--fd); font-size:7rem; font-weight:700;
                color:rgba(255,255,255,.06) }
.about-quote { font-family:var(--fd); font-size:1.6rem; font-style:italic;
               color:rgba(255,255,255,.84); line-height:1.55; margin-bottom:20px }
.about-text { font-size:.9rem; line-height:1.9; color:rgba(255,255,255,.5);
              font-weight:300; margin-bottom:32px }
.btn-row-w { display:flex; gap:12px; flex-wrap:wrap }
.btn-acc { display:inline-flex; align-items:center; gap:8px;
           padding:12px 22px; background:var(--accent); color:#fff;
           font-size:.77rem; font-weight:500; letter-spacing:.07em; text-transform:uppercase;
           transition:opacity .2s }
.btn-acc:hover { opacity:.85 }
.btn-acc [data-lucide] { stroke:#fff; width:14px; height:14px }
.btn-wh { display:inline-flex; align-items:center; gap:8px;
          padding:12px 22px; border:1px solid rgba(255,255,255,.2); color:rgba(255,255,255,.75);
          font-size:.77rem; font-weight:500; letter-spacing:.07em; text-transform:uppercase;
          transition:background .2s }
.btn-wh:hover { background:rgba(255,255,255,.08) }
.btn-wh [data-lucide] { stroke:currentColor; width:14px; height:14px }

/* ── RESPONSIVE (editorial-specific) ── */
@media (max-width:900px) {
  .svc-wrap { grid-template-columns:1fr; gap:44px }
  .svc-stick { position:static }
  .about-in { grid-template-columns:1fr }
}
@media (max-width:640px) {
  .nav-in { padding:0 20px }
  .hero-c { padding:0 20px 60px }
  .hero h1 { font-size:2.4rem }
  .btn-row { flex-direction:column }
  .btn-a, .btn-g { width:100%; justify-content:center }
  .trust-inner { grid-template-columns:1fr; gap:0; padding:0 20px }
  .trust-item { border-right:none; border-bottom:1px solid rgba(var(--rgb),.07);
                padding:24px 0 }
  .trust-item:last-child { border-bottom:none }
  .svc-wrap { padding:60px 20px }
  .about-in { padding:0 20px }
  .about-img-w img { height:260px }
}
</style>
</head>
<body>

<nav class="nav">
  <div class="nav-in">
    <div class="nav-logo">${esc(biz.name)}</div>
    ${biz.phone ? `<a href="tel:${esc(biz.phone)}" class="nav-cta">
      <i data-lucide="phone"></i>${esc(biz.phone)}</a>` : ""}
  </div>
</nav>

<section class="hero">
  ${img0 ? `<img src="${esc(img0)}" alt="${esc(biz.name)}" class="hero-bg">` : `<div class="hero-solid"></div>`}
  <div class="hero-ov"></div>
  <div class="hero-c">
    <div class="hero-badge">
      <span class="hero-dot"></span>
      ${esc(content.tagline || biz.category || "")}
    </div>
    <h1>${esc(content.hero_title || biz.name)}</h1>
    <p class="hero-sub">${esc(content.hero_subtitle || "")}</p>
    <div class="btn-row">
      ${biz.phone ? `<a href="tel:${esc(biz.phone)}" class="btn-a">
        <i data-lucide="phone"></i>Chiama ora</a>` : ""}
      ${biz.email ? `<a href="mailto:${esc(biz.email)}" class="btn-g">
        <i data-lucide="mail"></i>Scrivici</a>` : ""}
    </div>
  </div>
  <div class="scroll-hint" aria-hidden="true">
    <i data-lucide="chevron-down"></i>
  </div>
</section>

${ticker(content)}

${trust ? `<section class="trust"><div class="trust-inner">${trust}</div></section>` : ""}

<section class="svc-wrap">
  <div class="svc-stick reveal">
    <div class="s-label"><span class="s-line"></span>Servizi</div>
    <h2 class="svc-h2">Cosa<br><em style="font-style:italic;color:var(--accent)">offriamo</em></h2>
    <p class="svc-intro">${esc(content.services_intro || content.about || "")}</p>
    ${biz.area ? `<div class="svc-area"><i data-lucide="map-pin"></i>${esc(biz.area)}</div>` : ""}
  </div>
  <div class="svc-list">${services}</div>
</section>

${processSection(content)}

<section class="about">
  <div class="about-in">
    <div class="about-img-w reveal">
      ${img1
        ? `<img src="${esc(img1)}" alt="${esc(biz.name)}">`
        : `<div class="about-img-ph">${esc((biz.area || biz.name || "").slice(0, 2).toUpperCase())}</div>`}
    </div>
    <div class="reveal">
      <div class="s-label" style="color:var(--accent)"><span class="s-line"></span>Chi siamo</div>
      <p class="about-quote">${esc(content.about || content.hero_subtitle || "")}</p>
      <div class="btn-row-w">
        ${biz.phone ? `<a href="tel:${esc(biz.phone)}" class="btn-acc"><i data-lucide="phone"></i>${esc(biz.phone)}</a>` : ""}
        ${biz.email ? `<a href="mailto:${esc(biz.email)}" class="btn-wh"><i data-lucide="mail"></i>Scrivici</a>` : ""}
      </div>
    </div>
  </div>
</section>

${testimonialsSection(content, p)}

${faqBlock(content.faq)}

<section class="cta-band reveal">
  <h2 class="cta-h2">Pronti a iniziare?</h2>
  <p class="cta-sub">${esc(ctaText)}</p>
  <div class="cta-buttons">
    ${biz.phone ? `<a href="tel:${esc(biz.phone)}" class="btn-w"><i data-lucide="phone"></i>Chiama ora</a>` : ""}
    ${biz.email ? `<a href="mailto:${esc(biz.email)}" class="btn-w2"><i data-lucide="mail"></i>Invia email</a>` : ""}
  </div>
</section>

${footer(biz, content)}
${floatingCTA(biz)}
${DEMO_DISCLAIMER}
${SHARED_JS}
</body>
</html>`;
}


// ════════════════════════════════════════════════════════════════
// TEMPLATE 2 — MODERN
// DM Serif Display + Outfit · split hero · card grid · bold contrast
// ════════════════════════════════════════════════════════════════
export async function renderModern({ biz, content, palette: p, images }) {
  const img0 = images?.[0] || "";
  const img1 = images?.[1] || images?.[0] || "";
  const rgb   = hexToRgb(p.primary);
  const bgRgb = hexToRgb(p.bg);

  const cards = (content.services || []).map((s, i) => `
    <div class="card reveal" style="--i:${i}">
      <div class="card-num">0${i + 1}</div>
      <div class="card-title">${esc(s.title)}</div>
      <div class="card-desc">${esc(s.desc)}</div>
      <div class="card-arrow"><i data-lucide="arrow-right"></i></div>
    </div>`).join("");

  const trust = (content.trust_points || []).slice(0, 4).map((t, i) => {
    const numMatch = t.title.match(/([\d.,]+)\s*(\+)?/);
    const numVal = numMatch ? parseFloat(numMatch[1].replace(/\./g, "").replace(",", ".")) : null;
    const suffix = numMatch?.[2] || "";
    return `
    <div class="trust2-item reveal" style="--i:${i}">
      <i data-lucide="check-circle" class="trust2-icon"></i>
      <div>
        <div class="trust2-title">
          ${numVal !== null
            ? `<span data-count="${numVal}" data-suffix="${esc(suffix)}">${esc(t.title)}</span>`
            : esc(t.title)}
        </div>
        <div class="trust2-desc">${esc(t.desc)}</div>
      </div>
    </div>`;
  }).join("");

  const ctaText = content.cta_text || "Contattaci oggi per saperne di più.";

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="googlebot" content="noindex,nofollow">
<title>${esc(biz.name)}${content.tagline ? ` — ${esc(content.tagline)}` : ""}</title>
<meta name="description" content="${esc(content.hero_subtitle || "")}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
${LUCIDE}
<style>
:root {
  --primary: ${p.primary};
  --accent:  ${p.accent};
  --bg:      ${p.bg};
  --text:    ${p.text};
  --muted:   ${p.muted};
  --fd:      'DM Serif Display', Georgia, serif;
  --fb:      'Outfit', system-ui, sans-serif;
  --rgb:     ${rgb};
  --bg-rgb:  ${bgRgb};
}
html { font-family:var(--fb) }
${sharedCSS(p, rgb, bgRgb)}

/* ── NAV (modern) ── */
.nav { position:sticky; top:0; z-index:800; height:62px;
       background:rgba(var(--bg-rgb),.94); backdrop-filter:blur(16px);
       border-bottom:1px solid rgba(var(--rgb),.09);
       transition:box-shadow .3s }
.nav.nav-scrolled { box-shadow:0 2px 20px rgba(var(--rgb),.07) }
.nav-in { max-width:1160px; margin:0 auto; padding:0 40px; height:100%;
          display:flex; align-items:center; justify-content:space-between }
.nav-logo { font-family:var(--fd); font-size:1.1rem; color:var(--primary) }
.nav-right { display:flex; align-items:center; gap:16px }
.nav-phone { display:flex; align-items:center; gap:6px;
             font-size:.8rem; font-weight:500; color:var(--muted) }
.nav-phone [data-lucide] { stroke:var(--accent) }
.nav-cta { display:inline-flex; align-items:center; gap:8px;
           padding:8px 20px; background:var(--primary); color:#fff;
           font-size:.72rem; font-weight:500; letter-spacing:.08em; text-transform:uppercase;
           transition:opacity .2s }
.nav-cta:hover { opacity:.8 }

/* ── HERO (modern) ── */
.hero-wrap { max-width:1160px; margin:0 auto; padding:72px 40px 88px;
             display:grid; grid-template-columns:1fr 420px; gap:72px; align-items:center }
.hero-badge { display:inline-flex; align-items:center; gap:8px;
              font-size:.7rem; font-weight:500; letter-spacing:.14em; text-transform:uppercase;
              color:var(--accent); background:rgba(var(--rgb),.05);
              padding:6px 14px; margin-bottom:26px }
.hero-dot { width:5px; height:5px; border-radius:50%; background:var(--accent) }
.hero-wrap h1 { font-family:var(--fd); font-size:clamp(2.4rem,5.5vw,4.5rem); font-weight:400;
               line-height:1.04; color:var(--primary); letter-spacing:-.02em; margin-bottom:22px }
.hero-sub { font-size:1rem; line-height:1.85; color:var(--muted); font-weight:300;
            max-width:480px; margin-bottom:38px }
.btn-row { display:flex; gap:12px; flex-wrap:wrap }

/* ── PRIMARY BUTTON with shimmer ── */
@keyframes shimmer {
  0%   { background-position: -200% center }
  100% { background-position: 200% center }
}
.btn-p {
  display:inline-flex; align-items:center; gap:10px;
  padding:13px 24px; color:#fff;
  font-size:.78rem; font-weight:500; letter-spacing:.07em; text-transform:uppercase;
  background:linear-gradient(90deg, var(--primary) 0%, color-mix(in srgb,var(--primary) 75%,var(--accent)) 50%, var(--primary) 100%);
  background-size:200% auto;
  animation:shimmer 4s linear infinite;
  transition:opacity .2s }
.btn-p:hover { opacity:.85 }
.btn-p [data-lucide] { stroke:#fff; width:15px; height:15px }
.btn-o { display:inline-flex; align-items:center; gap:10px;
         padding:13px 24px; border:1.5px solid rgba(var(--rgb),.25); color:var(--primary);
         font-size:.78rem; font-weight:500; letter-spacing:.07em; text-transform:uppercase;
         transition:border-color .2s }
.btn-o:hover { border-color:var(--primary) }
.btn-o [data-lucide] { stroke:currentColor; width:15px; height:15px }

/* ── HERO IMAGE ── */
.hero-img-w { position:relative; overflow:hidden }
.hero-img-w img { width:100%; height:480px; object-fit:cover;
                  transition:transform .7s ease }
.hero-img-w:hover img { transform:scale(1.04) }
.hero-img-w::before { content:''; position:absolute; top:0; left:0;
                      width:3px; height:100%; background:var(--accent); z-index:1 }
.hero-img-ph { height:420px; background:var(--primary);
               display:flex; align-items:center; justify-content:center;
               font-family:var(--fd); font-size:8rem; font-weight:400;
               color:rgba(255,255,255,.06) }
.hero-location { position:absolute; bottom:0; right:0; background:var(--accent);
                 padding:10px 18px; font-size:.72rem; font-weight:600;
                 letter-spacing:.08em; text-transform:uppercase; color:#fff;
                 display:flex; align-items:center; gap:6px; z-index:1 }
.hero-location [data-lucide] { stroke:#fff; width:13px; height:13px }

/* ── TRUST 2×2 ── */
.trust2 { padding:56px 0; border-bottom:1px solid rgba(var(--rgb),.07) }
.trust2-inner { max-width:1160px; margin:0 auto; padding:0 40px;
                display:grid; grid-template-columns:repeat(2,1fr); gap:20px }
.trust2-item { display:flex; align-items:flex-start; gap:16px; padding:24px;
               background:rgba(var(--rgb),.025);
               opacity:0; transform:translateY(16px);
               transition:opacity .5s ease, transform .5s ease;
               transition-delay:calc(var(--i) * 90ms) }
.trust2-item.in { opacity:1; transform:translateY(0) }
.trust2-icon { stroke:var(--accent); width:22px; height:22px; flex-shrink:0; margin-top:2px }
.trust2-title { font-family:var(--fd); font-size:1.05rem; font-weight:400;
                color:var(--primary); margin-bottom:4px }
.trust2-desc { font-size:.82rem; line-height:1.65; color:var(--muted) }

/* ── SERVICE CARDS ── */
.svc-section { padding:88px 0 }
.svc-header { display:flex; align-items:flex-end; justify-content:space-between;
              margin-bottom:48px; gap:24px; flex-wrap:wrap }
.svc-h2 { font-family:var(--fd); font-size:clamp(2rem,4vw,3.2rem); font-weight:400;
          color:var(--primary); letter-spacing:-.02em }
.svc-intro-r { max-width:340px; font-size:.88rem; line-height:1.75;
               color:var(--muted); font-weight:300; text-align:right }
.card-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
             gap:2px; background:rgba(var(--rgb),.07) }
.card { background:var(--bg); padding:36px 32px; position:relative;
        display:flex; flex-direction:column; gap:12px;
        transition:box-shadow .25s, transform .25s;
        opacity:0; transform:translateY(18px);
        transition:opacity .5s ease, transform .5s ease, box-shadow .25s;
        transition-delay:calc(var(--i) * 90ms) }
.card.in { opacity:1; transform:translateY(0) }
.card:hover { box-shadow:0 10px 40px rgba(var(--rgb),.1); transform:translateY(-3px) }
.card-num { font-size:.68rem; font-weight:600; letter-spacing:.12em;
            text-transform:uppercase; color:var(--accent) }
.card-title { font-family:var(--fd); font-size:1.42rem; font-weight:400;
              color:var(--primary); line-height:1.2 }
.card-desc { font-size:.87rem; line-height:1.85; color:var(--muted); font-weight:300; flex:1 }
.card-arrow { margin-top:8px; color:var(--accent); opacity:0;
              transition:opacity .2s, transform .2s; transform:translateX(-6px) }
.card:hover .card-arrow { opacity:1; transform:translateX(0) }
.card-arrow [data-lucide] { stroke:var(--accent); width:18px; height:18px }

/* ── ABOUT SPLIT ── */
.about2 { background:var(--primary); padding:88px 0 }
.about2-in { max-width:1160px; margin:0 auto; padding:0 40px;
             display:grid; grid-template-columns:1.3fr 1fr; gap:72px; align-items:center }
.about2-h2 { font-family:var(--fd); font-size:clamp(1.8rem,3.5vw,2.8rem); font-weight:400;
             color:#fff; letter-spacing:-.02em; margin-bottom:20px; line-height:1.12 }
.about2-p { font-size:.9rem; line-height:1.9; color:rgba(255,255,255,.52);
            font-weight:300; margin-bottom:32px }
.about2-btns { display:flex; gap:12px; flex-wrap:wrap }
.btn-acc { display:inline-flex; align-items:center; gap:8px;
           padding:12px 22px; background:var(--accent); color:#fff;
           font-size:.77rem; font-weight:500; letter-spacing:.07em; text-transform:uppercase;
           transition:opacity .2s }
.btn-acc:hover { opacity:.85 }
.btn-acc [data-lucide] { stroke:#fff; width:14px; height:14px }
.btn-wh { display:inline-flex; align-items:center; gap:8px;
          padding:12px 22px; border:1px solid rgba(255,255,255,.2); color:rgba(255,255,255,.75);
          font-size:.77rem; font-weight:500; letter-spacing:.07em; text-transform:uppercase;
          transition:background .2s }
.btn-wh:hover { background:rgba(255,255,255,.08) }
.btn-wh [data-lucide] { stroke:currentColor; width:14px; height:14px }
.about2-img { overflow:hidden }
.about2-img img { width:100%; height:360px; object-fit:cover;
                  transition:transform .6s ease }
.about2-img:hover img { transform:scale(1.04) }
.about2-img-ph { height:320px; background:rgba(255,255,255,.04);
                 display:flex; align-items:center; justify-content:center;
                 font-family:var(--fd); font-size:7rem; color:rgba(255,255,255,.06) }

/* ── CONTACT SPLIT ── */
.contact { padding:88px 0 }
.contact-in { max-width:1160px; margin:0 auto; padding:0 40px;
              display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:start }
.contact-info { margin-top:28px; display:flex; flex-direction:column; gap:18px }
.contact-row { display:flex; align-items:center; gap:14px }
.contact-row [data-lucide] { stroke:var(--accent); flex-shrink:0; width:18px; height:18px }
.contact-label { font-size:.95rem; color:var(--primary); font-weight:500;
                 transition:color .2s }
a.contact-label:hover { color:var(--accent) }
.contact-box { background:var(--primary); padding:44px }
.contact-box-q { font-family:var(--fd); font-size:1.4rem; font-style:italic;
                 color:rgba(255,255,255,.82); line-height:1.5; margin-bottom:28px }
.contact-btns { display:flex; flex-direction:column; gap:12px }
.cbox-btn { display:flex; align-items:center; justify-content:space-between;
            padding:14px 20px; font-size:.82rem; font-weight:500;
            letter-spacing:.06em; text-transform:uppercase; transition:opacity .2s }
.cbox-btn [data-lucide] { stroke:currentColor; width:16px; height:16px }
.cbox-p { background:var(--accent); color:#fff }
.cbox-p:hover { opacity:.85 }
.cbox-s { background:rgba(255,255,255,.07); color:rgba(255,255,255,.75);
          border:1px solid rgba(255,255,255,.12) }
.cbox-s:hover { background:rgba(255,255,255,.13) }

/* ── RESPONSIVE (modern-specific) ── */
@media (max-width:900px) {
  .hero-wrap { grid-template-columns:1fr; gap:44px; padding-top:52px }
  .hero-img-w img { height:320px }
  .about2-in { grid-template-columns:1fr }
  .contact-in { grid-template-columns:1fr }
  .trust2-inner { grid-template-columns:1fr }
  .svc-header { flex-direction:column }
  .svc-intro-r { text-align:left; max-width:100% }
}
@media (max-width:640px) {
  .nav-in { padding:0 20px }
  .nav-phone { display:none }
  .hero-wrap { padding:40px 20px 60px }
  .hero-wrap h1 { font-size:2.4rem }
  .btn-row { flex-direction:column }
  .btn-p, .btn-o { width:100%; justify-content:center }
  .trust2 .trust2-inner { padding:0 20px }
  .svc-section .wrap { padding:0 20px }
  .about2-in { padding:0 20px }
  .contact-in { padding:0 20px }
  .about2-img img { height:260px }
}
</style>
</head>
<body>

<nav class="nav">
  <div class="nav-in">
    <div class="nav-logo">${esc(biz.name)}</div>
    <div class="nav-right">
      ${biz.phone ? `<a href="tel:${esc(biz.phone)}" class="nav-phone"><i data-lucide="phone"></i>${esc(biz.phone)}</a>` : ""}
      <a href="#contatti" class="nav-cta">Contattaci</a>
    </div>
  </div>
</nav>

<div class="hero-wrap">
  <div class="reveal">
    <div class="hero-badge"><span class="hero-dot"></span>${esc(content.tagline || biz.category || "")}</div>
    <h1>${esc(content.hero_title || biz.name)}</h1>
    <p class="hero-sub">${esc(content.hero_subtitle || "")}</p>
    <div class="btn-row">
      ${biz.phone ? `<a href="tel:${esc(biz.phone)}" class="btn-p"><i data-lucide="phone"></i>Chiama ora</a>` : ""}
      ${biz.email ? `<a href="mailto:${esc(biz.email)}" class="btn-o"><i data-lucide="mail"></i>Scrivici</a>` : ""}
    </div>
  </div>
  <div class="hero-img-w reveal">
    ${img0
      ? `<img src="${esc(img0)}" alt="${esc(biz.name)}">`
      : `<div class="hero-img-ph">${esc((biz.name || "").slice(0, 2).toUpperCase())}</div>`}
    ${biz.area ? `<div class="hero-location"><i data-lucide="map-pin"></i>${esc(biz.area)}</div>` : ""}
  </div>
</div>

${ticker(content)}

${trust ? `<section class="trust2"><div class="trust2-inner">${trust}</div></section>` : ""}

<section class="svc-section">
  <div class="wrap">
    <div class="svc-header reveal">
      <div>
        <div class="s-label"><span class="s-line"></span>Servizi</div>
        <h2 class="svc-h2">Quello che <em style="font-style:italic">facciamo</em></h2>
      </div>
      ${content.services_intro ? `<p class="svc-intro-r">${esc(content.services_intro)}</p>` : ""}
    </div>
    <div class="card-grid">${cards}</div>
  </div>
</section>

${processSection(content)}

<section class="about2">
  <div class="about2-in">
    <div class="reveal">
      <div class="s-label" style="color:var(--accent)"><span class="s-line"></span>Chi siamo</div>
      <h2 class="about2-h2">${esc(content.hero_title || biz.name)}</h2>
      <p class="about2-p">${esc(content.about || content.hero_subtitle || "")}</p>
      <div class="about2-btns">
        ${biz.phone ? `<a href="tel:${esc(biz.phone)}" class="btn-acc"><i data-lucide="phone"></i>${esc(biz.phone)}</a>` : ""}
        ${biz.email ? `<a href="mailto:${esc(biz.email)}" class="btn-wh"><i data-lucide="mail"></i>Email</a>` : ""}
      </div>
    </div>
    <div class="about2-img reveal">
      ${img1
        ? `<img src="${esc(img1)}" alt="${esc(biz.name)}">`
        : `<div class="about2-img-ph">${esc((biz.area || biz.name || "").slice(0, 2).toUpperCase())}</div>`}
    </div>
  </div>
</section>

${testimonialsSection(content, p)}

${faqBlock(content.faq)}

<section id="contatti" class="contact reveal">
  <div class="contact-in">
    <div>
      <div class="s-label"><span class="s-line"></span>Contatti</div>
      <h2 style="font-family:var(--fd);font-size:clamp(2rem,4vw,3rem);font-weight:400;
        color:var(--primary);letter-spacing:-.02em;margin-bottom:14px">Parliamone</h2>
      <p style="font-size:.92rem;line-height:1.8;color:var(--muted);font-weight:300">
        ${biz.area ? `Siamo a ${esc(biz.area)}.` : "Siamo qui per te."}
      </p>
      <div class="contact-info">
        ${biz.phone ? `<div class="contact-row"><i data-lucide="phone"></i>
          <a href="tel:${esc(biz.phone)}" class="contact-label">${esc(biz.phone)}</a></div>` : ""}
        ${biz.email ? `<div class="contact-row"><i data-lucide="mail"></i>
          <a href="mailto:${esc(biz.email)}" class="contact-label">${esc(biz.email)}</a></div>` : ""}
        ${biz.area  ? `<div class="contact-row"><i data-lucide="map-pin"></i>
          <span class="contact-label">${esc(biz.area)}</span></div>` : ""}
      </div>
    </div>
    <div class="contact-box">
      <p class="contact-box-q">${esc(content.tagline || ctaText)}</p>
      <div class="contact-btns">
        ${biz.phone ? `<a href="tel:${esc(biz.phone)}" class="cbox-btn cbox-p">
          Chiama ora<i data-lucide="arrow-right"></i></a>` : ""}
        ${biz.email ? `<a href="mailto:${esc(biz.email)}" class="cbox-btn cbox-s">
          Invia email<i data-lucide="arrow-right"></i></a>` : ""}
      </div>
    </div>
  </div>
</section>

<section class="cta-band reveal">
  <h2 class="cta-h2">Pronti a iniziare?</h2>
  <p class="cta-sub">${esc(ctaText)}</p>
  <div class="cta-buttons">
    ${biz.phone ? `<a href="tel:${esc(biz.phone)}" class="btn-w"><i data-lucide="phone"></i>Chiama ora</a>` : ""}
    ${biz.email ? `<a href="mailto:${esc(biz.email)}" class="btn-w2"><i data-lucide="mail"></i>Invia email</a>` : ""}
  </div>
</section>

${footer(biz, content)}
${floatingCTA(biz)}
${DEMO_DISCLAIMER}
${SHARED_JS}
</body>
</html>`;
}

export function pickTemplate(i) { return TEMPLATES[i % TEMPLATES.length]; }
export function pickPalette(i)  { return PALETTES[i % PALETTES.length]; }
export async function render(templateName, args) {
  if (templateName === "editorial") return renderEditorial(args);
  return renderModern(args);
}
