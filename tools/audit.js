const puppeteer = require('puppeteer');
const BASE = process.argv[2];
const PAGES = ['', 'about/', 'services/', 'projects/', 'contact/', 'privacy-policy/', 'projects/hisani-towers/',
  'en/', 'en/about/', 'en/services/', 'en/projects/', 'en/contact/', 'en/projects/hisani-towers/',
  'ru/', 'ru/about/', 'ru/services/', 'ru/projects/', 'ru/contact/', 'ru/projects/tunnel-rikoti/'];
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  let bad = 0;
  for (const path of PAGES) {
    const fails = [];
    const onResp = (r) => { if (r.status() >= 400) fails.push(r.status() + ' ' + r.url().replace(BASE, '')); };
    p.on('response', onResp);
    const errs = [];
    const onErr = (e) => errs.push(e.message);
    p.on('pageerror', onErr);
    await p.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 90000 });
    await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));} });
    await new Promise(r => setTimeout(r, 1200));
    const info = await p.evaluate(() => ({
      title: document.title,
      brokenImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.split('/').pop()),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      deadLinks: [...document.querySelectorAll('a[href="#"], a[href=""]')].length,
    }));
    p.off('response', onResp); p.off('pageerror', onErr);
    const problems = [...fails, ...errs.map(e => 'JS: ' + e), ...info.brokenImgs.map(i => 'img: ' + i)];
    if (problems.length || info.overflow > 1 || info.deadLinks) bad++;
    console.log((problems.length || info.overflow > 1 || info.deadLinks ? 'FAIL' : ' ok '), path.padEnd(30), info.title.slice(0, 34).padEnd(36),
      'ovf=' + info.overflow, 'dead=' + info.deadLinks, problems.slice(0, 4).join(' | '));
  }
  console.log(bad ? bad + ' page(s) with problems' : 'all clean');
  await b.close();
})();
