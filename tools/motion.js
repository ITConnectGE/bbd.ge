const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  for (const url of process.argv.slice(2)) {
    const p = await b.newPage();
    await p.setViewport({ width: 1600, height: 900 });
    await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
    await p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
    // walk down slowly so every reveal fires, then read the settled state
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 250) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } });
    await new Promise(r => setTimeout(r, 2500));
    const out = await p.evaluate(() => {
      const anim = [], shapes = [];
      document.querySelectorAll('*').forEach((e) => {
        const c = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        const comp = (e.className || '').toString().split(' ').find((x) => /^comp-/.test(x)) || '';
        if (c.animationName && c.animationName !== 'none') {
          anim.push({ comp, name: c.animationName, clip: c.getPropertyValue('--motion-clip-start').trim(),
            tx: c.getPropertyValue('--motion-translate-x').trim(), ty: c.getPropertyValue('--motion-translate-y').trim(),
            y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) });
        }
        if (/wixui-vector-image/.test((e.className || '').toString()) && r.width > 80 && r.height > 80) {
          const svg = e.querySelector('svg');
          const pa = svg && svg.querySelector('path,polygon,rect,circle');
          shapes.push({ comp, x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height),
            op: c.opacity, fill: pa ? getComputedStyle(pa).fill : '', fo: pa ? getComputedStyle(pa).fillOpacity : '',
            d: pa ? (pa.getAttribute('d') || '').slice(0, 40) : '' });
        }
      });
      return { anim, shapes };
    });
    console.log('\n===== ' + url);
    console.log('-- animated --'); out.anim.forEach((a) => console.log('  ', JSON.stringify(a)));
    console.log('-- shapes --'); out.shapes.forEach((s) => console.log('  ', JSON.stringify(s)));
    await p.close();
  }
  await b.close();
})();
