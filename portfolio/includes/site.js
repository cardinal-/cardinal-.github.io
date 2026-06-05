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
}

document.addEventListener('DOMContentLoaded', init);
