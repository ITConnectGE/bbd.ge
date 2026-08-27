const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  await p.goto('https://www.bbd.ge/projects', { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise(r => setTimeout(r, 3000));
  const count = () => p.evaluate(() => document.querySelectorAll('[id^=comp-mbc4nj864__]').length);
  console.log('all:', await count());
  const opts = await p.evaluate(() => [...document.querySelectorAll('select')].map(s => ({ id: s.id, opts: [...s.options].map(o => o.text) })));
  console.log('selects:', JSON.stringify(opts));
  const radios = await p.$$('[data-testid=radioGroup] input, [role=radio], input[type=radio]');
  console.log('radios:', radios.length);
  for (let i = 1; i < Math.min(radios.length, 3); i++) {
    await radios[i].click().catch(e => console.log('  click fail', e.message));
    await new Promise(r => setTimeout(r, 2500));
    console.log('after radio', i, '->', await count());
  }
  await b.close();
})();
