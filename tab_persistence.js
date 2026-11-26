(function () {
  const STORAGE_KEY = 'aq_last_active_tab_v1';
  const KNOWN_TABS = ['BERANDA', 'SINYAL', 'GRAFIK', 'BOT AI'];

  function normalizeTabName(raw) {
    if (!raw) return null;
    const upper = raw.replace(/[#_-]/g, ' ').trim().toUpperCase();
    for (const tab of KNOWN_TABS) {
      if (upper === tab || upper.includes(tab)) return tab;
    }
    return null;
  }

  function findNavButtons() {
    const candidates = Array.from(document.querySelectorAll('nav button, nav a, .bottom-nav button, .bottom-nav a, [role="tab"], footer button, footer a'));
    const map = {};
    for (const el of candidates) {
      // Abaikan tombol di dalam Floating Radial Menu
      if (el.closest('#aq-radial-menu, .radial-menu, .fab-menu, [class*="radial"]')) continue;
      const tabName = normalizeTabName(el.textContent || el.getAttribute('data-tab') || el.getAttribute('aria-label'));
      if (tabName && !map[tabName]) {
        map[tabName] = el;
      }
    }
    return map;
  }

  function saveActiveTab(tabName) {
    const clean = normalizeTabName(tabName);
    if (!clean) return;
    localStorage.setItem(STORAGE_KEY, clean);
    const slug = clean.toLowerCase().replace(/\s+/g, '-');
    if (history.replaceState) {
      history.replaceState(null, '', '#' + slug);
    }
  }

  // Dengarkan setiap klik pada navigasi tab bawah
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, a, [role="tab"]');
    if (!btn) return;
    if (btn.closest('#aq-radial-menu, .radial-menu, .fab-menu, [class*="radial"]')) return;

    const tabName = normalizeTabName(btn.textContent || btn.getAttribute('data-tab') || btn.getAttribute('aria-label'));
    if (tabName) {
      saveActiveTab(tabName);
    }
  }, true);

  function restoreTabOnLoad() {
    const fromHash = normalizeTabName(window.location.hash);
    const fromStorage = normalizeTabName(localStorage.getItem(STORAGE_KEY));
    const targetTab = fromHash || fromStorage;

    if (!targetTab || targetTab === 'BERANDA') return;

    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      const navMap = findNavButtons();
      const targetBtn = navMap[targetTab];

      if (targetBtn) {
        targetBtn.click();
        // Trigger ulang sebentar kemudian untuk memastikan listener JS lain sudah siap
        setTimeout(() => targetBtn.click(), 120);
        clearInterval(timer);
      } else if (attempts >= 25) {
        clearInterval(timer);
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreTabOnLoad);
  } else {
    restoreTabOnLoad();
  }
})();
