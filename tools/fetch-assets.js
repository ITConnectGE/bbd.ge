// Downloads every image referenced by data/images.json plus the company-profile PDFs.
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'assets', 'img');
const PDFOUT = path.join(ROOT, 'src', 'assets', 'files');

const uris = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'images.json'), 'utf8'));

const PDFS = {
  ka: { id: '4b098c_9ceb5a2c47d14df389379ed326718097', name: 'BBD-company-profile-ka.pdf' },
  en: { id: '4b098c_45e347a99af2434abfc2b7a3bb80909f', name: 'BBD-company-profile-en.pdf' },
  ru: { id: '4b098c_b497aeae3e6e4a499de93e9854eae727', name: 'BBD-company-profile-ru.pdf' },
};

function fetchBuf(url, tries = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/126' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(fetchBuf(res.headers.location, tries));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', (e) => (tries > 1 ? setTimeout(() => resolve(fetchBuf(url, tries - 1)), 1200) : reject(e)));
  });
}

// "4b098c_801e...~mv2.jpg" -> "4b098c_801e....jpg"  (safe, stable local filename)
const localName = (uri) => uri.replace('~mv2', '');

const MAX = 2000;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(PDFOUT, { recursive: true });

  let done = 0, saved = 0;
  const queue = uris.filter(Boolean).slice();
  const worker = async () => {
    while (queue.length) {
      const uri = queue.shift();
      const name = localName(uri);
      const dest = path.join(OUT, name);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) { done++; continue; }
      const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
      const base = 'https://static.wixstatic.com/media/' + uri;
      const fit = base + `/v1/fit/w_${MAX},h_${MAX},al_c,q_90,enc_auto/x.${ext}`;
      try {
        const [orig, small] = await Promise.all([
          fetchBuf(base).catch(() => null),
          fetchBuf(fit).catch(() => null),
        ]);
        const pick = !orig ? small : !small ? orig : (small.length < orig.length ? small : orig);
        if (!pick) { console.log('  X', uri); done++; continue; }
        fs.writeFileSync(dest, pick);
        saved += pick.length;
      } catch (e) { console.log('  X', uri, e.message); }
      done++;
      if (done % 20 === 0) console.log(`  images ${done}/${uris.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log('images done:', done, '~', (saved / 1048576).toFixed(1), 'MB new');

  for (const [lang, p] of Object.entries(PDFS)) {
    const dest = path.join(PDFOUT, p.name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) { console.log('  pdf cached', p.name); continue; }
    const buf = await fetchBuf('https://4b098c.usrfiles.com/ugd/' + p.id + '.pdf');
    fs.writeFileSync(dest, buf);
    console.log('  pdf', lang, p.name, (buf.length / 1048576).toFixed(1) + 'MB');
  }
})();
