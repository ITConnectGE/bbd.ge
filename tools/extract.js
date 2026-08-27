// Parses cached bbd.ge HTML into structured JSON under data/
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, 'cache');
const DATA = path.join(ROOT, 'data');
const LANGS = ['ka', 'en', 'ru'];
const slugs = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'slugs.json'), 'utf8'));

const images = new Set();
const noteImg = (u) => { if (u) images.add(u); return u; };

const load = (lang, key) => {
  const f = path.join(CACHE, lang, decodeURIComponent(key).replace(/[<>:"|?*]/g, '_') + '.html');
  return cheerio.load(fs.readFileSync(f, 'utf8'));
};

const clean = (s) => (s || '').replace(/​/g, '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();

/* Inline HTML we keep from Wix rich text (everything else is dropped). */
const KEEP = { br: [], a: ['href'], strong: [], b: [], em: [], i: [], u: [], sub: [], sup: [] };

function sanitize($, node) {
  const walk = (n) => {
    $(n).contents().each((i, c) => {
      if (c.type === 'text') return;
      if (c.type !== 'tag') { $(c).remove(); return; }
      const tag = c.tagName.toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(KEEP, tag)) {
        walk(c);
        $(c).replaceWith($(c).contents());
        return;
      }
      const allowed = KEEP[tag];
      Object.keys(c.attribs || {}).forEach((a) => { if (allowed.indexOf(a) === -1) $(c).removeAttr(a); });
      walk(c);
    });
  };
  const copy = $(node).clone();
  walk(copy);
  return $.html(copy.contents())
    .replace(/​/g, '')
    .replace(/ /g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function rich($, sel) {
  const el = $(sel);
  if (!el.length) return [];
  const out = [];
  el.find('h1,h2,h3,h4,h5,h6,p,li').each((i, n) => {
    const t = clean($(n).text());
    const h = sanitize($, n);
    if (!t && !/<br/.test(h)) return;
    out.push({ tag: n.tagName, text: t, html: h });
  });
  return out;
}
const txt = ($, sel) => { const r = rich($, sel); return r.length ? r[0].text : ''; };
const paras = ($, sel) => rich($, sel).map((r) => r.text);
const htmls = ($, sel) => rich($, sel).map((r) => r.html);

function imgOf($, sel) {
  const el = $(sel);
  if (!el || !el.length) return null;
  const holder = el.is('[data-image-info]') ? el : el.find('[data-image-info]').first();
  const raw = holder.attr('data-image-info');
  if (!raw) return null;
  try {
    const d = JSON.parse(raw).imageData;
    noteImg(d.uri);
    return { uri: d.uri, w: d.width, h: d.height, alt: d.alt || '', name: d.name || '' };
  } catch (e) { return null; }
}

/* Wix scopes SVG colours through a <style> block keyed on data-color.
   Inline those declarations as attributes so the markup is self-contained. */
function svgOf($, sel) {
  const el = $(sel).find('svg').first();
  if (!el.length) return '';

  const rules = [];
  el.find('style').each((i, st) => {
    const css = $(st).html() || '';
    const re = /\[data-color="(\d+)"\]\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const decls = {};
      m[2].split(';').forEach((d) => {
        const p = d.split(':');
        if (p.length === 2) decls[p[0].trim()] = p[1].trim();
      });
      rules.push({ key: m[1], decls });
    }
  });
  el.find('style').remove();
  el.find('defs').each((i, d) => { if (!$(d).children().length) $(d).remove(); });

  rules.forEach((r) => {
    el.find('[data-color="' + r.key + '"]').each((i, node) => {
      Object.keys(r.decls).forEach((prop) => {
        $(node).attr(prop, r.decls[prop]);
      });
    });
  });

  el.removeAttr('role').removeAttr('aria-hidden').removeAttr('aria-label').removeAttr('height').removeAttr('width');
  return $.html(el).replace(/\s+/g, ' ').trim();
}

function chrome($) {
  const header = $('section[data-testid=section-container]').first();
  const nav = [];
  const seen = new Set();
  header.find('a[data-testid=linkElement]').each((i, a) => {
    const href = $(a).attr('href');
    const label = clean($(a).find('.wixui-menu__item-label, .wixui-horizontal-menu__item-label').first().text() || $(a).text());
    if (!href || !label || label.indexOf('svg') >= 0 || seen.has(href + '|' + label)) return;
    seen.add(href + '|' + label);
    nav.push({ href, label });
  });
  const logo = svgOf($, header.find('a[data-testid=linkElement]').first());
  const headerBtn = clean(header.find('button').filter((i, b) => clean($(b).text()) && clean($(b).text()) !== 'Menu' && clean($(b).text()) !== 'Close').first().text());
  const footer = $('section[data-testid=section-container]').last();
  const fRich = [];
  footer.find('[data-testid=richTextElement]').each((i, el) => {
    const lines = paras($, el);
    if (lines.length) fRich.push({ id: $(el).attr('id'), lines });
  });
  const social = [];
  footer.find('a[data-testid=linkElement]').each((i, a) => {
    const href = $(a).attr('href') || '';
    if (!/facebook|linkedin|youtube|instagram/i.test(href)) return;
    const im = imgOf($, $(a));
    social.push({ href, icon: im && im.uri });
  });
  const wa = clean(header.closest('body').find('[aria-label=WhatsApp]').first().text()) || 'WhatsApp';
  const waIcon = svgOf($, $('[aria-label=WhatsApp]').first());
  return { nav, logo, headerBtn, footerRich: fRich, social, whatsapp: { label: wa, icon: waIcon } };
}

function home(lang) {
  const $ = load(lang, 'home');
  const heroSec = $('section[data-testid=section-container]').eq(1);
  const hero = {
    image: imgOf($, heroSec.find('[data-image-info]').first()),
    badge: clean(heroSec.find('button').first().text()),
    badgeIcon: svgOf($, heroSec.find('button').first()),
    text: paras($, heroSec.find('[data-testid=richTextElement]').first()),
    textHtml: htmls($, heroSec.find('[data-testid=richTextElement]').first()),
    ctas: [],
  };
  heroSec.find('a[data-testid=linkElement]').each((i, a) => {
    const label = clean($(a).text());
    if (label) hero.ctas.push({ href: $(a).attr('href'), label });
  });

  const svcSec = $('#comp-mbc3voau');
  const svc = { title: txt($, svcSec.find('[data-testid=richTextElement]').first()), intro: paras($, $('#comp-mbp3qwmg')), introHtml: htmls($, $('#comp-mbp3qwmg')), items: [], more: '' };
  svcSec.find('[id^=comp-mbp3qwn2__]').each((i, el) => {
    const key = $(el).attr('id').split('__')[1];
    svc.items.push({
      title: clean($(el).text()),
      icon: svgOf($, $('#comp-mbp3qwmo__' + key)),
      href: $(el).parent().find('a[data-testid=linkElement]').attr('href') || '',
    });
  });
  svc.more = clean(svcSec.find('a[data-testid=linkElement]').last().text());

  const feat = [];
  $('[id^=comp-mcaa3o4p__]').each((i, el) => {
    const key = $(el).attr('id').split('__')[1];
    const wrap = $(el).parent();
    feat.push({
      title: clean($(el).text()),
      text: clean($('#comp-mcaa3o4x__' + key).text()),
      textHtml: (htmls($, $('#comp-mcaa3o4x__' + key))[0] || ''),
      icon: svgOf($, $('#comp-mcaa3o4e__' + key)),
    });
  });

  const aboutSec = $('#comp-lk9jshjq');
  // DOM order is not visual order here: comp-lk9k1gw2 renders left, comp-lk9k5koj right.
  const aboutImgs = [];
  ['img-comp-lk9k1gw2', 'img-comp-lk9k5koj'].forEach((id) => {
    const im = imgOf($, $('#' + id).parent());
    if (im) aboutImgs.push(im);
  });
  if (aboutImgs.length < 2) {
    aboutImgs.length = 0;
    aboutSec.find('[data-image-info]').each((i, el) => { const im = imgOf($, $(el)); if (im) aboutImgs.push(im); });
    aboutImgs.reverse();
  }
  const aboutBlk = {
    title: txt($, $('#comp-mckkicdb')),
    text: paras($, $('#comp-lk9jwrya')),
    textHtml: htmls($, $('#comp-lk9jwrya')),
    cta: { href: aboutSec.find('a[data-testid=linkElement]').first().attr('href'), label: clean(aboutSec.find('a[data-testid=linkElement]').first().text()) },
    images: aboutImgs,
  };

  const projSec = $('#comp-mbc408lr');
  const projItems = [];
  projSec.find('[data-hook=item-container]').each((i, el) => {
    const im = $(el).find('img').attr('src') || '';
    const uri = im.split('/media/')[1] ? im.split('/media/')[1].split('/')[0] : '';
    noteImg(uri);
    const title = clean($(el).find('[data-hook=item-title]').text());
    const desc = clean($(el).find('[data-hook=item-description]').text());
    projItems.push({ id: $(el).attr('data-id'), uri, title, desc });
  });
  const projects = { title: txt($, $('#comp-mbc408me')), items: projItems, more: clean(projSec.find('a[data-testid=linkElement]').last().text()) };

  const ctaSec = $('section[data-testid=section-container]').eq(-2);
  const cta = {
    image: imgOf($, ctaSec.find('[data-image-info]').first()),
    title: clean(ctaSec.find('h1,h2,h3').first().text()),
    text: clean(ctaSec.find('p').first().text()),
    button: { href: ctaSec.find('a[data-testid=linkElement]').first().attr('href'), label: clean(ctaSec.find('a[data-testid=linkElement]').first().text()) },
  };
  return { hero, services: svc, features: feat, about: aboutBlk, projects, cta, chrome: chrome($) };
}

function about(lang) {
  const $ = load(lang, 'about');
  const secs = $('section[data-testid=section-container]');
  const intro = { eyebrow: '', paras: [], parasHtml: [] };
  const introSec = secs.eq(1);
  introSec.find('[data-testid=richTextElement]').each((i, el) => {
    const ps = paras($, el);
    if (!ps.length) return;
    if (!intro.eyebrow && ps.length === 1 && ps[0].length < 60) intro.eyebrow = ps[0];
    else { intro.paras.push.apply(intro.paras, ps); intro.parasHtml = (intro.parasHtml || []).concat(htmls($, el)); }
  });
  const teamSec = $('#comp-lk9ntdph');
  const team = { title: clean(teamSec.find('h1,h2').first().text()), text: clean($('#comp-mcmaigza').text()), members: [], more: '' };
  $('[id^=comp-lk9o30nn__]').each((i, el) => {
    const key = $(el).attr('id').split('__')[1];
    const photoWrap = $('#img-comp-lk9nwd8e__' + key).parent();
    team.members.push({
      id: key,
      name: clean($(el).text()),
      role: clean($('#comp-mckx6ak1__' + key).text()),
      roleHtml: (htmls($, $('#comp-mckx6ak1__' + key))[0] || ''),
      duty: clean($('#comp-mhbyoaxr__' + key).text()),
      dutyHtml: htmls($, $('#comp-mhbyoaxr__' + key)).join('<br>'),
      exp: clean($('#comp-mhbyowd0__' + key).text()),
      expHtml: htmls($, $('#comp-mhbyowd0__' + key)).join('<br>'),
      email: clean($('#comp-lk9o54z7__' + key).text()),
      photo: imgOf($, photoWrap),
    });
  });
  team.more = clean(teamSec.find('button').last().text());
  const bgs = [];
  teamSec.find('[data-image-info]').each((i, el) => {
    const im = imgOf($, $(el));
    if (im && !team.members.some((m) => m.photo && m.photo.uri === im.uri)) bgs.push(im);
  });
  team.bg = bgs[0] || null;
  return { intro, team };
}

function services(lang) {
  const $ = load(lang, 'services');
  const secs = $('section[data-testid=section-container]');
  const hs = secs.eq(1);
  const head = { title: clean(hs.find('h1,h2').first().text()), body: [] };
  hs.find('[data-testid=richTextElement]').each((i, el) => {
    rich($, el).forEach((r) => { if (!/^h1$/.test(r.tag)) head.body.push(r); });
  });
  const items = [];
  secs.each((i, s) => {
    const $s = $(s);
    const h2 = $s.find('h2').first();
    const h6 = $s.find('h6').first();
    if (!h2.length || !h6.length) return;
    const im = imgOf($, $s.find('[data-image-info]').first());
    const bodyEl = $s.find('[data-testid=richTextElement]').filter((j, e) => $(e).find('p').length).first();
    items.push({ eyebrow: clean(h6.text()), title: clean(h2.text()), body: rich($, bodyEl).map((r) => r.text), bodyHtml: rich($, bodyEl).map((r) => r.html), image: im });
  });
  return { head, items };
}

function contact(lang) {
  const $ = load(lang, 'contact');
  const sec = $('section[data-testid=section-container]').eq(1);
  const title = clean(sec.find('h1,h2').first().text());
  const blocks = [];
  sec.find('[data-testid=richTextElement]').each((i, el) => {
    const ps = htmls($, el);
    if (ps.length) blocks.push(ps);
  });
  const fields = [];
  sec.find('input, textarea, select').each((i, el) => {
    const $el = $(el);
    const id = $el.attr('id') || '';
    let lbl = '';
    if (id) lbl = clean(sec.find('label[for="' + id + '"]').text());
    if (!lbl) lbl = clean($el.closest('[class*=wixui]').find('label').first().text());
    if (lbl) fields.push({ label: lbl, type: $el.attr('type') || el.tagName, required: /\*/.test(lbl) });
  });
  const submit = clean(sec.find('button').last().text());
  let map = '';
  sec.find('iframe').each((i, el) => {
    const s = $(el).attr('src') || $(el).attr('data-src') || '';
    if (/google|maps/.test(s)) map = s;
  });
  return { title, blocks, fields, submit, map };
}

function privacy(lang) {
  const $ = load(lang, 'privacy-policy');
  const sec = $('section[data-testid=section-container]').eq(1);
  const blocks = [];
  sec.find('[data-testid=richTextElement]').each((i, el) => rich($, el).forEach((r) => blocks.push(r)));
  return { blocks };
}

function projectsList(lang) {
  const $ = load(lang, 'projects');
  const title = clean($('#comp-mc3c154m').text()) || clean($('section[data-testid=section-container]').eq(1).find('h1').first().text());
  const fsec = $('#comp-mbc4nj7t3');
  const filter = { title: clean(fsec.find('h6').first().text()), groups: [] };
  fsec.find('label.wixui-dropdown__label').each((i, el) => {
    const lbl = clean($(el).text());
    const sel = $(el).parent().find('select');
    const opts = [];
    sel.find('option').each((j, o) => opts.push(clean($(o).text())));
    filter.groups.push({ kind: 'select', label: lbl, options: opts });
  });
  const rg = fsec.find('[data-testid=groupLabel]');
  if (rg.length) {
    const opts = [];
    fsec.find('[data-testid=label]').each((i, el) => opts.push(clean($(el).text())));
    filter.groups.push({ kind: 'radio', label: clean(rg.text()), options: opts });
  }
  const items = [];
  $('[id^=comp-mbc4nj864__]').each((i, el) => {
    const key = $(el).attr('id').split('__')[1];
    const card = $(el).parent();
    const imgEl = $('#comp-mbc4nj85__' + key);
    const im = imgOf($, imgEl);
    const href = imgEl.find('a').attr('href') || card.find('a[data-testid=linkElement]').attr('href') || '';
    items.push({
      id: key,
      title: clean($(el).find('h1,h2,h3').first().text()),
      desc: clean($('#comp-mcvpuf2a__' + key).text()),
      image: im,
      slug: href.split('/projects/')[1] || '',
      more: clean(card.find('a[data-testid=linkElement]').last().text()),
    });
  });
  return { title, filter, items };
}

function projectPage(lang, slug) {
  const $ = load(lang, 'projects/' + slug);
  const sec = $('#comp-mbc61j2n').length ? $('#comp-mbc61j2n') : $('section[data-testid=section-container]').eq(1);
  const back = clean(sec.find('a[data-testid=linkElement]').first().text());
  const rts = [];
  sec.find('[data-testid=richTextElement]').each((i, el) => {
    const first = $(el).children().first()[0];
    rts.push({ id: $(el).attr('id'), tag: (first && first.tagName) || 'p', text: clean($(el).text()) });
  });
  const titleIdx = rts.findIndex((r) => /^h[1-6]$/.test(r.tag));
  const title = titleIdx >= 0 ? rts[titleIdx].text : (rts[0] || {}).text || '';
  const rest = rts.slice((titleIdx >= 0 ? titleIdx : 0) + 1);
  const desc = rest.length ? rest[0].text : '';
  const fields = [];
  for (let i = 1; i < rest.length; i += 2) {
    const label = rest[i].text;
    const value = rest[i + 1] ? rest[i + 1].text : '';
    if (label) fields.push({ label, value });
  }
  const gallery = [];
  sec.find('[data-hook=item-container]').each((i, el) => {
    const src = $(el).find('img').attr('src') || '';
    let uri = src.split('/media/')[1] ? src.split('/media/')[1].split('/')[0] : '';
    if (!uri) uri = ($(el).attr('data-id') || '').replace(/mv2\.(jpg|jpeg|png|webp)$/i, '~mv2.$1');
    if (uri) { noteImg(uri); gallery.push(uri); }
  });
  return { slug, back, title, desc, fields, gallery };
}

fs.mkdirSync(DATA, { recursive: true });
for (const lang of LANGS) {
  const out = {
    lang,
    home: home(lang),
    about: about(lang),
    services: services(lang),
    contact: contact(lang),
    privacy: privacy(lang),
    projectsList: projectsList(lang),
    projects: {},
  };
  for (const s of slugs) {
    try { out.projects[s] = projectPage(lang, s); }
    catch (e) { console.log('  ! project', lang, s, e.message); }
  }
  fs.writeFileSync(path.join(DATA, lang + '.json'), JSON.stringify(out, null, 2));
  console.log(lang,
    '| svcHome:', out.home.services.items.length,
    '| feat:', out.home.features.length,
    '| homeProj:', out.home.projects.items.length,
    '| services:', out.services.items.length,
    '| team:', out.about.team.members.length,
    '| list:', out.projectsList.items.length,
    '| pages:', Object.keys(out.projects).length);
}
fs.writeFileSync(path.join(DATA, 'images.json'), JSON.stringify([...images].sort(), null, 2));
console.log('unique images:', images.size);
