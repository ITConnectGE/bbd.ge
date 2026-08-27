// Crawls every internal link of the built site and reports non-200s.
const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2];
const root = new URL(BASE);
const client = root.protocol === 'https:' ? https : http;

const seen = new Set();
const queue = [BASE];
const bad = [];
let pages = 0;

const get = (u) => new Promise((res) => {
  const lib = new URL(u).protocol === 'https:' ? https : http;
  lib.get(u, { headers: { 'User-Agent': 'link-check' } }, (r) => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return res(get(new URL(r.headers.location, u).href)); }
    let d = '';
    const isHtml = /text\/html/.test(r.headers['content-type'] || '');
    if (!isHtml) { r.resume(); return res({ status: r.statusCode, body: '' }); }
    r.setEncoding('utf8');
    r.on('data', (c) => (d += c));
    r.on('end', () => res({ status: r.statusCode, body: d }));
  }).on('error', (e) => res({ status: 0, body: '', err: e.message }));
});

(async () => {
  while (queue.length) {
    const u = queue.shift();
    if (seen.has(u)) continue;
    seen.add(u);
    const { status, body, err } = await get(u);
    if (status !== 200) { bad.push(status + (err ? ' ' + err : '') + '  ' + u); continue; }
    if (!body) continue;
    pages++;
    for (const m of body.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
      let target;
      try { target = new URL(m[1], u); } catch (e) { continue; }
      if (target.origin !== root.origin) continue;
      if (!target.pathname.startsWith(root.pathname)) continue;
      target.hash = '';
      if (/\.(pdf|png|jpe?g|webp|svg|woff2?|xml|txt)$/i.test(target.pathname)) continue;
      if (!seen.has(target.href)) queue.push(target.href);
    }
  }
  console.log('html pages crawled:', pages, '| urls visited:', seen.size);
  console.log(bad.length ? 'BROKEN:\n' + bad.join('\n') : 'no broken internal links');
})();
