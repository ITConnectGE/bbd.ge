const puppeteer = require('puppeteer');
const T = {
  iconInner: '#comp-mbufhctp__item1 > .inner-box',
  cardInner: '#comp-mbufpebw__item1 > .inner-box',
  cardArrow: '#comp-mbufpebw__item1 a',
  moreLink: '#comp-mbc3voau a[href*="/services"]:last-of-type',
  gridLines: '.max-width-container',
  heroSecInner: '#comp-kbgaghri .max-width-container',
  svcSecInner: '#comp-mbc3voau .max-width-container',
  svcGrid: '#comp-mbp3qwn2, [id^=comp-mbp3qwn2]',
  featSecInner: '#comp-mca9v5fg .max-width-container',
  projCard: '#comp-mbc408lr [data-hook=item-container]',
  projTitle: '#comp-mbc408lr [data-hook=item-title]',
  projDesc: '#comp-mbc408lr [data-hook=item-description]',
  heroImg: '#comp-kbgaghri [data-image-info]',
  aboutImg1: '#comp-lk9jshjq [data-image-info]',
  diamond: '[class*=wixui-vector-image]',
};
const P = ['color','backgroundColor','backgroundImage','backgroundSize','backgroundPosition','fontFamily','fontSize','lineHeight','padding','margin','borderRadius','border','boxShadow','width','height','display','gridTemplateColumns','gap','objectFit','position','top','left','right','bottom','opacity','columnGap','rowGap','maxWidth'];
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 1000 });
  await p.goto('https://www.bbd.ge/', { waitUntil: 'networkidle2', timeout: 90000 });
  await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=300){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));} window.scrollTo(0,0); await new Promise(r=>setTimeout(r,900)); });
  const out = await p.evaluate((T,P) => {
    const r = {};
    for (const [k,sel] of Object.entries(T)) {
      const e = document.querySelector(sel);
      if (!e) { r[k]='NOT FOUND'; continue; }
      const cs = getComputedStyle(e), bb = e.getBoundingClientRect();
      const o = { _rect:[Math.round(bb.width),Math.round(bb.height),Math.round(bb.x),Math.round(bb.y)] };
      for (const q of P) { const v = cs[q]; if (v && v!=='none' && v!=='normal' && v!=='0px' && v!=='auto' && v!=='rgba(0, 0, 0, 0)' && v!=='static' && v!=='1') o[q]=v; }
      r[k]=o;
    }
    // vertical guide lines: find repeated 1px-wide bordered columns
    const gl = [...document.querySelectorAll('.max-width-container > *')].slice(0,3).map(e=>({cls:e.className,cs:getComputedStyle(e).borderLeft, gtc:getComputedStyle(e).gridTemplateColumns}));
    r.__gl = gl;
    return r;
  }, T, P);
  console.log(JSON.stringify(out,null,1));
  await b.close();
})();
