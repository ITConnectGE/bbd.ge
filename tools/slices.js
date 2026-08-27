const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'shots');
const url = process.argv[2];
const tag = process.argv[3];
const positions = (process.argv[4] || '0,800,1600,2400,3200,4000').split(',').map(Number);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  await p.addStyleTag; await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=300){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,80));} });
  for (const y of positions) {
    await p.evaluate((yy) => window.scrollTo(0, yy), y);
    await new Promise(r => setTimeout(r, 700));
    await p.screenshot({ path: path.join(OUT, `${tag}_${y}.png`) });
  }
  console.log('ok', tag, await p.evaluate(() => document.documentElement.scrollHeight));
  await b.close();
})();
