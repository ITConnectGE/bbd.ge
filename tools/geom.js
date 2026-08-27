const puppeteer = require('puppeteer');
const url = process.argv[2], sel = process.argv[3] || 'h1,h2,h3,h6,p,img,a[class*=wixui-button],button,[data-hook=item-container],wow-image';
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=300){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,70));} window.scrollTo(0,0); await new Promise(r=>setTimeout(r,900)); });
  const out = await p.evaluate((sel) => {
    const rows = [];
    document.querySelectorAll(sel).forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 5 || r.height < 5) return;
      const cs = getComputedStyle(e);
      const t = (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 34);
      rows.push([e.tagName.toLowerCase(), Math.round(r.x), Math.round(r.y + window.scrollY), Math.round(r.width), Math.round(r.height), cs.fontSize, t || (e.currentSrc ? (e.currentSrc.split('/media/')[1] || '').split('/')[0].slice(0, 30) : '')].join('\t'));
    });
    return rows.join('\n');
  }, sel);
  console.log(out);
  await b.close();
})();
