/* =========================================================================
   BBD static site generator
   data/*.json  +  src/  ->  docs/   (ready for GitHub Pages)
   ========================================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'docs');

const LANGS = ['ka', 'en', 'ru'];
const LANG_META = {
  ka: { htmlLang: 'ka', prefix: '', flag: 'GEO.png', name: 'ქართული' },
  en: { htmlLang: 'en', prefix: 'en', flag: 'GBR.png', name: 'English' },
  ru: { htmlLang: 'ru', prefix: 'ru', flag: 'RUS.png', name: 'Русский' },
};

const D = {};
LANGS.forEach((l) => { D[l] = JSON.parse(fs.readFileSync(path.join(DATA, l + '.json'), 'utf8')); });
const STATUS = JSON.parse(fs.readFileSync(path.join(DATA, 'status.json'), 'utf8'));
const slugs = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'slugs.json'), 'utf8'));
// centre/zoom of every Google Map on the site, read off the live map instances
// by tools/fetch-maps.js (Wix never puts the location in the HTML)
const MAPS = JSON.parse(fs.readFileSync(path.join(DATA, 'maps.json'), 'utf8'));
// translated privacy-policy copy, overriding what the extractor mirrors
const PRIVACY = JSON.parse(fs.readFileSync(path.join(DATA, 'privacy.json'), 'utf8'));

/* Which tile style the Leaflet maps use. `osm` is the default because it is
   the only one that needs no account at all — CARTO's basemaps now watermark
   unkeyed requests. Set MAP_TILES=carto (or =voyager) once a free CARTO key
   exists and pass it as MAP_TILES_KEY. */
const MAP_TILES = process.env.MAP_TILES || 'osm';
const MAP_TILES_KEY = (process.env.MAP_TILES_KEY || '').trim();

// status.json keys are the Georgian labels in DOM order: All / done / ongoing
const statusKeys = Object.keys(STATUS);
const ONGOING = new Set(STATUS[statusKeys[2]] || []);

/* The domain GitHub Pages serves the site on. Written to docs/CNAME on every
   build — GitHub drops the setting otherwise when a deploy replaces the site. */
const CUSTOM_DOMAIN = process.env.CUSTOM_DOMAIN === '' ? '' : (process.env.CUSTOM_DOMAIN || 'bbd.ge');

// Canonical / og:image / sitemap host. Override with SITE_URL when previewing elsewhere.
const SITE_URL = (process.env.SITE_URL || 'https://bbd.ge').replace(/\/$/, '');

/* The company-profile PDFs ship with the site. tools/shrink-pdfs.js re-encodes
   the originals (23 MB each) down to ~9.5 MB so the Pages artifact stays well
   inside what deploy-pages can publish; the untouched originals stay on the
   `assets` release. Set PDF_BASE to a URL to link out instead of bundling. */
const PDF_BASE = process.env.PDF_BASE || 'assets/files';
const isLocalPdfBase = !/^https?:/.test(PDF_BASE);
const pdfHref = (lang, rel) =>
  (isLocalPdfBase ? rel + PDF_BASE.replace(/^\/|\/$/g, '') + '/' : PDF_BASE + '/')
  + 'BBD-company-profile-' + lang + '.pdf';

/* ---------------------------------------------------------------- helpers */
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

const imgFile = (uri) => (uri || '').replace('~mv2', '');

