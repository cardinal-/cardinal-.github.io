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

// Animate a stat number counting up from 0 to its printed value
function animateCount(el) {
  const raw = el.textContent.trim();
  const match = raw.match(/[\d,]+/);
  if (!match) return;
  const target = parseInt(match[0].replace(/,/g, ''), 10);
  if (isNaN(target)) return;
  const prefixText = raw.slice(0, match.index);
  const suffixText = raw.slice(match.index + match[0].length);
  const duration = 1100;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(target * eased);
    el.textContent = prefixText + current.toLocaleString('en-US') + suffixText;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Fade/slide elements in as they enter the viewport; count up stat numbers once
function setupScrollEffects() {
  const revealSelector = '.container > section, .cs-header, .cs-body section, .work-index-item, .cta-block';
  const revealEls = Array.from(document.querySelectorAll(revealSelector));
  revealEls.forEach(el => el.classList.add('reveal'));

  const statEls = Array.from(document.querySelectorAll('.stat-number'));

  if (reducedMotion) {
    revealEls.forEach(el => el.classList.add('is-visible'));
    return;
  }

  // Anything already in (or near) the viewport on load should appear
  // immediately and quickly, not wait on a scroll-triggered observer —
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

  const statObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });

  statEls.forEach(el => statObserver.observe(el));
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
}

document.addEventListener('DOMContentLoaded', init);
