const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  await p.goto(process.argv[2], { waitUntil: 'networkidle2', timeout: 90000 });
  await p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=300){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,70));} });
  const out = await p.evaluate(() => {
    const res = [];
    document.querySelectorAll('[class*=wixui-vector-image], [data-testid^=svgRoot]').forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 60 || r.height < 60) return;
      const svg = e.querySelector('svg');
      const fill = svg ? getComputedStyle(svg.querySelector('path,polygon,rect,circle,ellipse') || svg).fill : '';
      res.push({ id: e.id || (e.className||'').toString().slice(0,40), x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height), fill, shape: svg ? (svg.getAttribute('data-bbox')||'') : '' });
    });
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
