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

// status.json keys are the Georgian labels in DOM order: All / done / ongoing
const statusKeys = Object.keys(STATUS);
const ONGOING = new Set(STATUS[statusKeys[2]] || []);

// Canonical / og:image / sitemap host. Override with SITE_URL when previewing elsewhere.
const SITE_URL = (process.env.SITE_URL || 'https://www.bbd.ge').replace(/\/$/, '');
const MAP_QUERY = 'David Gamrekeli St 2, Tbilisi, Georgia';

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
  <link rel="stylesheet" href="${rel}assets/css/style.css">
</head>
<body>`;
}

function header(lang, depth, active) {
  const d = D[lang];
  const nav = d.home.chrome.nav;
  const rel = relFor(depth);
  const L = { home: nav[0].label, about: nav[1].label, team: nav[2].label, services: nav[3].label, projects: nav[4].label, contact: nav[5].label };
  const pdf = `${rel}assets/files/BBD-company-profile-${lang}.pdf`;
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

function footer(lang, depth, active) {
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
<script src="${relFor(depth)}assets/js/main.js" defer></script>
</body>
</html>`;
}

/* ---------------------------------------------------------------- shared blocks */
function ctaSection(lang, depth) {
  const c = D[lang].home.cta;
  return `
<section class="cta reveal">
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
      <article class="feature reveal">
        <div class="feature__icon">${f.icon}</div>
        <h3 class="feature__title">${esc(f.title)}</h3>
        <p class="feature__text">${f.textHtml || esc(f.text)}</p>
      </article>`).join('');

  const aboutImgs = d.home.about.images.map((im) =>
    `<img src="${rel}assets/img/${imgFile(im.uri)}" alt="${esc(im.alt || im.name)}" loading="lazy">`).join('');

  const svcCards = d.home.services.items.map((s) => `
        <a class="svc-card reveal" href="${localise(lang, depth, s.href)}">
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
  </section>

  <section class="section features">
    <div class="features__inner">
      <div class="features__grid">${features}</div>
    </div>
  </section>

  <section class="section about-block">
    <div class="about-block__inner">
      <span class="diamond diamond--blue" style="width:230px;height:230px;left:-70px;top:20px"></span>
      <span class="diamond diamond--lime" style="width:110px;height:110px;left:420px;top:300px"></span>
      <div class="about-block__grid">
        <div class="about-block__copy reveal">
          <h2 class="about-block__title">${esc(d.home.about.title)}</h2>
          ${(d.home.about.textHtml || d.home.about.text.map(esc)).map((t) => `<p class="about-block__text">${t}</p>`).join('')}
          <p class="about-block__cta"><a class="arrow-link" href="${localise(lang, depth, d.home.about.cta.href)}">${esc(d.home.about.cta.label)}${ARROW_RIGHT}</a></p>
        </div>
        <div class="about-block__media reveal">${aboutImgs}</div>
      </div>
    </div>
  </section>

  <section class="section svc">
    <div class="section__inner">
      <h2 class="svc__title reveal">${esc(d.home.services.title)}</h2>
      <div class="svc__intro reveal">${(d.home.services.introHtml || d.home.services.intro.map(esc)).map((t) => `<p>${t}</p>`).join('')}</div>
      <div class="svc__grid">${svcCards}</div>
      <p class="svc__more reveal"><a class="arrow-link" href="${href(depth, urlFor(lang, 'services'))}">${esc(d.home.services.more)}${ARROW_RIGHT}</a></p>
    </div>
  </section>

  <section class="section projects-block">
    <div class="projects-block__inner">
      <span class="diamond diamond--blue" style="width:260px;height:260px;right:180px;top:-40px"></span>
      <h2 class="projects-block__title reveal">${esc(d.home.projects.title)}</h2>
      <div class="carousel reveal" data-carousel>
        <div class="carousel__track">${projCards}</div>
        <button class="carousel__nav carousel__nav--prev" type="button" aria-label="Previous">${CHEV_L}</button>
        <button class="carousel__nav carousel__nav--next" type="button" aria-label="Next">${CHEV_R}</button>
      </div>
      <p class="svc__more reveal"><a class="arrow-link" href="${href(depth, urlFor(lang, 'projects'))}">${esc(d.home.projects.more)}${ARROW_RIGHT}</a></p>
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
        <article class="team-card reveal">
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
      <span class="diamond diamond--blue" style="width:379px;height:379px;left:113px;top:210px"></span>
      <span class="diamond diamond--lime" style="width:138px;height:138px;left:1258px;top:523px"></span>
      <h1 class="page-head__title">${esc(d.about.intro.eyebrow)}</h1>
      <div class="page-head__body reveal">${(d.about.intro.parasHtml && d.about.intro.parasHtml.length ? d.about.intro.parasHtml : d.about.intro.paras.map(esc)).map((p) => `<p>${p}</p>`).join('')}</div>
    </div>
  </section>

  <section class="team" id="team">
    <div class="team__bg">${t.bg ? `<img src="${rel}assets/img/${imgFile(t.bg.uri)}" alt="" loading="lazy">` : ''}</div>
    <div class="team__inner">
      <h2 class="team__title reveal">${esc(t.title)}</h2>
      <p class="team__text reveal">${esc(t.text)}</p>
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
  <section class="svc-row${i % 2 ? ' svc-row--flip' : ''} reveal" id="svc-${i + 1}">
    <div class="svc-row__inner">
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
      <span class="diamond diamond--blue" style="width:270px;height:270px;left:655px;top:191px"></span>
      <span class="diamond diamond--lime" style="width:520px;height:520px;right:-140px;top:430px;border-radius:50%;transform:none"></span>
      <h1 class="page-head__title">${esc(d.services.head.title)}</h1>
      <div class="page-head__body page-head__body--narrow reveal">${headHtml}</div>
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
        <article class="project-card reveal" data-project data-status="${status}" data-year="${esc(year)}" data-scope="">
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
      <div class="project__gallery reveal">${gallery}</div>
      <div class="reveal">
        <h1 class="project__title">${esc(p.title)}</h1>
        <div class="project__rule"></div>
        <p class="project__desc">${esc(p.desc)}</p>
        <div class="project__fields">${fields}</div>
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
  }) + header(lang, depth, 'projects') + body + footer(lang, depth, 'projects');
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
      <div class="reveal">
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
      <div class="reveal">
        <iframe class="contact__map" title="Google Maps" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
          src="https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&z=15&output=embed"></iframe>
      </div>
    </div>
  </div>
</main>`;

  return head(lang, depth, {
    key: 'contact',
    title: `${d.contact.title} | BBD`,
    description: (b[2] || [''])[0].replace(/\n/g, ' '),
  }) + header(lang, depth, 'contact') + body + footer(lang, depth, 'contact');
}

