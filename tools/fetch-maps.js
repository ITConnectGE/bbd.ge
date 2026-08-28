// Harvests everything about the Google Map on every bbd.ge page that has one:
// centre, zoom, the custom style array, the marker title and the info-window
// links. None of it appears in the HTML — Wix builds the map at runtime — so we
// read it back off the live google.maps objects inside the map iframe.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'maps.json');
const slugs = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'slugs.json'), 'utf8'));

const targets = [{ key: 'contact', url: 'https://www.bbd.ge/contact' }]
  .concat(slugs.map((s) => ({ key: 'projects/' + s, url: 'https://www.bbd.ge/projects/' + s })));

const readMap = async (page) => {
  for (const f of page.frames()) {
    if (!/googleMap/.test(f.url())) continue;
    try {
      const o = await f.evaluate(() => {
        const m = window.googleMapsInstance;
        if (!m || typeof m.getCenter !== 'function') return null;
        const c = m.getCenter();
        const out = { lat: +c.lat().toFixed(7), lng: +c.lng().toFixed(7), zoom: m.getZoom() };
        try { out.styles = m.get('styles') || null; } catch (e) {}

        const mk = [].concat(window.googleMapsMarkerInstances || []).filter(Boolean)[0];
        if (mk && mk.getTitle) out.title = String(mk.getTitle()).trim();

        const iw = [].concat(window.googleMapsInfoWindowInstances || []).filter(Boolean)[0];
        if (iw) {
          let html = null;
          try { const c2 = iw.getContent(); html = c2 && c2.outerHTML ? c2.outerHTML : String(c2 || ''); } catch (e) {}
          if (html) {
            const dir = html.match(/href="(https:\/\/www\.google\.com\/maps\/dir\/[^"]*)"/);
            if (dir) out.directions = dir[1].replace(/&amp;/g, '&');
            const share = html.match(/href="(https:\/\/maps\.app\.goo\.gl\/[^"]*)"/);
            if (share) out.share = share[1];
          }
        }
        return out;
      });
      if (o) return o;
    } catch (e) {}
  }
  return null;
};

(async () => {
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const data = {};
  let styles = prev._style || null;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  let done = 0, found = 0;
  for (const t of targets) {
    done++;
    try {
      await page.goto(t.url, { waitUntil: 'networkidle2', timeout: 90000 });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 70)); }
      });
      let m = null;
      for (let tries = 0; tries < 6 && !m; tries++) {
        await new Promise(r => setTimeout(r, 1500));
        m = await readMap(page);
      }
      if (m) {
        // the style array is identical on every map; keep one copy
        if (m.styles && !styles) styles = m.styles;
        delete m.styles;
        data[t.key] = m;
        found++;
      } else console.log('  ! no map', t.key);
    } catch (e) { console.log('  X', t.key, e.message); }
    if (done % 10 === 0) console.log(`  ${done}/${targets.length} (${found} with maps)`);
  }

  fs.writeFileSync(OUT, JSON.stringify(Object.assign({ _style: styles }, data), null, 1));
  console.log('maps captured:', found, 'of', targets.length, '| style rules:', styles ? styles.length : 0);
  await browser.close();
})();
