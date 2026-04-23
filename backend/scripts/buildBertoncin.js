import "dotenv/config";
import nodemailer from "nodemailer";
import { deploySite, buildSlug, siteUrl } from "../src/services/cloudflareDeployer.js";

const SLUG = buildSlug("informa-fitness-nutrizione");
const URL  = siteUrl(SLUG);

const HTML = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Informa – Fitness e Nutrizione · Este (Pd)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,600;1,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<style>
:root{
  --c:  #F8F5EE;
  --gd: #0E2818;
  --gm: #1B4D2C;
  --gl: #2D7A47;
  --au: #C4A052;
  --al: #E8D5A3;
  --tx: #1A1A17;
  --mu: #7A7A6A;
  --bd: #E0DCD0;
  --wh: #FDFCF9;
  --fd: 'Cormorant Garamond',Georgia,serif;
  --fs: 'DM Sans',sans-serif;
}
*{margin:0;padding:0;box-sizing:border-box}
html{font-family:var(--fs);background:var(--c);color:var(--tx);scroll-behavior:smooth}
body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E");
  opacity:.022}

/* ── NAV ──────────────────────────────────────────── */
nav{position:fixed;top:0;left:0;right:0;z-index:800;height:64px;
  background:rgba(248,245,238,.93);backdrop-filter:blur(14px);
  border-bottom:1px solid var(--bd)}
.nav-w{max-width:1200px;margin:0 auto;padding:0 40px;height:100%;
  display:flex;align-items:center;justify-content:space-between}
.logo{font-family:var(--fd);font-size:1.3rem;font-weight:600;color:var(--gd);
  cursor:pointer;text-decoration:none;letter-spacing:-.02em}
.logo em{font-style:italic;color:var(--gl)}
.nav-menu{display:flex;gap:0;list-style:none}
.nav-menu a{display:block;padding:8px 16px;font-size:.75rem;font-weight:400;
  letter-spacing:.09em;text-transform:uppercase;color:var(--mu);text-decoration:none;
  position:relative;transition:color .2s;cursor:pointer}
.nav-menu a::after{content:'';position:absolute;bottom:0;left:16px;right:16px;
  height:1.5px;background:var(--gl);transform:scaleX(0);transition:transform .3s ease}
.nav-menu a:hover,.nav-menu a.active{color:var(--gd)}
.nav-menu a:hover::after,.nav-menu a.active::after{transform:scaleX(1)}
.nav-btn{padding:9px 22px;background:var(--gd);color:var(--wh);font-size:.75rem;
  font-weight:500;letter-spacing:.07em;text-transform:uppercase;text-decoration:none;
  transition:background .2s}
.nav-btn:hover{background:var(--gm)}
@media(max-width:768px){.nav-menu{display:none}.nav-w{padding:0 20px}}

/* ── ROUTER ───────────────────────────────────────── */
.page{display:none;min-height:calc(100vh - 64px);padding-top:64px;
  animation:pu .4s ease both}
.page.on{display:block}
@keyframes pu{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}

/* ── SHARED ───────────────────────────────────────── */
.w{max-width:1200px;margin:0 auto;padding:0 40px}
@media(max-width:768px){.w{padding:0 20px}}
.tag{font-size:.7rem;font-weight:500;letter-spacing:.15em;text-transform:uppercase;
  color:var(--au);display:flex;align-items:center;gap:10px;margin-bottom:18px}
.tag::before{content:'';width:28px;height:1px;background:var(--au)}
.h1{font-family:var(--fd);font-size:clamp(3rem,6vw,5rem);font-weight:400;
  line-height:1.0;color:var(--gd);letter-spacing:-.03em}
.h1 em{font-style:italic;color:var(--gl)}
.h2{font-family:var(--fd);font-size:clamp(2rem,4vw,3.2rem);font-weight:400;
  line-height:1.05;color:var(--gd);letter-spacing:-.025em}
.h2 em{font-style:italic;color:var(--gl)}
.lead{font-size:1rem;line-height:1.85;color:var(--mu);font-weight:300;max-width:520px}
.rule{border:none;border-top:1px solid var(--bd)}
.btn{display:inline-flex;align-items:center;gap:10px;padding:13px 26px;
  font-size:.78rem;font-weight:500;letter-spacing:.07em;text-transform:uppercase;
  text-decoration:none;transition:all .2s;cursor:pointer;border:none;font-family:var(--fs)}
.btn-dark{background:var(--gd);color:var(--wh)}.btn-dark:hover{background:var(--gm);gap:14px}
.btn-out{background:transparent;color:var(--gd);border:1.5px solid var(--bd)}
.btn-out:hover{border-color:var(--gd);gap:13px}
.btn-gold{background:var(--au);color:var(--gd)}.btn-gold:hover{background:#d4b062}

/* ── HOME ─────────────────────────────────────────── */
.hero{padding:80px 40px 96px;max-width:1200px;margin:0 auto;position:relative}
@media(max-width:768px){.hero{padding:48px 20px 64px}}
.hero-ghost{position:absolute;right:24px;top:48px;font-family:var(--fd);
  font-size:16rem;font-weight:700;color:var(--gd);opacity:.028;line-height:1;
  pointer-events:none;user-select:none}
@media(max-width:900px){.hero-ghost{display:none}}
.hero-layout{display:grid;grid-template-columns:1fr 360px;gap:64px;align-items:end}
@media(max-width:900px){.hero-layout{grid-template-columns:1fr;gap:40px}}
.hero-h1{margin-bottom:28px}
.hero-p{margin-bottom:38px}
.hero-actions{display:flex;align-items:center;gap:20px;flex-wrap:wrap}

.hero-card{background:var(--gd);padding:36px;position:relative;overflow:hidden}
.hero-card::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;
  height:180px;border-radius:50%;background:var(--gl);opacity:.12}
