# bbd.ge — static site

A hand-written static rebuild of **bbd.ge** (originally a Wix Studio site), in
Georgian, English and Russian, deployed to GitHub Pages.

**Live:** https://itconnectge.github.io/bbd.ge/

* 6 static pages × 3 languages
* 60 project detail pages × 3 languages
* 198 pages total, no runtime framework — plain HTML, one CSS file, one JS file

## Layout

```
build.js              generator: data/*.json + src/ -> docs/
data/                 extracted site content (one JSON per language)
  ka.json en.json ru.json
  status.json         which projects are finished vs. in progress
  images.json         every image the site references
  maps.json           centre/zoom of every Google Map on the site
  privacy.json        the real privacy policy (overrides the mirrored text)
src/
  css/style.css       the whole design system
  js/main.js          mobile nav, carousel, project filters, contact form
  assets/img          photos, icons, flags (downloaded from Wix, max 2000px)
  assets/fonts        FiraGO Book + Medium (SIL OFL), self-hosted
  assets/vendor       Leaflet, self-hosted
  assets/files        company-profile PDFs, web-ready (ka / en / ru) — see below
tools/                one-off tooling used to mirror and verify the original
docs/                 build output — published by GitHub Pages (git-ignored)
```

## Build

```bash
node build.js          # writes docs/
node tools/serve.js    # preview on http://localhost:4321

node tools/audit.js  http://localhost:4321/   # per-page console errors, 404s, overflow
node tools/crawl.js  http://localhost:4321/   # every internal link across all 198 pages
node tools/cmp.js    https://www.bbd.ge/ http://localhost:4321/   # element-by-element geometry diff
```

`build.js` has no dependencies. The tooling under `tools/` needs
`npm install` (puppeteer, cheerio, sharp, pdf-lib) and is only required when
re-mirroring the original site.

## The company-profile PDFs

The originals are ~23 MB each — 68 MB for the three. That is most of a Pages
artifact, and `actions/deploy-pages` caps its `timeout` at 10 minutes, which a
~100 MB artifact does not reliably publish within.

So `src/assets/files/` holds web-ready copies (~9.5 MB each) produced by
`tools/shrink-pdfs.js`, which re-encodes the embedded JPEGs at max 1600px wide,
quality 72. Text and vectors are untouched, page count and page size are
unchanged, and the pages are indistinguishable at 100% zoom. The finished
artifact is ~61 MB.

The untouched originals are attached to the `assets` release. To regenerate:

```bash
gh release download assets -D /tmp/pdf-originals
node tools/shrink-pdfs.js /tmp/pdf-originals src/assets/files
node tools/shrink-pdfs.js /tmp/pdf-originals src/assets/files 1300 66   # smaller
```

Set `PDF_BASE` to a URL (e.g. that release) to link out instead of bundling.

## The maps

Wix never puts the map location in the HTML — it hands it to the map iframe at
runtime. `tools/fetch-maps.js` reads it back off the live `google.maps` objects
on all 61 pages that have a map and writes `data/maps.json`: centre, zoom, the
marker title, the Directions link, and Wix's style array (`_style`).

The maps are then drawn with **Leaflet** and **OpenStreetMap** tiles — no API
key, no account, no billing. The original used the Google Maps JavaScript API
under Wix's own enterprise licence, which cannot be reused, so centre, zoom,
marker and Directions link all match while the tile artwork is OSM's rather
than Google's. `src/assets/vendor/leaflet` is self-hosted (178 KB).

Three tile styles are built in. `osm` is the default because it is the only one
needing no account at all; CARTO's basemaps now watermark unkeyed requests.

```bash
node build.js                                   # OpenStreetMap (default)
MAP_TILES=carto MAP_TILES_KEY=... node build.js  # CARTO, once a free key exists
```

OSM's tile policy suits a site of this size. If traffic grows, switch to a free
tier that issues a key — CARTO, MapTiler or Stadia — by setting those two
variables; nothing else changes.

`data/maps.json` also holds Wix's own Google style array (`_style`), unused by
Leaflet but kept in case the maps ever move back to the Google API.

16 of the 60 projects have no location set in the Wix CMS and sit at 0,0 —
that is what the original shows too. They get no marker.

## Deploy

`.github/workflows/deploy.yml` builds on every push to `main` and publishes
`docs/` to GitHub Pages. Nothing else is needed — no build output is committed.

To point the site at a custom domain, add `docs/CNAME` (write it from
`build.js` so it survives rebuilds) and set the domain in the repository's
Pages settings.

## Editing content

All copy lives in `data/<lang>.json`; edit there and re-run `node build.js`.
`data/privacy.json` is a deliberate override that survives re-extraction — put
any other hand-edited copy in the same shape. The mirrored JSON is regenerated
from the live Wix site by:

```bash
node tools/fetch-pages.js    # mirror every page into cache/
node tools/extract.js        # cache/ -> data/*.json
node tools/fetch-assets.js   # download every referenced image (skips files already present)
node tools/fetch-maps.js     # read every map's centre/zoom off the live site
```

## The privacy policy

The original page is Wix's *template* text explaining how to write a privacy
policy — it is not one. `data/privacy.json` replaces it with a real policy in
all three languages, written from what this site actually does: a `mailto:`
call-request form, embedded Google Maps, a WhatsApp link, no analytics and no
cookies of its own.

It names the controller as შპს „ბალტიის ბიზნეს განვითარება“ (ID 400098078).
It still wants a lawyer's review. Update `updated` in that file whenever the
text changes — it is rendered as the "last updated" line.

## Known carry-overs from the original site

These are reproduced as they are on bbd.ge today, not bugs in the rebuild:

* The footer's Facebook / LinkedIn / YouTube links still point at Wix's own
  accounts (`facebook.com/WixStudio`, `linkedin.com/company/wix-com`,
  `youtube.com/user/Wix`).
* The home page "Let's work together" section still carries Wix placeholder
  copy in English on all three languages.
* The projects page year and work-type filters have no data behind them, so
  they only show their placeholder option. The status filter works.
* The Georgian and English pages list different office addresses.
* The floating WhatsApp button has no target on the live site; here it links to
  the published landline, which is not a WhatsApp number.
* The header is transparent and scrolls away with the page (it is not sticky) —
  that is how the original behaves, so on mobile the menu button also scrolls
  out of reach.
* The footer copyright reads "© 2035 by bbd.ge".
