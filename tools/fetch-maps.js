// Harvests the Google Map centre/zoom/marker from every bbd.ge page that has one.
// The location never appears in the HTML — Wix passes it to the map iframe at
// runtime — so we read it back off the live google.maps.Map instance.
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
        // the marker carries the address label shown in the info window
        try {
          const mk = window.markers || window.mapMarkers || [];
          const arr = Array.isArray(mk) ? mk : [mk];
          const first = arr.filter(Boolean)[0];
          if (first && first.getTitle) out.title = first.getTitle();
        } catch (e) {}
        return out;
      });
      if (o) return o;
    } catch (e) {}
  }
  return null;
};

(async () => {
  const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  let done = 0, found = 0;
  for (const t of targets) {
    done++;
    if (existing[t.key]) { found++; continue; }
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
      if (m) { existing[t.key] = m; found++; }
      else console.log('  ! no map', t.key);
    } catch (e) { console.log('  X', t.key, e.message); }
    if (done % 10 === 0) {
      console.log(`  ${done}/${targets.length} (${found} with maps)`);
      fs.writeFileSync(OUT, JSON.stringify(existing, null, 1));
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(existing, null, 1));
  console.log('maps captured:', Object.keys(existing).length, 'of', targets.length);
  await browser.close();
})();
