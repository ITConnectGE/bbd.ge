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
src/
  css/style.css       the whole design system
  js/main.js          mobile nav, carousel, project filters, contact form
  assets/img          photos, icons, flags (downloaded from Wix, max 2000px)
  assets/fonts        FiraGO Book + Medium (SIL OFL), self-hosted
  assets/files        company-profile PDFs (ka / en / ru)
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
`npm install` (puppeteer + cheerio) and is only required when re-mirroring the
original site.

## Deploy

`.github/workflows/deploy.yml` builds on every push to `main` and publishes
`docs/` to GitHub Pages. Nothing else is needed — no build output is committed.

To point the site at a custom domain, add `docs/CNAME` (write it from
`build.js` so it survives rebuilds) and set the domain in the repository's
Pages settings.

## Editing content

All copy lives in `data/<lang>.json`; edit there and re-run `node build.js`.
The JSON is regenerated from the live Wix site by:

```bash
node tools/fetch-pages.js    # mirror every page into cache/
node tools/extract.js        # cache/ -> data/*.json
node tools/fetch-assets.js   # download every referenced image + the PDFs
```

## Known carry-overs from the original site

These are reproduced as they are on bbd.ge today, not bugs in the rebuild:

* The footer's Facebook / LinkedIn / YouTube links still point at Wix's own
  accounts (`facebook.com/WixStudio`, `linkedin.com/company/wix-com`,
  `youtube.com/user/Wix`).
* The home page "Let's work together" section still carries Wix placeholder
  copy in English on all three languages.
* The privacy policy is Wix's untranslated template text.
* The projects page year and work-type filters have no data behind them, so
  they only show their placeholder option. The status filter works.
* The Georgian and English pages list different office addresses.
* The floating WhatsApp button has no target on the live site; here it links to
  the published landline, which is not a WhatsApp number.
* The header is transparent and scrolls away with the page (it is not sticky) —
  that is how the original behaves, so on mobile the menu button also scrolls
  out of reach.
* The footer copyright reads "© 2035 by bbd.ge".
