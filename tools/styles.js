// Reads computed styles + geometry of key elements from the live site.
const puppeteer = require('puppeteer');

const TARGETS = {
  header: '#comp-mcvodwo2_r_comp-mcvodcmx, section[data-testid=section-container]',
  navLink: 'a .wixui-horizontal-menu__item-label, a .wixui-menu__item-label',
  headerBtn: 'button.wixui-button',
  heroBadge: '#comp-kbgaghri button',
  heroText: '#comp-lk9j793e p',
  heroBtn1: '#comp-kbgaghri a[href*="/contact"]',
  heroBtn2: '#comp-kbgaghri a[href*="/services"]',
  h2Services: '#comp-lk9orfv7 h2',
  svcIntro: '#comp-mbp3qwmg p',
  svcCard: '#comp-mbufpebw__item1',
  svcCardTitle: '#comp-mbp3qwn2__item1 h6',
  svcIconBox: '#comp-mbufhctp__item1',
  featTitle: '#comp-mcaa3o4p__item1 h6',
  featText: '#comp-mcaa3o4x__item1 p',
  aboutH2: '#comp-mckkicdb h2',
  aboutP: '#comp-lk9jwrya p',
  projH2: '#comp-mbc408me h2',
  ctaH2: '#comp-md1n6m34_r_comp-lk9m9ycd8 h2',
  ctaP: '#comp-md1n6m34_r_comp-lk9m9ycc1 p',
  ctaBtn: '#comp-md1n6m34_r_comp-lk9lw8bz a[href*="/contact"]',
  footer: 'section[data-testid=section-container]:last-of-type',
  footerH: '#comp-kbgakxmn_r_comp-lk9mjchy p',
  footerP: '#comp-kbgakxmn_r_comp-lk9mnaaa p',
  wa: '#comp-md1rbu2q button',
  page: 'body',
};

const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'textAlign',
  'padding', 'margin', 'borderRadius', 'border', 'boxShadow', 'width', 'height', 'maxWidth', 'gap', 'display', 'gridTemplateColumns', 'justifyContent', 'alignItems'];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.goto(process.argv[2] || 'https://www.bbd.ge/', { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 800));
  });
  const res = await page.evaluate((TARGETS, PROPS) => {
    const out = {};
    for (const [k, sel] of Object.entries(TARGETS)) {
      const el = document.querySelector(sel);
      if (!el) { out[k] = 'NOT FOUND'; continue; }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const o = { rect: [Math.round(r.width), Math.round(r.height)] };
      for (const p of PROPS) { const v = cs[p]; if (v && v !== 'none' && v !== 'normal' && v !== '0px' && v !== 'auto' && v !== 'rgba(0, 0, 0, 0)') o[p] = v; }
      out[k] = o;
    }
    // section geometry
    out.__sections = [...document.querySelectorAll('section[data-testid=section-container]')].map((s) => {
      const cs = getComputedStyle(s);
      const r = s.getBoundingClientRect();
      return { id: s.id, h: Math.round(r.height), bg: cs.backgroundColor, bgi: cs.backgroundImage.slice(0, 60), pad: cs.padding };
    });
    const mw = document.querySelector('.max-width-container');
    out.__container = mw ? { width: Math.round(mw.getBoundingClientRect().width), cs: getComputedStyle(mw).maxWidth, pad: getComputedStyle(mw).padding } : null;
    return out;
  }, TARGETS, PROPS);
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
