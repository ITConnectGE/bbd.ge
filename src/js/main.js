/* BBD — site behaviour: mobile nav, scroll reveal, carousel, project filters, team "more". */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- mobile nav */
  var burger = document.querySelector('[data-burger]');
  var mobileNav = document.querySelector('[data-mobile-nav]');
  if (burger && mobileNav) {
    burger.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mobileNav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        mobileNav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  /* ---------------------------------------------------------------- language menu (touch) */
  var lang = document.querySelector('[data-lang]');
  if (lang) {
    var langBtn = lang.querySelector('.lang__btn');
    langBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      lang.classList.toggle('is-open');
    });
    document.addEventListener('click', function () { lang.classList.remove('is-open'); });
  }

  /* ---------------------------------------------------------------- scroll reveal */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      reveals.forEach(function (el) { io.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('is-in'); });
    }
  }

  /* ---------------------------------------------------------------- carousel */
  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    var track = root.querySelector('.carousel__track');
    var prev = root.querySelector('.carousel__nav--prev');
    var next = root.querySelector('.carousel__nav--next');
    if (!track) return;
    var step = function () {
      var first = track.firstElementChild;
      if (!first) return 400;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return first.getBoundingClientRect().width + gap;
    };
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    var sync = function () {
      var max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.style.opacity = track.scrollLeft <= 2 ? '.35' : '1';
      if (next) next.style.opacity = track.scrollLeft >= max ? '.35' : '1';
    };
    track.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    sync();
  });

  /* ---------------------------------------------------------------- project filters */
  var grid = document.querySelector('[data-projects-grid]');
  if (grid) {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-project]'));
    var empty = document.querySelector('[data-projects-empty]');
    var yearSel = document.querySelector('[data-filter-year]');
    var scopeSel = document.querySelector('[data-filter-scope]');
    var statusInputs = Array.prototype.slice.call(document.querySelectorAll('[data-filter-status]'));

    var apply = function () {
      var year = yearSel && yearSel.value ? yearSel.value : '';
      var scope = scopeSel && scopeSel.value ? scopeSel.value : '';
      var status = '';
      statusInputs.forEach(function (i) { if (i.checked) status = i.value; });
      var shown = 0;
      cards.forEach(function (c) {
        var ok = true;
        if (year && c.getAttribute('data-year') !== year) ok = false;
        if (scope && (c.getAttribute('data-scope') || '').split('|').indexOf(scope) === -1) ok = false;
        if (status && status !== 'all' && c.getAttribute('data-status') !== status) ok = false;
        c.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      if (empty) empty.hidden = shown !== 0;
    };
    if (yearSel) yearSel.addEventListener('change', apply);
    if (scopeSel) scopeSel.addEventListener('change', apply);
    statusInputs.forEach(function (i) { i.addEventListener('change', apply); });
    apply();
  }

  /* ---------------------------------------------------------------- team "more" */
  var teamMore = document.querySelector('[data-team-more]');
  if (teamMore) {
    teamMore.addEventListener('click', function () {
      var hidden = document.querySelectorAll('.team-card.is-hidden');
      if (hidden.length) {
        hidden.forEach(function (c) { c.classList.remove('is-hidden'); });
        teamMore.hidden = true;
      }
    });
  }

  /* ---------------------------------------------------------------- contact form */
  var form = document.querySelector('[data-contact-form]');
  if (form) {
    form.addEventListener('submit', function (e) {
      if (!form.checkValidity()) return;
      e.preventDefault();
      var fd = new FormData(form);
      var lines = [];
      fd.forEach(function (v, k) { if (v) lines.push(k + ': ' + v); });
      var to = form.getAttribute('data-mailto') || 'info@bbd.ge';
      var subject = form.getAttribute('data-subject') || 'Website enquiry';
      window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
    });
  }
})();
