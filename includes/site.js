// Load an HTML include into a placeholder element
async function loadInclude(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;
  const res = await fetch(url);
  if (!res.ok) return;
  el.outerHTML = await res.text();
}

// Resolve the correct path prefix depending on directory depth
function prefix() {
  // Case study pages sit at root alongside other pages, so no prefix needed.
  return '';
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Parse "prefix123,456suffix" into its parts, caching them on the element
// so later reads don't depend on the currently-displayed (possibly
// mid-animation) text.
function parseStatText(el) {
  const raw = el.textContent.trim();
  const match = raw.match(/[\d,]+/);
  if (!match) return null;
  const value = parseInt(match[0].replace(/,/g, ''), 10);
  if (isNaN(value)) return null;
  return {
    value,
    prefix: raw.slice(0, match.index),
    suffix: raw.slice(match.index + match[0].length),
  };
}

function formatStatValue(el, value) {
  return `${el.dataset.countPrefix}${value.toLocaleString('en-US')}${el.dataset.countSuffix}`;
}

// Animate a stat number counting up from 0 to its printed value, then
// invoke onComplete (used to kick off any live-incrementing stats)
function animateCount(el, onComplete) {
  const parsed = parseStatText(el);
  if (!parsed) return;
  el.dataset.countPrefix = parsed.prefix;
  el.dataset.countSuffix = parsed.suffix;
  el.dataset.countValue = parsed.value;

  const duration = 1100;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(parsed.value * eased);
    el.textContent = formatStatValue(el, current);
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else if (onComplete) {
      onComplete();
    }
  }
  requestAnimationFrame(tick);
}

// Swap el's text for newText with an odometer-style roll: the current
// value slides up and fades out while the new value slides in from below.
// Guards against overlapping rolls by snapping any in-flight roll to its
// end state first, so a fast-firing tick can never corrupt the display.
function rollStatText(el, newText) {
  if (reducedMotion) {
    el.textContent = newText;
    return;
  }

  if (el.dataset.rolling === '1') {
    el.classList.remove('is-rolling-active');
    el.style.height = '';
  }
  el.dataset.rolling = '1';

  const height = el.getBoundingClientRect().height;
  const currentText = el.dataset.rollingText || el.textContent;

  el.style.height = `${height}px`;
  el.innerHTML = '';

  const currentSpan = document.createElement('span');
  currentSpan.className = 'stat-roll-current';
  currentSpan.textContent = currentText;

  const incomingSpan = document.createElement('span');
  incomingSpan.className = 'stat-roll-incoming';
  incomingSpan.textContent = newText;

  el.append(currentSpan, incomingSpan);
  el.dataset.rollingText = newText;

  // Double rAF so the browser paints the starting position before the
  // transition-triggering class is added, otherwise the transition can
  // get coalesced away and the swap would just jump instantly.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.add('is-rolling-active');
  }));

  incomingSpan.addEventListener('transitionend', () => {
    el.textContent = newText;
    el.classList.remove('is-rolling-active');
    el.style.height = '';
    el.dataset.rolling = '';
    delete el.dataset.rollingText;
  }, { once: true });
}

// Bump a stat's printed number up by one, preserving its prefix/suffix
function bumpStat(el) {
  const current = parseInt(el.dataset.countValue, 10);
  if (isNaN(current)) return;
  const next = current + 1;
  el.dataset.countValue = next;
  rollStatText(el, formatStatValue(el, next));
}

// Count up each hero stat as it scrolls into view, then let any stat
// tagged with data-live-interval keep quietly ticking up forever after
function setupStatCounters() {
  const statEls = Array.from(document.querySelectorAll('.stat-number'));

  const startLiveIncrement = el => {
    const interval = parseInt(el.dataset.liveInterval, 10);
    if (!interval) return;
    setInterval(() => bumpStat(el), interval);
  };

  if (reducedMotion) {
    statEls.forEach(el => {
      const parsed = parseStatText(el);
      if (parsed) {
        el.dataset.countPrefix = parsed.prefix;
        el.dataset.countSuffix = parsed.suffix;
        el.dataset.countValue = parsed.value;
      }
      startLiveIncrement(el);
    });
    return;
  }

  const statObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target, () => startLiveIncrement(entry.target));
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });

  statEls.forEach(el => statObserver.observe(el));
}

// Fade/slide elements in as they enter the viewport
function setupScrollEffects() {
  const revealSelector = '.container > section, .cs-header, .cs-body section, .work-index-item, .cta-block';
  const revealEls = Array.from(document.querySelectorAll(revealSelector));
  revealEls.forEach(el => el.classList.add('reveal'));

  if (reducedMotion) {
    revealEls.forEach(el => el.classList.add('is-visible'));
    return;
  }

  // Anything already in (or near) the viewport on load should appear
  // immediately and quickly, not wait on a scroll-triggered observer;
  // that's reserved for content the user hasn't scrolled to yet.
  const viewportH = window.innerHeight;
  const initiallyVisible = [];
  const belowFold = [];
  revealEls.forEach(el => {
    const rect = el.getBoundingClientRect();
    (rect.top < viewportH * 0.92 ? initiallyVisible : belowFold).push(el);
  });

  initiallyVisible.forEach(el => el.classList.add('reveal--fast'));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    initiallyVisible.forEach(el => el.classList.add('is-visible'));
  }));

  belowFold.forEach((el, i) => {
    const delay = Math.min(i % 4, 3) * 90;
    el.style.transitionDelay = `${delay}ms`;
  });

  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  belowFold.forEach(el => revealObserver.observe(el));
}

// Wire up the dark-mode toggle button (theme is already applied pre-paint
// by the inline script in <head>; this just handles clicks going forward)
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const root = document.documentElement;

  const sync = () => {
    btn.setAttribute('aria-pressed', String(root.getAttribute('data-theme') === 'dark'));
  };
  sync();

  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    sync();
  });
}

// Hide the nav when scrolling down, reveal it when scrolling up
function setupStickyNav() {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;
  let lastScroll = window.scrollY;

  window.addEventListener('scroll', () => {
    const current = window.scrollY;
    nav.classList.toggle('nav-scrolled', current > 8);
    if (!reducedMotion) {
      if (current > lastScroll && current > 120) {
        nav.classList.add('nav-hidden');
      } else {
        nav.classList.remove('nav-hidden');
      }
    }
    lastScroll = current;
  }, { passive: true });
}

async function init() {
  const p = prefix();
  await loadInclude('#nav-placeholder',    p + 'includes/nav.html');
  await loadInclude('#footer-placeholder', p + 'includes/footer.html');

  // Set active nav link based on current filename
  const file = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a[data-page]').forEach(a => {
    const page = a.dataset.page;
    const isActive =
      (page === 'work'    && (file === 'work.html'    || file.startsWith('cs-'))) ||
      (page === 'about'   && file === 'about.html')  ||
      (page === 'contact' && file === 'contact.html');
    if (isActive) a.classList.add('active');
  });

  setupThemeToggle();
  setupStickyNav();
  setupScrollEffects();
  setupStatCounters();
}

document.addEventListener('DOMContentLoaded', init);
