/* Draws the site's maps with Leaflet and free OpenStreetMap-based tiles — no
   API key, no account and no billing, unlike the Google Maps JS API the
   original Wix site used under Wix's own enterprise licence.

   The behaviour matches the original: same centre and zoom, a marker, and a
   popup that opens on load carrying the project title and a Directions link.

   The tile layer is chosen by the build (data-tiles on each map element) so it
   can be pointed at a keyed provider later without touching this file. */
(function () {
  'use strict';

  var TILES = {
    // the default: no account, no key, no watermark
    osm: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    },
    // very light and free of POI clutter — closest in character to the original,
    // but CARTO watermarks unkeyed tiles, so this needs data-tiles-key
    carto: {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    },
    voyager: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function draw(el) {
    var cfg;
    try { cfg = JSON.parse(el.getAttribute('data-map')); } catch (e) { return; }

    var tiles = TILES[el.getAttribute('data-tiles')] || TILES.osm;
    var tileKey = el.getAttribute('data-tiles-key');
    var tileUrl = tiles.url + (tileKey ? '?api_key=' + encodeURIComponent(tileKey) : '');

    var map = L.map(el, {
      center: [cfg.lat, cfg.lng],
      zoom: cfg.zoom,
      zoomControl: false,          // the original hides the zoom buttons too
      scrollWheelZoom: false,      // never hijack the page scroll
      attributionControl: true
    });

    L.tileLayer(tileUrl, {
      subdomains: tiles.subdomains || 'abc',
      attribution: tiles.attribution,
      maxZoom: tiles.maxZoom,
      detectRetina: true
    }).addTo(map);

    // the projects with no location set in the CMS carry no marker, as on the original
    if (!cfg.title) return;

    var marker = L.marker([cfg.lat, cfg.lng], { title: cfg.title }).addTo(map);

    var html = '<b>' + esc(cfg.title) + '</b>';
    if (cfg.directions) {
      html += '<br><a href="' + esc(cfg.directions) + '" target="_blank" rel="noopener">'
        + esc(cfg.dirLabel || 'Directions') + '</a>';
    }
    marker.bindPopup(html, { closeButton: true }).openPopup();
  }

  function init() {
    var nodes = document.querySelectorAll('[data-map]');
    if (!nodes.length || typeof L === 'undefined') return;
    Array.prototype.forEach.call(nodes, draw);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
