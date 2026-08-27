// Downloads every bbd.ge page (ka/en/ru) into cache/ as raw HTML.
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, 'cache');

const STATIC = ['', 'about', 'services', 'projects', 'contact', 'privacy-policy'];
const LANGS = [
  { code: 'ka', prefix: '' },
  { code: 'en', prefix: '/en' },
  { code: 'ru', prefix: '/ru' },
];

function get(url, tries = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(res.headers.location, tries));
      }
      let d = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', (e) => (tries > 1 ? setTimeout(() => resolve(get(url, tries - 1)), 1500) : reject(e)));
  });
}

async function projectSlugs() {
  const url = 'https://www.bbd.ge/dynamic-projects_p_7576023c_62d0_41b3_8b66_6607fe4422bf_0_5000-sitemap.xml';
  const { body } = await get(url);
  return [...body.matchAll(/<loc>https:\/\/www\.bbd\.ge\/projects\/([^<]+)<\/loc>/g)].map((m) => m[1]);
}

(async () => {
  const slugs = await projectSlugs();
  fs.writeFileSync(path.join(ROOT, 'tools', 'slugs.json'), JSON.stringify(slugs, null, 2));
  console.log('project slugs:', slugs.length);

  const jobs = [];
  for (const lang of LANGS) {
    for (const p of STATIC) jobs.push({ lang: lang.code, key: p || 'home', url: `https://www.bbd.ge${lang.prefix}${p ? '/' + p : ''}` });
    for (const s of slugs) jobs.push({ lang: lang.code, key: 'projects/' + s, url: `https://www.bbd.ge${lang.prefix}/projects/${s}` });
  }
  console.log('total pages:', jobs.length);

  let done = 0;
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length) {
      const j = queue.shift();
      const file = path.join(CACHE, j.lang, decodeURIComponent(j.key).replace(/[<>:"|?*]/g, '_') + '.html');
      if (fs.existsSync(file) && fs.statSync(file).size > 50000) { done++; continue; }
      try {
        const r = await get(j.url);
        if (r.status !== 200) { console.log('  !', r.status, j.url); continue; }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, r.body);
      } catch (e) { console.log('  X', j.url, e.message); }
      done++;
      if (done % 20 === 0) console.log(`  ${done}/${jobs.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log('done', done);
})();