.hero-card-title{font-family:var(--fd);font-size:.95rem;font-style:italic;
  color:var(--al);margin-bottom:24px;position:relative}
.stat-row{display:flex;align-items:center;justify-content:space-between;
  padding:14px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.stat-row:last-child{border-bottom:none}
.s-lbl{font-size:.72rem;letter-spacing:.07em;text-transform:uppercase;
  color:rgba(255,255,255,.4)}
.s-val{font-family:var(--fd);font-size:1.5rem;font-weight:600;color:var(--wh)}

.home-band{background:var(--wh);border-top:1px solid var(--bd);border-bottom:1px solid var(--bd)}
.home-band-inner{max-width:1200px;margin:0 auto;padding:0 40px;
  display:grid;grid-template-columns:repeat(4,1fr)}
@media(max-width:768px){.home-band-inner{grid-template-columns:1fr 1fr;padding:0 20px}}
.band-item{padding:44px 28px;border-right:1px solid var(--bd);cursor:pointer;
  transition:background .2s}
.band-item:last-child{border-right:none}
.band-item:hover{background:var(--c)}
.band-ico{font-size:1.4rem;margin-bottom:14px}
.band-name{font-family:var(--fd);font-size:1.25rem;font-weight:500;color:var(--gd);margin-bottom:6px}
.band-sub{font-size:.8rem;color:var(--mu);line-height:1.6}
.band-price{font-size:.75rem;font-weight:500;color:var(--au);margin-top:12px}

/* ── LUCIDE ───────────────────────────────────────── */
[data-lucide]{display:inline-block;vertical-align:middle}
.ico-band{width:28px;height:28px;stroke:var(--gl);stroke-width:1.5;margin-bottom:14px;display:block}
.ico-ct{width:18px;height:18px;stroke:var(--au);stroke-width:1.75;flex-shrink:0;margin-top:2px}
.ico-btn{width:16px;height:16px;stroke:currentColor;stroke-width:2;transition:transform .2s}
.btn:hover .ico-btn{transform:translateX(3px)}
.ico-social{width:15px;height:15px;stroke:currentColor;stroke-width:1.75}

.home-manifesto{max-width:1200px;margin:0 auto;padding:96px 40px}
@media(max-width:768px){.home-manifesto{padding:60px 20px}}
.manifesto-layout{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}
@media(max-width:768px){.manifesto-layout{grid-template-columns:1fr;gap:40px}}
.manifesto-visual{background:var(--gd);aspect-ratio:4/3;position:relative;overflow:hidden;
  display:flex;align-items:center;justify-content:center;flex-direction:column;padding:48px}
.manifesto-visual::before{content:'';position:absolute;top:0;left:0;width:100%;height:3px;
  background:linear-gradient(90deg,var(--au),transparent)}
.manifesto-ghost{font-family:var(--fd);font-size:9rem;font-weight:700;color:white;
  opacity:.05;position:absolute;bottom:-16px;right:10px;line-height:1;pointer-events:none}
.manifesto-q{font-family:var(--fd);font-size:1.55rem;font-style:italic;
  color:var(--al);text-align:center;line-height:1.45;position:relative;z-index:1}
.manifesto-attr{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;
  color:rgba(255,255,255,.25);margin-top:20px;text-align:center;position:relative;z-index:1}
.manifesto-text p{font-size:1rem;line-height:1.9;color:var(--mu);font-weight:300;
  margin-bottom:20px}

/* ── CHI SIAMO ────────────────────────────────────── */
.page-head{padding:72px 40px 0;max-width:1200px;margin:0 auto}
@media(max-width:768px){.page-head{padding:48px 20px 0}}
.cs-body{max-width:1200px;margin:0 auto;padding:56px 40px 80px}
@media(max-width:768px){.cs-body{padding:40px 20px 60px}}
.cs-layout{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:start}
@media(max-width:768px){.cs-layout{grid-template-columns:1fr;gap:40px}}
.dark-block{background:var(--gd);padding:44px;position:relative;overflow:hidden}
.dark-block::after{content:'"';font-family:var(--fd);font-size:11rem;color:white;
  opacity:.04;position:absolute;bottom:-20px;right:16px;line-height:1;pointer-events:none}
.dark-quote{font-family:var(--fd);font-size:1.45rem;font-style:italic;
  color:var(--al);line-height:1.5;position:relative;z-index:1}
.fact-list{list-style:none;margin-top:32px}
.fi{display:flex;gap:16px;padding:18px 0;border-bottom:1px solid var(--bd);align-items:flex-start}
.fi:first-child{border-top:1px solid var(--bd)}
.fi-n{font-family:var(--fd);font-size:1rem;font-weight:600;color:var(--au);
  width:26px;flex-shrink:0;line-height:1.7}
.fi-t{font-size:.9rem;line-height:1.75;color:var(--mu)}
.coll-box{border:1px solid var(--bd);padding:28px;margin-top:32px}
.coll-label{font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--au);margin-bottom:16px;display:flex;align-items:center;gap:10px}
.coll-label::before{content:'';width:22px;height:1px;background:var(--au)}
.coll-item{font-size:.87rem;line-height:1.75;color:var(--mu);
  padding:10px 0;border-bottom:1px solid var(--bd);
  display:flex;align-items:flex-start;gap:10px}
.coll-item:last-child{border-bottom:none}
.coll-item::before{content:'—';color:var(--au);flex-shrink:0}

/* ── TEAM ─────────────────────────────────────────── */
.team-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:2px;
  background:var(--bd);margin-top:60px}