/* A contact line arrives as sanitised HTML; linkify bare emails and phone numbers. */
function contactLine(html) {
  const plain = String(html).replace(/<[^>]+>/g, '').trim();
  if (/^[^\s<>@]+@[^\s<>@]+$/.test(plain)) return `<a href="mailto:${esc(plain)}">${esc(plain)}</a>`;
  if (/^\(?\+?[\d\s()+-]{7,}$/.test(plain)) return `<a href="tel:${esc(plain.replace(/[^\d+]/g, ''))}">${esc(plain)}</a>`;
  return html;
}

const writePage = (outPath, html) => {
  const full = path.join(OUT, outPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
};

// depth -> relative prefix ("", "../", "../../" ...)
const relFor = (depth) => (depth === 0 ? './' : '../'.repeat(depth));

/* Route table. `key` identifies the page; `path` is the ka path (no lang prefix). */
const ROUTES = {
  home: '',
  about: 'about',
  services: 'services',
  projects: 'projects',
  contact: 'contact',
  privacy: 'privacy-policy',
};

function urlFor(lang, key, slug) {
  const p = LANG_META[lang].prefix;
  const parts = [];
  if (p) parts.push(p);
  if (key === 'project') { parts.push('projects', slug); }
  else if (ROUTES[key]) parts.push(ROUTES[key]);
  return '/' + (parts.length ? parts.join('/') + '/' : '');
}

/* Convert an absolute site path into a relative href for a page at `depth`. */
function href(depth, absPath) {
  const rel = relFor(depth);
  const clean = absPath.replace(/^\//, '');
  return clean ? rel + clean : rel;
}

/* Rewrites a bbd.ge absolute link found in the source data to a local route. */
function localise(lang, depth, url) {
  if (!url) return '#';
  if (/^mailto:|^tel:|^https?:\/\/(?!www\.bbd\.ge)/.test(url)) return url;
  let p = url.replace(/^https?:\/\/www\.bbd\.ge/, '').replace(/^\/(en|ru)(?=\/|$)/, '');
  p = p.replace(/^\//, '').replace(/\/$/, '');
  if (!p) return href(depth, urlFor(lang, 'home'));
  if (p.indexOf('projects/') === 0) return href(depth, urlFor(lang, 'project', p.slice('projects/'.length)));
  const key = Object.keys(ROUTES).find((k) => ROUTES[k] === p);
  return href(depth, key ? urlFor(lang, key) : '/' + p + '/');
}

/* ---------------------------------------------------------------- SVG bits */
const ARROW_RIGHT = '<svg viewBox="0 0 34 12" aria-hidden="true"><path d="M0 6h32M26 1l6 5-6 5"/></svg>';
const ARROW_GLYPH = '<svg viewBox="0 0 200 200" aria-hidden="true"><path d="M104.133 18.918l-9.431 8.947 61.913 65.269-137.498.938.089 13 138.096-.942-61.338 66.11 9.529 8.842 75.39-81.254-76.75-80.91z"/></svg>';
const CARET = '<svg class="nav__caret" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg>';
const CHEV_L = '<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M10 1L2 10l8 9"/></svg>';
const CHEV_R = '<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M2 1l8 9-8 9"/></svg>';

/* A decorative background shape, positioned inside its section's 1600px inner
   box. Geometry and colour are taken from the corresponding SVG on bbd.ge. */
function shape(o) {
  const kind = o.kind || 'diamond';
  const cls = ['shape', 'shape--' + kind];
  if (o.mx || o.my) cls.push('motion', 'motion--float');
  const vars = (o.mx ? ';--mx:' + o.mx : '') + (o.my ? ';--my:' + o.my : '');
  // the source SVGs use preserveAspectRatio="xMidYMid meet", so a diamond in a
  // non-square box draws as the largest square that fits, centred
  let { x, y, w, h } = o;
  if (kind === 'diamond' && w !== h) {
    const s = Math.min(w, h);
    x += (w - s) / 2; y += (h - s) / 2; w = h = s;
  }
  return `<span class="${cls.join(' ')}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${o.c}${vars}"></span>`;
}

/* A map element, drawn by Leaflet at runtime from data-map using free
   OpenStreetMap-based tiles — no API key, no account, no billing. The original
   used the Google Maps JS API under Wix's own enterprise licence, which cannot
   be reused; centre, zoom, marker and Directions link all match, while the tile
   artwork is OSM's rather than Google's. */
function mapEmbed(key, lang, cls, title) {
  const m = MAPS[key];
  if (!m) return '';
  const cfg = { lat: m.lat, lng: m.lng, zoom: m.zoom };
  if (m.title) cfg.title = m.title;
  if (m.directions) {
    cfg.directions = m.directions;
    cfg.dirLabel = { ka: 'მარშრუტი', en: 'Directions', ru: 'Маршрут' }[lang];
  }
  const keyAttr = MAP_TILES_KEY ? ` data-tiles-key="${esc(MAP_TILES_KEY)}"` : '';
  return `<div class="${cls} lmap" role="img" aria-label="${esc(title)}" data-tiles="${esc(MAP_TILES)}"${keyAttr} data-map='${esc(JSON.stringify(cfg))}'></div>`;
}

/* Leaflet plus the renderer, emitted only on pages that actually have a map. */
function mapScript(lang, depth) {
  const rel = relFor(depth);
  return `
<script src="${rel}assets/vendor/leaflet/leaflet.js" defer></script>
<script src="${rel}assets/js/maps.js" defer></script>`;
}

/* The hero's bottom edge is a four-layer wave, each layer 20px taller and
   fainter than the one in front. Geometry and the wave path come from the
   original's own divider. */
const HERO_DIVIDER = `<div class="divider" aria-hidden="true">${[3, 2, 1, 0]
  .map((i) => `<span style="--i:${i}"></span>`).join('')}</div>`;

/* ---------------------------------------------------------------- chrome */
function head(lang, depth, opts) {
  const rel = relFor(depth);
  const m = LANG_META[lang];
  const alts = LANGS.map((l) => `<link rel="alternate" hreflang="${LANG_META[l].htmlLang}" href="${SITE_URL}${urlFor(l, opts.key, opts.slug)}">`).join('\n  ');
  return `<!doctype html>
<html lang="${m.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(opts.title)}</title>
  <meta name="description" content="${esc(opts.description || '')}">
  <link rel="canonical" href="${SITE_URL}${urlFor(lang, opts.key, opts.slug)}">
  ${alts}
  <link rel="alternate" hreflang="x-default" href="${SITE_URL}${urlFor('ka', opts.key, opts.slug)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(opts.title)}">
  <meta property="og:description" content="${esc(opts.description || '')}">
  ${opts.ogImage ? `<meta property="og:image" content="${SITE_URL}/assets/img/${imgFile(opts.ogImage)}">` : ''}
  <link rel="icon" href="${rel}assets/img/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="${rel}assets/fonts/firago-book.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${rel}assets/fonts/firago-medium.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${rel}assets/css/style.css">${opts.map ? `
  <link rel="stylesheet" href="${rel}assets/vendor/leaflet/leaflet.css">` : ''}
  <script>document.documentElement.className += ' js';</script>
</head>
<body>`;
}

function header(lang, depth, active) {
  const d = D[lang];
  const nav = d.home.chrome.nav;
  const rel = relFor(depth);
  const L = { home: nav[0].label, about: nav[1].label, team: nav[2].label, services: nav[3].label, projects: nav[4].label, contact: nav[5].label };
  const pdf = pdfHref(lang, rel);
  const isA = (k) => (active === k ? ' is-active' : '');

  const langLinks = LANGS.map((l) => {
    const cur = l === lang ? ' class="is-active"' : '';
    return `<li><a href="${href(depth, urlFor(l, 'home'))}"${cur} hreflang="${LANG_META[l].htmlLang}"><img src="${rel}assets/img/flags/${LANG_META[l].flag}" alt="" width="20" height="20"><span>${LANG_META[l].name}</span></a></li>`;
  }).join('');

  return `
<header class="site-header">
  <div class="container site-header__inner">
    <a class="logo" href="${href(depth, urlFor(lang, 'home'))}" aria-label="BBD">${d.home.chrome.logo}</a>
    <nav class="nav" aria-label="Main">
      <ul class="nav__list">
        <li class="nav__item"><a class="nav__link${isA('home')}" href="${href(depth, urlFor(lang, 'home'))}">${esc(L.home)}</a></li>
        <li class="nav__item">
          <a class="nav__link${isA('about')}" href="${href(depth, urlFor(lang, 'about'))}">${esc(L.about)}${CARET}</a>
          <ul class="nav__sub"><li><a href="${href(depth, urlFor(lang, 'about'))}#team">${esc(L.team)}</a></li></ul>
        </li>
        <li class="nav__item"><a class="nav__link${isA('services')}" href="${href(depth, urlFor(lang, 'services'))}">${esc(L.services)}</a></li>
        <li class="nav__item"><a class="nav__link${isA('projects')}" href="${href(depth, urlFor(lang, 'projects'))}">${esc(L.projects)}</a></li>
        <li class="nav__item"><a class="nav__link${isA('contact')}" href="${href(depth, urlFor(lang, 'contact'))}">${esc(L.contact)}</a></li>
      </ul>
      <a class="btn btn--lime" href="${pdf}" target="_blank" rel="noopener">${esc(d.home.chrome.headerBtn)}</a>
      <div class="lang" data-lang>
        <button class="lang__btn" type="button" aria-haspopup="true" aria-expanded="false">
          <img src="${rel}assets/img/flags/${LANG_META[lang].flag}" alt="${esc(LANG_META[lang].name)}" width="20" height="20">
          <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg>
        </button>
        <ul class="lang__menu">${langLinks}</ul>
      </div>
      <button class="burger" type="button" data-burger aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </nav>
  </div>
</header>
<div class="mobile-nav" data-mobile-nav>
  <ul>
    <li><a href="${href(depth, urlFor(lang, 'home'))}">${esc(L.home)}</a></li>
    <li><a href="${href(depth, urlFor(lang, 'about'))}">${esc(L.about)}</a></li>
    <li class="sub"><a href="${href(depth, urlFor(lang, 'about'))}#team">${esc(L.team)}</a></li>
    <li><a href="${href(depth, urlFor(lang, 'services'))}">${esc(L.services)}</a></li>
    <li><a href="${href(depth, urlFor(lang, 'projects'))}">${esc(L.projects)}</a></li>
    <li><a href="${href(depth, urlFor(lang, 'contact'))}">${esc(L.contact)}</a></li>
    <li><a href="${pdf}" target="_blank" rel="noopener">${esc(d.home.chrome.headerBtn)}</a></li>
  </ul>
  <div class="mobile-nav__langs">
    ${LANGS.map((l) => `<a href="${href(depth, urlFor(l, 'home'))}"${l === lang ? ' class="is-active"' : ''}>${LANG_META[l].name}</a>`).join('')}
  </div>
</div>`;
}

function footer(lang, depth, active, extraScripts) {
  const d = D[lang];
  const nav = d.home.chrome.nav;
  const rel = relFor(depth);
  const f = d.home.chrome.footerRich;
  const pick = (i) => (f[i] ? f[i].lines : ['']);
  const navTitle = pick(0)[0];
  const addrTitle = pick(1)[0];
  const addr = pick(2)[0];
  const hoursTitle = pick(3)[0];
  const hours = pick(4);
  const contactTitle = pick(5)[0];
  const contactLines = pick(6);
  const privacy = pick(7)[0];
  const copy = pick(8)[0];
  const isA = (k) => (active === k ? ' class="is-active"' : '');

  const social = d.home.chrome.social.map((s) =>
    `<a href="${esc(s.href)}" target="_blank" rel="noopener" aria-label="${esc((s.href.match(/\/\/(?:www\.)?([^.]+)/) || [, 'social'])[1])}"><img src="${rel}assets/img/${imgFile(s.icon)}" alt="" width="26" height="26" loading="lazy"></a>`).join('');

  const contactHtml = contactLines.map((l) => (/@/.test(l)
    ? `<a href="mailto:${esc(l)}">${esc(l)}</a><br>`
    : `<a href="tel:${esc(l.replace(/[^\d+]/g, ''))}">${esc(l)}</a><br>`)).join('');

  return `
<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="site-footer__grid">
      <div>
        <div class="site-footer__logo">${d.home.chrome.logo}</div>
        <div class="social">${social}</div>
      </div>
      <div>
        <h3>${esc(navTitle)}</h3>
        <ul class="footer-nav">
          <li><a href="${href(depth, urlFor(lang, 'home'))}"${isA('home')}>${esc(nav[0].label)}</a></li>
          <li><a href="${href(depth, urlFor(lang, 'about'))}"${isA('about')}>${esc(nav[1].label)}</a></li>
          <li><a href="${href(depth, urlFor(lang, 'services'))}"${isA('services')}>${esc(nav[3].label)}</a></li>
          <li><a href="${href(depth, urlFor(lang, 'projects'))}"${isA('projects')}>${esc(nav[4].label)}</a></li>
          <li><a href="${href(depth, urlFor(lang, 'contact'))}"${isA('contact')}>${esc(nav[5].label)}</a></li>
        </ul>
      </div>
      <div><h3>${esc(addrTitle)}</h3><p>${nl2br(addr)}</p></div>
      <div><h3>${esc(hoursTitle)}</h3><p>${hours.map(esc).join('<br>')}</p></div>
      <div><h3>${esc(contactTitle)}</h3><p>${contactHtml}</p></div>
    </div>
    <div class="site-footer__bottom">
      <a href="${href(depth, urlFor(lang, 'privacy'))}">${esc(privacy)}</a>
      <p>${esc(copy)}</p>
    </div>
  </div>
</footer>
<a class="wa-float" href="https://wa.me/995322222312" target="_blank" rel="noopener">${d.home.chrome.whatsapp.icon}<span>${esc(d.home.chrome.whatsapp.label)}</span></a>
<script src="${relFor(depth)}assets/js/main.js" defer></script>${extraScripts || ''}
</body>
</html>`;
}

/* ---------------------------------------------------------------- shared blocks */
function ctaSection(lang, depth) {
  const c = D[lang].home.cta;
  return `
<section class="cta">
  <div class="cta__bg">${c.image ? `<img src="${relFor(depth)}assets/img/${imgFile(c.image.uri)}" alt="" loading="lazy">` : ''}</div>
  <div class="cta__inner">
    <h2 class="cta__title">${esc(c.title)}</h2>
    <p class="cta__text">${esc(c.text)}</p>
    <div class="cta__btn"><a class="btn btn--primary" href="${localise(lang, depth, c.button.href)}">${esc(c.button.label)}</a></div>
  </div>
</section>`;
}

/* ---------------------------------------------------------------- home */
function pageHome(lang) {
  const d = D[lang], depth = LANG_META[lang].prefix ? 1 : 0, rel = relFor(depth);
  const h = d.home.hero;

  const heroBtns = h.ctas.map((c, i) =>
    `<a class="btn ${i === 0 ? 'btn--primary' : 'btn--ghost'}" href="${localise(lang, depth, c.href)}">${esc(c.label)}</a>`).join('');

  const features = d.home.features.map((f) => `
      <article class="feature motion motion--reveal-up">
        <div class="feature__icon">${f.icon}</div>
        <h3 class="feature__title">${esc(f.title)}</h3>
        <p class="feature__text">${f.textHtml || esc(f.text)}</p>
      </article>`).join('');

  // the left image wipes upward, the right one downward — as on the original
  const aboutImgs = d.home.about.images.map((im, i) =>
    `<img class="motion motion--reveal-${i === 0 ? 'up' : 'down'}" src="${rel}assets/img/${imgFile(im.uri)}" alt="${esc(im.alt || im.name)}" loading="lazy">`).join('');

  const svcCards = d.home.services.items.map((s) => `
        <a class="svc-card" href="${s.href ? localise(lang, depth, s.href) : href(depth, urlFor(lang, 'services'))}">
          <span class="svc-card__icon">${s.icon}</span>
          <span class="svc-card__title">${esc(s.title)}</span>
          <span class="svc-card__arrow">${ARROW_GLYPH}</span>
        </a>`).join('');

  const projSlugFor = (id) => {
    const base = String(id).replace(/_\d+$/, '');
    const li = d.projectsList.items.find((it) => it.title && base && it.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === base);
    return li ? li.slug : '';
  };

  const projCards = d.home.projects.items.map((p, i) => {
    const slug = projSlugFor(p.id) || (d.projectsList.items[i] ? d.projectsList.items[i].slug : '');
    const li = d.projectsList.items.find((it) => it.slug === slug);
    const title = p.title || (li ? li.title : '');
    const desc = p.desc || (li ? li.desc : '');
    return `
        <a class="proj-card" href="${href(depth, urlFor(lang, 'project', slug))}">
          <img src="${rel}assets/img/${imgFile(p.uri)}" alt="${esc(title)}" loading="lazy">
          <span class="proj-card__body">
            <span class="proj-card__title">${esc(title)}</span>
            <span class="proj-card__desc">${esc(desc)}</span>
          </span>
        </a>`;
  }).join('');

  const body = `
<main>
  <section class="hero">
    <div class="hero__bg">${h.image ? `<img src="${rel}assets/img/${imgFile(h.image.uri)}" alt="" fetchpriority="high">` : ''}</div>
    <div class="hero__inner">
      <div class="hero__content">
        <p class="hero__badge">${h.badgeIcon}<span>${esc(h.badge)}</span></p>
        ${(h.textHtml || h.text.map(esc)).map((t) => `<p class="hero__text">${t}</p>`).join('')}
        <div class="hero__actions">${heroBtns}</div>
      </div>
    </div>
    ${HERO_DIVIDER}
  </section>

  <section class="section features">
    <div class="features__inner">
      <div class="features__grid">${features}</div>
    </div>
  </section>

  <section class="section about-block">
    <div class="about-block__inner">
      ${shape({ x: 32, y: 133, w: 464, h: 464, c: 'rgba(14, 95, 224, .05)', mx: '-60px' })}
      ${shape({ x: 463, y: 603, w: 114, h: 114, c: 'rgba(190, 216, 100, .1)', my: '60px' })}
      <div class="about-block__grid">
        <div class="about-block__copy">
          <h2 class="about-block__title">${esc(d.home.about.title)}</h2>
          ${(d.home.about.textHtml || d.home.about.text.map(esc)).map((t) => `<p class="about-block__text">${t}</p>`).join('')}
          <p class="about-block__cta"><a class="arrow-link" href="${localise(lang, depth, d.home.about.cta.href)}">${esc(d.home.about.cta.label)}${ARROW_RIGHT}</a></p>
        </div>
        <div class="about-block__media">${aboutImgs}</div>
      </div>
    </div>
  </section>

  <section class="section svc">
    <div class="section__inner">
      <h2 class="svc__title">${esc(d.home.services.title)}</h2>
      <div class="svc__intro">${(d.home.services.introHtml || d.home.services.intro.map(esc)).map((t) => `<p>${t}</p>`).join('')}</div>
      <div class="svc__grid">${svcCards}</div>
      <p class="svc__more"><a class="arrow-link" href="${href(depth, urlFor(lang, 'services'))}">${esc(d.home.services.more)}${ARROW_RIGHT}</a></p>
    </div>
  </section>

  <section class="section projects-block">
    <div class="projects-block__inner">
      ${shape({ x: 942, y: 30, w: 626, h: 515, c: 'rgba(14, 95, 224, .1)' })}
      <h2 class="projects-block__title">${esc(d.home.projects.title)}</h2>
      <div class="carousel" data-carousel>
        <div class="carousel__track">${projCards}</div>
        <button class="carousel__nav carousel__nav--prev" type="button" aria-label="Previous">${CHEV_L}</button>
        <button class="carousel__nav carousel__nav--next" type="button" aria-label="Next">${CHEV_R}</button>
      </div>
      <p class="svc__more"><a class="arrow-link" href="${href(depth, urlFor(lang, 'projects'))}">${esc(d.home.projects.more)}${ARROW_RIGHT}</a></p>
    </div>
  </section>

  ${ctaSection(lang, depth)}
</main>`;

  return head(lang, depth, {
    key: 'home',
    title: lang === 'ka' ? 'მთავარი | BBD' : lang === 'ru' ? 'Главная | BBD' : 'Home | BBD',
    description: d.home.hero.text[0] || '',
    ogImage: h.image && h.image.uri,
  }) + header(lang, depth, 'home') + body + footer(lang, depth, 'home');
}

/* ---------------------------------------------------------------- about */
function pageAbout(lang) {
  const d = D[lang], depth = LANG_META[lang].prefix ? 2 : 1, rel = relFor(depth);
  const t = d.about.team;

  const cards = t.members.map((m, i) => `
        <article class="team-card motion motion--float" style="--mx:-60px">
          <div class="team-card__photo">${m.photo ? `<img src="${rel}assets/img/${imgFile(m.photo.uri)}" alt="${esc(m.name)}" loading="lazy">` : ''}</div>
          <div class="team-card__body">
            <h3 class="team-card__name">${esc(m.name)}</h3>
            <p class="team-card__role">${m.roleHtml || esc(m.role)}</p>
            ${m.duty ? `<p class="team-card__duty">${m.dutyHtml || esc(m.duty)}</p>` : ''}
            ${m.exp ? `<p class="team-card__exp">${m.expHtml || esc(m.exp)}</p>` : ''}
            ${m.email ? `<a class="team-card__mail" href="mailto:${esc(m.email.replace(/\s+/g, ''))}">${esc(m.email)}</a>` : ''}
          </div>
        </article>`).join('');

  const body = `
<main>
  <section class="section page-head">
    <div class="page-head__inner">
      ${shape({ x: 32, y: 128, w: 518, h: 518, c: 'rgba(14, 95, 224, .07)' })}
      ${shape({ x: 1192, y: 486, w: 377, h: 192, c: 'rgba(190, 216, 100, .1)' })}
      <h1 class="page-head__title">${esc(d.about.intro.eyebrow)}</h1>
      <div class="page-head__body motion motion--float" style="--mx:-60px">${(d.about.intro.parasHtml && d.about.intro.parasHtml.length ? d.about.intro.parasHtml : d.about.intro.paras.map(esc)).map((p) => `<p>${p}</p>`).join('')}</div>
    </div>
  </section>

  <section class="team" id="team">
    <div class="team__bg">${t.bg ? `<img src="${rel}assets/img/${imgFile(t.bg.uri)}" alt="" loading="lazy">` : ''}</div>
    <div class="team__inner">
      <h2 class="team__title motion motion--float" style="--mx:-60px">${esc(t.title)}</h2>
      <p class="team__text motion motion--float" style="--mx:-60px">${esc(t.text)}</p>
      <div class="team__grid">${cards}</div>
      <button class="btn btn--outline team__more" type="button" data-team-more>${esc(t.more)}</button>
    </div>
  </section>

  ${ctaSection(lang, depth)}
</main>`;

  return head(lang, depth, {
    key: 'about',
    title: `${d.home.chrome.nav[1].label} | BBD`,
    description: d.about.intro.paras[0] || '',
  }) + header(lang, depth, 'about') + body + footer(lang, depth, 'about');
}

/* ---------------------------------------------------------------- services */
function pageServices(lang) {
  const d = D[lang], depth = LANG_META[lang].prefix ? 2 : 1, rel = relFor(depth);

  // head body: paragraphs and the bullet list (li entries in source are duplicated as p — keep li only)
  const seenLi = new Set();
  let headHtml = '';
  let listOpen = false;
  d.services.head.body.forEach((b) => {
    if (b.tag === 'li') {
      if (seenLi.has(b.text)) return;
      seenLi.add(b.text);
      if (!listOpen) { headHtml += '<ul>'; listOpen = true; }
      headHtml += `<li>${b.html || esc(b.text)}</li>`;
    } else {
      if (seenLi.has(b.text)) return;
      if (listOpen) { headHtml += '</ul>'; listOpen = false; }
      headHtml += `<p>${b.html || esc(b.text)}</p>`;
    }
  });
  if (listOpen) headHtml += '</ul>';

  const rows = d.services.items.map((s, i) => `
  <section class="svc-row${i % 2 ? ' svc-row--flip' : ''}" id="svc-${i + 1}">
    <div class="svc-row__inner">
      ${i === 1 ? shape({ x: 420, y: 179, w: 380, h: 380, c: 'rgba(50, 121, 224, .05)' }) : ''}${i === 5 ? shape({ x: 601, y: 17, w: 296, h: 589, c: 'rgba(0, 38, 255, .05)' }) : ''}
      <div class="svc-row__text">
        <p class="svc-row__eyebrow">${esc(s.eyebrow)}</p>
        <h2 class="svc-row__title">${esc(s.title)}</h2>
        <div class="svc-row__body">${(s.bodyHtml || s.body.map(esc)).map((p) => `<p>${p}</p>`).join('')}</div>
      </div>
      <div class="svc-row__media">${s.image ? `<img src="${rel}assets/img/${imgFile(s.image.uri)}" alt="${esc(s.image.alt || s.title)}" loading="lazy">` : ''}</div>
    </div>
  </section>`).join('');

  const body = `
<main>
  <section class="section page-head page-head--services">
    <div class="page-head__inner">
      ${shape({ x: 602, y: 128, w: 396, h: 396, c: 'rgba(14, 95, 224, .05)' })}
      ${shape({ kind: 'dome', x: 1065, y: 648, w: 503, h: 252, c: 'rgba(165, 188, 68, .1)' })}
      <h1 class="page-head__title">${esc(d.services.head.title)}</h1>
      <div class="page-head__body page-head__body--narrow">${headHtml}</div>
    </div>
  </section>
  ${rows}
  ${ctaSection(lang, depth)}
</main>`;

  return head(lang, depth, {
    key: 'services',
    title: `${d.home.chrome.nav[3].label} | BBD`,
    description: (d.services.head.body[0] || {}).text || '',
  }) + header(lang, depth, 'services') + body + footer(lang, depth, 'services');
}

/* ---------------------------------------------------------------- projects list */
function pageProjects(lang) {
  const d = D[lang], depth = LANG_META[lang].prefix ? 2 : 1, rel = relFor(depth);
  const f = d.projectsList.filter;
  const gYear = f.groups.find((g) => g.kind === 'select');
  const gScope = f.groups.filter((g) => g.kind === 'select')[1];
  const gStatus = f.groups.find((g) => g.kind === 'radio');

  const cards = d.projectsList.items.map((p) => {
    const status = ONGOING.has(p.slug) ? 'ongoing' : 'done';
    const proj = d.projects[p.slug] || {};
    const fieldMap = {};
    (proj.fields || []).forEach((x) => { fieldMap[x.label] = x.value; });
    const year = (Object.values(fieldMap)[1] || '').trim();
    return `
        <article class="project-card" data-project data-status="${status}" data-year="${esc(year)}" data-scope="">
          <a href="${href(depth, urlFor(lang, 'project', p.slug))}">
            <div class="project-card__img">${p.image ? `<img src="${rel}assets/img/${imgFile(p.image.uri)}" alt="${esc(p.title)}" loading="lazy">` : ''}</div>
            <h2 class="project-card__title">${esc(p.title)}</h2>
            <p class="project-card__desc">${esc(p.desc)}</p>
            <span class="project-card__more">${esc(p.more)}</span>
          </a>
        </article>`;
  }).join('');

  const statusRadios = gStatus ? gStatus.options.map((o, i) => `
          <label class="filters__radio"><input type="radio" name="status" value="${i === 0 ? 'all' : i === 1 ? 'done' : 'ongoing'}"${i === 0 ? ' checked' : ''} data-filter-status> <span>${esc(o)}</span></label>`).join('') : '';

  const body = `
<main>
  <div class="projects-page__inner">
    <h1 class="projects-page__title">${esc(d.projectsList.title)}</h1>
    <aside class="filters">
      <h2 class="filters__title">${esc(f.title)}</h2>
      ${gYear ? `<div class="filters__group">
        <label class="filters__label" for="f-year">${esc(gYear.label)}</label>
        <select class="filters__select" id="f-year" data-filter-year>
          <option value="">${esc(gYear.options[0] || '')}</option>
        </select>
      </div>` : ''}
      ${gScope ? `<div class="filters__group">
        <label class="filters__label" for="f-scope">${esc(gScope.label)}</label>
        <select class="filters__select" id="f-scope" data-filter-scope>
          <option value="">${esc(gScope.options[0] || '')}</option>
        </select>
      </div>` : ''}
      ${gStatus ? `<div class="filters__group">
        <span class="filters__label">${esc(gStatus.label)}</span>
        <div class="filters__radios">${statusRadios}</div>
      </div>` : ''}
    </aside>
    <div class="projects-grid" data-projects-grid>
      ${cards}
      <p class="projects-empty" data-projects-empty hidden>—</p>
    </div>
  </div>
</main>`;

  return head(lang, depth, {
    key: 'projects',
    title: `${d.home.chrome.nav[4].label} | BBD`,
    description: d.projectsList.items.slice(0, 3).map((p) => p.title).join(', '),
  }) + header(lang, depth, 'projects') + body + footer(lang, depth, 'projects');
}

/* ---------------------------------------------------------------- project detail */
function pageProject(lang, slug) {
  const d = D[lang], depth = (LANG_META[lang].prefix ? 1 : 0) + 2, rel = relFor(depth);
  const p = d.projects[slug];
  if (!p) return null;
  const li = d.projectsList.items.find((x) => x.slug === slug);

  const gallery = p.gallery.map((u, i) =>
    `<img src="${rel}assets/img/${imgFile(u)}" alt="${esc(p.title)} ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}">`).join('');

  const fields = p.fields.map((f) =>
    `<p class="project__field"><b>${esc(f.label)}</b> <span>${esc(f.value)}</span></p>`).join('');

  const body = `
<main>
  <div class="project__inner">
    <a class="project__back" href="${href(depth, urlFor(lang, 'projects'))}">${ARROW_RIGHT}<span>${esc(p.back)}</span></a>
    <div class="project__grid">
      <div class="project__gallery">${gallery}</div>
      <div>
        <h1 class="project__title">${esc(p.title)}</h1>
        <div class="project__rule"></div>
        <p class="project__desc">${esc(p.desc)}</p>
        <div class="project__fields">${fields}</div>
        ${mapEmbed('projects/' + slug, lang, 'project__map', p.title)}
      </div>
    </div>
  </div>
</main>`;

  return head(lang, depth, {
    key: 'project',
    slug,
    title: `${p.title} | BBD`,
    description: p.desc,
    ogImage: p.gallery[0] || (li && li.image && li.image.uri),
    map: true,
  }) + header(lang, depth, 'projects') + body + footer(lang, depth, 'projects', mapScript(lang, depth));
}

/* ---------------------------------------------------------------- contact */
function pageContact(lang) {
  const d = D[lang], depth = LANG_META[lang].prefix ? 2 : 1;
  const b = d.contact.blocks;
  // blocks: [title][addrTitle][addr][hoursTitle][hours...][contactTitle][contact...][formTitle]
  const blk = (ti, bi) => `
        <div class="contact__block">
          <h3>${esc((b[ti] || [''])[0])}</h3>
          <p>${(b[bi] || []).map(contactLine).join('<br>')}</p>
        </div>`;

  const fields = d.contact.fields.map((fl, i) => {
    const req = /\*/.test(fl.label);
    const name = ['name', 'topic', 'phone'][i] || 'field' + i;
    const type = fl.type === 'phone' ? 'tel' : 'text';
    return `
        <div class="field">
          <label for="f-${name}">${esc(fl.label)}</label>
          <input type="${type}" id="f-${name}" name="${esc(fl.label.replace(/\*/g, '').trim())}"${req ? ' required' : ''}>
        </div>`;
  }).join('');

  const formTitle = (b[7] || [''])[0];

  const body = `
<main>
  <div class="contact__inner">
    <h1 class="contact__title">${esc(d.contact.title)}</h1>
    <div class="contact__grid">
      <div>
        <div class="contact__blocks">
          ${blk(1, 2)}
          ${blk(3, 4)}
          ${blk(5, 6)}
        </div>
        <h2 class="contact__form-title">${esc(formTitle)}</h2>
        <form data-contact-form data-mailto="info@bbd.ge" data-subject="bbd.ge — ${esc(d.contact.title)}">
          ${fields}
          <button class="btn btn--primary contact__submit" type="submit">${esc(d.contact.submit)}</button>
        </form>
      </div>
      <div>
        ${mapEmbed('contact', lang, 'contact__map', d.contact.title)}
      </div>
    </div>
  </div>
</main>`;

  return head(lang, depth, {
    key: 'contact',
    title: `${d.contact.title} | BBD`,
    description: (b[2] || [''])[0].replace(/\n/g, ' '),
    map: true,
  }) + header(lang, depth, 'contact') + body + footer(lang, depth, 'contact', mapScript(lang, depth));
}

/* ---------------------------------------------------------------- privacy */
function pagePrivacy(lang) {
  const d = D[lang], depth = LANG_META[lang].prefix ? 2 : 1;
  // PRIVACY (data/privacy.json) is the translated copy and wins over the
  // half-English text the extractor mirrors from Wix
  const blocks = PRIVACY[lang] || d.privacy.blocks;
  const html = blocks.map((b) => {
    const cls = b.class ? ` class="${esc(b.class)}"` : '';
    if (b.tag === 'ul') return `<ul${cls}>${(b.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    if (b.tag === 'h1') return `<h1${cls}>${b.html || esc(b.text)}</h1>`;
    if (/^h[2-6]$/.test(b.tag)) return `<h2${cls}>${b.html || esc(b.text)}</h2>`;
    return `<p${cls}>${b.html || esc(b.text)}</p>`;
  }).join('\n      ');

  const body = `
<main class="legal">
  <div class="legal__inner">
      ${html}
  </div>
</main>`;

  return head(lang, depth, {
    key: 'privacy',
    title: `${(blocks[0] || {}).text || 'Privacy Policy'} | BBD`,
    description: (blocks[2] || {}).text || '',
  }) + header(lang, depth, '') + body + footer(lang, depth, '');
}

/* ---------------------------------------------------------------- 404
   Pages serves this file for any unknown depth, so it cannot rely on relative
   asset paths — it is self-contained and derives the site root at runtime. */
function page404() {
  const label = D.ka.home.chrome.nav[0].label;
  return `<!doctype html>
<html lang="ka">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 | BBD</title>
<meta name="robots" content="noindex">
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#fff;
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color:#5e5968; text-align:center; padding:24px; }
  h1 { font-size:72px; margin:0 0 8px; color:#000; font-weight:500; }
  p { margin:0 0 28px; font-size:17px; }
  a { display:inline-flex; align-items:center; justify-content:center; height:45px; padding:0 32px;
      border-radius:5px; background:linear-gradient(15deg,#0e5fe0,#3279e0); color:#fff; text-decoration:none; font-size:17px; }
</style>
</head>
<body>
  <div>
    <h1>404</h1>
    <p>გვერდი ვერ მოიძებნა &middot; Page not found &middot; Страница не найдена</p>
    <a id="home" href="/">${esc(label)}</a>
  </div>
  <script>
    // On a github.io project site the root is /<repo>/, elsewhere it is /.
    var base = location.hostname.slice(-10) === 'github.io' ? '/' + location.pathname.split('/')[1] + '/' : '/';
    document.getElementById('home').href = base;
  </script>
</body>
</html>`;
}

/* ---------------------------------------------------------------- assets */
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), t = path.join(to, e.name);
    if (e.isDirectory()) copyDir(s, t);
    else fs.copyFileSync(s, t);
  }
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 272">
<path fill="#bed864" d="m598 0 41.63 41.63L598 83.258l-41.63-41.63z"/>
<path fill="#0e5fe0" d="M0 46h150v180H0z"/>
<path fill="#0e5fe0" d="M170 46h150v180H170z"/>
<path fill="#bed864" d="M340 46h150v180H340z"/>
<path fill="#0e5fe0" d="m415 96 40 40-40 40-40-40z"/>
</svg>`;

/* ---------------------------------------------------------------- sitemap */
function sitemap() {
  const urls = [];
  for (const lang of LANGS) {
    for (const key of Object.keys(ROUTES)) urls.push(SITE_URL + urlFor(lang, key));
    for (const s of slugs) urls.push(SITE_URL + urlFor(lang, 'project', s));
  }
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
}

/* ---------------------------------------------------------------- run */
function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  let n = 0;
  for (const lang of LANGS) {
    const p = LANG_META[lang].prefix;
    const at = (rest) => path.join(p, rest);
    writePage(at('index.html'), pageHome(lang)); n++;
    writePage(at('about/index.html'), pageAbout(lang)); n++;
    writePage(at('services/index.html'), pageServices(lang)); n++;
    writePage(at('projects/index.html'), pageProjects(lang)); n++;
    writePage(at('contact/index.html'), pageContact(lang)); n++;
    writePage(at('privacy-policy/index.html'), pagePrivacy(lang)); n++;
    for (const s of slugs) {
      const html = pageProject(lang, s);
      if (!html) { console.log('  ! missing project', lang, s); continue; }
      writePage(at(path.join('projects', decodeURIComponent(s), 'index.html')), html); n++;
    }
  }

  copyDir(path.join(SRC, 'assets'), path.join(OUT, 'assets'));
  // when the PDFs are linked out, keep them out of the artifact entirely
  if (!isLocalPdfBase) fs.rmSync(path.join(OUT, 'assets', 'files'), { recursive: true, force: true });
  copyDir(path.join(SRC, 'css'), path.join(OUT, 'assets', 'css'));
  copyDir(path.join(SRC, 'js'), path.join(OUT, 'assets', 'js'));
  fs.writeFileSync(path.join(OUT, 'assets', 'img', 'favicon.svg'), FAVICON);

  fs.writeFileSync(path.join(OUT, '404.html'), page404());
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  // the custom domain, rewritten on every build so a deploy never drops it
  if (CUSTOM_DOMAIN) fs.writeFileSync(path.join(OUT, 'CNAME'), CUSTOM_DOMAIN + '\n');
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap());
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  console.log('pages written:', n);
}

build();
