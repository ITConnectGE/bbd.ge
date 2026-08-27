const puppeteer = require('puppeteer');

const URL = process.argv[2] || 'https://www.bbd.ge/projects/hisani-towers';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 500));
  });
  const out = await page.evaluate(() => {
    const lines = [];
    const walk = (el, depth) => {
      if (depth > 22) return;
      const tag = el.tagName.toLowerCase();
      if (['script','style','noscript','svg','path'].includes(tag)) return;
      const id = el.id ? '#' + el.id : '';
      const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0,3).join('.');
      const dh = el.getAttribute('data-hook') || el.getAttribute('data-testid') || '';
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
      let extra = '';
      if (tag === 'img') extra = ' SRC=' + (el.currentSrc || el.src || '').split('/').pop().split('?')[0];
      if (tag === 'a') extra = ' HREF=' + el.getAttribute('href');
      if (own || extra || dh) lines.push('  '.repeat(depth) + tag + id + (cls?'.'+cls:'') + (dh?'[' + dh + ']':'') + extra + (own ? ' :: ' + own.slice(0,160) : ''));
      for (const c of el.children) walk(c, depth + 1);
    };
    walk(document.body, 0);
    return lines.join('\n');
  });
  console.log(out);
  await browser.close();
})();