@media(max-width:768px){.team-grid{grid-template-columns:1fr}}
.tc{background:var(--wh);padding:48px;position:relative;overflow:hidden;
  transition:background .25s}
.tc:hover{background:var(--c)}
.tc.feat{background:var(--gd)}.tc.feat:hover{background:var(--gm)}
.tc-init{font-family:var(--fd);font-size:3rem;font-weight:700;color:var(--gd);
  opacity:.06;position:absolute;top:20px;right:28px;line-height:1;pointer-events:none}
.tc.feat .tc-init{color:white;opacity:.05}
.tc-content{position:relative;z-index:1}
.tc-tag{font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--au);margin-bottom:14px}
.tc.feat .tc-tag{color:var(--al)}
.tc-name{font-family:var(--fd);font-size:2rem;font-weight:500;color:var(--gd);
  line-height:1.1;margin-bottom:8px}
.tc.feat .tc-name{color:var(--wh)}
.tc-role{font-size:.82rem;color:var(--mu);line-height:1.6;margin-bottom:20px}
.tc.feat .tc-role{color:rgba(255,255,255,.45)}
.tc-albo{display:inline-block;font-size:.7rem;letter-spacing:.06em;
  border:1px solid var(--au);color:var(--au);padding:4px 12px;margin-bottom:22px}
.tc.feat .tc-albo{border-color:var(--al);color:var(--al)}
.tc-studi{font-size:.82rem;line-height:1.7;color:var(--mu);margin-bottom:20px}
.tc.feat .tc-studi{color:rgba(255,255,255,.5)}
.tc-certs h5{font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--mu);margin-bottom:12px}
.tc.feat .tc-certs h5{color:rgba(255,255,255,.3)}
.tc-tags{display:flex;flex-wrap:wrap;gap:6px;list-style:none}
.tc-tags li{font-size:.7rem;padding:3px 10px;background:rgba(196,160,82,.1);color:var(--mu)}
.tc.feat .tc-tags li{background:rgba(255,255,255,.07);color:rgba(255,255,255,.55)}

/* ── SERVIZI ──────────────────────────────────────── */
.sv-list{margin-top:60px}
.sv-row{display:grid;grid-template-columns:68px 1fr auto;gap:36px;
  align-items:start;padding:48px 0;border-bottom:1px solid var(--bd);
  transition:padding-left .3s}
.sv-row:first-child{border-top:1px solid var(--bd)}
.sv-row:hover{padding-left:14px}
@media(max-width:768px){
  .sv-row{grid-template-columns:1fr;gap:14px;padding:32px 0}
  .sv-row:hover{padding-left:0}
}
.sv-num{font-family:var(--fd);font-size:2.8rem;font-weight:300;color:var(--bd);line-height:1}
.sv-name{font-family:var(--fd);font-size:1.75rem;font-weight:500;color:var(--gd);margin-bottom:10px}
.sv-desc{font-size:.88rem;line-height:1.85;color:var(--mu);max-width:520px;font-weight:300}
.sv-side{text-align:right;flex-shrink:0}
@media(max-width:768px){.sv-side{text-align:left}}
.sv-price{font-family:var(--fd);font-size:2rem;font-weight:600;color:var(--gd);
  white-space:nowrap;margin-bottom:14px}

/* ── PACCHETTI ────────────────────────────────────── */
.pk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;
  background:var(--bd);margin-top:60px}
@media(max-width:900px){.pk-grid{grid-template-columns:1fr}}
.pk{background:var(--wh);padding:44px 36px;display:flex;
  flex-direction:column;position:relative;overflow:hidden}
.pk.hl{background:var(--gd)}
.pk-ghost{font-family:var(--fd);font-size:5rem;font-weight:700;
  color:var(--gd);opacity:.04;position:absolute;bottom:16px;right:20px;
  line-height:1;pointer-events:none}
.pk.hl .pk-ghost{color:white}
.pk-badge{display:inline-block;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--au);border:1px solid var(--au);padding:4px 12px;margin-bottom:22px;width:fit-content}
.pk.hl .pk-badge{color:var(--al);border-color:var(--al)}
.pk-name{font-family:var(--fd);font-size:2rem;font-weight:500;color:var(--gd);
  line-height:1.1;margin-bottom:14px}
.pk.hl .pk-name{color:var(--wh)}
.pk-desc{font-size:.87rem;line-height:1.85;color:var(--mu);font-weight:300;flex:1;margin-bottom:28px}
.pk.hl .pk-desc{color:rgba(255,255,255,.5)}
.pk-durate{display:flex;gap:6px;margin-bottom:28px;flex-wrap:wrap}
.dur{font-size:.75rem;font-weight:500;letter-spacing:.05em;padding:5px 12px;
  border:1px solid var(--bd);color:var(--gd)}
.pk.hl .dur{border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.65)}
.pk-btn{display:flex;align-items:center;justify-content:space-between;
  background:var(--gd);color:var(--wh);padding:14px 18px;text-decoration:none;
  font-size:.78rem;font-weight:500;letter-spacing:.07em;text-transform:uppercase;
  cursor:pointer;border:none;width:100%;position:relative;z-index:1;
  font-family:var(--fs);transition:background .2s}
