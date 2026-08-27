const fs = require('fs'); const cheerio = require('cheerio');
const file = process.argv[2];
const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
$('section[data-testid=section-container]').each((si, sec) => {
  const sid = $(sec).attr('id');
  console.log('\n########## SECTION ' + sid);
  const walk = (el, d) => {
    $(el).children().each((i, c) => {
      const $c = $(c);
      const tag = c.tagName;
      const id = $c.attr('id') || '';
      const dh = $c.attr('data-testid') || $c.attr('data-hook') || '';
      let line = '';
      if (dh === 'richTextElement') {
        const parts = [];
        $c.find('h1,h2,h3,h4,h5,h6,p,li').each((j, t) => { const s = $(t).text().replace(/\u200b/g,'').trim(); if (s) parts.push(t.tagName + ':' + s); });
        line = 'TEXT ' + id + ' >> ' + parts.join(' | ').slice(0, 400);
      } else if ($c.attr('data-image-info')) {
        try { const info = JSON.parse($c.attr('data-image-info')); line = 'IMG ' + id + ' >> ' + info.imageData.uri + ' ' + info.imageData.width + 'x' + info.imageData.height + ' "' + (info.imageData.name||'') + '"'; } catch(e) { line = 'IMG?'; }
      } else if (tag === 'a' && $c.attr('href')) {
        line = 'LINK ' + $c.attr('href') + ' :: ' + $c.text().replace(/\s+/g,' ').trim().slice(0,80);
      } else if (dh === 'item-container') {
        line = 'GALLERY ' + $c.attr('data-id');
      } else if (tag === 'button') {
        line = 'BTN :: ' + $c.text().replace(/\s+/g,' ').trim().slice(0,60);
      } else if (tag === 'svg') { return; }
      if (line) console.log('  '.repeat(d) + line);
      if (d < 30) walk(c, d + 1);
    });
  };
  walk(sec, 1);
});
