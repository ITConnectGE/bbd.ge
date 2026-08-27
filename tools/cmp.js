const puppeteer = require('puppeteer');
const A = process.argv[2], B = process.argv[3];
async function grab(browser, url) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1600, height: 900 });
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=300){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,70));} window.scrollTo(0,0); await new Promise(r=>setTimeout(r,900)); });
  const rows = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('h1,h2,h3,h6,p,img,a,button').forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 20 || r.height < 8) return;
      const t = (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28);
      const key = (t || (e.currentSrc ? (e.currentSrc.split('/media/')[1]||e.currentSrc.split('/img/')[1]||'').split('/')[0].replace('~mv2','').slice(0,26) : ''));
      if (!key) return;
      out.push({ key, tag: e.tagName.toLowerCase(), x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height), fs: getComputedStyle(e).fontSize });
    });
    return out;
  });
  await p.close();
  return rows;
}
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const [a, c] = [await grab(b, A), await grab(b, B)];
  const idx = {};
  c.forEach((r) => { (idx[r.key] = idx[r.key] || []).push(r); });
  const used = new Set();
  console.log('KEY'.padEnd(30), 'LIVE x,y,w,h'.padEnd(24), 'MINE x,y,w,h'.padEnd(24), 'Δx Δy Δw');
  for (const r of a) {
    const cands = idx[r.key];
    if (!cands || !cands.length) { console.log(r.key.padEnd(30), `${r.x},${r.y},${r.w},${r.h}`.padEnd(24), 'MISSING'); continue; }
    const m = cands.find((x) => !used.has(x)) || cands[0];
    used.add(m);
    const dx = m.x - r.x, dy = m.y - r.y, dw = m.w - r.w;
    const flag = (Math.abs(dx) > 12 || Math.abs(dy) > 25 || Math.abs(dw) > 20) ? '  <<<' : '';
    console.log(r.key.padEnd(30), `${r.x},${r.y},${r.w},${r.h}`.padEnd(24), `${m.x},${m.y},${m.w},${m.h}`.padEnd(24), `${dx} ${dy} ${dw}${flag}`);
  }
  await b.close();
})();
