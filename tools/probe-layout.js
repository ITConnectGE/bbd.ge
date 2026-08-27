const puppeteer = require('puppeteer');
const url = process.argv[2];
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=300){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));} window.scrollTo(0,0); await new Promise(r=>setTimeout(r,900)); });
  const out = await p.evaluate(() => {
    return [...document.querySelectorAll('section[data-testid=section-container]')].map((s) => {
      const r = s.getBoundingClientRect();
      const inner = s.querySelector('.max-width-container');
      const kids = [];
      s.querySelectorAll('h1,h2,h3,h6,[data-image-info],[data-testid=item-container]').forEach((e) => {
        const k = e.getBoundingClientRect();
        kids.push({ t: e.tagName.toLowerCase(), x: Math.round(k.x), y: Math.round(k.y + window.scrollY), w: Math.round(k.width), h: Math.round(k.height), txt: (e.textContent||'').replace(/\s+/g,' ').trim().slice(0, 40) });
      });
      return { id: s.id, y: Math.round(r.y + window.scrollY), h: Math.round(r.height), pad: inner ? getComputedStyle(inner).padding : '', kids: kids.slice(0, 8) };
    });
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
