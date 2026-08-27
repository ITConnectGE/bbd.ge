const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2];
const OUT = process.argv[3] || 'tools/sniff';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  let n = 0;
  const log = [];
  page.on('response', async (res) => {
    try {
      const u = res.url();
      const ct = res.headers()['content-type'] || '';
      if (!/json/.test(ct)) return;
      if (!/wix-data|cloud-data|dynamicmodel|items\/query|collections|pro-gallery|dataset/i.test(u)) return;
      const body = await res.text();
      if (body.length < 200) return;
      const f = path.join(OUT, String(++n).padStart(3,'0') + '.json');
      fs.writeFileSync(f, body);
      log.push(`${f}  ${body.length}  ${u.split('?')[0]}`);
    } catch (e) {}
  });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); }
  });
  await new Promise(r => setTimeout(r, 4000));
  console.log(log.join('\n') || 'nothing captured');
  await browser.close();
})();