.pk-btn:hover{background:var(--gm)}
.pk.hl .pk-btn{background:var(--au);color:var(--gd)}
.pk.hl .pk-btn:hover{background:#d4b062}

/* ── CONTATTI ─────────────────────────────────────── */
.ct-layout{display:grid;grid-template-columns:1fr 440px;min-height:calc(100vh - 64px)}
@media(max-width:900px){.ct-layout{grid-template-columns:1fr}}
.ct-left{padding:72px 60px 60px;display:flex;flex-direction:column;justify-content:space-between}
@media(max-width:768px){.ct-left{padding:40px 20px}}
.ct-info{margin-top:44px}
.ct-item{display:flex;gap:20px;padding:22px 0;border-bottom:1px solid var(--bd)}
.ct-item:first-child{border-top:1px solid var(--bd)}
.ct-ico{font-size:1rem;width:20px;flex-shrink:0;line-height:1.9;color:var(--au)}
.ct-lbl{font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:var(--au);margin-bottom:3px}
.ct-val{font-size:.93rem;color:var(--tx);line-height:1.6}
.ct-val a{color:inherit;text-decoration:none;transition:color .2s}
.ct-val a:hover{color:var(--gl)}
.social-row{display:flex;gap:10px;margin-top:36px;flex-wrap:wrap}
.s-btn{font-size:.72rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;
  color:var(--mu);text-decoration:none;padding:8px 16px;border:1px solid var(--bd);
  transition:all .2s}
.s-btn:hover{border-color:var(--gd);color:var(--gd)}

.ct-right{background:var(--gd);padding:72px 56px}
@media(max-width:768px){.ct-right{padding:40px 20px}}
.form-title{font-family:var(--fd);font-size:1.9rem;font-style:italic;
  color:var(--wh);margin-bottom:36px}
.fg{margin-bottom:22px}
.fl{display:block;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;
  color:rgba(255,255,255,.35);margin-bottom:7px}
.fi2,.fsel,.fta{width:100%;background:rgba(255,255,255,.055);
  border:1px solid rgba(255,255,255,.1);color:var(--wh);padding:11px 15px;
  font-size:.9rem;font-family:var(--fs);outline:none;transition:border-color .2s;
  -webkit-appearance:none;border-radius:0}
.fi2:focus,.fsel:focus,.fta:focus{border-color:var(--au)}
.fi2::placeholder{color:rgba(255,255,255,.22)}
.fsel option{background:var(--gd)}
.fta{resize:vertical;min-height:100px}
.fsub{width:100%;background:var(--au);color:var(--gd);border:none;
  padding:14px;font-size:.8rem;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;cursor:pointer;font-family:var(--fs);
  transition:background .2s;display:flex;align-items:center;justify-content:center;
  gap:10px;margin-top:6px}
.fsub:hover{background:#d4b062}

/* ── FOOTER ───────────────────────────────────────── */
footer{background:var(--gd);padding:28px 40px;border-top:1px solid rgba(255,255,255,.06)}
.ft-in{max-width:1200px;margin:0 auto;display:flex;
  align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.ft-logo{font-family:var(--fd);font-size:1.05rem;font-style:italic;color:var(--al)}
.ft-meta{font-size:.75rem;color:rgba(255,255,255,.28);text-align:center}
.ft-links{display:flex;gap:20px}
.ft-links a{font-size:.7rem;color:rgba(255,255,255,.35);text-decoration:none;
  letter-spacing:.07em;text-transform:uppercase;transition:color .2s;cursor:pointer}
.ft-links a:hover{color:rgba(255,255,255,.75)}
@media(max-width:768px){footer{padding:24px 20px}.ft-in{flex-direction:column;text-align:center}}
</style>
</head>
<body>

<!-- ═══ NAV ═══════════════════════════════════════════ -->
<nav>
  <div class="nav-w">
    <a class="logo" data-page="home">
      <img src="https://www.informalb.it/wp-content/uploads/2025/02/logo-25-3.webp"
        alt="Informa" style="height:32px;vertical-align:middle;margin-right:8px;filter:brightness(0) saturate(1) invert(22%) sepia(48%) saturate(600%) hue-rotate(100deg) brightness(90%)">
    </a>
    <ul class="nav-menu">
      <li><a data-page="home">Home</a></li>
      <li><a data-page="chi-siamo">Chi Siamo</a></li>
      <li><a data-page="team">Team</a></li>
      <li><a data-page="servizi">Servizi</a></li>
      <li><a data-page="pacchetti">Pacchetti</a></li>
      <li><a data-page="contatti">Contatti</a></li>
    </ul>
    <a href="tel:+393409751524" class="nav-btn">Prenota <i data-lucide="arrow-right" class="ico-btn"></i></a>
  </div>
</nav>

<!-- ═══ HOME ═══════════════════════════════════════════ -->
<div class="page on" data-id="home">

  <div class="hero">
    <div class="hero-ghost">360°</div>
    <div class="hero-layout">
      <div>
        <div class="tag">Dal 2017 · Este, Padova</div>
        <h1 class="h1 hero-h1">Il tuo<br>benessere<br>a <em>360°</em></h1>
        <p class="lead hero-p">Un team di biologi nutrizionisti, personal trainer, chinesiologhi, osteopata e psicologa. Un percorso integrato costruito su di te — non su un programma standard.</p>
        <div class="hero-actions">
          <a href="tel:+393409751524" class="btn btn-dark"><i data-lucide="phone" class="ico-btn"></i> Chiama ora</a>
          <a class="btn btn-out" data-page="servizi">Scopri i servizi</a>
        </div>
      </div>
      <div style="position:relative;overflow:hidden">
        <img src="https://www.informalb.it/wp-content/uploads/2025/05/chi-siamo-team.webp"
          alt="Team Informa" style="width:100%;height:340px;object-fit:cover;display:block">
        <div style="position:absolute;bottom:0;left:0;right:0;padding:20px 24px;
          background:linear-gradient(transparent,rgba(14,40,24,.85))">
          <div style="font-family:var(--fd);font-style:italic;color:var(--al);font-size:.9rem">
            Il team Informa — Este (Pd)</div>
        </div>
      </div>
    </div>
  </div>

  <div class="home-band">
    <div class="home-band-inner">
      <div class="band-item" data-page="servizi">
        <i data-lucide="scale" class="ico-band"></i>
        <div class="band-name">BIA e Plicometria</div>
        <div class="band-sub">Analisi composizione corporea non invasiva</div>
        <div class="band-price">€ 70</div>
      </div>
      <div class="band-item" data-page="servizi">
        <i data-lucide="activity" class="ico-band"></i>
        <div class="band-name">Analisi HRV</div>
        <div class="band-sub">Sistema nervoso autonomo e recupero</div>
        <div class="band-price">€ 50</div>
      </div>
      <div class="band-item" data-page="servizi">
        <i data-lucide="clipboard-list" class="ico-band"></i>
        <div class="band-name">Anamnesi Motoria</div>
        <div class="band-sub">Valutazione funzionale in 3 fasi</div>
        <div class="band-price">€ 60</div>
      </div>
      <div class="band-item" data-page="servizi">
        <i data-lucide="dumbbell" class="ico-band"></i>
        <div class="band-name">Personal Training</div>
        <div class="band-sub">Sedute private da 60 minuti</div>
        <div class="band-price">da € 120</div>
      </div>
    </div>
  </div>

  <div class="home-manifesto">
    <div class="manifesto-layout">
      <div class="manifesto-visual" style="padding:0">
        <img src="https://www.informalb.it/wp-content/uploads/2025/05/img-intest-personal-trainer-1024x576.webp"
          alt="Personal Training Informa" style="width:100%;height:100%;object-fit:cover;display:block">
        <div style="position:absolute;inset:0;background:rgba(14,40,24,.55);display:flex;
          flex-direction:column;align-items:center;justify-content:center;padding:40px">
          <p class="manifesto-q">"Non un programma standard.<br>Un percorso costruito<br><em>su di te.</em>"</p>
          <p class="manifesto-attr">— La filosofia di Informa, dal 2017</p>
        </div>
      </div>
      <div class="manifesto-text">
        <div class="tag">La nostra filosofia</div>
        <h2 class="h2" style="margin-bottom:28px">Scienza applicata.<br><em>Risultati reali.</em></h2>
        <p>Informa nasce nel 2017 per offrire un servizio di alta qualità ad atleti e non. Ogni percorso è progettato da un team multidisciplinare che condivide i dati e lavora in sinergia.</p>
        <p>Biologi nutrizionisti e personal trainer collaborano insieme, adattando continuamente il piano ai tuoi progressi reali.</p>
        <div style="margin-top:32px;display:flex;gap:14px;flex-wrap:wrap">
          <a class="btn btn-dark" data-page="chi-siamo">Chi siamo →</a>
          <a class="btn btn-out" data-page="team">Il team</a>
        </div>
      </div>
    </div>
  </div>

  <footer>
    <div class="ft-in">
      <div class="ft-logo">informa fitness e nutrizione</div>
      <div class="ft-meta">Via degli Artigiani, 14 – Este (Pd) · P.IVA 05082910281 · © ${new Date().getFullYear()}</div>
      <div class="ft-links">
        <a data-page="contatti">Contatti</a>
        <a href="tel:+393409751524">+39 340 975 15 24</a>
      </div>
    </div>
  </footer>
</div>

<!-- ═══ CHI SIAMO ═══════════════════════════════════════ -->
<div class="page" data-id="chi-siamo">
  <div class="page-head">
    <div class="tag">Chi siamo</div>
    <h1 class="h1">Un team.<br>Un obiettivo.<br><em>Il tuo.</em></h1>
  </div>

  <div class="cs-body">
    <div class="cs-layout">
      <div>
        <img src="https://www.informalb.it/wp-content/uploads/2025/05/chi-siamo-cover-1024x576.webp"
          alt="Informa studio" style="width:100%;height:260px;object-fit:cover;margin-bottom:32px">
        <p class="lead" style="margin-bottom:24px">Informa nasce nel 2017 come servizio di alta qualità rivolto ad atleti e non che vogliono migliorare la propria performance fisica e la salute.</p>
        <p class="lead" style="margin-bottom:24px">Oggi siamo un team multidisciplinare in continuo aggiornamento: biologi nutrizionisti e personal trainer laureati in scienze motorie che lavorano all'unisono, condividendo dati e co-progettando percorsi integrati.</p>
        <p class="lead">Il risultato: un programma che funziona perché è costruito <em style="font-family:var(--fd);font-style:italic;color:var(--gl)">su di te</em> — non su un template.</p>

        <ul class="fact-list">
          <li class="fi"><span class="fi-n">01</span><span class="fi-t">Biologi nutrizionisti e personal trainer laureati in scienze motorie che collaborano in modo integrato</span></li>
          <li class="fi"><span class="fi-n">02</span><span class="fi-t">Aggiornamento professionale costante con le ultime ricerche in nutrizione e scienze motorie</span></li>
          <li class="fi"><span class="fi-n">03</span><span class="fi-t">Monitoraggi periodici e aggiornamenti del piano inclusi in ogni percorso</span></li>
          <li class="fi"><span class="fi-n">04</span><span class="fi-t">Studio privato attrezzato con spogliatoio riservato a Este, Via degli Artigiani 14</span></li>
        </ul>
      </div>

      <div>
        <div class="dark-block">
          <div class="dark-quote">"Un team di professionisti altamente qualificati che offrono un servizio a 360° volto a garantire miglioramenti sia della salute e performance fisica che nello stile di vita."</div>
        </div>
        <div class="coll-box" style="margin-top:24px">
          <div class="coll-label">Collaboratori in studio</div>
          <div class="coll-item">Psicologa specializzata nei disturbi del comportamento alimentare e nel training autogeno</div>
          <div class="coll-item">Osteopata specializzato nella valutazione del sistema posturale e nel trattamento delle disfunzioni muscolo-scheletriche</div>
        </div>
        <div style="margin-top:32px;display:flex;gap:14px;flex-wrap:wrap">
          <a class="btn btn-dark" data-page="team">Conosci il team →</a>
          <a class="btn btn-out" data-page="servizi">I servizi</a>
        </div>
      </div>
    </div>
  </div>

  <footer>
    <div class="ft-in">
      <div class="ft-logo">informa fitness e nutrizione</div>
      <div class="ft-meta">Via degli Artigiani, 14 – Este (Pd) · P.IVA 05082910281 · © ${new Date().getFullYear()}</div>
      <div class="ft-links"><a data-page="contatti">Contatti</a><a href="tel:+393409751524">+39 340 975 15 24</a></div>
    </div>
  </footer>
</div>

<!-- ═══ TEAM ════════════════════════════════════════════ -->
<div class="page" data-id="team">
  <div class="page-head">
    <div class="tag">Il team</div>
    <h1 class="h1">Professionisti<br>in aggiornamento<br><em>continuo.</em></h1>
  </div>
  <div class="w">
    <div class="team-grid">

      <div class="tc feat">
        <img src="https://www.informalb.it/wp-content/uploads/2025/05/leonardo-tessera.webp"
          alt="Leonardo Bertoncin" style="width:80px;height:80px;object-fit:cover;border-radius:50%;margin-bottom:16px;border:3px solid var(--au)">
        <div class="tc-content">
          <div class="tc-tag">Fondatore</div>
          <div class="tc-name">Leonardo Bertoncin</div>
          <div class="tc-role">Biologo Nutrizionista · Chinesiolog · Personal Trainer</div>
          <div class="tc-albo">Albo Biologi N° Tri_A2578</div>
          <div class="tc-studi">Laurea triennale Scienze Motorie (2015)<br>Laurea magistrale Scienze della Nutrizione Umana (2018)</div>
          <div class="tc-certs">
            <h5>Certificazioni principali</h5>
            <ul class="tc-tags">
              <li>Body Recomp Convention</li><li>Glutes Shape Project</li>
              <li>Open Academy of Medicine</li><li>S.I.F.A.</li>
              <li>Body Composition Conference</li><li>Scuola Nutrizione Salernitana</li>
              <li>Simposio Nutrizione Funzionale</li><li>ADV Female Fitness Academy</li>
              <li>Intuitive Eating L1</li><li>Smart Nutrition (2025)</li>
              <li>Sanis Nutrizione Sportiva (2026)</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="tc">
        <img src="https://www.informalb.it/wp-content/uploads/2025/05/erica-tessera.webp"
          alt="Erica Prendin" style="width:80px;height:80px;object-fit:cover;border-radius:50%;margin-bottom:16px">
        <div class="tc-content">
          <div class="tc-tag">Nutrizionista</div>
          <div class="tc-name">Erica Prendin</div>
          <div class="tc-role">Biologa Nutrizionista · Chinesiologа · Personal Trainer</div>
          <div class="tc-studi" style="margin-top:16px">Laurea triennale Scienze Motorie (2019)<br>Laurea magistrale Scienze della Nutrizione Umana</div>
        </div>
      </div>

      <div class="tc">
        <img src="https://www.informalb.it/wp-content/uploads/2025/05/riccardo-tessera.webp"
          alt="Riccardo Ferrigato" style="width:80px;height:80px;object-fit:cover;border-radius:50%;margin-bottom:16px">
        <div class="tc-content">
          <div class="tc-tag">Nutrizionista</div>
          <div class="tc-name">Riccardo Ferrigato</div>
          <div class="tc-role">Biologo Nutrizionista · Chinesiolog · Personal Trainer</div>
        </div>
      </div>

      <div class="tc">
        <img src="https://www.informalb.it/wp-content/uploads/2026/03/alberto-tessera.webp"
          alt="Alberto Capuzzo" style="width:80px;height:80px;object-fit:cover;border-radius:50%;margin-bottom:16px">
        <div class="tc-content">
          <div class="tc-tag">Osteopata</div>
          <div class="tc-name">Alberto Capuzzo</div>
          <div class="tc-role">Osteopata · Chinesiolog · Massoterapista</div>
          <div class="tc-studi" style="margin-top:16px;font-style:italic;font-family:var(--fd);font-size:.95rem;color:var(--mu)">Specializzato nella valutazione del sistema posturale e nel trattamento delle disfunzioni muscolo-scheletriche.</div>
        </div>
      </div>

    </div>
    <div style="padding:48px 0;display:flex;gap:14px;flex-wrap:wrap">
      <a class="btn btn-dark" data-page="servizi">Vedi i servizi →</a>
      <a class="btn btn-out" href="tel:+393409751524">Prenota una valutazione</a>
    </div>
  </div>

  <footer>
    <div class="ft-in">
      <div class="ft-logo">informa fitness e nutrizione</div>
      <div class="ft-meta">Via degli Artigiani, 14 – Este (Pd) · P.IVA 05082910281 · © ${new Date().getFullYear()}</div>
      <div class="ft-links"><a data-page="contatti">Contatti</a><a href="tel:+393409751524">+39 340 975 15 24</a></div>
    </div>
  </footer>
</div>

<!-- ═══ SERVIZI ══════════════════════════════════════════ -->
<div class="page" data-id="servizi">
  <div class="page-head">
    <div class="tag">Servizi</div>
    <h1 class="h1">Cosa puoi<br>fare <em>in studio.</em></h1>
  </div>
  <div class="w">
    <div class="sv-list">

      <div class="sv-row">
        <div class="sv-num">01</div>
        <div>
          <img src="https://www.informalb.it/wp-content/uploads/2025/05/img-bia-1-1024x683.webp"
            alt="BIA e Plicometria" style="width:100%;max-width:480px;height:220px;object-fit:cover;margin-bottom:16px">
          <div class="sv-name">BIA e Plicometria</div>
          <p class="sv-desc">Analisi della composizione corporea con bioimpedenziometria (BIA) e plicometria. Misura massa muscolare, massa grassa, metabolismo basale e stato di idratazione. Esame non invasivo. Fondamentale come punto di partenza per qualsiasi percorso.</p>
        </div>
        <div class="sv-side">
          <div class="sv-price">€ 70</div>
          <a href="tel:+393409751524" class="btn btn-dark">Prenota →</a>
        </div>
      </div>

      <div class="sv-row">
        <div class="sv-num">02</div>
        <div>
          <div class="sv-name">Analisi HRV – Kubios</div>
          <p class="sv-desc">Valutazione della variabilità della frequenza cardiaca con cardiofrequenzimetro e software Kubios. Misura stress, qualità del recupero, stato del sistema nervoso autonomo. Dati scientifici per ottimizzare allenamento e alimentazione in modo preciso.</p>
        </div>
        <div class="sv-side">
          <div class="sv-price">€ 50</div>
          <a href="tel:+393409751524" class="btn btn-dark">Prenota →</a>
        </div>
      </div>

      <div class="sv-row">
        <div class="sv-num">03</div>
        <div>
          <div class="sv-name">Anamnesi Motoria</div>
          <p class="sv-desc">Valutazione completa in 3 fasi: raccolta storia clinica e sportiva tramite questionario, test in studio con il Personal Trainer (mobilità, coordinazione, controllo motorio), consegna di un programma personalizzato. Prerequisito per le sedute di Personal Training.</p>
        </div>
        <div class="sv-side">
          <div class="sv-price">€ 60</div>
          <a href="tel:+393409751524" class="btn btn-dark">Prenota →</a>
        </div>
      </div>

      <div class="sv-row">
        <div class="sv-num">04</div>
        <div>
          <img src="https://www.informalb.it/wp-content/uploads/2025/05/img-personal-training-1024x683.webp"
            alt="Personal Training" style="width:100%;max-width:480px;height:220px;object-fit:cover;margin-bottom:16px">
          <div class="sv-name">Personal Training</div>
          <p class="sv-desc">Sedute da 60 minuti in studio privato con attrezzatura completa e spogliatoio riservato. Modalità singola o in coppia. Ogni percorso è progettato su misura per obiettivi, livello e limitazioni. Disponibile solo dopo Anamnesi Motoria o acquisto pacchetto. Validità 3 mesi dall'acquisto.</p>
        </div>
        <div class="sv-side">
          <div class="sv-price">da € 120</div>
          <a href="tel:+393409751524" class="btn btn-dark">Prenota →</a>
        </div>
      </div>

    </div>
    <div style="padding:48px 0">
      <a class="btn btn-dark" data-page="pacchetti">Vedi i pacchetti →</a>
    </div>
  </div>

  <footer>
    <div class="ft-in">
      <div class="ft-logo">informa fitness e nutrizione</div>
      <div class="ft-meta">Via degli Artigiani, 14 – Este (Pd) · P.IVA 05082910281 · © ${new Date().getFullYear()}</div>
      <div class="ft-links"><a data-page="contatti">Contatti</a><a href="tel:+393409751524">+39 340 975 15 24</a></div>
    </div>
  </footer>
</div>

<!-- ═══ PACCHETTI ════════════════════════════════════════ -->
<div class="page" data-id="pacchetti">
  <div class="page-head">
    <div class="tag">Pacchetti</div>
    <h1 class="h1">Percorsi<br>su <em>misura.</em></h1>
  </div>
  <div class="w">
    <div class="pk-grid">

      <div class="pk">
        <div class="pk-ghost">01</div>
        <div class="pk-badge">Nutrizione</div>
        <div class="pk-name">Pacchetto<br>Nutrizione</div>
        <p class="pk-desc">Piano alimentare costruito su misura in base ad abitudini, stile di vita, ritmi quotidiani e preferenze personali. Percorso sostenibile con monitoraggi periodici e revisioni del piano incluse. L'obiettivo è un rapporto sano e duraturo con il cibo.</p>
        <div class="pk-durate"><span class="dur">3 mesi</span><span class="dur">6 mesi</span></div>
        <a href="tel:+393409751524" class="pk-btn">Richiedi informazioni <span>→</span></a>
      </div>

      <div class="pk hl">
        <div class="pk-ghost">02</div>
        <div class="pk-badge">Più scelto</div>
        <div class="pk-name">Nutrizione<br>+ Allenamento</div>
        <p class="pk-desc">La combinazione ottimale: nutrizionista e personal trainer co-progettano il percorso e condividono dati reali. Piano alimentare calibrato sul protocollo di allenamento specifico. Risultati più rapidi, meno plateau, massima compliance.</p>
        <div class="pk-durate"><span class="dur">3 mesi</span><span class="dur">6 mesi</span></div>
        <a href="tel:+393409751524" class="pk-btn">Richiedi informazioni <span>→</span></a>
      </div>

      <div class="pk">
        <div class="pk-ghost">03</div>
        <div class="pk-badge">Allenamento</div>
        <div class="pk-name">Pacchetto<br>Allenamento</div>
        <p class="pk-desc">Protocollo personalizzato dopo anamnesi e analisi della composizione corporea. Eseguibile in palestra o a casa. Progressione strutturata verso obiettivi concreti: massa muscolare, rimodellamento, postura, performance sportiva.</p>
        <div class="pk-durate"><span class="dur">3 mesi</span><span class="dur">6 mesi</span></div>
        <a href="tel:+393409751524" class="pk-btn">Richiedi informazioni <span>→</span></a>
      </div>

    </div>
    <div style="padding:48px 0">
      <a class="btn btn-dark" data-page="contatti">Contattaci →</a>
    </div>
  </div>

  <footer>
    <div class="ft-in">
      <div class="ft-logo">informa fitness e nutrizione</div>
      <div class="ft-meta">Via degli Artigiani, 14 – Este (Pd) · P.IVA 05082910281 · © ${new Date().getFullYear()}</div>
      <div class="ft-links"><a data-page="contatti">Contatti</a><a href="tel:+393409751524">+39 340 975 15 24</a></div>
    </div>
  </footer>
</div>

<!-- ═══ CONTATTI ═════════════════════════════════════════ -->
<div class="page" data-id="contatti">
  <div class="ct-layout">
    <div class="ct-left">
      <div>
        <div class="tag">Contatti</div>
        <h1 class="h1">Vieni<br>a trovarci<br><em>a Este.</em></h1>
        <div class="ct-info">
          <div class="ct-item">
            <i data-lucide="map-pin" class="ico-ct"></i>
            <div>
              <div class="ct-lbl">Indirizzo</div>
              <div class="ct-val">Via degli Artigiani, 14<br>35042 Este (Pd)</div>
            </div>
          </div>
          <div class="ct-item">
            <i data-lucide="phone" class="ico-ct"></i>
            <div>
              <div class="ct-lbl">Telefono</div>
              <div class="ct-val"><a href="tel:+393409751524">+39 340 975 15 24</a></div>
            </div>
          </div>
          <div class="ct-item">
            <i data-lucide="mail" class="ico-ct"></i>
            <div>
              <div class="ct-lbl">Email</div>
              <div class="ct-val"><a href="mailto:leonardo.bertoncin@gmail.com">leonardo.bertoncin@gmail.com</a></div>
            </div>
          </div>
        </div>
        <div class="social-row">
          <a href="https://www.instagram.com/informafitnessenutrizione/" target="_blank" class="s-btn"><i data-lucide="instagram" class="ico-social"></i> Instagram</a>
          <a href="https://www.facebook.com/informafitnessenutrizione" target="_blank" class="s-btn"><i data-lucide="facebook" class="ico-social"></i> Facebook</a>
        </div>
      </div>
      <div class="ft-meta" style="margin-top:48px">Informa di Bertoncin Leonardo · P.IVA 05082910281 · © ${new Date().getFullYear()}</div>
    </div>

    <div class="ct-right">
      <div class="form-title">Richiedi<br>informazioni.</div>
      <div class="fg"><label class="fl">Nome e Cognome</label><input class="fi2" type="text" placeholder="Mario Rossi"></div>
      <div class="fg"><label class="fl">Telefono</label><input class="fi2" type="tel" placeholder="+39 340 ..."></div>
      <div class="fg"><label class="fl">Email</label><input class="fi2" type="email" placeholder="mario@email.it"></div>
      <div class="fg">
        <label class="fl">Servizio di interesse</label>
        <select class="fsel">
          <option>BIA e Plicometria – € 70</option>
          <option>Analisi HRV (Kubios) – € 50</option>
          <option>Anamnesi Motoria – € 60</option>
          <option>Personal Training – da € 120</option>
          <option>Pacchetto Nutrizione</option>
          <option>Pacchetto Allenamento</option>
          <option>Nutrizione + Allenamento</option>
        </select>
      </div>
      <div class="fg"><label class="fl">Messaggio</label><textarea class="fta" placeholder="Obiettivi, disponibilità, domande..."></textarea></div>
      <button class="fsub" type="button">Invia richiesta →</button>
    </div>
  </div>
</div>

<!-- ═══ ROUTER ════════════════════════════════════════════ -->
<script>
(function(){
  const pages = document.querySelectorAll('.page');
  const navLinks = document.querySelectorAll('[data-page]');

  function go(id){
    pages.forEach(p => p.classList.remove('on'));
    navLinks.forEach(a => a.classList.remove('active'));
    const target = document.querySelector('.page[data-id="'+id+'"]');
    if(target){ target.classList.add('on'); window.scrollTo(0,0); }
    navLinks.forEach(a => { if(a.dataset.page===id) a.classList.add('active'); });
    history.replaceState(null,'','#/'+id);
  }

  navLinks.forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); go(a.dataset.page); });
  });

  // Handle initial hash
  const hash = location.hash.replace('#/','') || 'home';
  go(hash);
})();
lucide.createIcons();
</script>
</body>
</html>`;

// ─── Deploy + Email ────────────────────────────────────────────────────────────
console.log(`Deploy → ${URL}`);
await deploySite(SLUG, HTML);
console.log(`✓ Live: ${URL}`);

const t = nodemailer.createTransport({ service:"gmail", auth:{user:process.env.EMAIL_USER,pass:process.env.EMAIL_PASS} });
await t.sendMail({
  from: `"Luca Brizzante" <${process.env.EMAIL_USER}>`,
  to: "l.brizzante@bevolve.it",
  subject: "Informa Fitness – sito rifatto (v3)",
  text: `Sito rifatto con design editoriale + navigazione multi-pagina:\n\n${URL}\n\n6 pagine: Home, Chi Siamo, Team, Servizi, Pacchetti, Contatti.\nTutto dal contenuto reale di informalb.it, nessuna immagine a caso.\n\nSe ti piace lo mandiamo a Bertoncin con un messaggio di scuse.`,
});
console.log("✓ Email inviata.");
