// Kojo Adjei Couture — interaction layer

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var body = document.body;

  /* ── launch curtain ─────────────────────────────────────── */
  var curtain = document.getElementById('curtain');
  var enterBtn = document.getElementById('curtain-enter');
  var curtainTimer = null;
  var curtainDone = false;

  function dismissCurtain() {
    if (curtainDone || !curtain) return;
    curtainDone = true;
    clearTimeout(curtainTimer);
    curtain.classList.add('is-done');
    body.classList.remove('is-locked');
    setTimeout(function () {
      curtain.classList.add('is-hidden');
    }, reduceMotion ? 50 : 1250);
  }

  if (curtain) {
    if (enterBtn) enterBtn.addEventListener('click', dismissCurtain);
    curtain.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      dismissCurtain();
    });
    document.addEventListener('keydown', function (e) {
      if (!curtainDone && (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ')) {
        dismissCurtain();
      }
    });

    // the curtain holds for a few seconds before it lifts
    var curtainStart = Date.now();
    var hold = reduceMotion ? 700 : 4800;
    curtainTimer = setTimeout(dismissCurtain, hold);

    // only if the page is still loading artwork after the hold, give it a moment more
    window.addEventListener('load', function () {
      if (Date.now() - curtainStart < hold - 1200) return;
      clearTimeout(curtainTimer);
      curtainTimer = setTimeout(dismissCurtain, reduceMotion ? 200 : 1600);
    });
  }

  /* ── nav ────────────────────────────────────────────────── */
  var nav = document.getElementById('nav');
  var menuBtn = document.getElementById('menu-btn');
  var navLinks = document.getElementById('nav-links');
  var progress = document.getElementById('progress');

  function onScroll() {
    var y = window.scrollY;
    if (y > 16) nav.classList.add('is-scrolled');
    else nav.classList.remove('is-scrolled');

    var max = document.documentElement.scrollHeight - window.innerHeight;
    var pct = max > 0 ? Math.min(y / max, 1) : 0;
    if (progress) {
      progress.style.width = (pct * 100).toFixed(2) + '%';
      progress.classList.toggle('is-on', y > 40);
    }

    // gentle hero drift
    if (!reduceMotion) {
      var heroImg = document.querySelector('.hero-img-wrap img');
      if (heroImg && y < window.innerHeight * 1.4) {
        heroImg.style.setProperty('--shift', (y * 0.06).toFixed(1) + 'px');
      }
    }
  }

  function closeMenu() {
    navLinks.classList.remove('is-open');
    nav.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.querySelector('.menu-word').textContent = 'Menu';
  }

  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', function () {
      var open = !navLinks.classList.contains('is-open');
      navLinks.classList.toggle('is-open', open);
      nav.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.querySelector('.menu-word').textContent = open ? 'Close' : 'Menu';
    });

    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('is-open')) {
        closeMenu();
        menuBtn.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 880) closeMenu();
    });
  }

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── reveal on scroll ───────────────────────────────────── */
  var reveals = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    reveals.forEach(function (el) { revealObserver.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ── lightbox ───────────────────────────────────────────── */
  var lb = document.getElementById('lb');
  var lbImg = document.getElementById('lb-img');
  var lbCap = document.getElementById('lb-cap');
  var lbClose = document.getElementById('lb-close');
  var lbPrev = document.getElementById('lb-prev');
  var lbNext = document.getElementById('lb-next');
  var triggers = Array.prototype.slice.call(document.querySelectorAll('.look button'));
  var current = 0;
  var lastFocus = null;

  function show(index) {
    if (!triggers.length) return;
    current = (index + triggers.length) % triggers.length;
    var btn = triggers[current];
    var img = btn.querySelector('img');
    lbImg.src = btn.dataset.src;
    lbImg.alt = img ? img.alt : '';
    lbCap.textContent = btn.dataset.cap || '';
  }

  function openLb(index) {
    lastFocus = document.activeElement;
    show(index);
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    body.style.overflow = 'hidden';
    lbClose.focus();
  }

  function closeLb() {
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  if (lb && triggers.length) {
    triggers.forEach(function (btn, i) {
      btn.addEventListener('click', function () { openLb(i); });
    });

    lbClose.addEventListener('click', closeLb);
    lbPrev.addEventListener('click', function () { show(current - 1); });
    lbNext.addEventListener('click', function () { show(current + 1); });

    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLb();
    });

    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowRight') show(current + 1);
      if (e.key === 'ArrowLeft') show(current - 1);
    });
  }

  /* ── year ───────────────────────────────────────────────── */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
