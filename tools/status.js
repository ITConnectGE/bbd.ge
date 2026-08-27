const puppeteer = require('puppeteer');
const fs = require('fs');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 1200 });
  await p.goto('https://www.bbd.ge/projects', { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise(r => setTimeout(r, 3000));
  const slugs = () => p.evaluate(() => [...document.querySelectorAll('a[href*="/projects/"]')].map(a => a.getAttribute('href').split('/projects/')[1]).filter(Boolean).filter((v, i, s) => s.indexOf(v) === i));
  const labels = await p.evaluate(() => [...document.querySelectorAll('[data-testid=label]')].map(e => e.textContent.trim()));
  const radios = await p.$$('input[type=radio]');
  const out = {};
  for (let i = 0; i < radios.length; i++) {
    await radios[i].click().catch(() => {});
    await new Promise(r => setTimeout(r, 2600));
    out[labels[i] || 'r' + i] = await slugs();
    console.log(labels[i], out[labels[i]].length);
  }
  fs.writeFileSync('data/status.json', JSON.stringify(out, null, 1));
  await b.close();
})();
