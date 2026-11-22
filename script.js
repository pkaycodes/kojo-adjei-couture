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

  /* ── cookie / storage notice ────────────────────────────── */
  var consent = document.getElementById('consent');
  var CONSENT_KEY = 'kaj-consent';

  function readConsent() {
    try { return window.localStorage.getItem(CONSENT_KEY); } catch (err) { return null; }
  }

  if (consent && !readConsent()) {
    consent.hidden = false;
    consent.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-consent]');
      if (!btn) return;
      try {
        window.localStorage.setItem(CONSENT_KEY, btn.getAttribute('data-consent'));
      } catch (err) { /* private mode — the notice simply returns next visit */ }
      consent.hidden = true;
    });
  }

  /* ── enquiry form ───────────────────────────────────────── */
  var form = document.getElementById('enquiry-form');
  var WA_NUMBER = '233504343113';

  if (form) {
    var formLoadedAt = Date.now();
    var status = document.getElementById('ef-status');

    var fields = {
      name: {
        input: document.getElementById('ef-name'),
        err: document.getElementById('ef-name-err'),
        min: 2,
        message: 'Please tell us your name.'
      },
      email: {
        input: document.getElementById('ef-email'),
        err: document.getElementById('ef-email-err'),
        min: 0,
        message: 'Please enter a valid email address.'
      },
      message: {
        input: document.getElementById('ef-message'),
        err: document.getElementById('ef-message-err'),
        min: 10,
        message: 'A sentence or two is enough — at least 10 characters.'
      }
    };

    function validEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    }

    function check(field, key) {
      var value = field.input.value.trim();
      var bad = key === 'email' ? !validEmail(value) : value.length < field.min;
      field.err.textContent = bad ? field.message : '';
      field.input.closest('.field').classList.toggle('is-invalid', bad);
      field.input.setAttribute('aria-invalid', bad ? 'true' : 'false');
      return bad;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var firstBad = null;
      Object.keys(fields).forEach(function (key) {
        if (check(fields[key], key) && !firstBad) firstBad = fields[key].input;
      });

      if (firstBad) {
        status.textContent = 'Please check the highlighted fields.';
        firstBad.focus();
        return;
      }

      // Spam traps: the hidden field must stay empty, and a real person takes
      // more than a couple of seconds to fill three fields.
      var trap = document.getElementById('ef-company');
      if ((trap && trap.value) || Date.now() - formLoadedAt < 2500) {
        status.textContent = 'Thanks — your message is ready to send.';
        form.reset();
        return;
      }

      var body = 'Hello Kojo Adjei Couture — I\'d like to know when the collection launches.\n\n' +
        'Name: ' + fields.name.input.value.trim() + '\n' +
        'Email: ' + fields.email.input.value.trim() + '\n\n' +
        fields.message.input.value.trim();

      status.textContent = 'Opening WhatsApp with your message ready to send…';
      window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(body), '_blank', 'noopener');
    });

    Object.keys(fields).forEach(function (key) {
      var field = fields[key];
      field.input.addEventListener('blur', function () {
        if (field.input.value.trim()) check(field, key);
      });
      field.input.addEventListener('input', function () {
        if (field.input.closest('.field').classList.contains('is-invalid')) check(field, key);
      });
    });
  }

  /* ── year ───────────────────────────────────────────────── */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
