const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  for (const [name, url] of Object.entries({ home: '', about: 'about/', services: 'services/', projects: 'projects/', contact: 'contact/' })) {
    await p.goto('http://localhost:4321/' + url, { waitUntil: 'networkidle2', timeout: 60000 });
    await p.addStyleTag({ content: 'html{scroll-behavior:auto!important} .reveal{opacity:1!important;transform:none!important}' });
    await new Promise(r => setTimeout(r, 900));
    await p.screenshot({ path: path.join(__dirname, 'shots', 'm_' + name + '.png') });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(name, 'h-overflow:', overflow);
  }
  await b.close();
})();
