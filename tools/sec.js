const puppeteer = require('puppeteer');
const SELS = process.argv[3].split(',');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  await p.goto(process.argv[2], { waitUntil: 'networkidle2', timeout: 90000 });
  await p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=300){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,70));} window.scrollTo(0,0); await new Promise(r=>setTimeout(r,900)); });
  const out = await p.evaluate((SELS) => SELS.map((s) => {
    const e = document.querySelector(s);
    if (!e) return s + ' = NF';
    const r = e.getBoundingClientRect();
    return s + ' = ' + [Math.round(r.x), Math.round(r.y + window.scrollY), Math.round(r.width), Math.round(r.height)].join(',');
  }).join('\n'), SELS);
  console.log(out, '\nDOC=', await p.evaluate(() => document.documentElement.scrollHeight));
  await b.close();
})();
