const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  await p.goto('https://www.bbd.ge/', { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise(r => setTimeout(r, 2500));
  const out = await p.evaluate(() => {
    const res = [];
    document.querySelectorAll('*').forEach((e) => {
      const cs = getComputedStyle(e);
      const bl = cs.borderLeftWidth, br = cs.borderRightWidth;
      const r = e.getBoundingClientRect();
      if ((bl !== '0px' || br !== '0px') && r.height > 200 && r.width < 400 && r.width > 100) {
        res.push({ cls: (e.className || '').toString().slice(0, 60), x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), bl, br, bc: cs.borderLeftColor || cs.borderRightColor });
      }
    });
    // also elements that look like the divider columns
    const cols = [...document.querySelectorAll('[class*=wixui-box]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 250 && r.width < 340 && r.height > 300; }).slice(0, 8)
      .map(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { cls: (e.className||'').toString().slice(0,60), x: Math.round(r.x), w: Math.round(r.width), border: cs.border, bg: cs.backgroundColor }; });
    return { res: res.slice(0, 12), cols, vw: window.innerWidth, doc: document.documentElement.clientWidth };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
