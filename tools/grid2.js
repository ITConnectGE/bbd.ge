const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  await p.goto('https://www.bbd.ge/', { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise(r => setTimeout(r, 2500));
  const out = await p.evaluate(() => {
    // sample pixel colors is not possible; instead find thin/gradient backgrounds
    const hits = [];
    document.querySelectorAll('*').forEach((e) => {
      const cs = getComputedStyle(e);
      const bi = cs.backgroundImage;
      if (bi && bi !== 'none' && /repeating|linear-gradient/.test(bi) && !/url/.test(bi)) {
        const r = e.getBoundingClientRect();
        if (r.width > 800) hits.push({ id: e.id, cls: (e.className||'').toString().slice(0,60), bi: bi.slice(0, 200), w: Math.round(r.width), h: Math.round(r.height), sz: cs.backgroundSize });
      }
    });
    // elements exactly 1-2px wide and tall
    const thin = [];
    document.querySelectorAll('*').forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width <= 2 && r.height > 100) thin.push({ id: e.id, cls: (e.className||'').toString().slice(0,50), x: Math.round(r.x), h: Math.round(r.height), bg: getComputedStyle(e).backgroundColor });
    });
    return { hits: hits.slice(0, 10), thin: thin.slice(0, 12) };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
