const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'shots');
const pages = (process.argv[2] || 'index,about,services,projects,contact,projects/hisani-towers').split(',');
const BASE = process.argv[3] || 'http://localhost:4321';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  for (const name of pages) {
    const url = BASE + '/' + (name === 'index' ? '' : name + '/');
    await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=400){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,90));} window.scrollTo(0,0); await new Promise(r=>setTimeout(r,800)); });
    const file = path.join(OUT, name.replace(/\//g, '_') + '.png');
    await p.screenshot({ path: file, fullPage: true });
    const h = await p.evaluate(() => document.documentElement.scrollHeight);
    console.log(name, '->', file, 'h=' + h);
  }
  await b.close();
})();