/* ---------------------------------------------------------------- privacy */
function pagePrivacy(lang) {
  const d = D[lang], depth = LANG_META[lang].prefix ? 2 : 1;
  const html = d.privacy.blocks.map((b) => {
    if (b.tag === 'h1') return `<h1>${b.html || esc(b.text)}</h1>`;
    if (/^h[2-6]$/.test(b.tag)) return `<h2>${b.html || esc(b.text)}</h2>`;
    return `<p>${b.html || esc(b.text)}</p>`;
  }).join('\n      ');

  const body = `
<main class="legal">
  <div class="legal__inner reveal">
      ${html}
  </div>
</main>`;

  return head(lang, depth, {
    key: 'privacy',
    title: `${(d.privacy.blocks[0] || {}).text || 'Privacy Policy'} | BBD`,
    description: (d.privacy.blocks[2] || {}).text || '',
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
  copyDir(path.join(SRC, 'css'), path.join(OUT, 'assets', 'css'));
  copyDir(path.join(SRC, 'js'), path.join(OUT, 'assets', 'js'));
  fs.writeFileSync(path.join(OUT, 'assets', 'img', 'favicon.svg'), FAVICON);

  fs.writeFileSync(path.join(OUT, '404.html'), page404());
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap());
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  console.log('pages written:', n);
}

build();
