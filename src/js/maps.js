/* Draws the site's Google Maps the way the original Wix site drew them:
   the same centre and zoom, Wix's style array (mint landscape, cyan water, no
   POI or transit, desaturated roads), a marker, and an info window that opens
   on load with the title and a Directions link.

   Loaded only when the build has a Maps JS API key; otherwise the pages carry
   a keyless <iframe> embed instead and this file is never requested. */
function bbdInitMaps() {
  var nodes = document.querySelectorAll('[data-gmap]');
  if (!nodes.length || !window.google || !google.maps) return;

  Array.prototype.forEach.call(nodes, function (el) {
    var cfg;
    try { cfg = JSON.parse(el.getAttribute('data-gmap')); } catch (e) { return; }

    var pos = { lat: cfg.lat, lng: cfg.lng };
    var map = new google.maps.Map(el, {
      center: pos,
      zoom: cfg.zoom,
      styles: window.BBD_MAP_STYLE || [],
      mapTypeControl: false,
      streetViewControl: false,
      zoomControl: false,
      keyboardShortcuts: false
    });

    if (!cfg.title) return; // the projects with no location set carry no marker

    var marker = new google.maps.Marker({ position: pos, map: map, title: cfg.title });

    var html = '<div class="gmap__info"><p><b>' + bbdEsc(cfg.title) + '</b></p>';
    if (cfg.directions) {
      html += '<p><a href="' + bbdEsc(cfg.directions) + '" target="_blank" rel="noopener">'
        + bbdEsc(cfg.dirLabel || 'Directions') + '</a></p>';
    }
    html += '</div>';

    var info = new google.maps.InfoWindow({ content: html });
    info.open({ anchor: marker, map: map });
    marker.addListener('click', function () { info.open({ anchor: marker, map: map }); });
  });
}

function bbdEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

window.bbdInitMaps = bbdInitMaps;
