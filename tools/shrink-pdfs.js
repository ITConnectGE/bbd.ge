// Re-encodes the JPEGs inside the company-profile PDFs so the whole site fits
// comfortably in a GitHub Pages artifact. Text, layout and page count are
// untouched — only embedded raster images are downscaled and recompressed.
//
//   node tools/shrink-pdfs.js <inDir> [outDir] [maxWidth] [quality]
//
// src/assets/files already holds the web-ready copies; the untouched originals
// live on the repo's `assets` release. To regenerate:
//
//   gh release download assets -D /tmp/pdf-originals
//   node tools/shrink-pdfs.js /tmp/pdf-originals src/assets/files
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument, PDFName, PDFRawStream, PDFNumber } = require('pdf-lib');

const ROOT = path.join(__dirname, '..');
const IN = path.resolve(process.argv[2] || path.join(ROOT, 'src', 'assets', 'files'));
const OUT = path.resolve(process.argv[3] || path.join(IN, 'compressed'));

const MAX_W = Number(process.argv[4]) || 1600;
const QUALITY = Number(process.argv[5]) || 72;
const MIN_BYTES = 20 * 1024; // leave tiny images (logos, icons) alone

const name = (n) => (n && n.constructor === PDFName ? n.asString() : String(n));

async function shrink(file) {
  const src = fs.readFileSync(path.join(IN, file));
  const doc = await PDFDocument.load(src, { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context;

  let touched = 0, before = 0, after = 0, skipped = 0;

  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (name(dict.get(PDFName.of('Subtype'))) !== '/Image') continue;

    const filter = dict.get(PDFName.of('Filter'));
    const filters = filter && filter.asArray ? filter.asArray().map(name) : [name(filter)];
    if (filters.length !== 1 || filters[0] !== '/DCTDecode') { skipped++; continue; }

    const jpeg = Buffer.from(obj.getContents());
    if (jpeg.length < MIN_BYTES) { skipped++; continue; }

    const w = dict.get(PDFName.of('Width'));
    const width = w instanceof PDFNumber ? w.asNumber() : null;

    let out;
    try {
      let pipe = sharp(jpeg, { failOn: 'none' }).toColorspace('srgb');
      if (width && width > MAX_W) pipe = pipe.resize({ width: MAX_W, withoutEnlargement: true });
      out = await pipe.jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer();
    } catch (e) { skipped++; continue; }

    if (out.length >= jpeg.length) { skipped++; continue; } // never make one bigger

    const meta = await sharp(out).metadata();
    const newDict = { Type: 'XObject', Subtype: 'Image', Width: meta.width, Height: meta.height,
      ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode' };
    // an alpha channel lives in a separate object; carry the reference across
    for (const key of ['SMask', 'Mask']) {
      const v = dict.get(PDFName.of(key));
      if (v) newDict[key] = v;
    }
    ctx.assign(ref, PDFRawStream.of(ctx.obj(newDict), out));

    touched++; before += jpeg.length; after += out.length;
  }

  const bytes = await doc.save({ useObjectStreams: false });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, file), bytes);

  const mb = (n) => (n / 1048576).toFixed(1) + 'MB';
  console.log(`${file}: ${mb(src.length)} -> ${mb(bytes.length)} ` +
    `(${touched} images ${mb(before)}->${mb(after)}, ${skipped} left alone)`);
  return { in: src.length, out: bytes.length };
}

(async () => {
  if (path.resolve(IN) === path.resolve(OUT)) throw new Error('inDir and outDir must differ');
  console.log(`${IN} -> ${OUT}  (max width ${MAX_W}px, quality ${QUALITY})`);
  const files = fs.readdirSync(IN).filter((f) => f.endsWith('.pdf'));
  let ti = 0, to = 0;
  for (const f of files) { const r = await shrink(f); ti += r.in; to += r.out; }
  console.log(`total: ${(ti / 1048576).toFixed(1)}MB -> ${(to / 1048576).toFixed(1)}MB`);
})();
